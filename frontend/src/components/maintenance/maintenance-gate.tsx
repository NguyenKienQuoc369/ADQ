"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type MaintenanceState = {
  enabled?: boolean;
  active?: boolean;
  status?: string;
};

const FORCE_MAINTENANCE =
  process.env.NEXT_PUBLIC_FORCE_MAINTENANCE === "true";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export function MaintenanceGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [checked, setChecked] = useState(FORCE_MAINTENANCE);

  const isMaintenancePage = pathname === "/maintenance";
  const isAdminPage = pathname?.startsWith("/admin");
  const isAuthCallback = pathname?.startsWith("/auth/callback");

  useEffect(() => {
    /*
     * Emergency frontend-only maintenance mode.
     *
     * Hoạt động ngay cả khi:
     * - VPS offline
     * - Redis offline
     * - Backend API timeout
     * - Nhà cung cấp VPS đang bảo trì
     */
    if (FORCE_MAINTENANCE) {
      setChecked(true);

      if (
        !isMaintenancePage &&
        !isAdminPage &&
        !isAuthCallback
      ) {
        router.replace("/maintenance");
      }

      return;
    }

    /*
     * Không redirect user đang ở maintenance khi manual force đã tắt.
     * Gate bên dưới sẽ kiểm tra backend rồi quyết định.
     */
    let cancelled = false;

    const checkMaintenance = async () => {
      try {
        const controller = new AbortController();

        const timeout = window.setTimeout(() => {
          controller.abort();
        }, 3500);

        const response = await fetch(`${API_URL}/api/maintenance`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        window.clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Maintenance API ${response.status}`);
        }

        const data = (await response.json()) as MaintenanceState;

        if (cancelled) return;

        const status = String(data?.status || "").toUpperCase();

        const active =
          data?.active === true ||
          data?.enabled === true ||
          status === "IN_PROGRESS" ||
          status === "OVERRUN";

        if (
          active &&
          !isMaintenancePage &&
          !isAdminPage &&
          !isAuthCallback
        ) {
          router.replace("/maintenance");
          return;
        }

        if (!active && isMaintenancePage) {
          router.replace("/");
          return;
        }
      } catch (error) {
        /*
         * Quan trọng:
         * Backend/VPS chết KHÔNG được làm app crash-loop.
         *
         * Emergency outage phải được điều khiển bằng
         * NEXT_PUBLIC_FORCE_MAINTENANCE phía Vercel.
         */
        console.warn(
          "[MaintenanceGate] Backend maintenance state unavailable:",
          error
        );
      } finally {
        if (!cancelled) {
          setChecked(true);
        }
      }
    };

    void checkMaintenance();

    const interval = window.setInterval(checkMaintenance, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    isMaintenancePage,
    isAdminPage,
    isAuthCallback,
    router,
  ]);

  /*
   * Với forced maintenance, không render dashboard trong 1 frame
   * trước khi redirect.
   */
  if (
    FORCE_MAINTENANCE &&
    !isMaintenancePage &&
    !isAdminPage &&
    !isAuthCallback
  ) {
    return (
      <div className="min-h-screen bg-[#020617]" />
    );
  }

  if (!checked) {
    return (
      <div className="min-h-screen bg-[#020617]" />
    );
  }

  return <>{children}</>;
}
