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
    const roleFilter = (searchParams.get("role") ?? "ALL") as
      | "ALL"
      | "USER"
      | "ADMIN";

    const packageFilter = (
      searchParams.get("packageTier") ?? "ALL"
    ) as "ALL" | "FREE" | "PRO" | "PRO_MAX";

    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") ?? "1", 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(searchParams.get("limit") ?? "25", 10) || 25
      )
    );

    /*
     * Không sync toàn bộ Supabase Auth ở mỗi GET nữa.
     *
     * Nếu admin thật sự muốn reconcile Auth -> DB:
     * /api/admin/users?sync=1
     */
    if (searchParams.get("sync") === "1") {
      await syncAllAuthUsersIntoAdminUsers();
    }

    const prisma = getPrismaClient();

    const where = {
      ...(search
        ? {
            OR: [
              {
                email: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                name: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
      ...(roleFilter !== "ALL"
        ? { role: roleFilter }
        : {}),
      ...(packageFilter !== "ALL"
        ? { packageTier: packageFilter }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [
      rows,
      total,
      totalUsers,
      freeUsers,
      proUsers,
      proMaxUsers,
      adminUsers,
    ] = await Promise.all([
      prisma.adminUser.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),

      prisma.adminUser.count({ where }),

      prisma.adminUser.count(),

      prisma.adminUser.count({
        where: { packageTier: "FREE" },
      }),

      prisma.adminUser.count({
        where: { packageTier: "PRO" },
      }),

      prisma.adminUser.count({
        where: { packageTier: "PRO_MAX" },
      }),

      prisma.adminUser.count({
        where: { role: "ADMIN" },
      }),
    ]);

    const totalPages = Math.max(
      1,
      Math.ceil(total / limit)
    );

    return NextResponse.json({
      users: rows.map((u) => toUserRecord(u)),

      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },

      summary: {
        totalUsers,
        freeUsers,
        proUsers,
        proMaxUsers,
        adminUsers,
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (error?.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    if (
      error?.code === "P2021" ||
      /does not exist|admin_users|table/i.test(
        String(error?.message ?? "")
      )
    ) {
      return NextResponse.json({
        users: [],
        pagination: {
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        summary: {
          totalUsers: 0,
          freeUsers: 0,
          proUsers: 0,
          proMaxUsers: 0,
          adminUsers: 0,
        },
      });
    }

    return NextResponse.json(
      {
        error:
          error?.message ??
          "Failed to load admin users.",
      },
      { status: 500 }
    );
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
