"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Gauge, Users, KeyRound, LogOut, Terminal, Activity, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const adminNav = [
  { href: "/admin", label: "Tổng quan SOC & Máy chủ", icon: Gauge },
  { href: "/admin/scans", label: "Lịch sử Quét Toàn cục", icon: ShieldAlert },
  { href: "/admin/users", label: "Quản lý Người dùng", icon: Users },
  { href: "/admin/redeem-codes", label: "Mã License Redeem", icon: KeyRound },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("adq_admin_root_token");
      if (!token) {
        router.replace("/admin/login");
        return;
      }
      setAuthorized(true);
    }
  }, [router]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("adq_admin_root_token");
      document.cookie = "adq_admin_root_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
      router.replace("/admin/login");
    }
  };

  if (!authorized) {
    return <div className="min-h-screen bg-[#020617]" />;
  }

  return (
    <div className="flex min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-rose-500 selection:text-white">
      {/* Sidebar Admin Riêng Biệt */}
      <aside className="w-64 shrink-0 border-r border-white/[0.08] bg-slate-950/90 p-4 flex flex-col justify-between backdrop-blur-2xl">
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-2 rounded-2xl bg-slate-900/80 border border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.15)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-black tracking-wider text-white">ADQ <span className="text-rose-400">ROOT SOC</span></div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> MASTER ACTIVE
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            {adminNav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition",
                    active
                      ? "border border-rose-500/40 bg-rose-950/40 text-rose-300 shadow-md"
                      : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-rose-400" : "text-slate-400")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-2 text-xs text-rose-400 hover:bg-rose-950/30 rounded-xl"
        >
          <LogOut className="h-4 w-4" /> Thoát Root Console
        </Button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
