"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type MaintenanceState = {
  enabled: boolean;
  status: "OFF" | "SCHEDULED" | "IN_PROGRESS" | "OVERRUN";
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // Never redirect the maintenance page itself or admin routes.
      if (pathname === "/maintenance" || pathname.startsWith("/admin")) {
        if (!cancelled) setChecked(true);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/maintenance`, {
          method: "GET",
          cache: "no-store",
        });
        const data = await res.json();
        const state = data?.maintenance as MaintenanceState | undefined;

        if (
          !cancelled &&
          state?.enabled &&
          (state.status === "IN_PROGRESS" || state.status === "OVERRUN")
        ) {
          router.replace("/maintenance");
          return;
        }
      } catch {
        // Fail open: maintenance API failure must not lock users out.
      }

      if (!cancelled) setChecked(true);
    }

    check();
    const timer = window.setInterval(check, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pathname, router]);

  // Avoid flashing protected UI before the first maintenance check.
  if (!checked && pathname !== "/maintenance" && !pathname.startsWith("/admin")) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-500 text-sm">
        Đang kiểm tra trạng thái hệ thống...
      </div>
    );
  }

  return <>{children}</>;
}
