"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Kiểm tra nếu là trang Admin hoặc Dashboard dự án thì ẩn hoàn toàn header/footer của landing page
  const isAdminRoute = pathname?.startsWith("/admin");
  const isDashboardRoute = pathname?.startsWith("/dashboard") || 
                           pathname?.startsWith("/scan") || 
                           pathname?.startsWith("/stress-test") || 
                           pathname?.startsWith("/apk-audit") || 
                           pathname?.startsWith("/copilot") ||
                           pathname?.startsWith("/settings");

  if (isAdminRoute || isDashboardRoute) {
    return <main className="flex-1 min-h-screen bg-[#020617]">{children}</main>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#020617]">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
