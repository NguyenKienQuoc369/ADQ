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

  // Navigation CHỈ hiển thị duy nhất trên trang chủ ("/")
  const isLandingPage = pathname === "/" && !isAdminDomain;

  return (
    <div className="flex min-h-screen flex-col font-sans">
      {isLandingPage && <Navigation />}
      <main className="flex-1">{children}</main>
    </div>
  );
}
