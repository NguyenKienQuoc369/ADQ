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

const SOC_CANONICAL_ORIGIN = "https://adq-soc.click";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const errorParam = searchParams.get("error");
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/admin";

  // 1. Handle OAuth cancellation or provider errors
  if (errorParam) {
    const errorCode = errorParam === "access_denied" ? "oauth_cancelled" : "auth_failed";
    return NextResponse.redirect(`${SOC_CANONICAL_ORIGIN}/admin/login?error=${errorCode}`);
  }

  // 2. Missing authorization code
  if (!code) {
    return NextResponse.redirect(`${SOC_CANONICAL_ORIGIN}/admin/login?error=missing_code`);
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
    return NextResponse.redirect(`${SOC_CANONICAL_ORIGIN}/admin/login?error=auth_failed`);
  }

  if (!authUser) {
    const { data: userData } = await supabase.auth.getUser();
    authUser = userData?.user;
  }

  if (!authUser || !authUser.id) {
    return NextResponse.redirect(`${SOC_CANONICAL_ORIGIN}/admin/login?error=no_identity`);
  }

  const prisma = getPrismaClient();

  // 3. Direct Read-Only Database Authorization Query (UUID Key Only)
  let adminRecord = null;
  try {
    adminRecord = await prisma.socAdmin.findFirst({
      where: {
        userAuthId: authUser.id,
        role: "SOC_ADMIN",
        enabled: true,
      },
    });
  } catch (dbErr: any) {
    console.error("[SOC Callback] Database query error:", dbErr.message || dbErr);
    return NextResponse.redirect(`${SOC_CANONICAL_ORIGIN}/admin/login?error=auth_failed`);
  }

  if (!adminRecord) {
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

    return NextResponse.redirect(`${SOC_CANONICAL_ORIGIN}/admin/login?error=access_denied`);
  }

  // 4. Issue SOC session token
  const socToken = createSocSessionToken(authUser.id, adminRecord.role || "SOC_ADMIN");

  // Log successful login
  try {
    await prisma.adminAction.create({
      data: {
        adminAuthUserId: authUser.id,
        action: "SOC_LOGIN_SUCCESS",
        detail: {
          email: authUser.email,
          role: adminRecord.role,
          provider: authUser.app_metadata?.provider || "supabase",
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch {}

  const destination = next.startsWith("/") ? next : `/${next}`;
  const response = NextResponse.redirect(`${SOC_CANONICAL_ORIGIN}${destination}`);

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

