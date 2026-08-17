"use client";

import Link from "next/link";
import { ArrowRight, LayoutDashboard, LogIn, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Navigation() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--background-elevated)]/90 text-[var(--foreground)] shadow-[0_1px_0_rgba(148,163,184,0.12)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-700 shadow-[0_0_24px_rgba(34,211,238,0.12)] dark:text-cyan-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--foreground)]">ADQ Security</p>
          </div>
        </Link>

        <div className="hidden items-center gap-1 text-sm md:flex"></div>

        <div className="flex items-center gap-3">
          <ThemeToggle compact />
          {user ? (
            <Link href={user.role === "ADMIN" ? "/admin" : "/dashboard"}>
              <Button
                variant="secondary"
                className="border-[var(--line)] bg-[var(--background-muted)] text-[var(--foreground)] hover:bg-[var(--background-strong)]"
              >
                <LayoutDashboard className="h-4 w-4" />
                Mở bảng điều khiển
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/register" className="hidden sm:block">
                <Button variant="ghost" size="sm" className="border-[var(--line)] text-[var(--foreground)] hover:bg-[var(--background-muted)]">
                  Tạo tài khoản
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="sm"
                  className="border-cyan-300/60 bg-gradient-to-r from-cyan-300 via-cyan-400 to-sky-400 text-slate-950 shadow-[0_12px_24px_rgba(34,211,238,0.26)] hover:shadow-[0_16px_28px_rgba(34,211,238,0.36)] dark:border-cyan-200/60 dark:from-cyan-200 dark:via-cyan-300 dark:to-sky-300"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Đăng nhập
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
