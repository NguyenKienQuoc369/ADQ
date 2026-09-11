"use client";

import React, { Suspense, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  Shield,
  Zap,
  Smartphone,
  Bot,
  ArrowLeft,
  FileText,
  ChevronRight,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserAvatar, getCanonicalDisplayName, getCanonicalPackageTier } from "@/components/ui/user-avatar";
import { cn, maskEmail } from "@/lib/utils";

type ShellArea = "dashboard" | "admin";

const workspaceNavGroups = [
  {
    title: "TỔNG QUAN",
    links: [
      { href: "/dashboard", label: "Dự án & Targets", icon: Folder },
      { href: "/reports", label: "Lịch sử & Báo cáo", icon: FileText },
    ],
  },
  {
    title: "CÔNG CỤ BẢO MẬT",
    links: [
      { href: "/scan", label: "Rà quét DAST", icon: Shield },
      { href: "/stress-test", label: "Kiểm thử tải L7", icon: Zap },
      { href: "/apk-audit", label: "Kiểm toán APK", icon: Smartphone },
      { href: "/copilot", label: "Trợ lý AI Copilot", icon: Bot },
    ],
  },
  {
    title: "HỆ THỐNG",
    links: [
      { href: "/dashboard/billing", label: "Gói dịch vụ", icon: CreditCard },
      { href: "/settings", label: "Cài đặt tài khoản", icon: Settings },
    ],
  },
];

const adminNavGroups = [
  {
    title: "QUẢN TRỊ ROOT SOC",
    links: [
      { href: "/admin", label: "Tổng quan hạ tầng", icon: Gauge },
      { href: "/admin/users", label: "Quản lý Người dùng", icon: Users },
      { href: "/admin/redeem-codes", label: "Mã kích hoạt License", icon: KeyRound },
    ],
  },
  {
    title: "ĐIỀU HƯỚNG",
    links: [
      { href: "/dashboard", label: "Vào Dashboard chính", icon: ArrowLeft },
    ],
  },
];

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

  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userDisplayName = getCanonicalDisplayName(user);
  const canonicalTier = getCanonicalPackageTier(user);

  const isProjectWorkspace = PROJECT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const navGroups = useMemo(
    () => (area === "admin" ? adminNavGroups : workspaceNavGroups),
    [area]
  );

  // Content for sidebar navigation
  const sidebarNavContent = (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6">
        {/* Brand & Logo Header */}
        <Link
          href="/dashboard"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-neutral-900/40 transition group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#222222] bg-[#0a0a0a] p-1">
            <Image
              src="/logo.png"
              alt="ADQ logo"
              width={32}
              height={32}
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-white group-hover:text-neutral-200 transition">
                ADQ SECURITY
              </span>
            </div>
            <p className="text-[10px] font-mono text-neutral-400">
              {canonicalTier} Plan
            </p>
          </div>
        </Link>

        {/* Navigation Sections */}
        <div className="space-y-5">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold">
                {group.title}
              </p>
              <div className="space-y-0.5 pt-1">
                {group.links.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  // Preserve projectId query parameter when navigating between tools
                  const href =
                    projectId && PROJECT_ROUTES.includes(item.href)
                      ? `${item.href}?projectId=${projectId}`
                      : item.href;

                  return (
                    <Link
                      key={item.href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition select-none",
                        active
                          ? "active-sidebar-link bg-white text-black font-semibold shadow-sm"
                          : "text-neutral-400 hover:text-white hover:bg-neutral-900/60"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-black" : "text-neutral-400")} />
                      <span className={active ? "text-black font-semibold" : ""}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sidebar Footer: User profile, Theme Toggle & Logout */}
      <div className="border-t border-[#222222] pt-3 space-y-2">
        {/* User Card */}
        <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-[#0a0a0a] border border-[#222222]">
          <Link
            href="/settings"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 overflow-hidden flex-1 group hover:opacity-90 transition cursor-pointer"
            title="Đi tới Cài đặt tài khoản"
          >
            <UserAvatar user={user} displayName={userDisplayName} size="sm" />
            <div className="truncate">
              <p className="text-xs font-medium text-white truncate group-hover:text-cyan-400 transition">
                {userDisplayName}
              </p>
              <p className="text-[10px] font-mono text-neutral-400 truncate">
                {maskEmail(user?.email)}
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            title="Đăng xuất"
            className="p-1.5 text-neutral-400 hover:text-rose-400 transition cursor-pointer shrink-0 ml-1"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Theme Toggle Button */}
        <div className="px-1 flex justify-center">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#000000] text-[#ededed] font-sans selection:bg-white selection:text-black">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30 border-r border-[#222222] bg-[#000000]">
        {sidebarNavContent}
      </aside>

      {/* Mobile Top Navigation Bar */}
      <header className="mobile-header-bar md:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#222222] bg-[#000000]/90 px-4 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 text-neutral-400 hover:text-white cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="ADQ logo"
              width={26}
              height={26}
              className="h-6.5 w-6.5 object-contain"
            />
            <span className="font-bold text-xs tracking-tight text-white">ADQ SECURITY</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/settings"
            className="rounded-full hover:ring-1 hover:ring-white transition"
            title="Cài đặt tài khoản"
          >
            <UserAvatar user={user} displayName={userDisplayName} size="sm" />
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            className="p-1.5 text-neutral-400 hover:text-rose-400 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-[#000000] border-r border-[#222222] shadow-2xl">
            {sidebarNavContent}
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="md:pl-64 flex flex-col min-h-screen">
        {/* Project Sub-header if inside a project tool */}
        {isProjectWorkspace && (
          <div className="tool-sticky-header sticky top-0 z-20 border-b border-[#222222] bg-[#000000]/85 backdrop-blur-md px-4 sm:px-8 py-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="tool-back-btn h-7 px-2 text-xs text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-md flex items-center gap-1 cursor-pointer mr-1"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>Dự án</span>
              </Button>

              <div className="tool-switcher-bar flex items-center gap-1 bg-[#0a0a0a] p-0.5 rounded-md border border-[#222222]">
                <Link
                  href={projectId ? `/scan?projectId=${projectId}` : "/scan"}
                  className={cn(
                    "h-7 px-2.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition select-none cursor-pointer",
                    pathname === "/scan" || pathname.startsWith("/scan/")
                      ? "active-tool-tab font-semibold shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  <Shield className="h-3 w-3" /> <span>Quét DAST</span>
                </Link>
                <Link
                  href={projectId ? `/stress-test?projectId=${projectId}` : "/stress-test"}
                  className={cn(
                    "h-7 px-2.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition select-none cursor-pointer",
                    pathname === "/stress-test" || pathname.startsWith("/stress-test/")
                      ? "active-tool-tab font-semibold shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  <Zap className="h-3 w-3" /> <span>Stress Test</span>
                </Link>
                <Link
                  href={projectId ? `/apk-audit?projectId=${projectId}` : "/apk-audit"}
                  className={cn(
                    "h-7 px-2.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition select-none cursor-pointer",
                    pathname === "/apk-audit" || pathname.startsWith("/apk-audit/")
                      ? "active-tool-tab font-semibold shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  <Smartphone className="h-3 w-3" /> <span>APK Audit</span>
                </Link>
                <Link
                  href={projectId ? `/copilot?projectId=${projectId}` : "/copilot"}
                  className={cn(
                    "h-7 px-2.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition select-none cursor-pointer",
                    pathname === "/copilot" || pathname.startsWith("/copilot/")
                      ? "active-tool-tab font-semibold shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  <Bot className="h-3 w-3" /> <span>AI Copilot</span>
                </Link>
              </div>
            </div>

            {projectId && (
              <div className="hidden lg:flex items-center text-[11px] font-mono text-neutral-500">
                Target: <span className="text-neutral-300 ml-1 truncate max-w-[200px]">{projectId}</span>
              </div>
            )}
          </div>
        )}

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardShell(props: { area: ShellArea; children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#000000]" />}>
      <DashboardShellContent {...props} />
    </Suspense>
  );
}
