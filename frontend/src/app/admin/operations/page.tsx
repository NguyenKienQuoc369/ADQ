"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  WifiOff,
  Workflow,
} from "lucide-react";

import { AdminShell } from "@/components/admin/admin-shell";
import { SocSessionGuard } from "@/components/admin/soc-session-guard";
import { Button } from "@/components/ui/button";

type ServiceStatus = "ONLINE" | "HEALTHY" | "READY" | "BUSY" | "OFFLINE" | "DEGRADED" | "UNKNOWN" | string;

type WorkerRecord = {
  worker_id?: string;
  id?: string;
  name?: string;
  status?: ServiceStatus;
  heartbeat_ttl?: number | null;
  processing_jobs?: number;
  queue_depth?: number;
  [key: string]: unknown;
};

type Telemetry = {
  ok?: boolean;
  timestamp?: string;
  server?: {
    scope?: string;
    available?: boolean;

    cpu_usage_percent?: number | null;

    ram_usage_percent?: number | null;
    ram_used_gb?: number | null;
    ram_total_gb?: number | null;

    disk_usage_percent?: number | null;
    disk_used_gb?: number | null;
    disk_total_gb?: number | null;
    disk_free_gb?: number | null;

    load_1m?: number | null;
    load_5m?: number | null;
    load_15m?: number | null;

    uptime_seconds?: number | null;
  };
  services?: {
    fastapi_backend?: ServiceStatus;
    redis_queue?: ServiceStatus;
    postgres_db?: ServiceStatus;
    worker_elite?: ServiceStatus;
    worker_mobile?: ServiceStatus;
    worker_light?: ServiceStatus;
    [key: string]: ServiceStatus | undefined;
  };
  queues?: {
    scan_queue?: number | null;
    processing_jobs?: number | null;
  };

  watchdog?: {
    source?: string;
    reachable?: boolean;
    latency_ms?: number;
    timeout_ms?: number;
  };
  workers?: WorkerRecord[];
  diagnostics?: {
    redis_error?: string | null;
    postgres_error?: string | null;
    [key: string]: string | null | undefined;
  };
};

function statusClass(status?: string) {
  switch (status) {
    case "ONLINE":
    case "HEALTHY":
    case "READY":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "BUSY":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
    case "DEGRADED":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "OFFLINE":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    default:
      return "border-slate-700 bg-slate-800/70 text-slate-400";
  }
}

function StatusBadge({ status }: { status?: string }) {
  const value = status || "UNKNOWN";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider ${statusClass(
        value
      )}`}
    >
      {value}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </span>
        <Icon className="h-4 w-4 text-slate-500" />
      </div>

      <div className="text-2xl font-black text-white">{value}</div>

      {detail ? (
        <div className="mt-2 text-xs text-slate-500">{detail}</div>
      ) : null}
    </div>
  );
}

function OperationsContent() {
  const [data, setData] = useState<Telemetry | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTelemetry = useCallback(async (manual = false) => {
    try {
      if (manual) setRefreshing(true);

      const response = await fetch("/api/admin/telemetry", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (response.status === 401 || response.status === 403) {
        window.location.href = "/admin";
        return;
      }

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error || `Telemetry request failed (${response.status})`
        );
      }

      setData(payload);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Không thể tải telemetry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTelemetry();

    const interval = window.setInterval(() => {
      loadTelemetry();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadTelemetry]);

  const server = data?.server;
  const services = data?.services;
  const queues = data?.queues;
  const workers = Array.isArray(data?.workers) ? data.workers : [];

  const diagnostics = Object.entries(data?.diagnostics || {}).filter(
    ([, value]) => Boolean(value)
  );

  return (
    <AdminShell>
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-rose-400">
              <Activity className="h-4 w-4" />
              SOC Operations
            </div>

            <h1 className="text-2xl font-black tracking-tight text-white">
              Runtime Operations
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Trạng thái runtime đọc trực tiếp từ telemetry backend. Không sử dụng
              trạng thái worker giả hoặc fallback READY.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {data?.timestamp ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock3 className="h-3.5 w-3.5" />
                {new Date(data.timestamp).toLocaleString()}
              </div>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              disabled={refreshing}
              onClick={() => loadTelemetry(true)}
              className="border-white/10 bg-slate-950 text-slate-300 hover:bg-slate-900"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Làm mới
            </Button>
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-bold">Telemetry unavailable</div>
              <div className="mt-1 font-mono text-xs text-rose-300/80">
                {error}
              </div>
            </div>
          </div>
        ) : null}

        {loading && !data ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-white/[0.08] bg-slate-950/50">
            <RefreshCw className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                label="VPS Host"
                icon={Server}
                value={
                  <StatusBadge
                    status={
                      services?.vps_host ||
                      (server?.available ? "ONLINE" : "UNAVAILABLE")
                    }
                  />
                }
                detail={
                  data?.watchdog?.reachable === false
                    ? "External watchdog cannot reach VPS"
                    : "VPS host telemetry"
                }
              />

              <MetricCard
                label="CPU"
                icon={Activity}
                value={
                  server?.available &&
                  server?.cpu_usage_percent !== null &&
                  server?.cpu_usage_percent !== undefined
                    ? `${server.cpu_usage_percent}%`
                    : "UNAVAILABLE"
                }
                detail="VPS host CPU"
              />

              <MetricCard
                label="RAM"
                icon={Server}
                value={
                  server?.available &&
                  server?.ram_usage_percent !== null &&
                  server?.ram_usage_percent !== undefined
                    ? `${server.ram_usage_percent}%`
                    : "UNAVAILABLE"
                }
                detail={
                  server?.available &&
                  server?.ram_used_gb !== null &&
                  server?.ram_used_gb !== undefined &&
                  server?.ram_total_gb !== null &&
                  server?.ram_total_gb !== undefined
                    ? `${server.ram_used_gb} GB / ${server.ram_total_gb} GB`
                    : "VPS host memory unavailable"
                }
              />

              <MetricCard
                label="Disk"
                icon={HardDrive}
                value={
                  server?.available &&
                  server?.disk_usage_percent !== null &&
                  server?.disk_usage_percent !== undefined
                    ? `${server.disk_usage_percent}%`
                    : "UNAVAILABLE"
                }
                detail={
                  server?.available &&
                  server?.disk_free_gb !== null &&
                  server?.disk_free_gb !== undefined
                    ? `${server.disk_free_gb} GB free`
                    : "VPS host disk unavailable"
                }
              />

              <MetricCard
                label="Scan Queue"
                icon={Workflow}
                value={
                  queues?.scan_queue === null ||
                  queues?.scan_queue === undefined
                    ? "UNAVAILABLE"
                    : queues.scan_queue
                }
                detail={
                  queues?.processing_jobs === null ||
                  queues?.processing_jobs === undefined
                    ? "Processing unavailable"
                    : `${queues.processing_jobs} processing`
                }
              />
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Server className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-bold text-white">Core Services</h2>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["VPS Host", services?.vps_host],
                  ["FastAPI Backend", services?.fastapi_backend],
                  ["PostgreSQL", services?.postgres_db],
                  ["Redis Queue", services?.redis_queue],
                  ["Worker Elite", services?.worker_elite],
                  ["Worker Mobile", services?.worker_mobile],
                  ["Worker Light", services?.worker_light],
                ].map(([label, status]) => (
                  <div
                    key={String(label)}
                    className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-slate-950/60 p-4"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-200">
                        {label}
                      </div>

                      <div className="mt-1 text-[11px] text-slate-600">
                        Runtime health
                      </div>
                    </div>

                    <StatusBadge status={status} />
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-slate-500" />
                  <h2 className="text-sm font-bold text-white">
                    Worker Heartbeats
                  </h2>
                </div>

                <span className="text-xs text-slate-500">
                  {workers.length} worker{workers.length === 1 ? "" : "s"}
                </span>
              </div>

              {workers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/[0.1] bg-slate-950/40 px-6 py-10 text-center">
                  <WifiOff className="mx-auto mb-3 h-6 w-6 text-slate-600" />

                  <div className="text-sm font-semibold text-slate-300">
                    Không phát hiện worker heartbeat
                  </div>

                  <div className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-500">
                    Đây không được coi là READY. Worker sẽ xuất hiện tại đây khi
                    Redis telemetry phát hiện heartbeat thật.
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-950/60">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-white/[0.08] bg-slate-900/60 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Worker</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold">
                            Processing
                          </th>
                          <th className="px-4 py-3 font-semibold">
                            Heartbeat TTL
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {workers.map((worker, index) => {
                          const workerName =
                            worker.worker_id ||
                            worker.id ||
                            worker.name ||
                            `worker-${index + 1}`;

                          return (
                            <tr
                              key={`${workerName}-${index}`}
                              className="border-b border-white/[0.05] last:border-0"
                            >
                              <td className="px-4 py-3 font-mono text-slate-300">
                                {workerName}
                              </td>

                              <td className="px-4 py-3">
                                <StatusBadge status={worker.status} />
                              </td>

                              <td className="px-4 py-3 font-mono text-slate-400">
                                {worker.processing_jobs ??
                                  worker.queue_depth ??
                                  0}
                              </td>

                              <td className="px-4 py-3 font-mono text-slate-400">
                                {worker.heartbeat_ttl === null ||
                                worker.heartbeat_ttl === undefined
                                  ? "—"
                                  : `${worker.heartbeat_ttl}s`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-bold text-white">External Watchdog</h2>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">
                    Reachability
                  </div>
                  <div className="mt-2">
                    <StatusBadge
                      status={
                        data?.watchdog?.reachable === true
                          ? "ONLINE"
                          : data?.watchdog?.reachable === false
                            ? "OFFLINE"
                            : "UNKNOWN"
                      }
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">
                    API Latency
                  </div>
                  <div className="mt-2 font-mono text-xl font-bold text-white">
                    {data?.watchdog?.latency_ms === undefined
                      ? "UNAVAILABLE"
                      : `${data.watchdog.latency_ms} ms`}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">
                    Last Check
                  </div>
                  <div className="mt-2 font-mono text-sm font-semibold text-white">
                    {data?.timestamp
                      ? new Date(data.timestamp).toLocaleString()
                      : "UNAVAILABLE"}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Database className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-bold text-white">Diagnostics</h2>
              </div>

              {diagnostics.length === 0 ? (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />

                  <div>
                    <div className="text-sm font-semibold text-emerald-300">
                      Không có diagnostic error
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Các health check hiện tại không báo lỗi.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {diagnostics.map(([key, message]) => (
                    <div
                      key={key}
                      className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4"
                    >
                      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                        <AlertTriangle className="h-4 w-4" />
                        {key.replaceAll("_", " ")}
                      </div>

                      <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-400">
                        {message}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="text-right text-[10px] uppercase tracking-[0.16em] text-slate-700">
              Auto refresh every 5 seconds · Read-only
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}

export default function OperationsPage() {
  return (
    <SocSessionGuard>
      <OperationsContent />
    </SocSessionGuard>
  );
}
