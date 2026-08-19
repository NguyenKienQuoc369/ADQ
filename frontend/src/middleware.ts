import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const url = request.nextUrl.clone();

  // Kiểm tra nếu truy cập qua admin subdomain
  if (hostname.startsWith("admin.")) {
    if (url.pathname === "/") {
      url.pathname = "/admin";
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png|logo.png).*)"],
};
