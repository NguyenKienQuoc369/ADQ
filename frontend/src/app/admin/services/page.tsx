"use client";

import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Server, RefreshCw, AlertCircle, CheckCircle2, Radio, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminServicesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/data/overview");
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/admin/login";
        return;
      }
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Không thể tải trạng thái");
      setData(json);
    } catch (err: any) {
      setError(err.message || "Lỗi tải trạng thái services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const workerHeartbeats = data?.workerHeartbeats || {};

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Server className="h-5 w-5 text-emerald-400" />
              Trạng thái Dịch vụ & Workers Phân tán
            </h1>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Theo dõi trực tiếp nhịp tim (Heartbeat) và khả năng xử lý tác vụ của từng worker node
            </p>
          </div>
          <Button
            onClick={fetchOverview}
            variant="outline"
            size="sm"
            disabled={loading}
            className="h-8 gap-2 border-[#333333] bg-[#0a0a0a] text-xs text-neutral-300 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Nodes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* API Server */}
          <div className="p-5 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-white font-mono">adq_api (FastAPI Core Engine)</div>
              <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> ONLINE
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Cung cấp toàn bộ REST API rà quét DAST, Recon, APK Analysis, Stress Engine, AI Copilot streaming.
            </p>
            <div className="text-[11px] font-mono text-neutral-500 pt-2 border-t border-[#1a1a1a]">
              Port: 8000 • Protocol: HTTP/2 via Caddy Proxy
            </div>
          </div>

          {/* Web Dashboard */}
          <div className="p-5 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-white font-mono">adq_dashboard (Next.js 16)</div>
              <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> ONLINE
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Giao diện điều hành chính `adq.io.vn` và SOC Control Center `adq-soc.click`.
            </p>
            <div className="text-[11px] font-mono text-neutral-500 pt-2 border-t border-[#1a1a1a]">
              Port: 3000 • SSR & Server Components
            </div>
          </div>

          {/* Worker Light */}
          <div className="p-5 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-white font-mono">adq-worker-light-1</div>
              <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> ACTIVE
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Phụ trách thu thập bề mặt tấn công: Subfinder, DNSX, Katana, GAU, Wayback URLs, Naabu Port Scan.
            </p>
            <div className="text-[11px] font-mono text-neutral-500 pt-2 border-t border-[#1a1a1a]">
              Capabilities: recon_infra, web_mapping
            </div>
          </div>

          {/* Worker Elite */}
          <div className="p-5 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-white font-mono">adq-worker-elite-1</div>
              <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> ACTIVE
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Phụ trách quét lỗ hổng sâu: Nuclei Custom Engine, DAST Active Fuzzing, Secret Hunter, Logic Flaws.
            </p>
            <div className="text-[11px] font-mono text-neutral-500 pt-2 border-t border-[#1a1a1a]">
              Capabilities: dast_active, deep_logic
            </div>
          </div>

          {/* Worker Stress */}
          <div className="p-5 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-white font-mono">adq_worker_stress (worker-stress-1)</div>
              <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> ACTIVE
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Phụ trách phát tải RPS tốc độ cao, đo lường latency percentiles, WAF challenge telemetry.
            </p>
            <div className="text-[11px] font-mono text-neutral-500 pt-2 border-t border-[#1a1a1a]">
              Capabilities: stress_test • Telemetry: Redis PubSub
            </div>
          </div>

          {/* OAST Server */}
          <div className="p-5 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-white font-mono">adq_oast (Out-of-band AST)</div>
              <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> LISTENING
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Lắng nghe callback tương tác ngoài luồng (SSRF, Blind RCE, DNS Exfiltration).
            </p>
            <div className="text-[11px] font-mono text-neutral-500 pt-2 border-t border-[#1a1a1a]">
              Port: 8888 • DNS/HTTP/HTTPS Callback Listener
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
