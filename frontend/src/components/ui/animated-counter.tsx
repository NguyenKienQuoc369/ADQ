"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Activity, ShieldCheck, Zap, Bot, LucideIcon } from "lucide-react";

interface MetricItem {
  id: string;
  icon: LucideIcon;
  targetValue: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  title: string;
  subtitle: string;
  color: string;
}

const METRICS: MetricItem[] = [
  {
    id: "rps",
    icon: Zap,
    targetValue: 1.2,
    suffix: "M+",
    decimals: 1,
    title: "Yêu Cầu / Giây",
    subtitle: "Công suất mô phỏng tải & thẩm định WAF Evasion",
    color: "from-amber-400 to-orange-500 text-amber-400",
  },
  {
    id: "cve",
    icon: ShieldCheck,
    targetValue: 100,
    suffix: "+",
    decimals: 0,
    title: "Lỗ Hổng OWASP & CVE",
    subtitle: "Thư viện rà soát chuyên sâu tự động cập nhật",
    color: "from-cyan-400 to-sky-500 text-cyan-400",
  },
  {
    id: "speed",
    icon: Activity,
    prefix: "< ",
    targetValue: 60,
    suffix: "s",
    decimals: 0,
    title: "Tốc Độ Phân Tích",
    subtitle: "Lập bản đồ rủi ro bề mặt tấn công tức thời",
    color: "from-emerald-400 to-teal-500 text-emerald-400",
  },
  {
    id: "accuracy",
    icon: Bot,
    targetValue: 99.8,
    suffix: "%",
    decimals: 1,
    title: "Độ Chính Xác AI",
    subtitle: "Khử triệt để báo động giả bằng ADQ Copilot",
    color: "from-purple-400 to-pink-500 text-purple-400",
  },
];

function CountUpNumber({
  target,
  decimals = 0,
  prefix = "",
  suffix = "",
  startCounting,
}: {
  target: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  startCounting: boolean;
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!startCounting) return;

    let startTime: number | null = null;
    const duration = 1800; // 1.8 seconds

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const val = easeOut * target;

      setCurrent(val);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setCurrent(target);
      }
    };

    requestAnimationFrame(step);
  }, [startCounting, target]);

  return (
    <span>
      {prefix}
      {current.toFixed(decimals)}
      {suffix}
    </span>
  );
}

export function CyberMetricsStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref} className="relative mx-auto max-w-7xl px-4 py-8 md:px-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        {METRICS.map((metric, idx) => {
          const Icon = metric.icon;

          return (
            <motion.div
              key={metric.id}
              initial={{ opacity: 0, y: 25 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: idx * 0.12, duration: 0.5, ease: "easeOut" }}
              whileHover={{
                y: -4,
                borderColor: "rgba(6, 182, 212, 0.4)",
                boxShadow: "0 15px 30px -10px rgba(6, 182, 212, 0.2)",
              }}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.12] bg-[#020617]/30 hover:border-cyan-400/40 p-4 md:p-5 backdrop-blur-md transition-all"
              style={{
                boxShadow: "inset 0 1px 1px 0 rgba(255, 255, 255, 0.15), 0 15px 35px -10px rgba(0, 0, 0, 0.4)",
              }}
            >
              {/* Top ambient glow */}
              <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-cyan-500/10 blur-2xl group-hover:bg-cyan-500/20 transition-colors" />

              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  METRIC 0{idx + 1}
                </span>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 ${metric.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>

              <div className="font-mono text-2xl md:text-3xl font-extrabold tracking-tight text-white group-hover:text-cyan-300 transition-colors">
                <CountUpNumber
                  target={metric.targetValue}
                  decimals={metric.decimals}
                  prefix={metric.prefix}
                  suffix={metric.suffix}
                  startCounting={isInView}
                />
              </div>

              <p className="mt-1 font-semibold text-xs md:text-sm text-slate-200">
                {metric.title}
              </p>

              <p className="mt-1 text-[11px] leading-relaxed text-slate-400 line-clamp-2">
                {metric.subtitle}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
