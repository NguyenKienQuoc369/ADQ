import { NextResponse } from "next/server";

import {
  createRandomPassword,
  findSupabaseAuthUserByEmail,
  getDailyLimitForPackage,
  normalisePackageTier,
  normaliseRole,
  normaliseStatus,
  requireAdminRequest,
  syncAdminUserFromAuthUser,
  syncAllAuthUsersIntoAdminUsers,
  syncSupabaseMetadataForAdminUser,
  toUserRecord,
  computePlanExpiry,
} from "@/lib/admin";
import { getPrismaClient } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    await requireAdminRequest();

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") ?? "").trim();
    const roleFilter = (searchParams.get("role") ?? "ALL") as "ALL" | "USER" | "ADMIN";
    const packageFilter = (searchParams.get("packageTier") ?? "ALL") as "ALL" | "FREE" | "PRO" | "PRO_MAX";

    await syncAllAuthUsersIntoAdminUsers();

    const prisma = getPrismaClient();
    const rows = await prisma.adminUser.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(roleFilter !== "ALL" ? { role: roleFilter } : {}),
        ...(packageFilter !== "ALL" ? { packageTier: packageFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users: rows.map(toUserRecord) });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (error?.code === "P2021" || /does not exist|admin_users|table/i.test(String(error?.message ?? ""))) {
      return NextResponse.json({ users: [] });
    }
    return NextResponse.json({ error: error?.message ?? "Failed to load admin users." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminRequest();

    const payload = await request.json();
    const email = String(payload?.email ?? "")
      .trim()
      .toLowerCase();
    const name = String(payload?.name ?? "").trim();
    const nextRole = normaliseRole(payload?.role ?? "USER");
    const nextPackage = normalisePackageTier(payload?.packageTier ?? "FREE");
    const nextStatus = normaliseStatus(payload?.status ?? "ACTIVE");
    const providedPassword = String(payload?.password ?? "").trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
    }

    const dailyLimit = Number(payload?.dailyLimit ?? getDailyLimitForPackage(nextPackage));
    const password = providedPassword || createRandomPassword(14);

    const adminClient = createSupabaseAdminClient();
    let authUser = await findSupabaseAuthUserByEmail(email);
    let temporaryPassword: string | null = null;

    if (authUser) {
      await syncSupabaseMetadataForAdminUser({
        authUserId: authUser.id,
        name: name || authUser.user_metadata?.name || null,
        role: nextRole,
        packageTier: nextPackage,
        status: nextStatus,
        ...(providedPassword ? { password } : {}),
      });
      authUser = (await findSupabaseAuthUserByEmail(email)) ?? authUser;
      if (providedPassword) {
        temporaryPassword = password;
      }
    } else {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          role: nextRole,
          packageTier: nextPackage,
          status: nextStatus,
        },
        app_metadata: {
          role: nextRole,
          packageTier: nextPackage,
          status: nextStatus,
        },
      });

      if (error || !data.user) {
        return NextResponse.json({ error: error?.message ?? "Không thể tạo tài khoản Auth." }, { status: 500 });
      }

      authUser = data.user;
      temporaryPassword = password;
    }

    // compute default plan expiry if not provided: PRO -> 30 days, PRO_MAX -> 365 days, FREE -> null
    const defaultDurationDays = nextPackage === "PRO" ? 30 : nextPackage === "PRO_MAX" ? 365 : null;
    const defaultPlanExpiresAt = payload?.planExpiresAt ? new Date(payload.planExpiresAt) : defaultDurationDays !== null ? computePlanExpiry(defaultDurationDays) : null;

    const record = await syncAdminUserFromAuthUser(authUser, {
      name: name || undefined,
      email,
      role: nextRole,
      packageTier: nextPackage,
      status: nextStatus,
      dailyLimit,
      scansToday: Number(payload?.scansToday ?? 0),
      telegramConnected: Boolean(payload?.telegramConnected),
      planExpiresAt: defaultPlanExpiresAt,
      oauthProvider: payload?.oauthProvider === "google" ? "google" : null,
    });

    return NextResponse.json({
      user: toUserRecord(record),
      temporaryPassword,
      linkedExistingAuthUser: Boolean(authUser) && temporaryPassword === null,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (error?.code === "P2021" || /does not exist|admin_users|table/i.test(String(error?.message ?? ""))) {
      return NextResponse.json({ user: null, error: "User table chưa được tạo. Chạy prisma db push hoặc migration." }, { status: 500 });
    }
    return NextResponse.json({ error: error?.message ?? "Failed to create admin user." }, { status: 500 });
  }
}
