"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Cpu,
  DatabaseZap,
  HardDrive,
  HardHat,
  Power,
  Save,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getSystemStats } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type MaintenanceState = {
  enabled: boolean;
  status: "OFF" | "SCHEDULED" | "IN_PROGRESS" | "OVERRUN";
  engineer: string;
  startsAt: string | null;
  endsAt: string | null;
  message: string;
  updatedAt?: string | null;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

function toLocalInput(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 16);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export function AdminOverviewClient() {
  const [stats, setStats] =
    useState<Awaited<ReturnType<typeof getSystemStats>> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [maintenance, setMaintenance] =
    useState<MaintenanceState | null>(null);

  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [engineer, setEngineer] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const [maintenanceMessage, setMaintenanceMessage] = useState(
    "Hệ thống đang được bảo trì để nâng cấp dịch vụ."
  );

  const [maintenanceFeedback, setMaintenanceFeedback] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getSystemStats()
      .then((response) => {
        if (!active) return;
        setStats(response);
      })
      .catch((err) => {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Không thể tải admin overview."
        );
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function loadMaintenance() {
    setMaintenanceLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/maintenance`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      const state = data?.maintenance as MaintenanceState;

      setMaintenance(state);

      setEnabled(Boolean(state?.enabled));
      setEngineer(state?.engineer || "");
      setStartsAt(toLocalInput(state?.startsAt));
      setEndsAt(toLocalInput(state?.endsAt));

      setMaintenanceMessage(
        state?.message ||
          "Hệ thống đang được bảo trì để nâng cấp dịch vụ."
      );
    } catch (err) {
      setMaintenanceFeedback(
        err instanceof Error
          ? `Không tải được Maintenance Mode: ${err.message}`
          : "Không tải được Maintenance Mode."
      );
    } finally {
      setMaintenanceLoading(false);
    }
  }

  useEffect(() => {
    loadMaintenance();
  }, []);

  async function getAuthHeaders() {
    const supabase = createSupabaseBrowserClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Không tìm thấy phiên đăng nhập admin.");
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
    };
  }

  async function saveMaintenance(nextEnabled = enabled) {
    setMaintenanceSaving(true);
    setMaintenanceFeedback(null);

    try {
      if (nextEnabled && !engineer.trim()) {
        throw new Error("Anh cần nhập kỹ sư phụ trách.");
      }

      if (nextEnabled && (!startsAt || !endsAt)) {
        throw new Error(
          "Anh cần nhập thời gian bắt đầu và kết thúc."
        );
      }

      if (
        nextEnabled &&
        new Date(endsAt).getTime() <= new Date(startsAt).getTime()
      ) {
        throw new Error(
          "Thời gian kết thúc phải sau thời gian bắt đầu."
        );
      }

      const authHeaders = await getAuthHeaders();

      const response = await fetch(`${API_BASE}/api/maintenance`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          enabled: nextEnabled,
          engineer: engineer.trim(),

          startsAt: startsAt
            ? new Date(startsAt).toISOString()
            : null,

          endsAt: endsAt
            ? new Date(endsAt).toISOString()
            : null,

          message:
            maintenanceMessage.trim() ||
            "Hệ thống đang được bảo trì để nâng cấp dịch vụ.",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.error ||
            "Không thể cập nhật Maintenance Mode."
        );
      }

      const nextState = data?.maintenance as MaintenanceState;

      setMaintenance(nextState);
      setEnabled(Boolean(nextState.enabled));

      setMaintenanceFeedback(
        nextEnabled
          ? "Đã lưu cấu hình Maintenance Mode."
          : "Đã kết thúc bảo trì. Website hoạt động bình thường."
      );
    } catch (err) {
      setMaintenanceFeedback(
        err instanceof Error
          ? err.message
          : "Không thể cập nhật Maintenance Mode."
      );
    } finally {
      setMaintenanceSaving(false);
    }
  }

  const maintenanceStatus = useMemo(() => {
    switch (maintenance?.status) {
      case "SCHEDULED":
        return {
          label: "ĐÃ LÊN LỊCH",
          className:
            "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
        };

      case "IN_PROGRESS":
        return {
          label: "ĐANG BẢO TRÌ",
          className:
            "border-amber-500/30 bg-amber-500/10 text-amber-300",
        };

      case "OVERRUN":
        return {
          label: "QUÁ GIỜ DỰ KIẾN",
          className:
            "border-rose-500/30 bg-rose-500/10 text-rose-300",
        };

      default:
        return {
          label: "HỆ THỐNG HOẠT ĐỘNG",
          className:
            "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        };
    }
  }, [maintenance?.status]);

  return (
    <DashboardShell area="admin">
      <div className="space-y-6">

        {/* SYSTEM STATS */}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loading || !stats
            ? Array.from({ length: 4 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-36 rounded-3xl"
                />
              ))
            : [
                {
                  title: "CPU Backend",
                  value: `${stats.cpuUsage}%`,
                  icon: Cpu,
                  hint: "Node cluster / workers",
                },
                {
                  title: "RAM Backend",
                  value: `${stats.ramUsage}%`,
                  icon: HardDrive,
                  hint: "Memory footprint",
                },
                {
                  title: "Tổng người dùng",
                  value: formatNumber(stats.totalUsers),
                  icon: Users,
                  hint: "Registered accounts",
                },
                {
                  title: "Tổng lượt quét",
                  value: formatNumber(stats.totalScans),
                  icon: ShieldCheck,
                  hint: "System-wide scans",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <Card key={item.title}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm text-slate-400">
                            {item.title}
                          </p>

                          <p className="mt-4 text-3xl font-semibold text-slate-50">
                            {item.value}
                          </p>

                          <p className="mt-2 text-sm text-slate-500">
                            {item.hint}
                          </p>
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
            <CardContent className="p-6 text-rose-100">
              {error}
            </CardContent>
          </Card>
        ) : null}

        {/* MAINTENANCE CONTROL */}

        <Card className="overflow-hidden border-cyan-500/20">
          <CardHeader className="border-b border-slate-800 bg-slate-950/70">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-cyan-300" />
                  System Maintenance
                </CardTitle>

                <CardDescription className="mt-2">
                  Điều khiển chế độ bảo trì của toàn bộ nền tảng ADQ.
                </CardDescription>
              </div>

              <div
                className={`w-fit rounded-full border px-4 py-2 text-xs font-bold ${maintenanceStatus.className}`}
              >
                {maintenanceStatus.label}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {maintenanceLoading ? (
              <Skeleton className="h-72 rounded-3xl" />
            ) : (
              <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">

                <div className="space-y-5">

                  {/* SWITCH */}

                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div>
                      <p className="font-semibold text-slate-100">
                        Maintenance Mode
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Khi đang bảo trì, người dùng sẽ được chuyển
                        sang trang /maintenance.
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-label="Toggle Maintenance Mode"
                      onClick={() =>
                        setEnabled((current) => !current)
                      }
                      className={`relative h-7 w-14 shrink-0 rounded-full transition-colors ${
                        enabled
                          ? "bg-amber-500"
                          : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                          enabled ? "left-8" : "left-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* ENGINEER */}

                  <div>
                    <label className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
                      <HardHat className="h-4 w-4" />
                      Kỹ sư phụ trách
                    </label>

                    <Input
                      value={engineer}
                      onChange={(event) =>
                        setEngineer(event.target.value)
                      }
                      placeholder="Tên kỹ sư / đội kỹ thuật phụ trách"
                    />
                  </div>

                  {/* TIME */}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
                        <Clock3 className="h-4 w-4" />
                        Thời gian bắt đầu
                      </label>

                      <Input
                        type="datetime-local"
                        value={startsAt}
                        onChange={(event) =>
                          setStartsAt(event.target.value)
                        }
                      />
                    </div>

                    <div>
                      <label className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
                        <Clock3 className="h-4 w-4" />
                        Kết thúc dự kiến
                      </label>

                      <Input
                        type="datetime-local"
                        value={endsAt}
                        onChange={(event) =>
                          setEndsAt(event.target.value)
                        }
                      />
                    </div>
                  </div>

                  {/* MESSAGE */}

                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-400">
                      Nội dung hiển thị trên trang bảo trì
                    </label>

                    <textarea
                      value={maintenanceMessage}
                      onChange={(event) =>
                        setMaintenanceMessage(
                          event.target.value
                        )
                      }
                      rows={4}
                      placeholder="Nhập nội dung thông báo cho người dùng..."
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>

                  {maintenanceFeedback ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
                      {maintenanceFeedback}
                    </div>
                  ) : null}

                  {/* ACTIONS */}

                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={maintenanceSaving}
                      onClick={() =>
                        saveMaintenance(enabled)
                      }
                    >
                      <Save className="mr-2 h-4 w-4" />

                      {maintenanceSaving
                        ? "Đang lưu..."
                        : "Lưu cấu hình"}
                    </Button>

                    {maintenance?.enabled ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={maintenanceSaving}
                        onClick={() =>
                          saveMaintenance(false)
                        }
                        className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                      >
                        <Power className="mr-2 h-4 w-4" />
                        Kết thúc bảo trì ngay
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/* STATUS PANEL */}

                <div className="space-y-4">

                  <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Trạng thái hiện tại
                    </p>

                    <div className="mt-4 flex items-center gap-3">
                      <span
                        className={`h-3 w-3 rounded-full ${
                          maintenance?.enabled
                            ? "animate-pulse bg-amber-400"
                            : "bg-emerald-400"
                        }`}
                      />

                      <span className="font-semibold text-slate-100">
                        {maintenanceStatus.label}
                      </span>
                    </div>

                    <div className="mt-5 space-y-4 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">
                          Kỹ sư
                        </p>

                        <p className="mt-1 text-slate-200">
                          {maintenance?.engineer || "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Bắt đầu
                        </p>

                        <p className="mt-1 font-mono text-xs text-slate-300">
                          {formatDate(
                            maintenance?.startsAt
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Kết thúc dự kiến
                        </p>

                        <p className="mt-1 font-mono text-xs text-slate-300">
                          {formatDate(
                            maintenance?.endsAt
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {maintenance?.status === "OVERRUN" ? (
                    <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4">
                      <div className="flex gap-3">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-rose-300" />

                        <div>
                          <p className="text-sm font-semibold text-rose-200">
                            Bảo trì đã quá giờ dự kiến
                          </p>

                          <p className="mt-1 text-xs leading-5 text-rose-100/60">
                            Website vẫn ở Maintenance Mode cho
                            đến khi admin kết thúc bảo trì.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs leading-6 text-slate-400">
                    <p>
                      <span className="font-semibold text-cyan-300">
                        SCHEDULED
                      </span>{" "}
                      — đã lên lịch nhưng chưa đến giờ.
                    </p>

                    <p>
                      <span className="font-semibold text-amber-300">
                        IN PROGRESS
                      </span>{" "}
                      — đang trong thời gian bảo trì.
                    </p>

                    <p>
                      <span className="font-semibold text-rose-300">
                        OVERRUN
                      </span>{" "}
                      — đã quá thời gian dự kiến.
                    </p>
                  </div>

                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CAPACITY / NOTES */}

        <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle>System capacity</CardTitle>

              <CardDescription>
                Giám sát nhanh mức sử dụng tài nguyên vận hành
                của backend.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {loading || !stats ? (
                <Skeleton className="h-64 rounded-3xl" />
              ) : (
                <>
                  <ResourceBar
                    label="CPU Usage"
                    value={stats.cpuUsage}
                    icon={Cpu}
                  />

                  <ResourceBar
                    label="RAM Usage"
                    value={stats.ramUsage}
                    icon={HardDrive}
                  />

                  <ResourceBar
                    label="Running scans"
                    value={Math.min(
                      100,
                      stats.runningScans * 10
                    )}
                    icon={Activity}
                    suffix={`${stats.runningScans} jobs`}
                  />

                  <ResourceBar
                    label="Backend nodes"
                    value={Math.min(
                      100,
                      stats.backendNodes * 12
                    )}
                    icon={DatabaseZap}
                    suffix={`${stats.backendNodes} nodes`}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin notes</CardTitle>

              <CardDescription>
                Những điểm cần theo dõi để hệ thống quét hoạt
                động ổn định.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {[
                "Theo dõi CPU/RAM khi concurrent scan tăng mạnh do Pro Max queue.",
                "Kiểm tra running scans và queue depth để tránh nghẽn pipeline.",
                "Rà soát account status thường xuyên để loại bỏ user bị khóa hoặc pending lâu.",
                "Đồng bộ redeem codes với package entitlement trước mỗi đợt campaign.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300"
                >
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

          <span className="text-sm text-slate-200">
            {label}
          </span>
        </div>

        <span className="text-sm font-semibold text-slate-100">
          {suffix ?? `${value}%`}
        </span>
      </div>

      <Progress value={value} className="h-2.5" />
    </div>
  );
}
