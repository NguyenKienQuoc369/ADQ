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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/admin";

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const host = forwardedHost || request.headers.get("host") || "adq-soc.click";
  const origin = `${forwardedProto}://${host.split(",")[0].trim()}`;

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

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[SOC Callback] Exchange error:", exchangeError.message);
    return NextResponse.redirect(`${origin}/admin/login?error=auth_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.id) {
    return NextResponse.redirect(`${origin}/admin/login?error=no_identity`);
  }

  // Authoritative UUID check in soc_admins table
  const authCheck = await checkSocAdminAuthorization(user.id);

  const prisma = getPrismaClient();

  if (!authCheck.authorized) {
    // Log unauthorized attempt in audit log
    try {
      await prisma.adminAction.create({
        data: {
          adminAuthUserId: user.id,
          action: "SOC_LOGIN_DENIED",
          detail: {
            email: user.email,
            reason: "NOT_IN_SOC_ADMINS",
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch {}

    return NextResponse.redirect(`${origin}/admin/login?error=access_denied`);
  }

  // Issue SOC session token
  const socToken = createSocSessionToken(user.id, authCheck.role || "SOC_ADMIN");

  // Log successful login
  try {
    await prisma.adminAction.create({
      data: {
        adminAuthUserId: user.id,
        action: "SOC_LOGIN_SUCCESS",
        detail: {
          email: user.email,
          role: authCheck.role,
          provider: user.app_metadata?.provider || "supabase",
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

