"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Home } from "lucide-react";
import { LiquidGlassButton } from "@/components/ui/liquid-glass";
import { CyberAuroraBackground } from "@/components/ui/cyber-aurora-background";

export default function NotFound() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-[#020617] text-slate-100 p-6 font-sans overflow-hidden">
      <CyberAuroraBackground />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 text-center space-y-7 max-w-xl mx-auto"
      >
        {/* Prominent Vercel-Style 404 Headline */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-white font-mono">
          <span className="text-7xl sm:text-8xl font-black tracking-tight text-white drop-shadow-[0_0_35px_rgba(255,255,255,0.4)]">
            404
          </span>
          <span className="hidden sm:block h-16 w-[2px] bg-gradient-to-b from-cyan-400 via-white to-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
          <span className="text-lg sm:text-xl font-bold text-white text-center sm:text-left leading-snug">
            Trang này không tồn tại <br />
            hoặc đã được di chuyển.
          </span>
        </div>

        <p className="text-sm sm:text-base text-slate-200 font-medium leading-relaxed font-sans max-w-lg mx-auto">
          Vui lòng kiểm tra đường dẫn hoặc quay lại trang chủ ADQ Security.
        </p>

        <div className="flex items-center justify-center gap-4 pt-2">
          <Link href="/">
            <LiquidGlassButton variant="primary" className="px-7 py-3 text-sm font-bold gap-2">
              <Home className="h-4 w-4" />
              <span>Về Trang Chủ</span>
            </LiquidGlassButton>
          </Link>

          <Link href="/dashboard">
            <LiquidGlassButton variant="secondary" className="px-6 py-3 text-sm font-semibold gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Console</span>
            </LiquidGlassButton>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
