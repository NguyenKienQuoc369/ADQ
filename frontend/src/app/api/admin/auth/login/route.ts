import { NextResponse } from "next/server";
import {
  createSocSessionToken,
  isAllowedSocHost,
  SOC_COOKIE_NAME,
  SOC_SESSION_MAX_AGE_SECONDS,
  verifySocMasterKey,
} from "@/lib/soc-auth";

export async function POST(request: Request) {
  if (!isAllowedSocHost(request)) {
    return NextResponse.json(
      { error: "SOC_HOST_REQUIRED" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const masterKey = String(
      body?.masterKey ?? ""
    ).trim();

    if (!verifySocMasterKey(masterKey)) {
      return NextResponse.json(
        { error: "INVALID_SOC_CREDENTIALS" },
        { status: 401 }
      );
    }

    const token = createSocSessionToken();

    const response = NextResponse.json({
      ok: true,
      authenticated: true,
    });

    response.cookies.set({
      name: SOC_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SOC_SESSION_MAX_AGE_SECONDS,
    });

    // Xóa cookie admin legacy.
    response.cookies.set({
      name: "adq_admin_root_token",
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "SOC_LOGIN_FAILED" },
      { status: 500 }
    );
  }
}
