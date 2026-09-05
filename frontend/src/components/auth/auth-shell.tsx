"use client";

import React, { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Shield, Cpu, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const isRegister = pathname === "/register";

  return (
    <div className="relative min-h-screen w-full flex bg-[#000000] text-[#ededed] font-sans selection:bg-white selection:text-black overflow-x-hidden">
      {/* ======================================================== */}
      {/* LEFT COLUMN: HERO 3D ARTWORK & BRAND CITADEL (DESKTOP) */}
      {/* ======================================================== */}
      <div className="relative hidden lg:flex lg:w-[48%] xl:w-[50%] flex-col justify-between p-10 xl:p-14 overflow-hidden border-r border-[#222222] bg-[#000000]">
        {/* Full background 3D Artwork */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/auth-hero-citadel.jpg"
            alt="ADQ Cyber Defense Command Citadel"
            fill
            priority
            className="object-cover object-center scale-105 opacity-60 transition-transform duration-1000 hover:scale-110"
          />
          {/* Multi-layered dark overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-[#000000]/40 to-[#000000]/70" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#000000]/40 via-transparent to-[#000000]" />
        </div>

        {/* Top Brand Bar */}
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-md border border-[#222222] bg-[#000000] p-1 flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="ADQ logo"
                width={32}
                height={32}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">
                  ADQ <span className="text-neutral-400">SECURITY</span>
                </span>
                <span className="rounded border border-[#333333] bg-[#111111] px-1.5 py-0.2 text-[9px] font-mono font-medium text-neutral-300">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 font-mono">Automated Cyber Defense</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-[#222222] bg-[#0a0a0a] text-[11px] font-mono text-neutral-400">
            <Shield className="h-3.5 w-3.5 text-white" />
            <span>SECURITY GATEWAY v2.4</span>
          </div>
        </div>
        {/* Middle Hero Statement & Value Proposition */}
        <div className="relative z-10 my-auto py-8 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-700 bg-neutral-900 text-neutral-200 text-[11px] font-mono font-medium tracking-wider uppercase mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            Hạ Tầng Giám Sát Chủ Động
          </div>

          <h2 className="text-3xl xl:text-4xl font-bold tracking-tight text-white leading-tight">
            Nền Tảng Đánh Giá An Ninh <br />
            & Phản Ứng Tự Động Hóa.
          </h2>

          <p className="mt-4 text-xs xl:text-sm text-neutral-400 leading-relaxed">
            Hợp nhất toàn bộ quy trình kiểm thử xâm nhập: Quét bề mặt mạng, phát hiện lỗ hổng DAST chuyên sâu, phân tích mã nguồn APK và AI Copilot hỗ trợ viết bản vá bảo mật chuẩn công nghiệp.
          </p>

          {/* Feature Badges */}
          <div className="flex items-center gap-4 text-[11px] font-mono text-neutral-400 pt-6">
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-white" /> OWASP ASVS</span>
            <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-white" /> TLS 1.3</span>
            <span className="flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5 text-white" /> Zero-Trust</span>
          </div>
        </div>

        {/* Bottom Details Bar */}
        <div className="relative z-10 flex items-center justify-between text-xs text-neutral-500 font-mono pt-4 border-t border-[#222222]">
          <p>© 2026 ADQ CYBERSECURITY</p>
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Lock className="h-3.5 w-3.5 text-white" />
            <span>256-BIT ENCRYPTED</span>
          </div>
        </div>
      </div>
      {/* ======================================================== */}
      {/* RIGHT COLUMN: DIRECT CLEAN AUTH CANVAS */}
      {/* ======================================================== */}
      <div className="relative flex-1 flex flex-col justify-between p-4 sm:p-6 lg:px-12 lg:py-6 min-h-screen lg:max-h-screen bg-[#000000] overflow-y-auto">
        {/* Main Form Center Area */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full max-w-[440px] mx-auto my-auto py-2 z-10"
        >
          {/* Segmented Switcher Tab giữa Đăng Nhập & Đăng Ký */}
          {(isLogin || isRegister) && (
            <div className="grid grid-cols-2 p-1 rounded-md bg-[#111111] border border-[#222222] mb-4">
              <Link
                href="/login"
                className={`flex items-center justify-center py-1.5 text-xs rounded transition-all duration-200 ${
                  isLogin
                    ? "bg-white !text-black font-bold shadow-md"
                    : "text-neutral-400 hover:text-white font-medium"
                }`}
              >
                <span className={isLogin ? "!text-black font-bold" : ""}>
                  Đăng Nhập
                </span>
              </Link>
              <Link
                href="/register"
                className={`flex items-center justify-center py-1.5 text-xs rounded transition-all duration-200 ${
                  isRegister
                    ? "bg-white !text-black font-bold shadow-md"
                    : "text-neutral-400 hover:text-white font-medium"
                }`}
              >
                <span className={isRegister ? "!text-black font-bold" : ""}>
                  Đăng Ký Mới
                </span>
              </Link>
            </div>
          )}

          <div className="mb-4">
            <h1 className="text-xl font-semibold text-white tracking-tight">
              {title}
            </h1>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              {subtitle}
            </p>
          </div>

          {/* Form Content */}
          <div className="relative">{children}</div>

          {/* Footer Switcher */}
          {footerText && footerLinkHref && footerLinkText && (
            <div className="mt-4 pt-3.5 border-t border-[#222222] text-center">
              <p className="text-xs text-neutral-500">
                {footerText}{" "}
                <Link
                  href={footerLinkHref}
                  className="font-medium text-white hover:underline transition-colors"
                >
                  {footerLinkText}
                </Link>
              </p>
            </div>
          )}
        </motion.div>
      </div>
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
