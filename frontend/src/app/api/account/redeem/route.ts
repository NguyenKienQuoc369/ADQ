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

const MASTER_PRO_MAX_CODES = new Set([
  "ADQ-PROMAX-E5N7D",
  "ADQ-PROMAX-VIP",
  "PROMAX-VIP",
  "VIP-PROMAX",
  "ADQPROMAX",
  "PROMAX999",
]);

export async function POST(request: Request) {
  try {
    const authUser = await getAuthenticatedUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: "UNAUTHORIZED: Vui lòng đăng nhập lại." }, { status: 401 });
    }

    const payload = await request.json();
    const code = String(payload?.code ?? "").trim().toUpperCase();
    if (code.length < 3) {
      return NextResponse.json({ error: "Mã kích hoạt không hợp lệ." }, { status: 400 });
    }

    const prisma = getPrismaClient();
    const currentRecord = await syncAdminUserFromAuthUser(authUser);

    // MÃ CỐ ĐỊNH VIP PRO MAX
    if (MASTER_PRO_MAX_CODES.has(code)) {
      const packageTier = "PRO_MAX";
      const planExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      const updatedUser = await prisma.adminUser.update({
        where: { id: currentRecord.id },
        data: {
          authUserId: authUser.id,
          packageTier,
          dailyLimit: getDailyLimitForPackage(packageTier) || 999999,
          planExpiresAt,
          status: currentRecord.status === "LOCKED" ? "LOCKED" : "ACTIVE",
        },
      });

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
        });
      }

      return NextResponse.json({
        ok: true,
        message: "Kích hoạt gói PRO MAX thành công (Thời hạn 1 năm)!",
        user: toUserRecord(updatedUser),
      });
    }

    // MÃ TỪ DATABASE
    const redeemCode = await prisma.redeemCode.findUnique({ where: { code } });
    if (!redeemCode) {
      return NextResponse.json({ error: "Mã kích hoạt không tồn tại trên hệ thống." }, { status: 404 });
    }

    if (redeemCode.status === "USED" || redeemCode.usedCount >= redeemCode.maxUses) {
      return NextResponse.json({ error: "Mã kích hoạt đã được sử dụng hết số lượt." }, { status: 400 });
    }

    const userEmail = String(authUser.email ?? "").trim().toLowerCase();
    const existedRedemption = await prisma.redeemCodeRedemption.findUnique({
      where: {
        redeemCodeId_userEmail: {
          redeemCodeId: redeemCode.id,
          userEmail,
        },
      },
    });

    if (existedRedemption) {
      return NextResponse.json({ error: "Tài khoản này đã dùng mã này rồi." }, { status: 409 });
    }

    const packageTier = normalisePackageTier(redeemCode.packageTier);
    const planExpiresAt = computePlanExpiry(redeemCode.durationDays, new Date());

    const [updatedUser] = await prisma.$transaction([
      prisma.adminUser.update({
        where: { id: currentRecord.id },
        data: {
          authUserId: authUser.id,
          packageTier,
          dailyLimit: getDailyLimitForPackage(packageTier),
          planExpiresAt,
          status: currentRecord.status === "LOCKED" ? "LOCKED" : "ACTIVE",
        },
      }),
      prisma.redeemCodeRedemption.create({
        data: {
          redeemCodeId: redeemCode.id,
          userAuthId: authUser.id,
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
      });
    }

    return NextResponse.json({ user: toUserRecord(updatedUser) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Không thể kích hoạt mã nâng cấp." }, { status: 500 });
  }
}
