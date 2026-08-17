import type { User as SupabaseUser } from "@supabase/supabase-js";

import { getPrismaClient } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppRole = "USER" | "ADMIN";
export type AppPackageTier = "FREE" | "PRO" | "PRO_MAX";
export type AppStatus = "ACTIVE" | "PENDING" | "LOCKED";

export function normaliseRole(value?: string | null): AppRole {
  return String(value ?? "").trim().toUpperCase() === "ADMIN" ? "ADMIN" : "USER";
}

export function normalisePackageTier(value?: string | null): AppPackageTier {
  const upper = String(value ?? "").trim().toUpperCase();
  if (upper === "PRO_MAX") return "PRO_MAX";
  if (upper === "PRO") return "PRO";
  return "FREE";
}

export function normaliseStatus(value?: string | null): AppStatus {
  const upper = String(value ?? "").trim().toUpperCase();
  if (upper === "LOCKED") return "LOCKED";
  if (upper === "PENDING") return "PENDING";
  return "ACTIVE";
}

export function getDailyLimitForPackage(packageTier: AppPackageTier) {
  if (packageTier === "PRO") return 25;
  if (packageTier === "PRO_MAX") return 100;
  return 5;
}

export function toUserRecord(row: any) {
  return {
    id: String(row.id),
    authUserId: row.authUserId ? String(row.authUserId) : null,
    name: row.name ?? row.email?.split("@")[0] ?? "Người dùng",
    email: String(row.email ?? ""),
    avatar: undefined,
    role: normaliseRole(row.role),
    packageTier: normalisePackageTier(row.packageTier),
    status: normaliseStatus(row.status),
    dailyLimit: Number(row.dailyLimit ?? getDailyLimitForPackage(normalisePackageTier(row.packageTier))),
    scansToday: Number(row.scansToday ?? 0),
    telegramConnected: Boolean(row.telegramConnected),
    planExpiresAt: row.planExpiresAt ? new Date(row.planExpiresAt).toISOString() : null,
    oauthProvider: row.oauthProvider === "google" ? "google" : null,
    lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt).toISOString() : new Date().toISOString(),
  };
}

export function toRedeemCodeRecord(row: any) {
  const status = row.status === "USED" ? "USED" : row.status === "PARTIAL" ? "PARTIAL" : "UNUSED";
  return {
    id: String(row.id),
    code: String(row.code),
    packageTier: normalisePackageTier(row.packageTier),
    durationLabel: String(row.durationLabel),
    maxUses: Number(row.maxUses ?? 1),
    usedCount: Number(row.usedCount ?? 0),
    status,
    activatedBy: row.activatedBy ? String(row.activatedBy) : null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export async function requireAdminRequest() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("UNAUTHORIZED");
  }

  const role = normaliseRole(
    data.user.user_metadata?.role ??
      (data.user.app_metadata as Record<string, unknown> | undefined)?.role ??
      (data.user as any).raw_user_meta_data?.role ??
      (data.user as any).raw_app_meta_data?.role,
  );

  if (role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }

  return data.user;
}

export async function getCurrentRequestUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }
  return data.user;
}

export async function listAllSupabaseAuthUsers() {
  const admin = createSupabaseAdminClient();
  const users: SupabaseUser[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(error.message);
    }

    const batch = data?.users ?? [];
    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
    if (page > 50) {
      break;
    }
  }

  return users;
}

export async function findSupabaseAuthUserByEmail(email: string) {
  const normalisedEmail = email.trim().toLowerCase();
  if (!normalisedEmail) return null;
  const users = await listAllSupabaseAuthUsers();
  return users.find((user) => (user.email ?? "").trim().toLowerCase() === normalisedEmail) ?? null;
}

export async function getSupabaseAuthUserById(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    return null;
  }
  return data.user ?? null;
}

export async function resolveSupabaseAuthUser(record: { authUserId?: string | null; email: string }) {
  if (record.authUserId) {
    const userById = await getSupabaseAuthUserById(record.authUserId);
    if (userById) return userById;
  }

  return findSupabaseAuthUserByEmail(record.email);
}

export async function syncAdminUserFromAuthUser(authUser: SupabaseUser, fallback?: Partial<any>) {
  const prisma = getPrismaClient();
  const email = (authUser.email ?? fallback?.email ?? "").trim().toLowerCase();
  if (!email) {
    throw new Error("Auth user không có email hợp lệ.");
  }

  const role = normaliseRole(
    fallback?.role ??
      authUser.user_metadata?.role ??
      (authUser.app_metadata as Record<string, unknown> | undefined)?.role,
  );
  const packageTier = normalisePackageTier(
    fallback?.packageTier ??
      authUser.user_metadata?.packageTier ??
      (authUser.app_metadata as Record<string, unknown> | undefined)?.packageTier,
  );
  const status = normaliseStatus(fallback?.status ?? "ACTIVE");
  const name =
    (fallback?.name as string | undefined) ??
    (authUser.user_metadata?.name as string | undefined) ??
    (authUser.user_metadata?.full_name as string | undefined) ??
    authUser.email?.split("@")[0] ??
    "Người dùng";

  const existing = await prisma.adminUser.findFirst({
    where: {
      OR: [{ authUserId: authUser.id }, { email }],
    },
  });

  if (existing) {
    return prisma.adminUser.update({
      where: { id: existing.id },
      data: {
        authUserId: authUser.id,
        email,
        name,
        role,
        packageTier,
        status,
        dailyLimit: Number(fallback?.dailyLimit ?? existing.dailyLimit ?? getDailyLimitForPackage(packageTier)),
        scansToday: Number(fallback?.scansToday ?? existing.scansToday ?? 0),
        telegramConnected: Boolean(fallback?.telegramConnected ?? existing.telegramConnected ?? false),
        planExpiresAt: fallback?.planExpiresAt !== undefined ? (fallback.planExpiresAt as Date | null) : existing.planExpiresAt,
        oauthProvider:
          typeof fallback?.oauthProvider === "string"
            ? String(fallback.oauthProvider)
            : ((authUser.app_metadata as Record<string, unknown> | undefined)?.provider as string | undefined) ??
              ((authUser.user_metadata?.provider as string | undefined) ?? null),
        lastLoginAt: authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at) : existing.lastLoginAt ?? new Date(),
      },
    });
  }

  return prisma.adminUser.create({
    data: {
      authUserId: authUser.id,
      email,
      name,
      role,
      packageTier,
      status,
      dailyLimit: Number(fallback?.dailyLimit ?? getDailyLimitForPackage(packageTier)),
      scansToday: Number(fallback?.scansToday ?? 0),
      telegramConnected: Boolean(fallback?.telegramConnected ?? false),
      planExpiresAt: (fallback?.planExpiresAt as Date | null | undefined) ?? null,
      oauthProvider:
        typeof fallback?.oauthProvider === "string"
          ? String(fallback.oauthProvider)
          : ((authUser.app_metadata as Record<string, unknown> | undefined)?.provider as string | undefined) ??
            ((authUser.user_metadata?.provider as string | undefined) ?? null),
      lastLoginAt: authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at) : new Date(),
    },
  });
}

export async function syncAllAuthUsersIntoAdminUsers() {
  const users = await listAllSupabaseAuthUsers();
  for (const authUser of users) {
    if (!authUser.email) continue;
    await syncAdminUserFromAuthUser(authUser);
  }
}

export async function syncSupabaseMetadataForAdminUser(input: {
  authUserId: string;
  name?: string | null;
  role: AppRole;
  packageTier: AppPackageTier;
  status?: AppStatus;
  password?: string;
}) {
  const admin = createSupabaseAdminClient();
  const existing = await getSupabaseAuthUserById(input.authUserId);
  if (!existing) {
    throw new Error("Không tìm thấy tài khoản Auth tương ứng.");
  }

  const nextUserMetadata = {
    ...(existing.user_metadata ?? {}),
    ...(input.name ? { name: input.name } : {}),
    role: input.role,
    packageTier: input.packageTier,
    status: input.status ?? normaliseStatus((existing.user_metadata as any)?.status),
  };

  const nextAppMetadata = {
    ...(existing.app_metadata ?? {}),
    role: input.role,
    packageTier: input.packageTier,
    status: input.status ?? normaliseStatus((existing.app_metadata as any)?.status),
  };

  const { error } = await admin.auth.admin.updateUserById(input.authUserId, {
    ...(input.password ? { password: input.password } : {}),
    user_metadata: nextUserMetadata,
    app_metadata: nextAppMetadata,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function parseDurationLabelToDays(durationLabel: string) {
  const raw = durationLabel.trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("vĩnh viễn") || raw.includes("permanent") || raw.includes("forever") || raw.includes("lifetime")) {
    return null;
  }

  const match = raw.match(/(\d+)/);
  if (!match) return null;

  const value = Number(match[1]);
  if (Number.isNaN(value) || value <= 0) return null;

  if (raw.includes("năm") || raw.includes("year")) return value * 365;
  if (raw.includes("tháng") || raw.includes("month")) return value * 30;
  if (raw.includes("tuần") || raw.includes("week")) return value * 7;
  return value;
}

export function computePlanExpiry(durationDays: number | null, from = new Date()) {
  if (durationDays === null) return null;
  const expiry = new Date(from);
  expiry.setDate(expiry.getDate() + durationDays);
  return expiry;
}

export function createRandomPassword(length = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return password;
}
