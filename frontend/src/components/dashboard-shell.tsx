"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BadgeCheck,
  Bug,
  CreditCard,
  Gauge,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  PanelsTopLeft,
  Shield,
  ShieldAlert,
  Terminal,
  Users,
  X,
  Folder,
  Settings,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

type ShellArea = "dashboard" | "admin";

const workspaceSections = [
  {
    title: "Không gian chính",
    links: [
      { href: "/dashboard", label: "Dự án", icon: Folder },
      { href: "/vulnerabilities", label: "Chi tiết lỗ hổng", icon: Bug },
      { href: "/dashboard/billing", label: "Gói dịch vụ", icon: CreditCard },
      { href: "/settings", label: "Cài đặt", icon: Settings },
    ],
  },
] as const;

const adminLinks = [
  { href: "/admin", label: "Tổng quan quản trị", icon: Gauge },
  { href: "/admin/users", label: "Quản lý tài khoản", icon: Users },
  { href: "/admin/redeem-codes", label: "Tạo mã nâng cấp", icon: KeyRound },
];

const routeMeta: Record<string, { eyebrow: string; title: string }> = {
  "/dashboard": { eyebrow: "Dự án", title: "Tổng quan dự án" },
  "/dashboard/results": { eyebrow: "Kết quả", title: "Xem toàn bộ kết quả và tải báo cáo" },
  "/dashboard/tools": { eyebrow: "Công cụ", title: "Trung tâm công cụ" },
  "/dashboard/billing": { eyebrow: "Tài khoản", title: "Gói dịch vụ" },
  "/vulnerabilities": { eyebrow: "Chi tiết", title: "Chi tiết lỗ hổng" },
  "/settings": { eyebrow: "Cài đặt", title: "Cấu hình dự án" },
  "/admin": { eyebrow: "Quản trị", title: "Tổng quan hệ thống" },
  "/admin/users": { eyebrow: "Quản trị", title: "Quản lý tài khoản người dùng" },
  "/admin/redeem-codes": { eyebrow: "Quản trị", title: "Tạo và theo dõi mã nâng cấp" },
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
  const [pulse, setPulse] = useState(92);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPulse((prev) => (prev >= 99 ? 92 : prev + 1));
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

  const navigationGroups = useMemo(
    () => (area === "admin" ? [{ title: "Khu vực quản trị", links: adminLinks }] : workspaceSections),
    [area],
  );

  const currentMeta = useMemo(() => {
    const matched = Object.entries(routeMeta)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([route]) => pathname === route || pathname.startsWith(`${route}/`));

    return matched?.[1] ?? (area === "admin"
      ? { eyebrow: "Quản trị", title: "Tổng quan hệ thống" }
      : { eyebrow: "Dành cho mọi người", title: "Bảng điều khiển dễ dùng" });
  }, [area, pathname]);

  if (loading || !user || (area === "admin" && user.role !== "ADMIN")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent text-[var(--foreground)]">
        <div className="rounded-2xl px-6 py-5 shadow-2xl app-panel">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.9)]" />
          <p>Đang chuẩn bị giao diện làm việc...</p>
          </div>
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col justify-between border-r app-border bg-[color:color-mix(in_srgb,var(--background-elevated)_94%,transparent)] p-4 backdrop-blur">
      <div className="space-y-6">
        <div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--accent)_18%,transparent)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_14%,transparent),color-mix(in_srgb,#10b981_10%,transparent),transparent)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--accent)_20%,transparent)] bg-[color:var(--background-elevated)]">
              <Shield className="h-5 w-5 text-[color:var(--accent-strong)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">ADQ Scanner</p>
              <p className="text-xs text-[var(--foreground-muted)]">Bảng điều khiển gọn hơn, dễ thao tác hơn</p>
            </div>
          </div>
        </div>

        {navigationGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <p className="px-2 text-xs uppercase tracking-[0.2em] text-[var(--foreground-muted)]">{group.title}</p>
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
                    "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition",
                    active
                      ? "border-[color:color-mix(in_srgb,var(--accent)_25%,transparent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                      : "border-transparent text-[var(--foreground-soft)] hover:border-[color:var(--line)] hover:bg-[color:var(--background-muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}

        {area !== "admin" ? (
          <div className="rounded-2xl border p-4 app-panel-soft">
            <div className="mb-3 flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-[color:var(--accent-strong)]" />
              <p className="text-sm font-medium text-[var(--foreground)]">Luồng quét chính</p>
            </div>
            <p className="text-xs leading-6 text-[var(--foreground-muted)]">
              Hệ thống quét chính của dự án đang chạy qua điều phối quét nâng cao. Tổng quan chỉ tập trung vào theo dõi, triage và phân tích kết quả.
            </p>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border p-4 app-panel-soft">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]">
            {user.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--foreground)]">{user.name}</p>
            <p className="truncate text-xs text-[var(--foreground-muted)]">{user.email}</p>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge variant="success">{user.role}</Badge>
          <Badge variant="default">{user.packageTier.replace("_", " ")}</Badge>
        </div>
        <Button
          variant="secondary"
          className="w-full justify-center"
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-transparent text-[var(--foreground)]">
      <div className="flex min-h-screen">
        <aside className="hidden w-80 xl:block">{sidebar}</aside>

        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-slate-950/50 xl:hidden dark:bg-slate-950/80"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: -320 }}
                animate={{ x: 0 }}
                exit={{ x: -320 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className="fixed inset-y-0 left-0 z-50 w-80 xl:hidden"
              >
                {sidebar}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b app-border bg-[color:color-mix(in_srgb,var(--background-elevated)_88%,transparent)] backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-8">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => setMobileOpen(true)}>
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--foreground-muted)]">{currentMeta.eyebrow}</p>
                  <h1 className="text-lg font-semibold text-[var(--foreground)]">{currentMeta.title}</h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ThemeToggle compact />
                <div className="hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 md:block">
                  <div className="flex items-center gap-2 text-sm">
                    <Activity className="h-4 w-4 text-emerald-300" />
                    <span className="text-[var(--foreground)]">Trạng thái hệ thống</span>
                    <span className="font-semibold text-emerald-300">{pulse}%</span>
                  </div>
                </div>
                <div className="rounded-2xl border px-4 py-2 app-panel-soft">
                  <div className="flex items-center gap-2 text-sm">
                    <BadgeCheck className="h-4 w-4 text-[color:var(--accent-strong)]" />
                    <span className="text-[var(--foreground-soft)]">{user.role}</span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
