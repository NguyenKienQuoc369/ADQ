"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, LayoutDashboard, LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/providers/auth-provider";
import { LiquidGlassButton } from "@/components/ui/liquid-glass";

export function Navigation() {
  const { user } = useAuth();
  const pathname = usePathname();
  const onMarketingPage = pathname === "/";
  const [mounted, setMounted] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // CHỈ hiển thị duy nhất ở trang chủ ("/")
  if (pathname !== "/") return null;

  const menu = [
    {
      label: "Cách hoạt động",
      href: onMarketingPage ? "#how-it-works" : "/#how-it-works",
    },
    {
      label: "Nền tảng",
      href: onMarketingPage ? "#platform" : "/#platform",
    },
    {
      label: "Tính năng",
      href: onMarketingPage ? "#features" : "/#features",
    },
    {
      label: "Về chúng tôi",
      href: onMarketingPage ? "#about" : "/#about",
    },
    {
      label: "Bảng giá",
      href: onMarketingPage ? "#pricing" : "/#pricing",
    },
  ];

  return (
    <header className="sticky top-3.5 z-50 w-full px-4 md:px-8 font-sans text-slate-100 transition-all pointer-events-none">
      <div
        className="pointer-events-auto relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 rounded-2xl md:rounded-full border border-white/[0.12] bg-[#020617]/25 backdrop-blur-md transition-all overflow-hidden"
        style={{
          boxShadow:
            "inset 0 1px 1px 0 rgba(255, 255, 255, 0.2), 0 20px 45px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-cyan-400/30 bg-cyan-400/10 shadow-[0_0_26px_rgba(6,182,212,0.22)]">
            <Image
              src="/logo.png"
              alt="ADQ SECURITY logo"
              width={40}
              height={40}
              className="h-full w-full object-contain"
            />
          </div>

          <div>
            <p className="text-base font-semibold text-slate-100">ADQ SECURITY</p>
            <p className="text-[10px] tracking-[0.16em] text-cyan-300/80">
              AUTOMATED SECURITY PLATFORM
            </p>
          </div>
        </Link>

        <nav
          onMouseLeave={() => setHoveredNav(null)}
          className="relative hidden items-center gap-1 rounded-full border border-cyan-500/20 bg-slate-950/70 px-2 py-1 text-sm backdrop-blur-md md:flex shadow-inner"
        >
          {menu.map((item) => {
            const isHovered = hoveredNav === item.label;

            return (
              <Link
                key={item.label}
                href={item.href}
                onMouseEnter={() => setHoveredNav(item.label)}
                className="relative rounded-full px-3.5 py-1.5 text-slate-300 transition-colors duration-200 hover:text-white"
              >
                {isHovered && (
                  <motion.div
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 26 }}
                    className="absolute inset-0 rounded-full border border-cyan-400/40 bg-gradient-to-r from-cyan-500/25 via-sky-500/15 to-cyan-500/25 shadow-[0_0_15px_rgba(6,182,212,0.35)] -z-10"
                  />
                )}
                <span className="relative z-10 font-medium text-xs tracking-wide">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {mounted && user ? (
            <Link href="/dashboard">
              <LiquidGlassButton
                variant="secondary"
                className="px-3.5 py-1.5 text-xs font-semibold"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Dashboard
              </LiquidGlassButton>
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden sm:block">
                <LiquidGlassButton
                  variant="secondary"
                  className="px-3 py-1.5 text-xs font-medium border-white/10 hover:border-cyan-400/40"
                >
                  Đăng nhập
                </LiquidGlassButton>
              </Link>

              <Link href="/register">
                <LiquidGlassButton
                  variant="primary"
                  className="px-3.5 py-1.5 text-xs font-bold"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Bắt đầu miễn phí
                </LiquidGlassButton>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
