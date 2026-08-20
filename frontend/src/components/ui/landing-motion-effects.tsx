"use client";

import React, { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BrainCircuit,
  Bug,
  DatabaseZap,
  Globe2,
  Network,
  Radar,
  ScanSearch,
} from "lucide-react";

const stages = [
  {
    number: "01",
    title: "Asset Discovery",
    subtitle: "Khám phá tài sản",
    icon: Globe2,
  },
  {
    number: "02",
    title: "Network Exposure",
    subtitle: "Bề mặt mạng",
    icon: Network,
  },
  {
    number: "03",
    title: "Web Surface Mapping",
    subtitle: "Lập bản đồ Web",
    icon: Radar,
  },
  {
    number: "04",
    title: "Vulnerability Analysis",
    subtitle: "Phân tích lỗ hổng",
    icon: Bug,
  },
  {
    number: "05",
    title: "Sensitive Data Exposure",
    subtitle: "Rò rỉ dữ liệu",
    icon: DatabaseZap,
  },
  {
    number: "06",
    title: "Application Security",
    subtitle: "Phân tích ứng dụng",
    icon: ScanSearch,
  },
  {
    number: "07",
    title: "AI Risk Assessment",
    subtitle: "Đánh giá bằng AI",
    icon: BrainCircuit,
  },
];

export function LandingMotionEffects() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.getElementById("adq-landing");
    if (!root) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("section")
    );

    if (!prefersReducedMotion) {
      sections.forEach((section) => {
        section.style.opacity = "0";
        section.style.transform = "translateY(24px)";
        section.style.transition =
          "opacity 700ms cubic-bezier(.22,1,.36,1), transform 700ms cubic-bezier(.22,1,.36,1)";
      });

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const section = entry.target as HTMLElement;
            section.style.opacity = "1";
            section.style.transform = "translateY(0)";
            observer.unobserve(section);
          });
        },
        {
          threshold: 0.08,
          rootMargin: "0px 0px -40px 0px",
        }
      );

      sections.forEach((section, index) => {
        // Hero không cần chờ observer.
        if (index === 0) {
          section.style.opacity = "1";
          section.style.transform = "translateY(0)";
        } else {
          observer.observe(section);
        }
      });

      return () => observer.disconnect();
    }
  }, []);

  useEffect(() => {
    const root = document.getElementById("adq-landing");
    const glow = glowRef.current;

    if (!root || !glow) return;

    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!finePointer || reduced) {
      glow.style.display = "none";
      return;
    }

    let frame = 0;

    const handleMove = (event: MouseEvent) => {
      cancelAnimationFrame(frame);

      frame = requestAnimationFrame(() => {
        const rect = root.getBoundingClientRect();

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        glow.style.transform =
          `translate3d(${x - 230}px, ${y - 230}px, 0)`;
        glow.style.opacity = "1";
      });
    };

    const handleLeave = () => {
      glow.style.opacity = "0";
    };

    root.addEventListener("mousemove", handleMove);
    root.addEventListener("mouseleave", handleLeave);

    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("mousemove", handleMove);
      root.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return (
    <div
      ref={glowRef}
      aria-hidden="true"
      className="
        pointer-events-none absolute left-0 top-0 z-[1]
        h-[460px] w-[460px] rounded-full opacity-0
        transition-opacity duration-500
        bg-[radial-gradient(circle,rgba(34,211,238,0.055)_0%,rgba(14,165,233,0.025)_35%,transparent_70%)]
        blur-2xl
      "
    />
  );
}

export function SecurityPipeline() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#030816]/80 p-5 shadow-[0_30px_80px_rgba(2,6,23,0.4)] backdrop-blur-xl md:p-7">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-52 w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/[0.045] blur-[80px]" />

      {/* Desktop connection rail */}
      <div className="pointer-events-none absolute left-[8%] right-[8%] top-[70px] hidden h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent lg:block" />

      {!reduceMotion && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute top-[68px] hidden h-[3px] w-24 rounded-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_18px_rgba(34,211,238,0.85)] lg:block"
          animate={{
            left: ["5%", "88%"],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 5.8,
            repeat: Infinity,
            ease: "easeInOut",
            repeatDelay: 0.6,
          }}
        />
      )}

      <div className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {stages.map((stage, index) => {
          const Icon = stage.icon;

          return (
            <motion.div
              key={stage.number}
              initial={
                reduceMotion
                  ? false
                  : {
                      opacity: 0,
                      y: 14,
                      scale: 0.97,
                    }
              }
              whileInView={
                reduceMotion
                  ? undefined
                  : {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                    }
              }
              viewport={{
                once: true,
                amount: 0.3,
              }}
              transition={{
                duration: 0.45,
                delay: index * 0.075,
                ease: "easeOut",
              }}
              whileHover={
                reduceMotion
                  ? undefined
                  : {
                      y: -4,
                    }
              }
              className="
                group relative rounded-2xl border border-slate-800
                bg-slate-950/75 p-4 transition-colors duration-300
                hover:border-cyan-500/35 hover:bg-cyan-950/15
              "
            >
              <div className="mb-4 flex items-center justify-between">
                <div
                  className="
                    relative flex h-10 w-10 items-center justify-center
                    rounded-xl border border-cyan-500/25 bg-cyan-500/10
                    text-cyan-300
                  "
                >
                  {!reduceMotion && (
                    <motion.span
                      className="absolute inset-0 rounded-xl border border-cyan-300/30"
                      animate={{
                        scale: [1, 1.32, 1],
                        opacity: [0.45, 0, 0.45],
                      }}
                      transition={{
                        duration: 2.8,
                        repeat: Infinity,
                        delay: index * 0.22,
                      }}
                    />
                  )}

                  <Icon className="relative h-4.5 w-4.5" />
                </div>

                <span className="font-mono text-[10px] tracking-[0.18em] text-slate-600">
                  {stage.number}
                </span>
              </div>

              <p className="text-xs font-semibold leading-5 text-slate-100">
                {stage.title}
              </p>

              <p className="mt-1 text-[10px] leading-4 text-slate-500">
                {stage.subtitle}
              </p>

              <div className="mt-4 h-px w-full overflow-hidden bg-slate-800">
                {!reduceMotion && (
                  <motion.div
                    className="h-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                    animate={{
                      x: ["-100%", "100%"],
                    }}
                    transition={{
                      duration: 2.8,
                      repeat: Infinity,
                      delay: index * 0.3,
                      ease: "linear",
                    }}
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">
          ADQ Automated Security Workflow
        </p>

        <div className="flex items-center gap-2 font-mono text-[10px] text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
          PIPELINE READY
        </div>
      </div>
    </div>
  );
}
