"use client";

import React, { useEffect, useState } from "react";

export default function MaintenancePage() {
  const [timeLeft, setTimeLeft] = useState({ hours: 2, minutes: 45, seconds: 0 });

  useEffect(() => {
    const target = new Date().getTime() + 3 * 60 * 60 * 1000;
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const diff = Math.max(0, target - now);
      setTimeLeft({
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Grid Pattern Background */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }}
      />

      <div className="relative z-10 w-full max-w-xl bg-[#0d1117]/90 border border-sky-500/20 backdrop-blur-xl rounded-2xl p-8 text-center shadow-2xl shadow-sky-950/40">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/30 rounded-full text-rose-400 text-xs font-semibold uppercase tracking-wider mb-6">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          Hệ Thống Đang Bảo Trì & Nâng Cấp
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-sky-400 bg-clip-text text-transparent mb-3">
          ADQ SECURITY PLATFORM
        </h1>

        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Cụm máy chủ và hệ thống API đang được tạm dừng để tiến hành nâng cấp định kỳ hạ tầng Cluster & tối ưu hóa cơ sở dữ liệu.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-6">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">👤 Kỹ sư phụ trách</div>
            <div className="text-sm font-semibold text-white">Nguyễn Kiến Quốc</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">🛠️ Hạng mục nâng cấp</div>
            <div className="text-sm font-semibold text-white">Cluster L7 & C2 Engine</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">🕒 Bắt đầu bảo trì</div>
            <div className="text-sm font-semibold text-white">14:00 - 20/08/2026</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">⏳ Dự kiến hoàn tất</div>
            <div className="text-sm font-semibold text-white">17:00 - 20/08/2026</div>
          </div>
        </div>

        <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-4 mb-6">
          <div className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">
            Thời gian dự kiến mở lại hệ thống
          </div>
          <div className="flex justify-center gap-4">
            <div className="min-w-[60px]">
              <div className="text-2xl font-bold font-mono text-white">
                {String(timeLeft.hours).padStart(2, "0")}
              </div>
              <div className="text-[10px] uppercase text-slate-500">Giờ</div>
            </div>
            <div className="text-2xl font-bold text-slate-600">:</div>
            <div className="min-w-[60px]">
              <div className="text-2xl font-bold font-mono text-white">
                {String(timeLeft.minutes).padStart(2, "0")}
              </div>
              <div className="text-[10px] uppercase text-slate-500">Phút</div>
            </div>
            <div className="text-2xl font-bold text-slate-600">:</div>
            <div className="min-w-[60px]">
              <div className="text-2xl font-bold font-mono text-white">
                {String(timeLeft.seconds).padStart(2, "0")}
              </div>
              <div className="text-[10px] uppercase text-slate-500">Giây</div>
            </div>
          </div>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-sky-950/50 cursor-pointer"
        >
          Kiểm Tra Trạng Thái Lại
        </button>

        <div className="mt-6 text-[11px] text-slate-500">
          © 2026 ADQ Security Operations Center.
        </div>
      </div>
    </div>
  );
}
