import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  computePlanExpiry,
  getAuthenticatedUserFromRequest,
  getDailyLimitForPackage,
  normalisePackageTier,
  normalizeRedeemCode,
  resolveSupabaseAuthUser,
  syncAdminUserFromAuthUser,
  syncSupabaseMetadataForAdminUser,
  toUserRecord,
} from "@/lib/admin";
import { getPrismaClient } from "@/lib/prisma";

export async function POST(request: Request) {
  const traceId = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const traceHeaders = {
    "X-ADQ-Trace-Id": traceId,
    "X-ADQ-Handler": "account-redeem",
    "X-ADQ-Build": process.env.NEXT_PUBLIC_APP_VERSION || "2.0.0",
  };

  try {
    const authUser = await getAuthenticatedUserFromRequest(request);
    if (!authUser) {
      console.log(`trace=${traceId} route=redeem auth=no status=401 result=UNAUTHORIZED`);
      return NextResponse.json(
        { error: "UNAUTHORIZED: Vui lòng đăng nhập lại.", code: "UNAUTHORIZED" },
        { status: 401, headers: traceHeaders }
      );
    }

    const payload = await request.json().catch(() => ({}));
    const rawInput = String(payload?.code ?? "").trim();
    const canonicalInput = normalizeRedeemCode(rawInput);

    if (!canonicalInput || canonicalInput.length < 3) {
      console.log(`trace=${traceId} route=redeem auth=yes status=400 result=INVALID_PAYLOAD`);
      return NextResponse.json(
        { error: "Vui lòng nhập mã kích hoạt hợp lệ.", code: "INVALID_CODE" },
        { status: 400, headers: traceHeaders }
      );
    }

    const redeemFp = crypto.createHash("sha256").update(canonicalInput).digest("hex").slice(0, 12);
    const prisma = getPrismaClient();
    const currentRecord = await syncAdminUserFromAuthUser(authUser);
    const userEmail = String(authUser.email ?? currentRecord.email ?? "").trim().toLowerCase();
    const userAuthId = authUser.id;

    // 1. Tra cứu mã trong Database: Thử tìm chính xác trước (indexed), sau đó fallback theo canonical normalization
    let redeemCode = await prisma.redeemCode.findUnique({
      where: { code: rawInput.toUpperCase() },
    });

    if (!redeemCode) {
      // Fallback: Tra cứu toàn diện qua canonical normalization
      const allRedeemCodes = await prisma.redeemCode.findMany();
      redeemCode =
        allRedeemCodes.find((rc) => normalizeRedeemCode(rc.code) === canonicalInput) || null;
    }

    if (!redeemCode) {
      console.log(`trace=${traceId} fp=${redeemFp} route=redeem auth=yes status=404 result=INVALID_CODE`);
      return NextResponse.json(
        { error: "Mã kích hoạt không tồn tại hoặc không hợp lệ.", code: "INVALID_CODE" },
        { status: 404, headers: traceHeaders }
      );
    }

    // 2. Kiểm tra trạng thái vô hiệu hóa (REVOKED)
    if (redeemCode.status === "REVOKED") {
      console.log(`trace=${traceId} fp=${redeemFp} route=redeem auth=yes status=400 result=REVOKED`);
      return NextResponse.json(
        { error: "Mã kích hoạt này đã bị vô hiệu hóa.", code: "REVOKED" },
        { status: 400, headers: traceHeaders }
      );
    }

    const packageTier = normalisePackageTier(redeemCode.packageTier);

    // 3. IDEMPOTENT SAME-USER RECOVERY:
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
        console.log(`trace=${traceId} fp=${redeemFp} route=redeem auth=yes status=400 result=EXPIRED_CODE`);
        return NextResponse.json(
          { error: "Gói kích hoạt từ mã này đã hết hạn sử dụng.", code: "EXPIRED_CODE" },
          { status: 400, headers: traceHeaders }
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

      console.log(`trace=${traceId} fp=${redeemFp} route=redeem auth=yes status=200 result=ALREADY_ACTIVE tier=${packageTier}`);
      return NextResponse.json(
        {
          ok: true,
          alreadyActive: true,
          recovered: true,
          code: "ALREADY_ACTIVE",
          message: `Gói ${packageTier.replace("_", " ")} đã được kích hoạt trước đó trên tài khoản của bạn.`,
          user: toUserRecord(updatedUser, authUser),
        },
        { headers: traceHeaders }
      );
    }

    // 4. Kiểm tra số lượt sử dụng đối với tài khoản khác
    if (redeemCode.status === "USED" || redeemCode.usedCount >= redeemCode.maxUses) {
      console.log(`trace=${traceId} fp=${redeemFp} route=redeem auth=yes status=400 result=ALREADY_USED`);
      return NextResponse.json(
        { error: "Mã kích hoạt đã được sử dụng hết số lượt.", code: "ALREADY_USED" },
        { status: 400, headers: traceHeaders }
      );
    }

    // 5. Thực hiện kích hoạt mới trong Atomic Transaction có bảo vệ Concurrency Guard
    const planExpiresAt = computePlanExpiry(redeemCode.durationDays, new Date());

    const result = await prisma.$transaction(async (tx) => {
      // Atomic capacity claim with conditional update
      const claim = await tx.redeemCode.updateMany({
        where: {
          id: redeemCode.id,
          status: { in: ["UNUSED", "PARTIAL"] },
          usedCount: { lt: redeemCode.maxUses },
        },
        data: {
          usedCount: { increment: 1 },
          activatedBy: userEmail,
        },
      });

      if (claim.count === 0) {
        throw new Error("CAPACITY_EXHAUSTED");
      }

      // Check if new usedCount reaches maxUses, update status accordingly
      const freshCode = await tx.redeemCode.findUnique({
        where: { id: redeemCode.id },
      });
      if (freshCode && freshCode.usedCount >= freshCode.maxUses) {
        await tx.redeemCode.update({
          where: { id: redeemCode.id },
          data: { status: "USED" },
        });
      } else if (freshCode && freshCode.usedCount > 0) {
        await tx.redeemCode.update({
          where: { id: redeemCode.id },
          data: { status: "PARTIAL" },
        });
      }

      // Create unique redemption record
      await tx.redeemCodeRedemption.create({
        data: {
          redeemCodeId: redeemCode.id,
          userAuthId,
          userEmail,
        },
      });

      // Update user entitlement
      const updatedUser = await tx.adminUser.update({
        where: { id: currentRecord.id },
        data: {
          authUserId: userAuthId,
          email: userEmail,
          packageTier,
          dailyLimit: getDailyLimitForPackage(packageTier),
          planExpiresAt,
          status: currentRecord.status === "LOCKED" ? "LOCKED" : "ACTIVE",
        },
      });

      return updatedUser;
    });

    // 6. Best-effort async synchronization sang Supabase Auth metadata
    try {
      const resolvedAuthUser = await resolveSupabaseAuthUser({
        authUserId: result.authUserId,
        email: result.email,
      });

      if (resolvedAuthUser?.id) {
        await syncSupabaseMetadataForAdminUser({
          authUserId: resolvedAuthUser.id,
          name: result.name,
          role: result.role === "ADMIN" ? "ADMIN" : "USER",
          packageTier,
          status: result.status === "LOCKED" ? "LOCKED" : "ACTIVE",
          planExpiresAt: planExpiresAt ? planExpiresAt.toISOString() : null,
        });
      }
    } catch (metaErr) {
      console.error("[redeem] Package activated but Supabase metadata sync failed:", metaErr);
    }

    console.log(`trace=${traceId} fp=${redeemFp} route=redeem auth=yes status=200 result=VALID_ACTIVATED tier=${packageTier}`);
    return NextResponse.json(
      {
        ok: true,
        code: "VALID_ACTIVATED",
        message: `Kích hoạt gói ${packageTier.replace("_", " ")} thành công.`,
        user: toUserRecord(result, authUser),
      },
      { headers: traceHeaders }
    );
  } catch (error: any) {
    if (error?.message === "CAPACITY_EXHAUSTED") {
      return NextResponse.json(
        { error: "Mã kích hoạt đã được sử dụng hết số lượt.", code: "ALREADY_USED" },
        { status: 400, headers: traceHeaders }
      );
    }
    console.error(`trace=${traceId} route=redeem auth=error status=500 result=SERVER_ERROR`, error?.message);
    return NextResponse.json(
      {
        error: "Lỗi máy chủ khi kích hoạt mã. Vui lòng thử lại sau.",
        code: "SERVER_ERROR",
        detail: error?.message,
      },
      { status: 500, headers: traceHeaders }
    );
  }
}

