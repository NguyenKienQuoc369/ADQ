"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, LayoutDashboard, LogIn } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

export function Navigation() {
  const { user } = useAuth();
  const pathname = usePathname();
  const onMarketingPage = pathname === "/";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const menu = [
    { label: "Tính năng", href: onMarketingPage ? "#features" : "/#features" },
    { label: "Ma trận", href: onMarketingPage ? "#matrix" : "/#matrix" },
    { label: "Bề mặt tấn công", href: onMarketingPage ? "#recon-globe" : "/#recon-globe" },
    { label: "Bắt đầu", href: onMarketingPage ? "#pricing" : "/#pricing" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-cyan-500/20 bg-[#020617]/75 text-slate-100 backdrop-blur-xl font-sans">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-cyan-400/30 bg-cyan-400/10 shadow-[0_0_26px_rgba(6,182,212,0.22)]">
            <Image src="/logo.png" alt="ADQ SECURITY logo" width={40} height={40} className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-100">ADQ SECURITY</p>
            <p className="text-[11px] tracking-[0.2em] text-cyan-300/80">OFFENSIVE CLOUD</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-sm md:flex">
          {menu.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-full px-3 py-1.5 text-slate-300 transition hover:bg-cyan-400/10 hover:text-cyan-200"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {mounted && user ? (
            <Link href="/dashboard">
              <Button
                variant="secondary"
                className="border-cyan-500/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20 cursor-pointer"
              >
                <LayoutDashboard className="h-4 w-4 mr-1.5" />
                Mở Console
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/register" className="hidden sm:block">
                <Button variant="ghost" size="sm" className="border border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/10 cursor-pointer">
                  Tạo tài khoản
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="sm"
                  className="border border-cyan-300/60 bg-gradient-to-r from-cyan-300 via-cyan-400 to-sky-400 text-slate-950 shadow-[0_12px_28px_rgba(34,211,238,0.32)] hover:shadow-[0_16px_32px_rgba(34,211,238,0.42)] cursor-pointer"
                >
                  <LogIn className="h-3.5 w-3.5 mr-1" />
                  Mở Console
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
