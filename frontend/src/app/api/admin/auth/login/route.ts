import { NextResponse } from "next/server";
import {
  checkLoginRateLimit,
  createSocSessionToken,
  isAllowedSocHost,
  recordLoginAttempt,
  SOC_COOKIE_NAME,
  SOC_SESSION_MAX_AGE_SECONDS,
  verifySocPassword,
} from "@/lib/soc-auth";
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
    const masterKey = String(
      body?.password ??
      body?.masterKey ??
      body?.socPassword ??
      body?.master_password ??
      body?.key ??
      ""
    ).trim();

    if (!masterKey) {
      await recordLoginAttempt(clientIp, false);
      return NextResponse.json(
        { error: "Vui lòng nhập mật khẩu quản trị SOC.", code: "INVALID_CREDENTIAL" },
        { status: 401 }
      );
    }

    const verifyResult = await verifySocPassword(masterKey);

    if (!verifyResult.valid) {
      await recordLoginAttempt(clientIp, false);

      if (verifyResult.code === "AUTH_CONFIG_ERROR") {
        return NextResponse.json(
          { error: "Cấu hình xác thực SOC chưa được khởi tạo trên máy chủ.", code: "AUTH_CONFIG_ERROR" },
          { status: 500 }
        );
      }

      if (verifyResult.code === "HASH_ERROR") {
        return NextResponse.json(
          { error: "Lỗi kiểm tra mã băm xác thực quản trị.", code: "HASH_ERROR" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "Mật khẩu quản trị viên SOC không chính xác.", code: "INVALID_CREDENTIAL" },
        { status: 401 }
      );
    }

    await recordLoginAttempt(clientIp, true);

    let token: string;
    try {
      token = createSocSessionToken("soc-root");
    } catch {
      return NextResponse.json(
        { error: "Lỗi khởi tạo phiên quản trị SOC.", code: "SESSION_ERROR" },
        { status: 500 }
      );
    }

    // Audit log
    try {
      const prisma = getPrismaClient();
      await prisma.adminAction.create({
        data: {
          adminAuthUserId: "soc-root",
          action: "SOC_LOGIN_SUCCESS",
          detail: {
            ip: clientIp,
            userAgent: request.headers.get("user-agent") || "unknown",
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch {}

    const response = NextResponse.json({
      ok: true,
      authenticated: true,
      role: "ADMIN",
      name: "SOC Root Administrator",
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

    // Clear legacy cookie
    response.cookies.set({
      name: "adq_admin_root_token",
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: "Xác thực SOC thất bại. Vui lòng kiểm tra lại cấu hình.", code: "SESSION_ERROR" },
      { status: 500 }
    );
  }
}
