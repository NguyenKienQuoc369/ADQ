"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Folder,
  CreditCard,
  Settings,
  Gauge,
  Users,
  KeyRound,
  LogOut,
  Menu,
  X,
  Radio,
  BadgeCheck,
  ArrowLeft,
  Shield,
  Zap,
  Smartphone,
  Bot,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TermsModal } from "@/components/auth/terms-modal";

type ShellArea = "dashboard" | "admin";

const workspaceSections = [
  {
    title: "Không gian chính",
    links: [
      { href: "/dashboard", label: "Quản lý Dự án & Targets", icon: Folder },
      { href: "/dashboard/billing", label: "Gói dịch vụ & License", icon: CreditCard },
      { href: "/settings", label: "Cài đặt & API Nodes", icon: Settings },
    ],
  },
] as const;

const adminSections = [
  {
    title: "Quản trị hệ thống",
    links: [
      { href: "/admin", label: "Tổng quan SOC Admin", icon: Gauge },
      { href: "/admin/users", label: "Quản lý Người dùng", icon: Users },
      { href: "/admin/redeem-codes", label: "Mã kích hoạt License", icon: KeyRound },
    ],
  },
] as const;

const PROJECT_ROUTES = ["/scan", "/stress-test", "/apk-audit", "/copilot"];

function DashboardShellContent({
  area,
  children,
}: {
  area: ShellArea;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams?.get("projectId") || null;

  const { user, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [syncPulse, setSyncPulse] = useState(99);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Kiểm tra nếu người dùng chưa duyệt Điều khoản (Lần đầu đăng nhập Google)
  useEffect(() => {
    if (!loading && user) {
      if (typeof window !== "undefined") {
        const accepted = localStorage.getItem("adq_terms_accepted_v1");
        if (!accepted) {
          setShowTermsModal(true);
        }
      }
    }
  }, [loading, user]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSyncPulse((prev) => (prev >= 99 ? 96 : prev + 1));
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (area === "admin" && user.role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [area, loading, router, user]);

  const isProjectWorkspace = PROJECT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const navGroups = useMemo(
    () => (area === "admin" ? adminSections : workspaceSections),
    [area]
  );

  // Xử lý từ chối điều khoản -> Đăng xuất ngay lập tức
  const handleDeclineTerms = async () => {
    setShowTermsModal(false);
    await logout();
    router.replace("/");
  };

  const handleAcceptTerms = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("adq_terms_accepted_v1", "true");
    }
    setShowTermsModal(false);
  };

  // MÀN HÌNH LOADING CYBER SOC MƯỢT MÀ KHI ĐỒNG BỘ SESSION
  if (loading || !user || (area === "admin" && user.role !== "ADMIN")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-cyan-400 font-sans">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-cyan-500/20 bg-slate-950/80 p-8 backdrop-blur-2xl shadow-2xl">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <span className="absolute h-full w-full animate-ping rounded-full bg-cyan-400/20" />
            <Image src="/logo.png" alt="ADQ logo" width={48} height={48} className="h-full w-full object-contain animate-pulse" />
          </div>
          <p className="font-mono text-xs tracking-widest text-slate-400 uppercase mt-2">Đang kết nối SOC Cluster...</p>
        </div>
      </div>
    );
  }

  // 1. PROJECT WORKSPACE (ẨN SIDEBAR)
  if (isProjectWorkspace) {
    return (
      <div className="relative min-h-screen bg-[#020617] text-slate-100 selection:bg-cyan-500 selection:text-black overflow-hidden font-sans">
        <TermsModal
          isOpen={showTermsModal}
          onAccept={handleAcceptTerms}
          onDecline={handleDeclineTerms}
        />

        <div
          className="fixed inset-0 pointer-events-none opacity-15"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(6, 182, 212, 0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(6, 182, 212, 0.08) 1px, transparent 1px)
            `,
            backgroundSize: "36px 36px",
          }}
        />

        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-slate-950/85 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 px-4 py-2 sm:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="h-8 px-2.5 rounded-lg border border-white/[0.08] bg-slate-900/60 text-xs font-semibold text-slate-300 hover:border-cyan-500/40 hover:bg-cyan-950/30 hover:text-cyan-300 transition-all active:scale-98 flex items-center gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-cyan-400" />
                <span>Quay lại Dự án</span>
              </Button>

              <div className="hidden md:flex items-center gap-1.5 border-l border-white/[0.08] pl-3">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs font-bold text-white tracking-wide">
                  {pathname === "/scan"
                    ? "Web & Network Scanner"
                    : pathname === "/stress-test"
                    ? "L7 Stress Test War Room"
                    : pathname === "/apk-audit"
                    ? "Mobile APK Audit"
                    : "Security Workspace"}
                </span>
                {projectId && (
                  <span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-950/50 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                    ID: {projectId.slice(0, 8)}...
                  </span>
                )}
              </div>
            </div>

            {projectId && (
              <div className="hidden lg:flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-white/[0.08] backdrop-blur-md">
                <Link
                  href={`/scan?projectId=${projectId}`}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all",
                    pathname === "/scan"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <Shield className="h-3 w-3" />
                  Quét DAST
                </Link>
                <Link
                  href={`/stress-test?projectId=${projectId}`}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all",
                    pathname === "/stress-test"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.2)]"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <Zap className="h-3 w-3" />
                  Stress Test
                </Link>
                <Link
                  href={`/apk-audit?projectId=${projectId}`}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all",
                    pathname === "/apk-audit"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <Smartphone className="h-3 w-3" />
                  APK Audit
                </Link>
                <Link
                  href={`/copilot?projectId=${projectId}`}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all",
                    pathname === "/copilot"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <Bot className="h-3 w-3" />
                  AI Copilot
                </Link>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-1 backdrop-blur-md">
                <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
                <span className="text-[11px] font-mono font-medium text-emerald-300">
                  Node Sync: {syncPulse}%
                </span>
              </div>

              <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-slate-900/60 px-2.5 py-1 backdrop-blur-md">
                <BadgeCheck className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-[11px] font-mono font-medium text-slate-300">
                  {user.role}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="w-full">{children}</main>
      </div>
    );
  }

  // 2. DASHBOARD / SETTINGS / ADMIN (CÓ SIDEBAR)
  const sidebarContent = (
    <div className="relative flex h-full flex-col justify-between border-r border-white/[0.07] bg-slate-950/80 p-4 backdrop-blur-2xl">
      <div className="space-y-5">
        <Link
          href="/dashboard"
          className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-slate-900/40 p-2.5 transition-all duration-300 hover:border-cyan-500/40 hover:bg-cyan-950/20 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 border border-cyan-500/30 p-1 group-hover:border-cyan-400 transition">
            <Image src="/logo.png" alt="ADQ logo" width={32} height={32} className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-wide text-white">
                ADQ<span className="text-cyan-400">.SEC</span>
              </span>
              <span className="rounded bg-cyan-950 px-1.5 py-0.2 text-[9px] font-mono text-cyan-300 border border-cyan-500/30">
                PRO
              </span>
            </div>
            <p className="truncate text-[10px] font-mono text-slate-400 tracking-wider">
              {area === "admin" ? "SOC ROOT CONSOLE" : "DEVSECOPS SUITE"}
            </p>
          </div>
        </Link>

        <div className="space-y-4">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-2.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                {group.title}
              </p>
              <div className="space-y-0.5 pt-1">
                {group.links.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
                        active
                          ? "border border-cyan-500/40 bg-cyan-950/40 text-cyan-300 shadow-[inset_0_1px_0_0_rgba(6,182,212,0.3),0_0_15px_rgba(6,182,212,0.1)]"
                          : "border border-transparent text-slate-400 hover:border-white/[0.06] hover:bg-slate-900/60 hover:text-slate-200"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          active ? "text-cyan-400 drop-shadow-[0_0_6px_#22d3ee]" : "text-slate-400 group-hover:text-slate-300"
                        )}
                      />
                      <span className="truncate">{item.label}</span>

                      {active && (
                        <motion.span
                          layoutId="activeIndicator"
                          className="absolute right-2 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 p-3 backdrop-blur-xl">
        <div className="mb-2.5 flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 font-mono font-bold text-xs text-cyan-300">
            {user.name.slice(0, 1).toUpperCase()}
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-slate-950 bg-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">{user.name}</p>
            <p className="truncate text-[10px] font-mono text-slate-400">{user.email}</p>
          </div>
        </div>

        <Button
          variant="secondary"
          className="h-7 w-full justify-center gap-1.5 rounded-lg border border-white/[0.06] bg-slate-950 text-[11px] font-medium text-slate-400 transition hover:border-rose-500/40 hover:bg-rose-950/20 hover:text-rose-300 active:scale-98"
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          <LogOut className="h-3 w-3" />
          Đăng xuất
        </Button>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-[#020617] text-slate-100 selection:bg-cyan-500 selection:text-black overflow-hidden font-sans">
      <TermsModal
        isOpen={showTermsModal}
        onAccept={handleAcceptTerms}
        onDecline={handleDeclineTerms}
      />

      <div
        className="fixed inset-0 pointer-events-none opacity-15"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(6, 182, 212, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(6, 182, 212, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: "36px 36px",
        }}
      />

      <div className="relative flex min-h-screen z-10">
        <aside className="hidden w-64 shrink-0 xl:block">{sidebarContent}</aside>

        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-md xl:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: -260 }}
                animate={{ x: 0 }}
                exit={{ x: -260 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed inset-y-0 left-0 z-50 w-64 xl:hidden"
              >
                {sidebarContent}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-slate-950/70 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:border-cyan-500/40 hover:text-white xl:hidden"
                  onClick={() => setMobileOpen(true)}
                >
                  {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
                <div>
                  <h1 className="text-sm font-bold text-white tracking-tight">
                    Bảng điều khiển Quản lý Dự án & Hạ tầng
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-1 backdrop-blur-md">
                  <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-mono font-medium text-emerald-300">
                    Engine Sync: {syncPulse}%
                  </span>
                </div>

                <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-slate-900/60 px-2.5 py-1 backdrop-blur-md">
                  <BadgeCheck className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-[11px] font-mono font-medium text-slate-300">
                    {user.role}
                  </span>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function DashboardShell(props: { area: ShellArea; children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#020617]" />}>
      <DashboardShellContent {...props} />
    </Suspense>
  );
}
