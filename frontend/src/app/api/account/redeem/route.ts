import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  computePlanExpiry,
  getDailyLimitForPackage,
  normalisePackageTier,
  resolveSupabaseAuthUser,
  syncAdminUserFromAuthUser,
  syncSupabaseMetadataForAdminUser,
  toUserRecord,
} from "@/lib/admin";
import { getPrismaClient } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    let authUser: any = null;

    try {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();
      authUser = data.user ?? null;
    } catch {
      authUser = null;
    }

    if (!authUser) {
      const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (url && anonKey && token) {
          const client = createClient(url, anonKey);
          try {
            (client.auth as any).setAuth(token);
            const { data } = await client.auth.getUser();
            authUser = data.user ?? null;
          } catch {
            authUser = null;
          }
        }
      }
    }

    if (!authUser) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const payload = await request.json();
    const code = String(payload?.code ?? "").trim().toUpperCase();
    if (code.length < 4) {
      return NextResponse.json({ error: "Mã kích hoạt không hợp lệ." }, { status: 400 });
    }

    const prisma = getPrismaClient();
    const redeemCode = await prisma.redeemCode.findUnique({
      where: { code },
    });

    if (!redeemCode) {
      return NextResponse.json({ error: "Mã kích hoạt không tồn tại." }, { status: 404 });
    }

    if (redeemCode.status === "USED" || redeemCode.usedCount >= redeemCode.maxUses) {
      return NextResponse.json({ error: "Mã kích hoạt đã được sử dụng hết." }, { status: 400 });
    }

    const userEmail = String(authUser.email ?? "")
      .trim()
      .toLowerCase();
    if (!userEmail) {
      return NextResponse.json({ error: "Tài khoản hiện tại không có email hợp lệ." }, { status: 400 });
    }

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

    const currentRecord = await syncAdminUserFromAuthUser(authUser);
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
        status: updatedUser.status === "LOCKED" ? "LOCKED" : updatedUser.status === "PENDING" ? "PENDING" : "ACTIVE",
      });
    }

    return NextResponse.json({ user: toUserRecord(updatedUser) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Không thể kích hoạt mã nâng cấp." }, { status: 500 });
  }
}
