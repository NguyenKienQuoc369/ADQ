"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Gauge,
  Users,
  KeyRound,
  LogOut,
  Server,
  Folder,
  ShieldAlert,
  Zap,
  Smartphone,
  Bot,
  Database,
  Lock,
  Radio,
  FileText,
  ShieldCheck,
  CreditCard,
  Layers,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const adminNavSections: NavSection[] = [
  {
    title: "TỔNG QUAN",
    items: [
      { href: "/admin", label: "Tổng quan hệ thống", icon: Gauge },
    ],
  },
  {
    title: "NGƯỜI DÙNG & QUYỀN",
    items: [
      { href: "/admin/users", label: "Người dùng", icon: Users },
      { href: "/admin/roles", label: "Phân quyền Admin", icon: ShieldCheck },
      { href: "/admin/entitlements", label: "Gói & Entitlement", icon: CreditCard },
      { href: "/admin/redeem-codes", label: "Redeem Codes", icon: KeyRound },
    ],
  },
  {
    title: "DỮ LIỆU SẢN PHẨM",
    items: [
      { href: "/admin/projects", label: "Projects & Targets", icon: Folder },
      { href: "/admin/scans", label: "Scan Jobs", icon: ShieldAlert },
      { href: "/admin/stress", label: "Stress Test", icon: Zap },
      { href: "/admin/apk", label: "APK Audit", icon: Smartphone },
      { href: "/admin/copilot", label: "AI Copilot", icon: Bot },
    ],
  },
  {
    title: "HẠ TẦNG & DỮ LIỆU",
    items: [
      { href: "/admin/postgres", label: "PostgreSQL Explorer", icon: Database },
      { href: "/admin/supabase", label: "Supabase Auth", icon: Lock },
      { href: "/admin/redis", label: "Redis / Live Jobs", icon: Radio },
      { href: "/admin/services", label: "Workers & Services", icon: Server },
    ],
  },
  {
    title: "HỆ THỐNG",
    items: [
      { href: "/admin/audit-logs", label: "Audit Log", icon: FileText },
      { href: "/admin/security", label: "Cấu hình an toàn", icon: ShieldCheck },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      window.location.href = "/admin/login";
    }
  };

  if (!mounted) {
    return <div className="min-h-screen bg-[#000000]" />;
  }

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4 bg-[#000000] text-[#ededed]">
      <div className="space-y-6">
        {/* Brand & SOC Master Header */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0a0a] border border-[#222222]">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#222222] bg-[#000000] p-1 shadow-sm">
            <Image
              src="/logo.png"
              alt="ADQ logo"
              width={32}
              height={32}
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <div className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
              ADQ SOC ADMIN
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 font-mono">v2.0</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AUTHORITATIVE REALM
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="space-y-5 overflow-y-auto max-h-[calc(100vh-230px)] pr-1 custom-scrollbar">
          {adminNavSections.map((sec) => (
            <div key={sec.title} className="space-y-1.5">
              <div className="px-3 text-[10px] font-mono font-semibold tracking-wider text-neutral-500 uppercase">
                {sec.title}
              </div>
              <div className="space-y-0.5">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    (item.href === "/admin" && pathname === "/admin") ||
                    (item.href !== "/admin" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer select-none",
                        active
                          ? "bg-white text-black font-semibold shadow-sm"
                          : "text-neutral-400 hover:bg-[#111111] hover:text-white"
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-black" : "text-neutral-400")} />
                      <span className={cn("truncate", active ? "text-black font-semibold" : "")}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer / Logout */}
      <div className="pt-3 border-t border-[#222222] space-y-2">
        <div className="px-2 py-1 flex items-center justify-between text-[10px] font-mono text-neutral-500">
          <span>REALM: SOC ROOT</span>
          <span className="text-emerald-400">ENCRYPTED</span>
        </div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-2 text-xs text-neutral-400 hover:text-rose-400 hover:bg-neutral-900 rounded-md h-8"
        >
          <LogOut className="h-3.5 w-3.5" /> Thoát Root Console
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#000000] text-[#ededed] font-sans selection:bg-white selection:text-black">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-[#222222] flex-col justify-between fixed inset-y-0 left-0 z-30 bg-[#000000]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-[#000000] border-r border-[#222222] shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-[#222222] bg-[#000000]/90 backdrop-blur-md px-4 lg:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-900"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white tracking-tight">ADQ SOC Control Center</span>
              <span className="hidden sm:inline-block text-[10px] font-mono text-neutral-500">|</span>
              <span className="hidden sm:inline-block text-[11px] font-mono text-neutral-400">
                Observability & Authoritative Management
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#222222] bg-[#0a0a0a] text-[10px] font-mono text-neutral-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                PG: <span className="text-neutral-400">adq_db</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#222222] bg-[#0a0a0a] text-[10px] font-mono text-neutral-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Auth: <span className="text-neutral-400">Supabase</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#222222] bg-[#0a0a0a] text-[10px] font-mono text-neutral-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Redis: <span className="text-neutral-400">6379</span>
              </div>
            </div>

            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-semibold">
              <ShieldCheck className="h-3 w-3" />
              SOC AUTH
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
