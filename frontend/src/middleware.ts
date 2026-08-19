import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").toLowerCase();
  const { pathname } = request.nextUrl;

  // Bỏ qua static assets và API
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/logo") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Nhận diện domain quản trị riêng: adq-soc.click
  const isAdminDomain = host.includes("adq-soc.click") || host.startsWith("admin.");

  if (isAdminDomain) {
    if (pathname === "/" || pathname === "") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (!pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL(`/admin${pathname}`, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png|logo.png).*)"],
};
