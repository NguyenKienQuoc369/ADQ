"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Navigation } from "./Navigation";

const HIDE_HEADER_ROUTES = [
  "/dashboard",
  "/scan",
  "/stress-test",
  "/apk-audit",
  "/admin",
  "/settings",
  "/reports",
  "/copilot",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const hideHeader = HIDE_HEADER_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (hideHeader) {
    return <main className="flex-1 w-full">{children}</main>;
  }

  return (
    <>
      <Navigation />
      <main className="flex-1 w-full">{children}</main>
    </>
  );
}
