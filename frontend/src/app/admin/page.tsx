"use client";

import React, { useState, useEffect } from "react";
import AdminLoginPage from "@/app/admin/login/page";
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
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("adq_admin_root_token");
      setAuthorized(token === "soc_root_authorized_session");
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resTelemetry, resScans] = await Promise.all([
        fetch("/api/admin/telemetry"),
        fetch("/api/admin/global-scans"),
      ]);

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

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("adq_admin_root_token");
      document.cookie = "adq_admin_root_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
      setAuthorized(false);
    }
  };

  if (authorized === null) {
    return <div className="min-h-screen bg-[#020617]" />;
  }

  if (!authorized) {
    return <AdminLoginPage onSuccess={() => setAuthorized(true)} />;
  }

  const server = telemetry?.server || { cpu_usage_percent: 0, ram_used_gb: 0, ram_total_gb: 0, ram_usage_percent: 0, disk_usage_percent: 0 };
  const services = telemetry?.services || {};

  return (
    <AdminShell onLogout={handleLogout}>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Server className="h-5 w-5 text-rose-400" /> SOC Root Control & Cluster Telemetry
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Giám sát hạ tầng VPS 163.44.193.9, Docker nodes và hàng đợi tác vụ rà quét</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={fetchData} disabled={loading} variant="outline" size="sm" className="h-8 border-slate-800 bg-slate-900 text-xs text-slate-300">
              <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Làm mới Realtime
            </Button>
            <Button onClick={handleLogout} variant="destructive" size="sm" className="h-8 text-xs bg-rose-950/60 border border-rose-500/40 text-rose-300 hover:bg-rose-900">
              <LogOut className="h-3.5 w-3.5 mr-1" /> Thoát Root
            </Button>
          </div>
        </div>

        {/* 4 Chỉ số phần cứng */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-white/[0.08] bg-slate-950/80 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>CPU Usage</span>
              <Cpu className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-2">{server.cpu_usage_percent}%</div>
            <div className="h-1 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-cyan-400" style={{ width: `${server.cpu_usage_percent}%` }} />
            </div>
          </Card>

          <Card className="border border-white/[0.08] bg-slate-950/80 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>RAM Memory</span>
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-2">{server.ram_used_gb} / {server.ram_total_gb} GB</div>
            <div className="h-1 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-emerald-400" style={{ width: `${server.ram_usage_percent}%` }} />
            </div>
          </Card>

          <Card className="border border-white/[0.08] bg-slate-950/80 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Disk Storage</span>
              <HardDrive className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-2">{server.disk_usage_percent}%</div>
            <div className="h-1 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-purple-400" style={{ width: `${server.disk_usage_percent}%` }} />
            </div>
          </Card>

          <Card className="border border-white/[0.08] bg-slate-950/80 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Cluster Services</span>
              <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-400 mt-2">
              {services.fastapi_backend === "ONLINE" ? "ALL HEALTHY" : "DEGRADED"}
            </div>
            <p className="text-[10px] font-mono text-slate-400 mt-1">Backend: {services.fastapi_backend || "CHECKING"}</p>
          </Card>
        </div>

        {/* Bảng Global Scans */}
        <Card className="border border-white/[0.08] bg-slate-950/80 shadow-2xl">
          <CardHeader className="pb-3 border-b border-white/[0.06]">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-400" /> Lịch Sử Phiên Quét Toàn Cục (Global Audit)
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Kiểm soát tất cả mục tiêu được quét bởi các tài khoản trên nền tảng
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono">
                    <th className="pb-2">ID Phiên</th>
                    <th className="pb-2">Tài Khoản</th>
                    <th className="pb-2">Target Domain / URL</th>
                    <th className="pb-2">Lỗ Hổng</th>
                    <th className="pb-2">Trạng Thái</th>
                    <th className="pb-2 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {scans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-mono">
                        Chưa có phiên rà quét nào được kích hoạt
                      </td>
                    </tr>
                  ) : (
                    scans.map((s) => (
                      <tr key={s.job_id} className="hover:bg-slate-900/40">
                        <td className="py-3 font-mono text-cyan-300">{s.job_id}</td>
                        <td className="py-3 text-slate-300">{s.user_email}</td>
                        <td className="py-3 font-mono text-slate-200 font-medium">{s.target}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-mono border border-rose-500/30">
                            {s.total_vulns} Bugs
                          </span>
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              s.status === "COMPLETED"
                                ? "success"
                                : s.status === "KILLED_BY_ADMIN"
                                ? "danger"
                                : "default"
                            }
                            className="text-[10px] font-mono"
                          >
                            {s.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          {s.status === "RUNNING" && (
                            <Button size="sm" variant="destructive" onClick={() => handleKillJob(s.job_id)} className="h-6 px-2 text-[10px]">
                              <Ban className="h-3 w-3 mr-1" /> Kill Switch
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
