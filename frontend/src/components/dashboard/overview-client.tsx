"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Clock3,
  Globe,
  Layers3,
  LoaderCircle,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PlainTips } from "@/components/workspace/friendly-ui";
import { getDashboardOverview, getScanResults, type ScanResult } from "@/lib/api";
import { formatDateTime, formatNumber, getSeverityColor } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";

const trendColors = {
  critical: "#fb7185",
  high: "#fb923c",
  medium: "#f59e0b",
  low: "#22d3ee",
};

const pieColors = ["#06b6d4", "#10b981", "#38bdf8", "#f59e0b", "#818cf8"];

export function OverviewClient() {
  const { user, updateUser } = useAuth();
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardOverview>> | null>(null);
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;

    Promise.all([getDashboardOverview(), getScanResults()])
      .then(([overviewResponse, scanResponse]) => {
        if (!active) return;
        setData(overviewResponse);
        setScans(scanResponse);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Không thể tải dashboard.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo(() => {
    if (!data) return [];
    return [
      { icon: Target, title: data.metrics.totalTargets.label, value: data.metrics.totalTargets.value, change: data.metrics.totalTargets.change },
      { icon: AlertTriangle, title: data.metrics.totalVulnerabilities.label, value: data.metrics.totalVulnerabilities.value, change: data.metrics.totalVulnerabilities.change },
      { icon: Boxes, title: data.metrics.totalAssets.label, value: data.metrics.totalAssets.value, change: data.metrics.totalAssets.change },
      { icon: Globe, title: data.metrics.subdomains.label, value: data.metrics.subdomains.value, change: data.metrics.subdomains.change },
    ];
  }, [data]);

  const latestScan = scans[0] ?? null;

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6">

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-3xl" />)
            : cards.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title} className="overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-[var(--foreground-muted)]">{item.title}</p>
                          <p className="mt-4 text-3xl font-semibold text-[var(--foreground)]">{formatNumber(item.value)}</p>
                          <p className="mt-2 text-sm text-emerald-500 dark:text-emerald-300">{item.change}</p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color:var(--accent-soft)]">
                          <Icon className="h-5 w-5 text-[color:var(--accent-strong)]" />
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

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <Card>
            <CardHeader>
              <CardTitle>Xu hướng lỗ hổng</CardTitle>
              <CardDescription>Biểu đồ này cho biết số cảnh báo tăng hay giảm qua từng lần quét gần đây.</CardDescription>
            </CardHeader>
            <CardContent className="h-[340px]">
              {loading || !data ? (
                <Skeleton className="h-full rounded-2xl" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.vulnerabilityTrend}>
                    <defs>
                      <linearGradient id="criticalGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={trendColors.critical} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={trendColors.critical} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="highGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={trendColors.high} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={trendColors.high} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(148,163,184,0.18)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--foreground-muted)" tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--foreground-muted)" tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ stroke: "#155e75", strokeDasharray: "3 3" }}
                      contentStyle={{
                        backgroundColor: "var(--background-elevated)",
                        borderColor: "rgba(6, 182, 212, 0.2)",
                        borderRadius: 16,
                        color: "var(--foreground)",
                      }}
                    />
                    <Area type="monotone" dataKey="critical" stroke={trendColors.critical} fill="url(#criticalGlow)" strokeWidth={2} />
                    <Area type="monotone" dataKey="high" stroke={trendColors.high} fill="url(#highGlow)" strokeWidth={2} />
                    <Area type="monotone" dataKey="medium" stroke={trendColors.medium} fillOpacity={0} strokeWidth={2} />
                    <Area type="monotone" dataKey="low" stroke={trendColors.low} fillOpacity={0} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Phân bổ Tech Stack</CardTitle>
              <CardDescription>Cho biết website của bạn đang dùng công nghệ nào, ví dụ WordPress, React hay Laravel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading || !data ? (
                <Skeleton className="h-[300px] rounded-2xl" />
              ) : (
                <>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.techStackDistribution} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={4}>
                          {data.techStackDistribution.map((entry, index) => (
                            <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--background-elevated)",
                            borderColor: "rgba(6, 182, 212, 0.2)",
                            borderRadius: 16,
                            color: "var(--foreground)",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {data.techStackDistribution.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: pieColors[index % pieColors.length] }} />
                          <span className="text-sm text-[var(--foreground)]">{item.name}</span>
                        </div>
                        <span className="text-sm font-medium text-[var(--foreground-soft)]">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Danh sách ưu tiên xử lý</CardTitle>
              <CardDescription>Điểm càng cao thì bạn càng nên xem mục đó trước. Đây là gợi ý, không phải kết luận cuối cùng.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading || !data ? (
                Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)
              ) : (
                data.riskPriorityTable.map((item) => (
                  <div key={item.target} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] p-4">
                    <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium text-[var(--foreground)]">{item.target}</p>
                        <p className="text-sm text-[var(--foreground-muted)]">{item.primaryIssue}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={item.flagLikelihood === "HIGH" ? "danger" : item.flagLikelihood === "MEDIUM" ? "warning" : "default"}>
                          Flag {item.flagLikelihood}
                        </Badge>
                        <span className={`rounded-full border px-3 py-1 text-xs ${getSeverityColor(item.severity)}`}>{item.severity}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Progress value={item.riskScore} className="h-2.5 flex-1" />
                      <span className="min-w-14 text-right text-sm font-semibold text-[color:var(--accent-strong)]">{item.riskScore}/100</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Trạng thái hiện tại</CardTitle>
                <CardDescription>Cho biết hệ thống có đang quét hay không và lần cập nhật gần nhất là khi nào.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading || !data ? (
                  <Skeleton className="h-40 rounded-2xl" />
                ) : (
                  <>
                    <IndicatorRow icon={Radar} label="Lượt quét đang chạy" value={String(data.realtime.activeScans)} />
                    <IndicatorRow icon={Layers3} label="Số mục đang chờ" value={String(data.realtime.queueDepth)} />
                    <IndicatorRow icon={ShieldCheck} label="Tỷ lệ thành công" value={`${data.realtime.successRate}%`} />
                    <IndicatorRow icon={Clock3} label="Cập nhật gần nhất" value={formatDateTime(data.realtime.lastUpdatedAt)} />
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hoạt động gần đây</CardTitle>
                <CardDescription>Danh sách những lượt quét mới chạy để bạn không bị lạc giữa nhiều kết quả.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading || !data ? (
                  Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-2xl" />)
                ) : (
                  data.recentActivity.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-[var(--foreground)]">{item.target}</p>
                        <Badge variant={item.state === "RUNNING" ? "success" : item.state === "QUEUED" ? "warning" : "default"}>
                          {translateStatus(item.state)}
                        </Badge>
                      </div>
                      <p className="line-clamp-1 text-xs text-[var(--foreground-muted)]">{item.title}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                        <Activity className="h-3.5 w-3.5" />
                        {formatDateTime(item.startedAt)}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <PlainTips
          title="Mẹo đọc nhanh"
          items={[
            "Nếu bạn chỉ muốn biết website có gì đáng lo, hãy nhìn vào các ô số ở đầu trang và mục `Danh sách ưu tiên xử lý`.",
            "Nếu chưa hiểu biểu đồ, hãy ưu tiên đọc các chỉ số tổng quan và các cảnh báo có mức độ nghiêm trọng cao nhất.",
            "Các mục có màu đỏ hoặc điểm cao hơn thường cần xem trước, nhưng vẫn nên kiểm tra ngữ cảnh trước khi kết luận.",
          ]}
        />
      </div>
    </DashboardShell>
  );
}

function IndicatorRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--accent)_20%,transparent)] bg-[color:var(--accent-soft)]">
          <Icon className="h-4 w-4 text-[color:var(--accent-strong)]" />
        </div>
        <span className="text-sm text-[var(--foreground-soft)]">{label}</span>
      </div>
      <span className="text-sm font-semibold text-[var(--foreground)]">{value}</span>
    </div>
  );
}

function translateStatus(status: string) {
  if (status === "RUNNING") return "Đang quét";
  if (status === "QUEUED") return "Đang chờ";
  if (status === "COMPLETED") return "Đã xong";
  return status;
}
