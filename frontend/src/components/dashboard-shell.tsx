"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Folder,
  Shield,
  Zap,
  Smartphone,
  CreditCard,
  Settings,
  Gauge,
  Users,
  KeyRound,
  LogOut,
  Menu,
  X,
  Radio,
  Sparkles,
  Bot,
  BadgeCheck,
  ChevronRight,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ShellArea = "dashboard" | "admin";

const workspaceSections = [
  {
    title: "Không gian làm việc",
    links: [
      { href: "/dashboard", label: "Quản lý Dự án", icon: Folder },
      { href: "/scan", label: "Web & Network Scan", icon: Shield },
      { href: "/stress-test", label: "L7 Stress Test", icon: Zap },
      { href: "/apk-audit", label: "Mobile APK Audit", icon: Smartphone },
    ],
  },
  {
    title: "Cấu hình & Dịch vụ",
    links: [
      { href: "/dashboard/billing", label: "Gói SaaS & License", icon: CreditCard },
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

const routeMeta: Record<string, { eyebrow: string; title: string }> = {
  "/dashboard": { eyebrow: "Security Assets", title: "Tổng quan phiên quét & Bề mặt mục tiêu" },
  "/scan": { eyebrow: "DAST Engine", title: "Trinh sát bề mặt & Quét lỗ hổng Nuclei" },
  "/stress-test": { eyebrow: "Layer 7 Engine", title: "Kiểm thử chịu tải & Đánh giá WAF Shield" },
  "/apk-audit": { eyebrow: "Mobile Security", title: "Kiểm toán mã độc & Bóc tách Android APK" },
  "/dashboard/billing": { eyebrow: "License Mesh", title: "Hạn ngạch Worker & Gói tài khoản" },
  "/settings": { eyebrow: "Core Settings", title: "Cấu hình bảo mật & API Cluster" },
  "/admin": { eyebrow: "Root SOC", title: "Bảng điều khiển máy chủ phân tán" },
  "/admin/users": { eyebrow: "Identity Control", title: "Phân quyền & Quản trị tài khoản" },
  "/admin/redeem-codes": { eyebrow: "License Generator", title: "Tạo và quản lý License Keys" },
};

export function DashboardShell({
  area,
  children,
}: {
  area: ShellArea;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [syncPulse, setSyncPulse] = useState(99);

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

  const navGroups = useMemo(
    () => (area === "admin" ? adminSections : workspaceSections),
    [area]
  );

  const currentMeta = useMemo(() => {
    const matched = Object.entries(routeMeta)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([route]) => pathname === route || pathname.startsWith(`${route}/`));

    return matched?.[1] ?? { eyebrow: "Security Mesh", title: "Không gian làm việc bảo mật" };
  }, [pathname]);

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

  const sidebarContent = (
    <div className="relative flex h-full flex-col justify-between border-r border-white/[0.07] bg-slate-950/80 p-4 backdrop-blur-2xl">
      {/* Accent corner neon lines */}
      <div className="absolute top-0 right-0 h-4 w-4 border-t border-r border-cyan-500/40 pointer-events-none" />
      <div className="absolute bottom-0 right-0 h-4 w-4 border-b border-r border-cyan-500/40 pointer-events-none" />

      <div className="space-y-5">
        {/* Brand Banner */}
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

        {/* Navigation Sections */}
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

      {/* User Status Card */}
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
      {/* Background Matrix Grid */}
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

      {/* Ambient Neon Glows */}
      <div className="fixed top-0 left-1/3 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/10 blur-[130px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[300px] bg-emerald-500/5 blur-[140px] pointer-events-none" />

      <div className="relative flex min-h-screen z-10">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 shrink-0 xl:block">{sidebarContent}</aside>

        {/* Mobile Sidebar */}
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

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header Bar */}
          <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-slate-950/70 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
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
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <p className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                      {currentMeta.eyebrow}
                    </p>
                  </div>
                  <h1 className="text-sm font-bold text-white tracking-tight">
                    {currentMeta.title}
                  </h1>
                </div>
              </div>

              {/* Status Indicators */}
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

          {/* Dynamic Page Content */}
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
