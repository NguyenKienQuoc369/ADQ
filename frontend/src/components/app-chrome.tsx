"use client";

import { usePathname } from "next/navigation";

import { Navigation } from "@/components/Navigation";

const hiddenOnPrefixes = ["/dashboard", "/admin", "/c2", "/ctem", "/graph", "/vulnerabilities", "/scan", "/settings"];
const hiddenOnExactRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNavigation =
    hiddenOnExactRoutes.includes(pathname) || hiddenOnPrefixes.some((prefix) => pathname.startsWith(prefix));

  return (
    <>
      {!hideNavigation ? <Navigation /> : null}
      <main className="flex-1 bg-transparent text-[var(--foreground)]">{children}</main>
    </>
  );
}
