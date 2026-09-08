"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { LiquidGlassButton } from "@/components/ui/liquid-glass";

export function StickyMobileCTA() {
  const { user } = useAuth();

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 md:hidden">
      <div className="rounded-2xl border border-cyan-500/40 bg-slate-950/85 p-3 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 pl-1">
          <div className="h-8 w-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white leading-tight">ADQ SECURITY</p>
            <p className="text-[10px] text-cyan-300 font-mono">Bảo mật tự động 24/7</p>
          </div>
        </div>

        <Link href={user ? "/dashboard" : "/register"} className="shrink-0">
          <LiquidGlassButton variant="primary" className="px-4 py-2 text-xs font-bold gap-1.5">
            <span>{user ? "Console" : "Dùng Thử"}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </LiquidGlassButton>
        </Link>
      </div>
    </div>
  );
}

