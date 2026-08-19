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
import { GoogleSetupModal } from "@/components/auth/google-setup-modal";
import { PlansModal } from "@/components/auth/plans-modal";

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

  const { user, loading, logout, acceptTerms, setupGoogleRecovery } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [syncPulse, setSyncPulse] = useState(99);

  const needsTerms = useMemo(() => {
    if (loading || !user) return false;
    if (user.termsAccepted) return false;

    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(`adq_terms_accepted_${user.id}`);
      if (cached === "true") return false;
    }
    return true;
  }, [loading, user]);

  const needsGoogleRecovery = useMemo(() => {
    if (loading || !user) return false;
    if (user.oauthProvider !== "google") return false;
    if (user.hasRecoveryPassword) return false;

    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(`adq_recovery_setup_${user.id}`);
      if (cached === "true") return false;
    }
    return true;
  }, [loading, user]);

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);

  useEffect(() => {
    if (needsTerms) {
      setShowTermsModal(true);
      setShowGoogleModal(false);
    } else if (needsGoogleRecovery) {
      setShowTermsModal(false);
      setShowGoogleModal(true);
    } else {
      setShowTermsModal(false);
      setShowGoogleModal(false);
    }
  }, [needsTerms, needsGoogleRecovery]);

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

  const handleDeclineTerms = async () => {
    setShowTermsModal(false);
    await logout();
    router.replace("/");
  };

  const handleAcceptTerms = async () => {
    await acceptTerms();
    setShowTermsModal(false);
    // Sau khi duyệt điều khoản, hiển thị bảng giới thiệu 3 gói cước
    setShowPlansModal(true);
  };

  const handleCompleteGoogleRecovery = async (data: { name: string; username: string; password: string }) => {
    await setupGoogleRecovery(data);
    setShowGoogleModal(false);
  };

  if (loading) {
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

  if (!user || (area === "admin" && user.role !== "ADMIN")) {
    return <div className="min-h-screen bg-[#020617]" />;
  }

  return (
    <div className="relative min-h-screen bg-[#020617] text-slate-100 selection:bg-cyan-500 selection:text-black overflow-hidden font-sans">
      <TermsModal isOpen={showTermsModal} onAccept={handleAcceptTerms} onDecline={handleDeclineTerms} userEmail={user.email} />
      <GoogleSetupModal isOpen={showGoogleModal} userEmail={user.email} defaultName={user.name} onComplete={handleCompleteGoogleRecovery} />
      <PlansModal isOpen={showPlansModal} onClose={() => setShowPlansModal(false)} />

      {isProjectWorkspace ? (
        <div className="relative min-h-screen flex flex-col">
          <header className="sticky top-0 z-30 shrink-0 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl px-4 py-2 flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
              className="h-8 px-2.5 rounded-lg border border-white/[0.08] bg-slate-900/60 text-xs font-semibold text-slate-300 hover:border-cyan-500/40 hover:bg-cyan-950/30 hover:text-cyan-300 transition-all active:scale-98 flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-cyan-400" />
              <span>Quay lại Dự án</span>
            </Button>

            {projectId && (
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/60 border border-white/[0.08] backdrop-blur-md">
                <Link href={`/scan?projectId=${projectId}`} className={cn("flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all", pathname === "/scan" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-slate-200")}>
                  <Shield className="h-3 w-3" /> Quét DAST
                </Link>
                <Link href={`/stress-test?projectId=${projectId}`} className={cn("flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all", pathname === "/stress-test" ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : "text-slate-400 hover:text-slate-200")}>
                  <Zap className="h-3 w-3" /> Stress Test
                </Link>
                <Link href={`/apk-audit?projectId=${projectId}`} className={cn("flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all", pathname === "/apk-audit" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "text-slate-400 hover:text-slate-200")}>
                  <Smartphone className="h-3 w-3" /> APK Audit
                </Link>
                <Link href={`/copilot?projectId=${projectId}`} className={cn("flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all", pathname === "/copilot" ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" : "text-slate-400 hover:text-slate-200")}>
                  <Bot className="h-3 w-3" /> AI Copilot
                </Link>
              </div>
            )}
          </header>
          <main className="w-full flex-1 min-h-0">{children}</main>
        </div>
      ) : (
        <div className="relative flex min-h-screen z-10">
          <aside className="hidden w-64 shrink-0 xl:block">
            <div className="relative flex h-full flex-col justify-between border-r border-white/[0.07] bg-slate-950/80 p-4 backdrop-blur-2xl">
              <div className="space-y-5">
                <Link href="/dashboard" className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-slate-900/40 p-2.5 transition hover:border-cyan-500/40">
                  <Image src="/logo.png" alt="ADQ logo" width={32} height={32} className="object-contain" />
                  <div>
                    <span className="font-bold text-sm tracking-wide text-white">ADQ<span className="text-cyan-400">.SEC</span></span>
                    <p className="text-[10px] font-mono text-slate-400">{user.packageTier || "FREE"}</p>
                  </div>
                </Link>
                <div className="space-y-1">
                  {navGroups.map((group) => (
                    <div key={group.title} className="space-y-1">
                      {group.links.map((item) => {
                        const Icon = item.icon;
                        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                        return (
                          <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition", active ? "border border-cyan-500/40 bg-cyan-950/40 text-cyan-300" : "text-slate-400 hover:bg-slate-900/60")}>
                            <Icon className={cn("h-4 w-4", active ? "text-cyan-400" : "text-slate-400")} />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <Button variant="ghost" className="w-full justify-start gap-2 text-xs text-rose-400 hover:bg-rose-950/20" onClick={() => logout()}>
                <LogOut className="h-4 w-4" /> Đăng xuất
              </Button>
            </div>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="p-4 xl:hidden">
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="h-8 w-8 text-slate-300 border border-slate-800 bg-slate-900">
                <Menu className="h-4 w-4" />
              </Button>
            </div>
            <main className="flex-1 p-4 sm:p-6">{children}</main>
          </div>
        </div>
      )}
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
