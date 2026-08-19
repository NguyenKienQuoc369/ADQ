import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").toLowerCase();
  const { pathname } = request.nextUrl;

  // Bỏ qua static files, api và assets
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

  // Bắt tất cả request từ adq-soc.click hoặc admin subdomain
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
