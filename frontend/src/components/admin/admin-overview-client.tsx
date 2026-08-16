"use client";

import { useEffect, useState } from "react";
import { Activity, Cpu, DatabaseZap, HardDrive, ShieldCheck, Users } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getSystemStats } from "@/lib/api";
import { formatNumber } from "@/lib/utils";

export function AdminOverviewClient() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getSystemStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getSystemStats()
      .then((response) => {
        if (!active) return;
        setStats(response);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Không thể tải admin overview.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <DashboardShell area="admin">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loading || !stats
            ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-3xl" />)
            : [
                { title: "CPU Backend", value: `${stats.cpuUsage}%`, icon: Cpu, hint: "Node cluster / workers" },
                { title: "RAM Backend", value: `${stats.ramUsage}%`, icon: HardDrive, hint: "Memory footprint" },
                { title: "Tổng người dùng", value: formatNumber(stats.totalUsers), icon: Users, hint: "Registered accounts" },
                { title: "Tổng lượt quét", value: formatNumber(stats.totalScans), icon: ShieldCheck, hint: "System-wide scans" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm text-slate-400">{item.title}</p>
                          <p className="mt-4 text-3xl font-semibold text-slate-50">{item.value}</p>
                          <p className="mt-2 text-sm text-slate-500">{item.hint}</p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/10">
                          <Icon className="h-5 w-5 text-cyan-300" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
        </div>

        {error ? (
          <Card className="border-rose-500/20 bg-rose-500/10">
            <CardContent className="p-6 text-rose-100">{error}</CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle>System capacity</CardTitle>
              <CardDescription>Giám sát nhanh mức sử dụng tài nguyên vận hành của backend.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loading || !stats ? (
                <Skeleton className="h-64 rounded-3xl" />
              ) : (
                <>
                  <ResourceBar label="CPU Usage" value={stats.cpuUsage} icon={Cpu} />
                  <ResourceBar label="RAM Usage" value={stats.ramUsage} icon={HardDrive} />
                  <ResourceBar label="Running scans" value={Math.min(100, stats.runningScans * 10)} icon={Activity} suffix={`${stats.runningScans} jobs`} />
                  <ResourceBar label="Backend nodes" value={Math.min(100, stats.backendNodes * 12)} icon={DatabaseZap} suffix={`${stats.backendNodes} nodes`} />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin notes</CardTitle>
              <CardDescription>Những điểm cần theo dõi để hệ thống quét hoạt động ổn định.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                "Theo dõi CPU/RAM khi concurrent scan tăng mạnh do Pro Max queue.",
                "Kiểm tra running scans và queue depth để tránh nghẽn pipeline.",
                "Rà soát account status thường xuyên để loại bỏ user bị khóa hoặc pending lâu.",
                "Đồng bộ redeem codes với package entitlement trước mỗi đợt campaign.",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}

function ResourceBar({
  label,
  value,
  suffix,
  icon: Icon,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: typeof Cpu;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10">
            <Icon className="h-4 w-4 text-cyan-300" />
          </div>
          <span className="text-sm text-slate-200">{label}</span>
        </div>
        <span className="text-sm font-semibold text-slate-100">{suffix ?? `${value}%`}</span>
      </div>
      <Progress value={value} className="h-2.5" />
    </div>
  );
}
