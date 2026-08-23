import { NextResponse } from "next/server";
import { SOC_COOKIE_NAME } from "@/lib/soc-auth";

export async function POST() {
  const response = NextResponse.json({
    ok: true,
  });

  response.cookies.set({
    name: SOC_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

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
}
