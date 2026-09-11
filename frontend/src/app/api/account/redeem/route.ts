import { NextResponse } from "next/server";
import {
  computePlanExpiry,
  getAuthenticatedUserFromRequest,
  getDailyLimitForPackage,
  normalisePackageTier,
  resolveSupabaseAuthUser,
  syncAdminUserFromAuthUser,
  syncSupabaseMetadataForAdminUser,
  toUserRecord,
} from "@/lib/admin";
import { getPrismaClient } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const authUser = await getAuthenticatedUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: Vui lòng đăng nhập lại.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const payload = await request.json().catch(() => ({}));
    const code = String(payload?.code ?? "").trim().toUpperCase();
    if (!code || code.length < 3) {
      return NextResponse.json(
        { error: "Vui lòng nhập mã kích hoạt hợp lệ.", code: "INVALID_CODE" },
        { status: 400 }
      );
    }

    const prisma = getPrismaClient();
    const currentRecord = await syncAdminUserFromAuthUser(authUser);
    const userEmail = String(authUser.email ?? currentRecord.email ?? "").trim().toLowerCase();
    const userAuthId = authUser.id;

    // 1. Tra cứu mã trong Database với chuẩn hóa linh hoạt toàn diện (casing, spaces, PROMAX vs PRO_MAX, hyphens, alphanumeric canonicalization)
    const normalizeKey = (s: string) =>
      s
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .replace(/PRO_MAX/g, "PROMAX");

    const targetKey = normalizeKey(code);

    const allRedeemCodes = await prisma.redeemCode.findMany();
    const redeemCode = allRedeemCodes.find(
      (rc) =>
        rc.code.trim().toUpperCase() === code ||
        normalizeKey(rc.code) === targetKey ||
        rc.code.replace(/_/g, "-").toUpperCase() === code.replace(/_/g, "-").toUpperCase()
    );
    if (!redeemCode) {
      return NextResponse.json(
        { error: "Mã kích hoạt không tồn tại trên hệ thống.", code: "INVALID_CODE" },
        { status: 404 }
      );
    }

    if (redeemCode.status === "REVOKED") {
      return NextResponse.json(
        { error: "Mã kích hoạt này đã bị vô hiệu hóa.", code: "REVOKED" },
        { status: 400 }
      );
    }

    const packageTier = normalisePackageTier(redeemCode.packageTier);

    // 2. IDEMPOTENT SAME-USER RECOVERY:
    // Kiểm tra xem chính tài khoản này đã từng kích hoạt mã này trước đây chưa
    const existedRedemption = await prisma.redeemCodeRedemption.findFirst({
      where: {
        redeemCodeId: redeemCode.id,
        OR: [
          { userAuthId },
          { userEmail },
        ],
      },
    });

    if (existedRedemption) {
      // Tính hạn dùng từ lần kích hoạt trước đó
      const durationDays = redeemCode.durationDays;
      let computedExpiry: Date | null = null;
      if (durationDays) {
        computedExpiry = new Date(
          new Date(existedRedemption.createdAt).getTime() + durationDays * 86400000
        );
      }

      const isExpired = computedExpiry ? computedExpiry.getTime() <= Date.now() : false;
      if (isExpired) {
        return NextResponse.json(
          { error: "Gói kích hoạt từ mã này đã hết hạn sử dụng.", code: "EXPIRED_CODE" },
          { status: 400 }
        );
      }

      // Khôi phục và đồng bộ lại quyền lợi PRO/PRO_MAX bền vững cho tài khoản
      const updatedUser = await prisma.adminUser.update({
        where: { id: currentRecord.id },
        data: {
          authUserId: userAuthId,
          email: userEmail,
          packageTier,
          dailyLimit: getDailyLimitForPackage(packageTier),
          planExpiresAt: computedExpiry,
          status: currentRecord.status === "LOCKED" ? "LOCKED" : "ACTIVE",
        },
      });

      // Đồng bộ Supabase metadata
      syncSupabaseMetadataForAdminUser({
        authUserId: userAuthId,
        name: updatedUser.name,
        role: updatedUser.role === "ADMIN" ? "ADMIN" : "USER",
        packageTier,
        status: updatedUser.status === "LOCKED" ? "LOCKED" : "ACTIVE",
        planExpiresAt: computedExpiry ? computedExpiry.toISOString() : null,
      }).catch(() => {});

      return NextResponse.json({
        ok: true,
        recovered: true,
        message: "Gói này đã được kích hoạt trên tài khoản của bạn.",
        user: toUserRecord(updatedUser, authUser),
      });
    }

    // 3. Kiểm tra số lượt sử dụng đối với tài khoản khác
    if (redeemCode.status === "USED" || redeemCode.usedCount >= redeemCode.maxUses) {
      return NextResponse.json(
        { error: "Mã kích hoạt đã được sử dụng hết số lượt.", code: "ALREADY_USED" },
        { status: 400 }
      );
    }

    // 4. Thực hiện kích hoạt mới trong Atomic Transaction
    const planExpiresAt = computePlanExpiry(redeemCode.durationDays, new Date());

    const [updatedUser] = await prisma.$transaction([
      prisma.adminUser.update({
        where: { id: currentRecord.id },
        data: {
          authUserId: userAuthId,
          email: userEmail,
          packageTier,
          dailyLimit: getDailyLimitForPackage(packageTier),
          planExpiresAt,
          status: currentRecord.status === "LOCKED" ? "LOCKED" : "ACTIVE",
        },
      }),
      prisma.redeemCodeRedemption.create({
        data: {
          redeemCodeId: redeemCode.id,
          userAuthId,
          userEmail,
        },
      }),
      prisma.redeemCode.update({
        where: { id: redeemCode.id },
        data: {
          usedCount: { increment: 1 },
          activatedBy: userEmail,
          status: redeemCode.usedCount + 1 >= redeemCode.maxUses ? "USED" : "PARTIAL",
        },
      }),
    ]);

    // 5. Best-effort async synchronization sang Supabase Auth metadata
    try {
      const resolvedAuthUser = await resolveSupabaseAuthUser({
        authUserId: updatedUser.authUserId,
        email: updatedUser.email,
      });

      if (resolvedAuthUser?.id) {
        await syncSupabaseMetadataForAdminUser({
          authUserId: resolvedAuthUser.id,
          name: updatedUser.name,
          role: updatedUser.role === "ADMIN" ? "ADMIN" : "USER",
          packageTier,
          status: updatedUser.status === "LOCKED" ? "LOCKED" : "ACTIVE",
          planExpiresAt: planExpiresAt ? planExpiresAt.toISOString() : null,
        });
      }
    } catch (metadataError) {
      console.error(
        "[redeem] Package activated but Supabase metadata sync failed:",
        metadataError
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Kích hoạt gói thành công.",
      user: toUserRecord(updatedUser, authUser),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Không thể kích hoạt mã nâng cấp.", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
