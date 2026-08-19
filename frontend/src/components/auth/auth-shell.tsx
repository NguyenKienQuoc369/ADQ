"use client";

import React, { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, Sparkles } from "lucide-react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footerText?: string;
  footerLinkText?: string;
  footerLinkHref?: string;
}

function AuthShellInner({
  title,
  subtitle,
  children,
  footerText,
  footerLinkText,
  footerLinkHref,
}: AuthShellProps) {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#020617] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black overflow-hidden">
      {/* Background Matrix Grid */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(6, 182, 212, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(6, 182, 212, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: "36px 36px",
        }}
      />

      {/* Ambient Multi-Point Neon Glows */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-cyan-500/10 blur-[140px] pointer-events-none" />
      <div className="fixed bottom-10 right-1/3 w-[500px] h-[250px] bg-emerald-500/5 blur-[130px] pointer-events-none" />

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative w-full max-w-[440px] z-10"
      >
        {/* Glassmorphism Card */}
        <div className="relative rounded-2xl border border-white/[0.08] bg-slate-950/85 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          {/* Corner HUD Accents */}
          <div className="absolute top-0 right-0 h-3 w-3 border-t-2 border-r-2 border-cyan-500/40 pointer-events-none rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-cyan-500/40 pointer-events-none rounded-bl-lg" />

          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center space-y-3 mb-6">
            <Link
              href="/"
              className="group flex items-center justify-center h-12 w-12 rounded-xl bg-slate-900/80 border border-cyan-500/30 p-1.5 shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all duration-300 hover:border-cyan-400 hover:scale-105"
            >
              <Image
                src="/logo.png"
                alt="ADQ logo"
                width={40}
                height={40}
                className="h-full w-full object-contain"
              />
            </Link>

            <div>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="font-extrabold text-base tracking-wider text-white">
                  ADQ<span className="text-cyan-400">.SEC</span>
                </span>
                <span className="rounded bg-cyan-950/80 px-1.5 py-0.2 text-[9px] font-mono text-cyan-300 border border-cyan-500/40">
                  SOC
                </span>
              </div>
              <h1 className="text-lg font-bold text-white tracking-tight">{title}</h1>
              <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            </div>
          </div>

          {/* Form Content */}
          {children}

          {/* Footer Switcher */}
          {footerText && footerLinkHref && footerLinkText && (
            <div className="mt-6 pt-4 border-t border-white/[0.06] text-center">
              <p className="text-xs text-slate-400">
                {footerText}{" "}
                <Link
                  href={footerLinkHref}
                  className="font-semibold text-cyan-400 hover:text-cyan-300 transition hover:underline"
                >
                  {footerLinkText}
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Security Badge */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          <Lock className="h-3 w-3 text-cyan-500/70" />
          <span>256-Bit SOC Encrypted Gateway</span>
        </div>
      </motion.div>
    </div>
  );
}

export function AuthShell(props: AuthShellProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#020617]" />}>
      <AuthShellInner {...props} />
    </Suspense>
  );
}
