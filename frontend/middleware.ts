import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/c2", "/ctem", "/graph", "/vulnerabilities", "/scan"];
const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

function normalizeRole(rawRole: unknown) {
  if (!rawRole) return "USER";
  const value = String(rawRole).trim().toUpperCase();
  return value === "ADMIN" ? "ADMIN" : "USER";
}

function getDefaultHomeForRole(role: string) {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAuthPath(pathname: string) {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isRoleAllowedForPath(role: string, pathname: string) {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return role === "ADMIN";
  // Các khu vực còn lại là workspace cho user (admin vẫn có thể truy cập nếu muốn).
  return true;
}

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Nếu chưa cấu hình Supabase, cho phép chạy dev UI tĩnh (tránh crash toàn bộ app).
  if (!url || !anonKey) {
    return NextResponse.next();
  }

  const res = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh session nếu có cookie.
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  const pathname = req.nextUrl.pathname;

  if (isProtectedPath(pathname) && !user) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthPath(pathname) && user) {
    const role = normalizeRole(user.user_metadata?.role ?? user.app_metadata?.role);
    const nextParam = req.nextUrl.searchParams.get("next");
    const safeNext = nextParam && nextParam.startsWith("/") ? nextParam : null;

    const redirectUrl = req.nextUrl.clone();
    if (safeNext && isRoleAllowedForPath(role, safeNext)) {
      redirectUrl.pathname = safeNext;
    } else {
      redirectUrl.pathname = getDefaultHomeForRole(role);
    }

    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    // Skip Next.js internals + static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
