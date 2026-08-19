"use client";

import React from "react";
import { usePathname } from "next/navigation";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  return (
    <div className={`min-h-screen ${isAdmin ? "bg-[#020617]" : ""}`}>
      {children}
    </div>
  );
}
