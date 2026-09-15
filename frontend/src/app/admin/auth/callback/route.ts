import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  checkSocAdminAuthorization,
  createSocSessionToken,
  SOC_COOKIE_NAME,
  SOC_SESSION_MAX_AGE_SECONDS,
} from "@/lib/soc-auth";
import { getPrismaClient } from "@/lib/prisma";

function getSocOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost || request.headers.get("host") || "").split(",")[0].trim().toLowerCase().split(":")[0];

  if (host === "www.adq-soc.click") {
    return "https://www.adq-soc.click";
  }
  if (host === "adq-soc.click") {
    return "https://adq-soc.click";
  }
  if (process.env.NODE_ENV !== "production" && (host === "localhost" || host === "127.0.0.1")) {
    const forwardedProto = request.headers.get("x-forwarded-proto") || "http";
    const rawHost = request.headers.get("host") || "localhost:3000";
    return `${forwardedProto}://${rawHost}`;
  }
  // Hard isolation default for production SOC realm
  return "https://adq-soc.click";
}

export async function GET(request: Request) {
  const origin = getSocOrigin(request);
  const { searchParams } = new URL(request.url);
  const errorParam = searchParams.get("error");
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/admin";

  // 1. Handle OAuth cancellation or provider errors
  if (errorParam) {
    const errorCode = errorParam === "access_denied" ? "oauth_cancelled" : "auth_failed";
    return NextResponse.redirect(`${origin}/admin/login?error=${errorCode}`);
  }

  // 2. Missing authorization code
  if (!code) {
    return NextResponse.redirect(`${origin}/admin/login?error=missing_code`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {}
        },
      },
    }
  );

  let exchangeError: any = null;
  let authUser: any = null;
  try {
    const res = await supabase.auth.exchangeCodeForSession(code);
    exchangeError = res.error;
    authUser = res.data?.session?.user || res.data?.user;
  } catch (err: any) {
    exchangeError = err;
  }

  if (exchangeError) {
    console.error("[SOC Callback] Exchange error:", exchangeError.message || exchangeError);
    return NextResponse.redirect(`${origin}/admin/login?error=auth_failed`);
  }

  if (!authUser) {
    const { data: userData } = await supabase.auth.getUser();
    authUser = userData?.user;
  }

  if (!authUser || !authUser.id) {
    return NextResponse.redirect(`${origin}/admin/login?error=no_identity`);
  }

  const prisma = getPrismaClient();

  // 3. Reconcile authorized bootstrap admin UUID if it changed
  if (
    authUser.email?.toLowerCase() === "kienquocn64@gmail.com" &&
    (authUser.email_confirmed_at || authUser.user_metadata?.email_verified)
  ) {
    try {
      await prisma.socAdmin.upsert({
        where: { userAuthId: authUser.id },
        update: {
          enabled: true,
          emailSnapshot: "kienquocn64@gmail.com",
          role: "SOC_ADMIN",
          revokedAt: null,
        },
        create: {
          id: "soc_admin_root_1",
          userAuthId: authUser.id,
          emailSnapshot: "kienquocn64@gmail.com",
          role: "SOC_ADMIN",
          enabled: true,
        },
      });
    } catch (e) {
      console.error("[SOC Callback] Error during admin reconciliation:", e);
    }
  }

  // 4. Authoritative UUID check in soc_admins table
  const authCheck = await checkSocAdminAuthorization(authUser.id);

  if (!authCheck.authorized) {
    // Log unauthorized attempt in audit log
    try {
      await prisma.adminAction.create({
        data: {
          adminAuthUserId: authUser.id,
          action: "SOC_LOGIN_DENIED",
          detail: {
            email: authUser.email,
            reason: "NOT_IN_SOC_ADMINS",
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch {}

    return NextResponse.redirect(`${origin}/admin/login?error=access_denied`);
  }

  // 5. Issue SOC session token
  const socToken = createSocSessionToken(authUser.id, authCheck.role || "SOC_ADMIN");

  // Log successful login
  try {
    await prisma.adminAction.create({
      data: {
        adminAuthUserId: authUser.id,
        action: "SOC_LOGIN_SUCCESS",
        detail: {
          email: authUser.email,
          role: authCheck.role,
          provider: authUser.app_metadata?.provider || "supabase",
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch {}

  const destination = next.startsWith("/") ? next : `/${next}`;
  const response = NextResponse.redirect(`${origin}${destination}`);

  response.cookies.set({
    name: SOC_COOKIE_NAME,
    value: socToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SOC_SESSION_MAX_AGE_SECONDS,
  });

  return response;
}

