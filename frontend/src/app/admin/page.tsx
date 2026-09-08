"use client";

import React, { useState, useEffect } from "react";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Cpu,
  HardDrive,
  Radio,
  Server,
  ShieldAlert,
  RotateCw,
  Ban,
  LogOut,
} from "lucide-react";

export default function AdminDashboardPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [telemetry, setTelemetry] = useState<any>({
    server: { cpu_usage_percent: 0, ram_usage_percent: 0, ram_used_gb: 0, ram_total_gb: 0, disk_usage_percent: 0 },
    services: { fastapi_backend: "OFFLINE", redis_queue: "DEGRADED", postgres_db: "OFFLINE", worker_elite: "OFFLINE", worker_mobile: "OFFLINE", worker_light: "OFFLINE" }
  });
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const verifySocSession = async () => {
      try {
        const res = await fetch("/api/admin/auth/session", {
          credentials: "same-origin",
          cache: "no-store",
        });

        if (!cancelled) {
          setAuthorized(res.ok);
        }
      } catch {
        if (!cancelled) {
          setAuthorized(false);
        }
      }
    };

    void verifySocSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resTelemetry, resScans] = await Promise.all([
        fetch("/api/admin/telemetry", {
          credentials: "same-origin",
          cache: "no-store",
        }),
        fetch("/api/admin/global-scans", {
          credentials: "same-origin",
          cache: "no-store",
        }),
      ]);

      if (
        resTelemetry.status === 401 ||
        resTelemetry.status === 403 ||
        resScans.status === 401 ||
        resScans.status === 403
      ) {
        setAuthorized(false);
        return;
      }

      if (resTelemetry.ok) {
        const data = await resTelemetry.json();
        setTelemetry(data);
      }

      if (resScans.ok) {
        const data = await resScans.json();
        setScans(data.scans || []);
      }
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authorized) {
      fetchData();
      const interval = setInterval(fetchData, 8000);
      return () => clearInterval(interval);
    }
  }, [authorized]);

  const handleKillJob = async (jid: string) => {
    try {
      const res = await fetch(`/api/admin/global-scans/${jid}/kill`, { method: "POST" });
      if (res.ok) {
        setScans((prev) =>
          prev.map((s) => (s.job_id === jid ? { ...s, status: "KILLED_BY_ADMIN" } : s))
        );
      }
    } catch (err) {
      console.error("Failed to kill job", err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      setAuthorized(false);
    }
  };

  if (authorized === null) {
    return <div className="min-h-screen bg-[#000000]" />;
  }

  if (!authorized) {
    return (
      <AdminLoginForm
        onSuccess={() => {
          setAuthorized(true);
          void fetchData();
        }}
      />
    );
  }

  const server = telemetry?.server || { cpu_usage_percent: 0, ram_used_gb: 0, ram_total_gb: 0, ram_usage_percent: 0, disk_usage_percent: 0 };
  const services = telemetry?.services || {};

  return (
    <AdminShell onLogout={handleLogout}>
      <div className="space-y-6 max-w-7xl mx-auto font-sans text-[#ededed]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <Server className="h-5 w-5 text-white" /> SOC Root Control & Cluster Telemetry
            </h1>
            <p className="text-xs text-neutral-400 mt-1">Giám sát hạ tầng VPS 163.44.193.9, Docker nodes và hàng đợi tác vụ rà quét.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={fetchData}
              disabled={loading}
              variant="outline"
              size="sm"
              className="h-8 border-[#333333] bg-[#111111] hover:bg-neutral-800 text-xs text-white rounded-md cursor-pointer"
            >
              <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Làm mới Realtime
            </Button>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="h-8 text-xs border-[#333333] hover:bg-neutral-900 text-neutral-300 rounded-md cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" /> Thoát Root
            </Button>
          </div>
        </div>

        {/* 4 Chỉ số phần cứng */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border border-[#222222] bg-[#000000] p-4">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-mono uppercase">
              <span>CPU Usage</span>
              <Cpu className="h-4 w-4 text-white" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">{server.cpu_usage_percent}%</div>
            <div className="h-1 w-full bg-neutral-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-white" style={{ width: `${server.cpu_usage_percent}%` }} />
            </div>
          </div>

          <div className="rounded-lg border border-[#222222] bg-[#000000] p-4">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-mono uppercase">
              <span>RAM Memory</span>
              <Activity className="h-4 w-4 text-white" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">{server.ram_used_gb} / {server.ram_total_gb} GB</div>
            <div className="h-1 w-full bg-neutral-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-white" style={{ width: `${server.ram_usage_percent}%` }} />
            </div>
          </div>

          <div className="rounded-lg border border-[#222222] bg-[#000000] p-4">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-mono uppercase">
              <span>Disk Storage</span>
              <HardDrive className="h-4 w-4 text-white" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">{server.disk_usage_percent}%</div>
            <div className="h-1 w-full bg-neutral-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-white" style={{ width: `${server.disk_usage_percent}%` }} />
            </div>
          </div>

          <div className="rounded-lg border border-[#222222] bg-[#000000] p-4">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-mono uppercase">
              <span>Cluster Services</span>
              <Radio className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              {services.fastapi_backend === "ONLINE" ? "ALL HEALTHY" : "DEGRADED"}
            </div>
            <p className="text-[10px] font-mono text-neutral-500 mt-1">Backend: {services.fastapi_backend || "CHECKING"}</p>
          </div>
        </div>

        {/* Bảng Global Scans */}
        <div className="rounded-lg border border-[#222222] bg-[#000000]">
          <div className="p-4 border-b border-[#222222]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-white" /> Lịch Sử Phiên Quét Toàn Cục (Global Audit)
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Kiểm soát tất cả mục tiêu được quét bởi các tài khoản trên nền tảng.
            </p>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#222222] text-neutral-500 font-mono">
                    <th className="pb-2">ID Phiên</th>
                    <th className="pb-2">Tài Khoản</th>
                    <th className="pb-2">Target Domain / URL</th>
                    <th className="pb-2">Lỗ Hổng</th>
                    <th className="pb-2">Trạng Thái</th>
                    <th className="pb-2 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222] font-sans">
                  {scans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-neutral-500 font-mono">
                        Chưa có phiên rà quét nào được kích hoạt
                      </td>
                    </tr>
                  ) : (
                    scans.map((s) => (
                      <tr key={s.job_id} className="hover:bg-neutral-900/40">
                        <td className="py-3 font-mono text-white">{s.job_id}</td>
                        <td className="py-3 text-neutral-300">{s.user_email}</td>
                        <td className="py-3 font-mono text-white font-medium">{s.target}</td>
                        <td className="py-3">
                          <span className="font-mono text-neutral-300">{s.vuln_count || 0} phát hiện</span>
                        </td>
                        <td className="py-3">
                          <span className="border border-neutral-700 bg-neutral-800 text-white font-mono text-[10px] px-2 py-0.5 rounded-full">
                            {s.status || "COMPLETED"}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => alert(`Chi tiết phiên quét: ${s.job_id}`)}
                            className="h-7 text-xs border border-[#333333] hover:bg-neutral-800 text-white rounded-md"
                          >
                            Xem Chi Tiết
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
