import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Cho phép Next.js xử lý trực tiếp, không redirect cứng để tránh loop query
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png|logo.png).*)"],
};
