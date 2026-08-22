"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, ServerOff, X } from "lucide-react";

type MaintenanceState = {
  enabled?: boolean;
  active?: boolean;
  status?: string;
};

/*
 * Biến này giờ được dùng cho tình trạng:
 * VPS / backend provider outage.
 *
 * KHÔNG đồng nghĩa với full maintenance.
 */
const VPS_OUTAGE =
  process.env.NEXT_PUBLIC_FORCE_MAINTENANCE === "true";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const OUTAGE_BYPASS_KEY = "adq:vps-outage-acknowledged";

export function MaintenanceGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [checked, setChecked] = useState(false);
  const [outageAcknowledged, setOutageAcknowledged] = useState(false);
  const [hideBanner, setHideBanner] = useState(false);

  const isMaintenancePage = pathname === "/maintenance";
  const isAdminPage = pathname?.startsWith("/admin");
  const isAuthCallback = pathname?.startsWith("/auth/callback");

  /*
   * VPS outage:
   * Chỉ bắt người dùng xem thông báo một lần trong session.
   */
  useEffect(() => {
    if (!VPS_OUTAGE) return;

    const acknowledged =
      sessionStorage.getItem(OUTAGE_BYPASS_KEY) === "true";

    setOutageAcknowledged(acknowledged);

    if (
      !acknowledged &&
      !isMaintenancePage &&
      !isAdminPage &&
      !isAuthCallback
    ) {
      router.replace("/maintenance");
    }
  }, [
    isMaintenancePage,
    isAdminPage,
    isAuthCallback,
    router,
  ]);

  /*
   * Full maintenance thật vẫn do backend điều khiển.
   * Backend maintenance active => hard redirect.
   *
   * Không có bypass.
   */
  useEffect(() => {
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

        /*
         * Đây mới là FULL MAINTENANCE.
         */
        if (
          active &&
          !isMaintenancePage &&
          !isAdminPage &&
          !isAuthCallback
        ) {
          router.replace("/maintenance?mode=full");
          return;
        }

        /*
         * Nếu backend bình thường và user đang ở maintenance,
         * chỉ redirect về home nếu KHÔNG phải VPS outage.
         */
        if (
          !active &&
          isMaintenancePage &&
          !VPS_OUTAGE
        ) {
          router.replace("/");
        }
      } catch (error) {
        /*
         * VPS chết không được coi là full maintenance.
         * Frontend vẫn hoạt động.
         */
        console.warn(
          "[MaintenanceGate] Backend unavailable:",
          error
        );
      } finally {
        if (!cancelled) {
          setChecked(true);
        }
      }
    };

    void checkMaintenance();

    const interval = window.setInterval(
      checkMaintenance,
      15000
    );

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
   * Trong lúc đang redirect user sang trang thông báo,
   * tránh flash Dashboard.
   */
  if (
    VPS_OUTAGE &&
    !outageAcknowledged &&
    !isMaintenancePage &&
    !isAdminPage &&
    !isAuthCallback
  ) {
    return <div className="min-h-screen bg-[#020617]" />;
  }

  if (!checked && !VPS_OUTAGE) {
    return <div className="min-h-screen bg-[#020617]" />;
  }

  return (
    <>
      {VPS_OUTAGE &&
        outageAcknowledged &&
        !hideBanner &&
        !isMaintenancePage && (
          <div className="relative z-[100] border-b border-amber-500/25 bg-amber-950/35 px-4 py-2.5 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center gap-3">
              <ServerOff className="h-4 w-4 shrink-0 text-amber-400" />

              <p className="flex-1 text-xs leading-5 text-amber-100/80">
                <strong className="text-amber-300">
                  Hệ thống đang trong quá trình khôi phục sau bảo trì máy chủ.
                </strong>{" "}
                Một số chức năng như Security Scan, Stress Test,
                AI Analysis và các tác vụ xử lý nền có thể phản hồi
                chậm hoặc tạm thời chưa ổn định. Các chức năng còn
                lại của ADQ vẫn có thể tiếp tục sử dụng.
              </p>

              <button
                type="button"
                onClick={() => setHideBanner(true)}
                className="rounded-lg p-1.5 text-amber-300/60 transition hover:bg-amber-500/10 hover:text-amber-200"
                aria-label="Ẩn thông báo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

      {children}
    </>
  );
}
