import { createSupabaseAdminClient } from "./admin";
import { getPrismaClient } from "@/lib/prisma";

export async function invalidateSupabaseSessionsForUser(userId: string) {
  const admin = createSupabaseAdminClient();
  const tried: string[] = [];

  // candidate paths to try on admin client
  const candidates = [
    (admin as any)?.auth?.admin?.invalidateUserSessions,
    (admin as any)?.auth?.admin?.invalidateUserRefreshTokens,
    (admin as any)?.auth?.admin?.revokeUserRefreshTokens,
    (admin as any)?.auth?.admin?.revokeUserTokens,
    (admin as any)?.auth?.admin?.revokeRefreshTokens,
    (admin as any)?.auth?.revokeUserTokens,
    (admin as any)?.invalidateUserSessions,
    (admin as any)?.auth?.invalidateUserSessions,
  ];

  const names = [
    "auth.admin.invalidateUserSessions",
    "auth.admin.invalidateUserRefreshTokens",
    "auth.admin.revokeUserRefreshTokens",
    "auth.admin.revokeUserTokens",
    "auth.admin.revokeRefreshTokens",
    "auth.revokeUserTokens",
    "invalidateUserSessions",
    "auth.invalidateUserSessions",
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const fn = candidates[i];
    const name = names[i] ?? `candidate[${i}]`;
    if (typeof fn === "function") {
      try {
        // call with userId
        await fn.call((admin as any), userId);
        return { ok: true, method: name };
      } catch (err) {
        tried.push(`${name}: ${String((err as any)?.message ?? err)}`);
      }
    } else {
      tried.push(`${name}: not available`);
    }
  }

  // fallback: attempt to remove refresh tokens from auth.refresh_tokens via Prisma raw SQL
  try {
    const prisma = getPrismaClient();
    // Some Supabase installs may require deleting from auth.refresh_tokens; best-effort approach
    const res = await prisma.$executeRaw`DELETE FROM auth.refresh_tokens WHERE user_id = ${userId}`;
    // Note: $executeRaw returns number of rows affected on postgres
    return { ok: true, method: "sql.delete_auth_refresh_tokens", detail: res };
  } catch (sqlErr: any) {
    tried.push(`sql.delete_auth_refresh_tokens: ${String(sqlErr?.message ?? sqlErr)}`);
  }

  // nothing worked
  return { ok: false, tried };
}
