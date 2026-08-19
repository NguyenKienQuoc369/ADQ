"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Navigation from "@/components/Navigation";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Ẩn Navigation trên toàn bộ các route admin và dashboard ứng dụng
  const hideNavigation = 
    pathname?.startsWith("/admin") || 
    pathname?.startsWith("/dashboard") || 
    pathname?.startsWith("/scan") || 
    pathname?.startsWith("/stress-test") || 
    pathname?.startsWith("/apk-audit") || 
    pathname?.startsWith("/copilot") ||
    pathname?.startsWith("/settings");

  return (
    <div className="flex min-h-screen flex-col bg-[#020617] text-slate-100 selection:bg-cyan-500 selection:text-black font-sans">
      {!hideNavigation && <Navigation />}
      <main className="flex-1">{children}</main>
    </div>
  );
}
