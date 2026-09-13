import { NextResponse } from "next/server";
import {
  checkLoginRateLimit,
  checkSocAdminAuthorization,
  createSocSessionToken,
  isAllowedSocHost,
  recordLoginAttempt,
  SOC_COOKIE_NAME,
  SOC_SESSION_MAX_AGE_SECONDS,
} from "@/lib/soc-auth";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPrismaClient } from "@/lib/prisma";

export async function POST(request: Request) {
  if (!isAllowedSocHost(request)) {
    return NextResponse.json(
      { error: "SOC_HOST_REQUIRED", code: "SOC_HOST_REQUIRED" },
      { status: 403 }
    );
  }

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  const rateCheck = await checkLoginRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: `Quá nhiều lần thử đăng nhập không thành công. Vui lòng thử lại sau ${rateCheck.retryAfterSeconds ?? 900} giây.`,
        code: "RATE_LIMITED",
        locked: true,
        retryAfter: rateCheck.retryAfterSeconds,
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "").trim();
    const accessToken = String(body?.accessToken || "").trim();

    // 1. Direct Access Token verification (if provided via Supabase client session)
    if (accessToken) {
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

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser(accessToken);

      if (userError || !user || !user.id) {
        await recordLoginAttempt(clientIp, false);
        return NextResponse.json(
          { error: "Phiên xác thực danh tính ADQ không hợp lệ.", code: "INVALID_IDENTITY" },
          { status: 401 }
        );
      }

      const authCheck = await checkSocAdminAuthorization(user.id);
      if (!authCheck.authorized) {
        await recordLoginAttempt(clientIp, false);
        const prisma = getPrismaClient();
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

        return NextResponse.json(
          { error: "Tài khoản của bạn không có quyền SOC Administrator.", code: "ACCESS_DENIED" },
          { status: 403 }
        );
      }

      await recordLoginAttempt(clientIp, true);
      const token = createSocSessionToken(user.id, authCheck.role || "SOC_ADMIN");

      const prisma = getPrismaClient();
      try {
        await prisma.adminAction.create({
          data: {
            adminAuthUserId: user.id,
            action: "SOC_LOGIN_SUCCESS",
            detail: {
              email: user.email,
              method: "SUPABASE_TOKEN_IDENTITY",
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch {}

      const response = NextResponse.json({
        ok: true,
        authenticated: true,
        role: "SOC_ADMIN",
        name: user.email || "SOC Administrator",
      });

      response.cookies.set({
        name: SOC_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SOC_SESSION_MAX_AGE_SECONDS,
      });

      return response;
    }

    // 2. Email + Password direct identity verification via Supabase Auth
    if (email && password) {
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

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        await recordLoginAttempt(clientIp, false);
        return NextResponse.json(
          { error: "Email hoặc mật khẩu ADQ không chính xác.", code: "INVALID_CREDENTIALS" },
          { status: 401 }
        );
      }

      const authCheck = await checkSocAdminAuthorization(authData.user.id);
      if (!authCheck.authorized) {
        await recordLoginAttempt(clientIp, false);
        const prisma = getPrismaClient();
        try {
          await prisma.adminAction.create({
            data: {
              adminAuthUserId: authData.user.id,
              action: "SOC_LOGIN_DENIED",
              detail: {
                email: authData.user.email,
                reason: "NOT_IN_SOC_ADMINS",
                timestamp: new Date().toISOString(),
              },
            },
          });
        } catch {}

        return NextResponse.json(
          { error: "Tài khoản của bạn không có quyền SOC Administrator.", code: "ACCESS_DENIED" },
          { status: 403 }
        );
      }

      await recordLoginAttempt(clientIp, true);
      const token = createSocSessionToken(authData.user.id, authCheck.role || "SOC_ADMIN");

      const prisma = getPrismaClient();
      try {
        await prisma.adminAction.create({
          data: {
            adminAuthUserId: authData.user.id,
            action: "SOC_LOGIN_SUCCESS",
            detail: {
              email: authData.user.email,
              method: "SUPABASE_PASSWORD_IDENTITY",
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch {}

      const response = NextResponse.json({
        ok: true,
        authenticated: true,
        role: "SOC_ADMIN",
        name: authData.user.email || "SOC Administrator",
      });

      response.cookies.set({
        name: SOC_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SOC_SESSION_MAX_AGE_SECONDS,
      });

      return response;
    }

    return NextResponse.json(
      {
        error: "Vui lòng xác thực danh tính ADQ qua OAuth hoặc thông tin đăng nhập Supabase.",
        code: "IDENTITY_REQUIRED",
      },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Xác thực SOC thất bại.", code: "AUTH_ERROR" },
      { status: 500 }
    );
  }
}
