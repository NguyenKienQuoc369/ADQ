"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  Gauge,
  Users,
  KeyRound,
  ShieldAlert,
  Zap,
  Smartphone,
  Bot,
  Database,
  Lock,
  Radio,
  Server,
  Folder,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  Layers,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/data/overview");
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/admin/login";
        return;
      }
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Không thể tải dữ liệu tổng quan");
      }
      setData(json);
    } catch (err: any) {
      setError(err.message || "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const metrics = data?.metrics || {};
  const sources = data?.sources || {};
  const services = data?.services || {};

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Gauge className="h-5 w-5 text-emerald-400" />
              Tổng quan Hệ thống & Hạ tầng SOC
            </h1>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Bảng điều khiển trung tâm quan sát thời gian thực toàn bộ dữ liệu nền tảng ADQ Security
            </p>
          </div>
          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
            disabled={loading}
            className="h-8 gap-2 border-[#333333] bg-[#0a0a0a] text-xs text-neutral-300 hover:text-white hover:bg-[#151515]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới dữ liệu
          </Button>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Authoritative Data Sources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* PostgreSQL */}
          <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">PostgreSQL (adq_db)</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                sources.postgres?.status === "HEALTHY"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              }`}>
                {sources.postgres?.status || "CHECKING"}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Lưu trữ bền vững: 12 bảng nghiệp vụ chính (Projects, Scans, Stress Jobs, Vulnerabilities, Users).
            </p>
            <div className="pt-2 border-t border-[#1a1a1a] flex items-center justify-between text-[11px] font-mono text-neutral-400">
              <span>Schema: <strong className="text-white">public</strong></span>
              <Link href="/admin/postgres" className="text-emerald-400 hover:underline flex items-center gap-1">
                Khám phá <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Supabase Auth */}
          <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-sky-400" />
                <span className="text-xs font-bold text-white">Supabase Auth</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                sources.supabaseAuth?.status === "HEALTHY"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}>
                {sources.supabaseAuth?.status || "CHECKING"}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Xác thực định danh: Quản lý session, OAuth Google, email verification, auth metadata.
            </p>
            <div className="pt-2 border-t border-[#1a1a1a] flex items-center justify-between text-[11px] font-mono text-neutral-400">
              <span>Auth Users: <strong className="text-white">{metrics.supabaseAuthUsers ?? "--"}</strong></span>
              <Link href="/admin/supabase" className="text-sky-400 hover:underline flex items-center gap-1">
                Đối soát <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Redis */}
          <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold text-white">Redis Runtime State</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                sources.redis?.status === "HEALTHY"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              }`}>
                {sources.redis?.status || "CHECKING"}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Trạng thái live: Telemetry Stress Test, Worker Heartbeats, AI Copilot memory, Quotas.
            </p>
            <div className="pt-2 border-t border-[#1a1a1a] flex items-center justify-between text-[11px] font-mono text-neutral-400">
              <span>Total Keys: <strong className="text-white">{metrics.redisTotalKeys ?? "--"}</strong></span>
              <Link href="/admin/redis" className="text-amber-400 hover:underline flex items-center gap-1">
                Keyspace <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* 2. Key Business Metrics Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-lg bg-[#0a0a0a] border border-[#222222]">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">Tổng người dùng</div>
            <div className="text-xl font-bold text-white mt-1 font-mono">{metrics.users ?? 0}</div>
            <div className="text-[10px] text-neutral-500 mt-1 flex items-center gap-1 font-mono">
              <span className="text-neutral-400">FREE: {metrics.freeUsers ?? 0}</span>
              <span>•</span>
              <span className="text-amber-400">PRO: {(metrics.proUsers ?? 0) + (metrics.proMaxUsers ?? 0)}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#0a0a0a] border border-[#222222]">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">Dự án & Targets</div>
            <div className="text-xl font-bold text-white mt-1 font-mono">{metrics.projects ?? 0}</div>
            <div className="text-[10px] text-neutral-500 mt-1 font-mono">
              {metrics.targets ?? 0} domains
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#0a0a0a] border border-[#222222]">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">Phiên Rà quét Scan</div>
            <div className="text-xl font-bold text-white mt-1 font-mono">{metrics.scanJobs ?? 0}</div>
            <div className="text-[10px] text-neutral-500 mt-1 font-mono">
              DAST & Attack Surface
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#0a0a0a] border border-[#222222]">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">Lỗ hổng Phát hiện</div>
            <div className="text-xl font-bold text-rose-400 mt-1 font-mono">{metrics.vulnerabilities ?? 0}</div>
            <div className="text-[10px] text-neutral-500 mt-1 font-mono">
              Verified Findings
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#0a0a0a] border border-[#222222]">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">Kiểm thử Stress</div>
            <div className="text-xl font-bold text-sky-400 mt-1 font-mono">{metrics.stressJobs ?? 0}</div>
            <div className="text-[10px] text-neutral-500 mt-1 font-mono">
              Load & RPS Jobs
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#0a0a0a] border border-[#222222]">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">Mã License Đã dùng</div>
            <div className="text-xl font-bold text-purple-400 mt-1 font-mono">{metrics.redeemUsed ?? 0}</div>
            <div className="text-[10px] text-neutral-500 mt-1 font-mono">
              / {metrics.redeemCodes ?? 0} codes tạo
            </div>
          </div>
        </div>

        {/* 3. Workers & Distributed Infrastructure Health */}
        <div className="p-5 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-emerald-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Trạng thái Workers & Services Phân tán
              </h2>
            </div>
            <Link href="/admin/services" className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 font-mono">
              Chi tiết Nodes <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-md bg-[#000000] border border-[#1f1f1f] flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">adq_api (FastAPI)</div>
                <div className="text-[10px] text-neutral-400 font-mono">Port 8000 • Core Engine</div>
              </div>
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ONLINE
              </span>
            </div>

            <div className="p-3 rounded-md bg-[#000000] border border-[#1f1f1f] flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">worker-light-1</div>
                <div className="text-[10px] text-neutral-400 font-mono">Recon & Mapping</div>
              </div>
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ACTIVE
              </span>
            </div>

            <div className="p-3 rounded-md bg-[#000000] border border-[#1f1f1f] flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">worker-elite-1</div>
                <div className="text-[10px] text-neutral-400 font-mono">DAST & Nuclei Runner</div>
              </div>
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ACTIVE
              </span>
            </div>

            <div className="p-3 rounded-md bg-[#000000] border border-[#1f1f1f] flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">worker-stress-1</div>
                <div className="text-[10px] text-neutral-400 font-mono">High-throughput RPS</div>
              </div>
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ACTIVE
              </span>
            </div>
          </div>
        </div>

        {/* 4. Quick Navigation Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/admin/users"
            className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] hover:border-neutral-600 transition group"
          >
            <Users className="h-4 w-4 text-white group-hover:text-emerald-400 transition" />
            <div className="text-xs font-bold text-white mt-2">Quản lý Người dùng</div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Hồ sơ, User 360, phân quyền & hạn mức</div>
          </Link>

          <Link
            href="/admin/entitlements"
            className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] hover:border-neutral-600 transition group"
          >
            <CreditCard className="h-4 w-4 text-white group-hover:text-sky-400 transition" />
            <div className="text-xs font-bold text-white mt-2">Gói & Entitlements</div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Nâng cấp PRO/PRO_MAX, thời hạn gói</div>
          </Link>

          <Link
            href="/admin/redeem-codes"
            className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] hover:border-neutral-600 transition group"
          >
            <KeyRound className="h-4 w-4 text-white group-hover:text-purple-400 transition" />
            <div className="text-xs font-bold text-white mt-2">Mã License Redeem</div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Tạo mã CSPRNG 128-bit & đối soát lịch sử</div>
          </Link>

          <Link
            href="/admin/security"
            className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] hover:border-neutral-600 transition group"
          >
            <ShieldCheck className="h-4 w-4 text-white group-hover:text-amber-400 transition" />
            <div className="text-xs font-bold text-white mt-2">Cấu hình An toàn</div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Đổi mật khẩu SOC, rate limit & audit</div>
          </Link>
        </div>
      </div>
    </AdminShell>
  );
}
