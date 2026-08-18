"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BadgeCheck,
  CreditCard,
  Gauge,
  KeyRound,
  LogOut,
  Menu,
  Shield,
  ShieldCheck,
  Users,
  X,
  Folder,
  Settings,
  Sparkles,
  Terminal,
  Radio,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ShellArea = "dashboard" | "admin";

const workspaceSections = [
  {
    title: "Không gian chính",
    links: [
      { href: "/dashboard", label: "Dự án & Targets", icon: Folder },
      { href: "/dashboard/billing", label: "Gói dịch vụ & License", icon: CreditCard },
      { href: "/settings", label: "Cài đặt & API Nodes", icon: Settings },
    ],
  },
] as const;

const adminLinks = [
  { href: "/admin", label: "Tổng quan quản trị", icon: Gauge },
  { href: "/admin/users", label: "Quản lý tài khoản", icon: Users },
  { href: "/admin/redeem-codes", label: "Tạo mã nâng cấp", icon: KeyRound },
];

const routeMeta: Record<string, { eyebrow: string; title: string }> = {
  "/dashboard": { eyebrow: "Security Assets", title: "Tổng quan dự án & Bề mặt tấn công" },
  "/dashboard/results": { eyebrow: "Scan Telemetry", title: "Kết quả quét & PoC Exploit" },
  "/dashboard/tools": { eyebrow: "Attack Mesh", title: "Trung tâm công cụ DAST" },
  "/dashboard/billing": { eyebrow: "License Key", title: "Quản lý gói & Hạn ngạch Worker" },
  "/vulnerabilities": { eyebrow: "Vulnerability Intel", title: "Chi tiết lỗ hổng OWASP" },
  "/settings": { eyebrow: "Engine Configuration", title: "Cấu hình bảo mật & Tác tử AI" },
  "/admin": { eyebrow: "Root Admin", title: "Tổng quan hệ thống phân tán" },
  "/admin/users": { eyebrow: "Identity Access", title: "Quản trị danh tính & Phân quyền" },
  "/admin/redeem-codes": { eyebrow: "License Generator", title: "Tạo và theo dõi mã nâng cấp" },
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
  const [pulse, setPulse] = useState(94);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPulse((prev) => (prev >= 99 ? 94 : prev + 1));
    }, 2500);
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

  const navigationGroups = useMemo(
    () => (area === "admin" ? [{ title: "Khu vực quản trị", links: adminLinks }] : workspaceSections),
    [area],
  );

  const currentMeta = useMemo(() => {
    const matched = Object.entries(routeMeta)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([route]) => pathname === route || pathname.startsWith(`${route}/`));

    return matched?.[1] ?? { eyebrow: "Security Mesh", title: "Bảng điều khiển trung tâm" };
  }, [pathname]);

  if (loading || !user || (area === "admin" && user.role !== "ADMIN")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-cyan-400">
        <div className="relative flex flex-col items-center gap-4 rounded-3xl border border-cyan-500/30 bg-slate-950/80 p-8 backdrop-blur-2xl shadow-[0_0_60px_rgba(6,182,212,0.2)]">
          <div className="relative flex h-14 w-14 items-center justify-center">
            <span className="absolute h-full w-full animate-ping rounded-full bg-cyan-400/20" />
            <ShieldCheck className="h-8 w-8 text-cyan-400 animate-pulse" />
          </div>
          <p className="font-mono text-xs tracking-widest uppercase">Initialising SOC Console...</p>
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="relative flex h-full flex-col justify-between border-r border-cyan-500/20 bg-slate-950/90 p-5 backdrop-blur-2xl shadow-[inset_-10px_0_30px_rgba(0,0,0,0.8)]">
      
      {/* Subtle Corner HUD Accent */}
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400/60 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400/60 pointer-events-none" />

      <div className="space-y-6">
        {/* Brand Banner */}
        <Link
          href="/"
          className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 via-slate-950/80 to-transparent p-3.5 shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all duration-300 hover:border-cyan-400 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)]"
        >
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-0.5 shadow-lg shadow-cyan-500/30">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
              <Shield className="h-5 w-5 text-cyan-400 transition-transform duration-300 group-hover:scale-110" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-wider text-white">
                ADQ<span className="text-cyan-400">.SEC</span>
              </span>
              <span className="rounded bg-cyan-950 px-1.5 py-0.2 text-[9px] font-mono text-cyan-300 border border-cyan-500/40">
                PRO
              </span>
            </div>
            <p className="truncate text-[10px] font-mono text-cyan-400/70 tracking-wider">
              {area === "admin" ? "ROOT ACCESS" : "DAST WORKER MESH"}
            </p>
          </div>
        </Link>

        {/* Navigation Groups */}
        {navigationGroups.map((group) => (
          <div key={group.title} className="space-y-1.5">
            <div className="flex items-center justify-between px-3">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-slate-500">
                {group.title}
              </p>
              <Terminal className="h-3 w-3 text-slate-600" />
            </div>
            <div className="space-y-1 pt-1">
              {group.links.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== `/${area}` && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all duration-200",
                      active
                        ? "border border-cyan-500/40 bg-gradient-to-r from-cyan-950/80 to-slate-900/60 text-cyan-300 shadow-[inset_0_1px_0_0_rgba(6,182,212,0.4),0_0_20px_rgba(6,182,212,0.15)]"
                        : "border border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900/60 hover:text-slate-200",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        active ? "text-cyan-400 drop-shadow-[0_0_8px_#22d3ee]" : "text-slate-500 group-hover:text-slate-300",
                      )}
                    />
                    <span className="truncate">{item.label}</span>

                    {active && (
                      <motion.span
                        layoutId="activeIndicator"
                        className="absolute right-2.5 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Profile & Node Telemetry Footer */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-slate-900/90 to-slate-950 p-4 backdrop-blur-2xl shadow-xl">
        <div className="mb-3.5 flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 border border-cyan-500/40 font-mono font-bold text-sm text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
            {user.name.slice(0, 1).toUpperCase()}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400 shadow-[0_0_6px_#34d399]" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">{user.name}</p>
            <p className="truncate text-[11px] font-mono text-slate-500">{user.email}</p>
          </div>
        </div>

        <div className="mb-3.5 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-950/60 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
            <Sparkles className="h-2.5 w-2.5 text-cyan-400" />
            {user.role}
          </span>
          <span className="inline-flex items-center rounded-md border border-slate-800 bg-slate-950/60 px-2 py-0.5 text-[10px] font-mono text-slate-400">
            {user.packageTier.replace("_", " ")}
          </span>
        </div>

        <Button
          variant="secondary"
          className="h-8 w-full justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/90 text-xs font-medium text-slate-400 transition-all hover:border-rose-500/50 hover:bg-rose-950/30 hover:text-rose-300 hover:shadow-[0_0_15px_rgba(244,63,94,0.2)] active:scale-98"
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          <LogOut className="h-3.5 w-3.5" />
          Đăng xuất
        </Button>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-[#020617] text-slate-100 selection:bg-cyan-500 selection:text-black overflow-hidden font-sans">
      
      {/* CYBER GRID BACKGROUND MATRIX */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(6, 182, 212, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(6, 182, 212, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* AMBIENT MULTI-POINT NEON GLOWS */}
      <div className="fixed top-0 left-1/4 -translate-x-1/2 w-[700px] h-[350px] bg-cyan-500/10 blur-[140px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[350px] bg-emerald-500/5 blur-[150px] pointer-events-none" />

      <div className="relative flex min-h-screen z-10">
        
        {/* Desktop Sidebar */}
        <aside className="hidden w-72 shrink-0 xl:block">{sidebar}</aside>

        {/* Mobile Sidebar Modal */}
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
                initial={{ x: -288 }}
                animate={{ x: 0 }}
                exit={{ x: -288 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed inset-y-0 left-0 z-50 w-72 xl:hidden"
              >
                {sidebar}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Console Viewport */}
        <div className="flex min-w-0 flex-1 flex-col">
          
          {/* Top HUD Header */}
          <header className="sticky top-0 z-30 border-b border-cyan-500/20 bg-slate-950/80 backdrop-blur-2xl">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
              
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl border border-slate-800 bg-slate-900/80 text-slate-300 hover:border-cyan-500/40 hover:text-white xl:hidden"
                  onClick={() => setMobileOpen(true)}
                >
                  {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                    <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-400">
                      {currentMeta.eyebrow}
                    </p>
                  </div>
                  <h1 className="text-base font-bold text-white tracking-tight">
                    {currentMeta.title}
                  </h1>
                </div>
              </div>

              {/* Realtime Telemetry Badges */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-1.5 backdrop-blur-md shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                  <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono font-medium text-emerald-300">
                    Engine Sync: {pulse}%
                  </span>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-slate-900/80 px-3 py-1.5 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                  <BadgeCheck className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-xs font-mono font-medium text-slate-300">
                    {user.role}
                  </span>
                </div>
              </div>

            </div>
          </header>

          {/* Dynamic Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>

      </div>
    </div>
  );
}