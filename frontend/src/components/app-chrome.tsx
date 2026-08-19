"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Navigation from "./Navigation";

const DASHBOARD_ROUTES = [
  "/dashboard",
  "/scan",
  "/stress-test",
  "/apk-audit",
  "/admin",
  "/settings",
  "/reports",
  "/copilot",
];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Kiểm tra nếu đang ở trang Dashboard hoặc các Module DAST
  const isDashboardWorkspace = DASHBOARD_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isDashboardWorkspace) {
    return <main className="flex-1 w-full">{children}</main>;
  }

  return (
    <>
      <Navigation />
      <main className="flex-1 w-full">{children}</main>
    </>
  );
}
