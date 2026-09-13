import { NextResponse } from "next/server";
import {
  isAllowedSocHost,
  redeemEmergencyRecoveryToken,
  SOC_COOKIE_NAME,
  SOC_SESSION_MAX_AGE_SECONDS,
} from "@/lib/soc-auth";

export async function POST(request: Request) {
  if (!isAllowedSocHost(request)) {
    return NextResponse.json({ error: "SOC_HOST_REQUIRED" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body?.token || "").trim();

    if (!token) {
      return NextResponse.json({ error: "Vui lòng cung cấp mã khôi phục khẩn cấp." }, { status: 400 });
    }

    const result = await redeemEmergencyRecoveryToken(token);

    if (!result.success || !result.sessionToken) {
      return NextResponse.json(
        { error: result.error || "Mã khôi phục không hợp lệ, đã sử dụng hoặc đã hết hạn." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      authenticated: true,
      role: "SOC_ADMIN",
      adminAuthId: result.adminAuthId,
    });

    response.cookies.set({
      name: SOC_COOKIE_NAME,
      value: result.sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SOC_SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: "Lỗi xử lý mã khôi phục khẩn cấp." },
      { status: 500 }
    );
  }
}

