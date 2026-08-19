import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
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

  // Nhận diện domain quản trị riêng: adq-soc.click hoặc subdomain admin
  const isAdminDomain = host.includes("adq-soc.click") || host.startsWith("admin.");

  if (isAdminDomain) {
    // Nếu vào trang chủ của domain admin, rewrite sang /admin/login
    if (pathname === "/" || pathname === "") {
      return NextResponse.rewrite(new URL("/admin/login", request.url));
    }
    // Nếu vào các đường dẫn con mà chưa có tiền tố /admin, tự động lồng /admin
    if (!pathname.startsWith("/admin")) {
      return NextResponse.rewrite(new URL(`/admin${pathname}`, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png|logo.png).*)"],
};
