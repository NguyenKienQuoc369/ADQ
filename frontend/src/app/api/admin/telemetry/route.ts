import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin";

export const dynamic = "force-dynamic";

const WATCHDOG_TIMEOUT_MS = 4000;

function unavailableTelemetry({
  reason,
  latencyMs,
  apiStatus,
  vpsStatus,
}: {
  reason: string;
  latencyMs: number;
  apiStatus: "UNREACHABLE" | "DEGRADED";
  vpsStatus: "OFFLINE" | "UNAVAILABLE";
}) {
  return {
    ok: false,
    timestamp: new Date().toISOString(),

    server: {
      scope: "VPS_HOST",
      available: false,
      cpu_usage_percent: null,
      ram_usage_percent: null,
      ram_used_gb: null,
      ram_total_gb: null,
      disk_usage_percent: null,
      disk_used_gb: null,
      disk_total_gb: null,
      disk_free_gb: null,
      load_1m: null,
      load_5m: null,
      load_15m: null,
      uptime_seconds: null,
    },

    backend_runtime: null,

    services: {
      vps_host: vpsStatus,
      fastapi_backend: apiStatus,
      redis_queue: "UNAVAILABLE",
      postgres_db: "UNAVAILABLE",
      worker_elite: "UNAVAILABLE",
      worker_mobile: "UNAVAILABLE",
      worker_light: "UNAVAILABLE",
    },

    queues: {
      scan_queue: null,
      processing_jobs: null,
    },

    workers: [],

    diagnostics: {
      watchdog_error: reason,
      host_telemetry_error: null,
      redis_error: null,
      postgres_error: null,
    },

    watchdog: {
      source: "VERCEL_SOC",
      reachable: false,
      latency_ms: latencyMs,
      timeout_ms: WATCHDOG_TIMEOUT_MS,
    },
  };
}

export async function GET() {
  try {
    await requireAdminRequest();
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (error?.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "SOC_AUTH_FAILED" },
      { status: 500 }
    );
  }

  const backendUrl =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://api.adq.io.vn";

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    WATCHDOG_TIMEOUT_MS
  );

  const startedAt = Date.now();

  try {
    const res = await fetch(
      `${backendUrl}/api/admin/telemetry`,
      {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      }
    );

    const latencyMs = Date.now() - startedAt;

    if (!res.ok) {
      const body = await res
        .text()
        .catch(() => "");

      return NextResponse.json(
        unavailableTelemetry({
          reason:
            `Backend responded HTTP ${res.status}` +
            (body ? `: ${body.slice(0, 200)}` : ""),
          latencyMs,
          apiStatus: "DEGRADED",
          vpsStatus: "UNAVAILABLE",
        }),
        {
          // SOC vẫn render dashboard thay vì biến thành trang lỗi.
          status: 200,
        }
      );
    }

    const data = await res.json();

    return NextResponse.json(
      {
        ...data,

        watchdog: {
          source: "VERCEL_SOC",
          reachable: true,
          latency_ms: latencyMs,
          timeout_ms: WATCHDOG_TIMEOUT_MS,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    const latencyMs = Date.now() - startedAt;

    const timedOut =
      error?.name === "AbortError";

    return NextResponse.json(
      unavailableTelemetry({
        reason: timedOut
          ? `VPS telemetry timeout after ${WATCHDOG_TIMEOUT_MS}ms`
          : error?.message ||
            "VPS telemetry connection failed",
        latencyMs,
        apiStatus: "UNREACHABLE",
        vpsStatus: "OFFLINE",
      }),
      {
        // 200 có chủ đích:
        // SOC vẫn sống và render trạng thái VPS OFFLINE.
        status: 200,
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}
