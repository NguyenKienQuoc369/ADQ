import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { normalisePackageTier, normaliseRole, normaliseStatus, syncAdminUserFromAuthUser, toUserRecord } from "@/lib/admin";

export async function GET(request: Request) {
  try {
    let dataUser: any = null;

    // First try cookie-based server client (normal flow)
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        dataUser = data.user;
      }
    } catch (cookieErr) {
      // ignore and fallthrough to token-based
    }

    // If cookie-based didn't yield a user, try Authorization: Bearer <token> header
    if (!dataUser) {
      const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (url && anonKey && token) {
          const client = createClient(url, anonKey);
          // set auth for this client to inspect the provided token
          try {
            (client.auth as any).setAuth(token);
            const { data, error } = await client.auth.getUser();
            if (!error && data.user) dataUser = data.user;
          } catch (e) {
            // ignore
          }
        }
      }
    }

    if (!dataUser) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const prisma = getPrismaClient();

    const existing = await prisma.adminUser.findFirst({
      where: {
        OR: [{ authUserId: dataUser.id }, { email: dataUser.email ?? "" }],
      },
    });

    const row = await syncAdminUserFromAuthUser(dataUser, {
      name:
        (dataUser.user_metadata ?? {})["name"] ||
        (dataUser.user_metadata ?? {})["full_name"] ||
        existing?.name ||
        dataUser.email?.split("@")[0] ||
        "Người dùng",
      role: normaliseRole(existing?.role ?? (dataUser.user_metadata ?? {})["role"] ?? (dataUser.app_metadata as any)?.role),
      // admin_users.package_tier là nguồn sự thật duy nhất.
      // Auth metadata chỉ là mirror, không được dùng để tự cấp entitlement.
      packageTier: normalisePackageTier(existing?.packageTier ?? "FREE"),
      status: normaliseStatus(existing?.status ?? (dataUser.user_metadata ?? {})["status"] ?? (dataUser.app_metadata as any)?.status ?? "ACTIVE"),
      dailyLimit: existing?.dailyLimit,
      scansToday: existing?.scansToday,
      telegramConnected: existing?.telegramConnected,
      planExpiresAt: existing?.planExpiresAt ?? null,
      oauthProvider:
        ((dataUser.user_metadata ?? {})["provider"] as string | undefined) ??
        (((dataUser.app_metadata as any)?.provider as string | undefined) ?? existing?.oauthProvider ?? null),
    });

    const appUser = {
      ...toUserRecord(row),
      id: dataUser.id,
      avatar: (dataUser.user_metadata ?? {})["avatar_url"] || dataUser.user_metadata?.["picture"] || undefined,
      lastLoginAt: dataUser.last_sign_in_at ?? row.lastLoginAt ?? new Date().toISOString(),
    };

    // If account locked, send 403 with explicit flag
    if (appUser.status === "LOCKED") {
      return NextResponse.json({ error: "LOCKED", user: appUser }, { status: 403 });
    }

    return NextResponse.json({ ok: true, user: appUser });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to fetch account." }, { status: 500 });
  }
}
