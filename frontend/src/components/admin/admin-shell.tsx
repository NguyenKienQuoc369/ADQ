"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Gauge, Users, KeyRound, LogOut, Terminal, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const adminNav = [
  { href: "/admin", label: "Tổng quan SOC & Máy chủ", icon: Gauge },
  { href: "/admin/operations", label: "Operations", icon: Server },
  { href: "/admin/users", label: "Quản lý Người dùng", icon: Users },
  { href: "/admin/redeem-codes", label: "Mã License Redeem", icon: KeyRound },
];

export function AdminShell({ children, onLogout }: { children: React.ReactNode; onLogout?: () => void }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
      return;
    }

    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      window.location.href = "/admin";
    }
  };

  if (!mounted) return <div className="min-h-screen bg-[#000000]" />;

  return (
    <div className="flex min-h-screen bg-[#000000] text-[#ededed] font-sans selection:bg-white selection:text-black">
      {/* Sidebar Admin Riêng Biệt */}
      <aside className="w-64 shrink-0 border-r border-[#222222] bg-[#000000] p-4 flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0a0a] border border-[#222222]">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#222222] bg-[#000000] p-1">
              <Image
                src="/logo.png"
                alt="ADQ logo"
                width={28}
                height={28}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-tight text-white">ADQ ROOT SOC</div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> MASTER ACTIVE
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            {adminNav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href === "/admin" && (pathname === "/" || pathname === ""));
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition cursor-pointer select-none",
                    active
                      ? "active-sidebar-link bg-white text-black font-semibold shadow-sm"
                      : "text-neutral-400 hover:bg-[#111111] hover:text-white"
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-black" : "text-neutral-400")} />
                  <span className={active ? "text-black font-semibold" : ""}>{item.label}</span>
                </a>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2 pt-3 border-t border-[#222222]">
          <div className="w-full flex justify-center">
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-xs text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-md"
          >
            <LogOut className="h-4 w-4" /> Thoát Root Console
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
