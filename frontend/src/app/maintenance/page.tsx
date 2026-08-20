"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Clock3, HardHat, RefreshCcw, ShieldCheck, Wrench } from "lucide-react";

type Maintenance = {
  enabled: boolean;
  status: "OFF" | "SCHEDULED" | "IN_PROGRESS" | "OVERRUN";
  engineer: string;
  startsAt: string | null;
  endsAt: string | null;
  message: string;
  updatedAt?: string | null;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

function pad(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function formatLocal(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(d);
}

export default function MaintenancePage() {
  const [state, setState] = useState<Maintenance | null>(null);
  const [now, setNow] = useState(Date.now());

  async function refresh() {
    try {
      const res = await fetch(`${API_BASE}/api/maintenance`, {
        cache: "no-store",
      });
      const data = await res.json();
      setState(data?.maintenance ?? null);
    } catch {
      // Keep the page stable if API is restarting during maintenance.
    }
  }

  useEffect(() => {
    refresh();
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const sync = window.setInterval(refresh, 15_000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(sync);
    };
  }, []);

  const remaining = useMemo(() => {
    if (!state?.endsAt) return 0;
    return Math.max(0, new Date(state.endsAt).getTime() - now);
  }, [state?.endsAt, now]);

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const overrun = state?.status === "OVERRUN";
  const scheduled = state?.status === "SCHEDULED";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.12),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.10),transparent_32%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(148,163,184,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.18)_1px,transparent_1px)] [background-size:42px_42px]" />

      <section className="relative mx-auto flex min-h-screen max-w-5xl items-center px-5 py-12">
        <div className="w-full rounded-[28px] border border-slate-800/90 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl md:p-10">
          <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-amber-300">
                <Wrench className="h-3.5 w-3.5" />
                {scheduled ? "MAINTENANCE SCHEDULED" : overrun ? "MAINTENANCE OVERRUN" : "MAINTENANCE IN PROGRESS"}
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
                ADQ đang được bảo trì
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 md:text-base">
                {state?.message || "Hệ thống đang được bảo trì để nâng cấp dịch vụ."}
              </p>
            </div>

            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
              <ShieldCheck className="h-9 w-9" />
            </div>
          </div>

          {overrun ? (
            <div className="mb-8 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5">
              <div className="text-xs font-bold tracking-[0.16em] text-rose-300">DỰ KIẾN HOÀN TẤT ĐÃ QUÁ HẠN</div>
              <div className="mt-2 text-sm text-rose-100/80">
                Hệ thống vẫn đang được kỹ sư xử lý. Thời gian mới sẽ được cập nhật ngay khi có thông tin.
              </div>
            </div>
          ) : (
            <div className="mb-8">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <Clock3 className="h-4 w-4" />
                {scheduled ? "Thời gian đến khi bắt đầu" : "Thời gian dự kiến còn lại"}
              </div>
              <div className="grid grid-cols-4 gap-2 md:gap-4">
                {[
                  [days, "NGÀY"],
                  [hours, "GIỜ"],
                  [minutes, "PHÚT"],
                  [seconds, "GIÂY"],
                ].map(([value, label]) => (
                  <div key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-2 py-5 text-center md:px-5">
                    <div className="font-mono text-3xl font-black tabular-nums text-cyan-300 md:text-5xl">{pad(Number(value))}</div>
                    <div className="mt-2 text-[9px] font-bold tracking-[0.18em] text-slate-500 md:text-[10px]">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                <HardHat className="h-4 w-4 text-cyan-400" />
                Kỹ sư phụ trách
              </div>
              <div className="font-semibold text-white">{state?.engineer || "Đội ngũ ADQ Engineering"}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
              <div className="mb-2 text-xs text-slate-500">Bắt đầu</div>
              <div className="font-mono text-sm text-slate-200">{formatLocal(state?.startsAt ?? null)}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
              <div className="mb-2 text-xs text-slate-500">Dự kiến hoàn tất</div>
              <div className="font-mono text-sm text-slate-200">{formatLocal(state?.endsAt ?? null)}</div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-800 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              ADQ Operations Center
            </div>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-slate-400 transition hover:bg-slate-900 hover:text-white"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Cập nhật trạng thái
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
