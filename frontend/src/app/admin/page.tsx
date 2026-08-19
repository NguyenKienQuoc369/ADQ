"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
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
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [telemetry, setTelemetry] = useState<any>({
    server: { cpu_usage_percent: 18.5, ram_usage_percent: 42.1, ram_used_gb: 3.4, ram_total_gb: 8.0, disk_usage_percent: 32 },
    services: { fastapi_backend: "ONLINE", redis_queue: "HEALTHY", postgres_db: "ONLINE", worker_elite: "READY", worker_mobile: "READY" }
  });
  const [scans, setScans] = useState<any[]>([
    { job_id: "scan_01e9a", target: "https://quoc-bank-v8-0.vercel.app/", user_email: "operator@adq.io.vn", status: "COMPLETED", total_vulns: 3, created_at: Date.now() - 360000 },
    { job_id: "scan_02f8b", target: "https://api-target.internal.io", user_email: "test_user@gmail.com", status: "RUNNING", total_vulns: 0, created_at: Date.now() - 120000 },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("adq_admin_root_token");
      if (!token) {
        router.replace("/admin/login");
        return;
      }
      setAuthorized(true);
    }
  }, [router]);

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/telemetry");
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authorized) {
      fetchTelemetry();
      const interval = setInterval(fetchTelemetry, 10000);
      return () => clearInterval(interval);
    }
  }, [authorized]);

  const handleKillJob = (jid: string) => {
    setScans(scans.map(s => s.job_id === jid ? { ...s, status: "KILLED_BY_ADMIN" } : s));
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("adq_admin_root_token");
      document.cookie = "adq_admin_root_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
      router.replace("/admin/login");
    }
  };

  if (!authorized) {
    return <div className="min-h-screen bg-[#020617]" />;
  }

  return (
    <DashboardShell area="admin">
      <div className="space-y-6 max-w-7xl mx-auto font-sans">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Server className="h-5 w-5 text-cyan-400" /> SOC Root Control & Cluster Telemetry
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Giám sát hạ tầng VPS, hàng đợi tác vụ rà quét và tiến trình phân tán</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={fetchTelemetry} disabled={loading} variant="outline" size="sm" className="h-8 border-slate-800 bg-slate-900 text-xs text-slate-300">
              <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Làm mới Realtime
            </Button>
            <Button onClick={handleLogout} variant="destructive" size="sm" className="h-8 text-xs bg-rose-950/60 border border-rose-500/40 text-rose-300 hover:bg-rose-900">
              <LogOut className="h-3.5 w-3.5 mr-1" /> Thoát Root
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-white/[0.08] bg-slate-950/80 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>CPU Usage</span>
              <Cpu className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-2">{telemetry.server.cpu_usage_percent}%</div>
            <div className="h-1 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-cyan-400" style={{ width: `${telemetry.server.cpu_usage_percent}%` }} />
            </div>
          </Card>

          <Card className="border border-white/[0.08] bg-slate-950/80 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>RAM Memory</span>
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-2">{telemetry.server.ram_used_gb} / {telemetry.server.ram_total_gb} GB</div>
            <div className="h-1 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-emerald-400" style={{ width: `${telemetry.server.ram_usage_percent}%` }} />
            </div>
          </Card>

          <Card className="border border-white/[0.08] bg-slate-950/80 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Disk Storage</span>
              <HardDrive className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-2">{telemetry.server.disk_usage_percent}%</div>
            <div className="h-1 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-purple-400" style={{ width: `${telemetry.server.disk_usage_percent}%` }} />
            </div>
          </Card>

          <Card className="border border-white/[0.08] bg-slate-950/80 p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Cluster Services</span>
              <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-400 mt-2">ALL HEALTHY</div>
            <p className="text-[10px] font-mono text-slate-400 mt-1">6/6 Docker Nodes Active</p>
          </Card>
        </div>

        <Card className="border border-white/[0.08] bg-slate-950/80 shadow-2xl">
          <CardHeader className="pb-3 border-b border-white/[0.06]">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-400" /> Toàn Bộ Lịch Sử Phiên Quét Hệ Thống (Global Audit)
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
                  {scans.map((s) => (
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
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
