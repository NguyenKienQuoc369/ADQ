"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Navigation } from "@/components/Navigation";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAdminDomain, setIsAdminDomain] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase();
      if (host.includes("adq-soc.click") || host.startsWith("admin.")) {
        setIsAdminDomain(true);
      }
    }
  }, []);

  const hideNavigation =
    isAdminDomain ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/scan") ||
    pathname?.startsWith("/stress-test") ||
    pathname?.startsWith("/apk-audit") ||
    pathname?.startsWith("/copilot") ||
    pathname?.startsWith("/settings");

  return (
    <div className="flex min-h-screen flex-col bg-[#020617] text-slate-100 selection:bg-rose-500 selection:text-white font-sans">
      {!hideNavigation && <Navigation />}
      <main className="flex-1">{children}</main>
    </div>
  );
}
