"use client";

import React, { useEffect, useState } from "react";

// Mốc cố định: 17:00:00 ngày 21/08/2026 (GMT+7)
const TARGET_TIMESTAMP = new Date("2026-08-21T17:00:00+07:00").getTime();

export default function MaintenancePage() {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const calculateTime = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, TARGET_TIMESTAMP - now);

      const totalHours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({
        hours: totalHours,
        minutes,
        seconds,
      });
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Cyber Grid */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }}
      />

      <div className="relative z-10 w-full max-w-xl bg-[#0d1117]/95 border border-sky-500/25 backdrop-blur-2xl rounded-2xl p-6 sm:p-8 text-center shadow-2xl shadow-sky-950/50">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-rose-500/10 border border-rose-500/30 rounded-full text-rose-400 text-xs font-semibold uppercase tracking-wider mb-6">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          Hệ Thống Đang Bảo Trì & Nâng Cấp
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white via-slate-100 to-sky-400 bg-clip-text text-transparent mb-3 tracking-tight">
          ADQ SECURITY PLATFORM
        </h1>

        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Cụm máy chủ và hệ thống API đang được tạm dừng để tiến hành nâng cấp toàn diện hạ tầng Cluster L7, C2 Engine & tối ưu hóa cơ sở dữ liệu.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-6">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">👤 Kỹ sư phụ trách</div>
            <div className="text-sm font-semibold text-white">Nguyễn Kiến Quốc</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">🛠️ Hạng mục nâng cấp</div>
            <div className="text-sm font-semibold text-white">Cluster L7 & C2 Engine</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">🕒 Bắt đầu bảo trì</div>
            <div className="text-sm font-semibold text-white">14:00 - 20/08/2026</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">⏳ Dự kiến hoàn tất</div>
            <div className="text-sm font-semibold text-sky-400">17:00 - 21/08/2026</div>
          </div>
        </div>

        <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-5 mb-6">
          <div className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-4">
            Thời gian dự kiến mở lại hệ thống
          </div>
          <div className="flex justify-center items-center gap-3 sm:gap-5">
            <div className="min-w-[65px] bg-black/40 border border-white/5 rounded-lg py-2">
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white">
                {mounted ? String(timeLeft.hours).padStart(2, "0") : "--"}
              </div>
              <div className="text-[10px] uppercase text-slate-400 mt-1">Giờ</div>
            </div>
            <div className="text-2xl font-bold text-slate-600">:</div>
            <div className="min-w-[65px] bg-black/40 border border-white/5 rounded-lg py-2">
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white">
                {mounted ? String(timeLeft.minutes).padStart(2, "0") : "--"}
              </div>
              <div className="text-[10px] uppercase text-slate-400 mt-1">Phút</div>
            </div>
            <div className="text-2xl font-bold text-slate-600">:</div>
            <div className="min-w-[65px] bg-black/40 border border-white/5 rounded-lg py-2">
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white">
                {mounted ? String(timeLeft.seconds).padStart(2, "0") : "--"}
              </div>
              <div className="text-[10px] uppercase text-slate-400 mt-1">Giây</div>
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
