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
  FileText,
  ShieldCheck,
  Zap,
  Bot,
  Crown,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserAvatar, getCanonicalDisplayName, getCanonicalPackageTier } from "@/components/ui/user-avatar";
import { cn, maskEmail } from "@/lib/utils";

type ShellArea = "dashboard" | "admin";

const globalNavGroups = [
  {
    title: "KHÔNG GIAN LÀM VIỆC",
    links: [
      { href: "/dashboard", label: "Dự án & Targets", icon: Folder },
      { href: "/reports", label: "Lịch sử & Báo cáo", icon: FileText },
    ],
  },
  {
    title: "TÀI KHOẢN & HỆ THỐNG",
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
      { href: "/dashboard", label: "Vào Dashboard chính", icon: Folder },
    ],
  },
];

function DashboardShellContent({
  area,
  children,
}: {
  area: ShellArea;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userDisplayName = getCanonicalDisplayName(user);
  const canonicalTier = getCanonicalPackageTier(user);

  const navGroups = useMemo(
    () => (area === "admin" ? adminNavGroups : globalNavGroups),
    [area]
  );

  // Content for sidebar navigation
  const sidebarNavContent = (
    <div className="flex h-full flex-col justify-between p-4 bg-[#000000]">
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
              {canonicalTier.replace("_", " ")} Plan
            </p>
          </div>
        </Link>

        {/* Global Navigation Sections */}
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

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition select-none cursor-pointer",
                        active
                          ? "bg-white text-black font-semibold shadow-sm"
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

      {/* Sidebar Footer: Compact Plan / Quota Card & User profile */}
      <div className="border-t border-[#222222] pt-3 space-y-3">
        {/* Compact Plan / Quota Card */}
        {area !== "admin" && (
          <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-neutral-300" />
                <span>{canonicalTier.replace("_", " ")}</span>
              </span>
              <Link
                href="/dashboard/billing"
                className="text-[10px] text-neutral-400 hover:text-white transition underline"
              >
                Chi tiết
              </Link>
            </div>

            <div className="space-y-1 text-[11px] text-neutral-400 font-mono">
              <div className="flex items-center justify-between">
                <span>Stress Test:</span>
                <span className="text-neutral-200">
                  {canonicalTier === "PRO_MAX"
                    ? "10 / ngày"
                    : canonicalTier === "PRO"
                    ? "1 / ngày"
                    : "Đã khóa"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Scan:</span>
                <span className="text-neutral-200">
                  {canonicalTier === "FREE" ? "1 lượt" : "Không giới hạn"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Copilot:</span>
                <span className="text-neutral-200">
                  {canonicalTier === "PRO_MAX" ? "Có sẵn" : "Gói PRO MAX"}
                </span>
              </div>
            </div>
          </div>
        )}

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
              <p className="text-xs font-medium text-white truncate group-hover:text-neutral-300 transition">
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
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 z-30 border-r border-[#222222] bg-[#000000]">
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

      {/* Main Content Viewport - Full Width Space for Tools */}
      <div className="md:pl-60 flex flex-col min-h-screen">
        <main className="flex-1 w-full p-4 sm:p-6 md:p-8">
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
