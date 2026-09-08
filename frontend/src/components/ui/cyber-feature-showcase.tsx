"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Globe,
  LucideIcon,
  Radar,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { LiquidGlassButton, LiquidGlassCard } from "@/components/ui/liquid-glass";
import { BorderBeam } from "@/components/ui/border-beam";

interface DetailedFeature {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  icon: LucideIcon;
  bullets: string[];
  ctaText: string;
  ctaLink: string;
  glowColor: "cyan" | "emerald" | "purple";
}

const features: DetailedFeature[] = [
  {
    id: "01",
    tag: "AUTOMATED DAST SCANNER",
    title: "Rà Quét Lỗ Hổng Web & API Tự Động",
    subtitle: "Phát hiện lỗ hổng DAST theo chuẩn OWASP Top 10 & SANS CWE-25",
    description:
      "Tự động rà soát toàn bộ bề mặt ứng dụng web và cổng API Endpoint. Hệ thống thực hiện hơn 500+ bài kiểm thử bảo mật chuyên sâu nhằm phát hiện các lỗ hổng như SQL Injection, XSS, SSRF, RCE, Broken Auth mà không cần quyền truy cập mã nguồn.",
    image: "/images/feature-scan.jpg",
    icon: Radar,
    bullets: [
      "Quét tự động toàn bộ 100% đường dẫn URL & REST/GraphQL API",
      "Đánh giá điểm rủi ro kinh doanh chuẩn CVSS v3.1",
      "Loại bỏ báo động giả (False-Positive Elimination)",
      "Xuất báo cáo đa định dạng: PDF, JSON, Markdown",
    ],
    ctaText: "Khám Phá DAST Scan",
    ctaLink: "/register",
    glowColor: "cyan",
  },
  {
    id: "02",
    tag: "LAYER 7 STRESS TESTING",
    title: "Kiểm Thử Ngưỡng Chịu Tải & Chống Chịu WAF",
    subtitle: "Mô phỏng hàng triệu request tầng ứng dụng HTTP/HTTPS",
    description:
      "Đo lường ngưỡng chịu tải thực tế (RPS) và khả năng ứng phó của tường lửa WAF (Cloudflare/AWS WAF). Giúp doanh nghiệp chủ động phát hiện điểm nghẽn hiệu năng và sẵn sàng cho các đợt tăng vọt lưu lượng truy cập lớn.",
    image: "/images/feature-stress.jpg",
    icon: Zap,
    bullets: [
      "Kiểm thử chịu tải Layer 7 với hàng chục nghìn RPS",
      "Đánh giá độ trễ Latency và tỷ lệ lỗi HTTP 5xx",
      "Kiểm tra hiệu quả quy tắc chặn lọc của Cloudflare/WAF",
      "An toàn 100% không ảnh hưởng dữ liệu gốc",
    ],
    ctaText: "Thử Nghiệm Stress Test",
    ctaLink: "/register",
    glowColor: "emerald",
  },
  {
    id: "03",
    tag: "AI COPILOT REMEDIATION",
    title: "Trợ Lý AI Tự Động Phân Tích & Vá Lỗi Mã Nguồn",
    subtitle: "One-Click Code Patch Diff cho 7+ ngôn ngữ lập trình",
    description:
      "Trợ lý AI Bảo mật của ADQ tự động phân tích vết lỗ hổng (Root Cause Analysis), loại bỏ các cảnh báo nhiễu và trực tiếp tạo ra đoạn mã nguồn sửa lỗi (Code Diff Patch). Đội ngũ lập trình chỉ cần 1 cú nhấp chuột để phê duyệt và vá lỗi.",
    image: "/images/feature-ai.jpg",
    icon: BrainCircuit,
    bullets: [
      "Tạo mã sửa lỗi tức thì cho React, Node, Python, Java, PHP, Go",
      "Giải thích nguyên nhân lỗ hổng bằng tiếng Việt dễ hiểu",
      "Tích hợp trực tiếp với luồng CI/CD GitHub & GitLab",
      "Tối ưu 90% thời gian khắc phục sự cố cho lập trình viên",
    ],
    ctaText: "Trải Nghiệm AI Copilot",
    ctaLink: "/register",
    glowColor: "purple",
  },
  {
    id: "04",
    tag: "ATTACK SURFACE MONITORING",
    title: "Giám Sát Bề Mặt Tấn Công 24/7",
    subtitle: "Phát hiện tài sản số ngầm & rò rỉ thông tin",
    description:
      "Tự động quét và phát hiện các tên miền con (Subdomains), cổng dịch vụ mở (Open Ports) và thông tin cấu hình bị rò rỉ của doanh nghiệp trên môi trường Internet, giúp ngăn chặn nguy cơ bị kẻ xấu lợi dụng.",
    image: "/images/feature-surface.jpg",
    icon: Globe,
    bullets: [
      "Tự động tìm kiếm toàn bộ Subdomain & Cổng mở",
      "Cảnh báo tức thì khi phát hiện dịch vụ chưa vá lỗi",
      "Bản đồ trực quan hóa tài sản số của doanh nghiệp",
      "Bảo vệ bề mặt tấn công liên tục không gián đoạn",
    ],
    ctaText: "Giám Sát Bề Mặt Số",
    ctaLink: "/register",
    glowColor: "cyan",
  },
];

export function CyberFeatureShowcase() {
  return (
    <div className="space-y-24 md:space-y-36">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-mono font-bold flex items-center justify-center gap-2">
          <ShieldCheck className="h-4 w-4 text-cyan-400" />
          <span>CHI TIẾT TÍNH NĂNG CỐT LÕI</span>
        </p>
        <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">
          Nền Tảng An Ninh Mạng Tự Động Hóa Thế Hệ Mới
        </h2>
        <p className="text-base md:text-lg text-slate-200 leading-relaxed max-w-2xl mx-auto font-medium">
          Khám phá chi tiết sức mạnh của từng module bảo vệ trên Console ADQ Security.
        </p>
      </div>

      <div className="space-y-20 md:space-y-32">
        {features.map((item, idx) => {
          const Icon = item.icon;
          const isEven = idx % 2 === 0;

          return (
            <div
              key={item.id}
              className={`grid gap-10 lg:grid-cols-2 items-center ${
                isEven ? "" : "lg:grid-flow-dense"
              }`}
            >
              {/* IMAGE COLUMN */}
              <motion.div
                initial={{ opacity: 0, x: isEven ? -30 : 30, filter: "blur(8px)" }}
                whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className={isEven ? "lg:col-start-1" : "lg:col-start-2"}
              >
                <LiquidGlassCard className="group relative overflow-hidden rounded-3xl p-2 md:p-3 border-cyan-500/30 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 600px"
                      className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020617]/70 via-transparent to-transparent" />
                  </div>

                  <BorderBeam
                    size={280}
                    duration={12}
                    colorFrom={
                      item.glowColor === "cyan"
                        ? "#22d3ee"
                        : item.glowColor === "emerald"
                        ? "#10b981"
                        : "#a855f7"
                    }
                    colorTo="#38bdf8"
                    borderWidth={1.5}
                  />
                </LiquidGlassCard>
              </motion.div>

              {/* CONTENT COLUMN */}
              <motion.div
                initial={{ opacity: 0, x: isEven ? 30 : -30, filter: "blur(8px)" }}
                whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                className={`space-y-6 ${isEven ? "lg:col-start-2" : "lg:col-start-1"}`}
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs font-extrabold tracking-widest text-cyan-300 uppercase">
                      [{item.tag}]
                    </span>
                  </div>

                  <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
                    {item.title}
                  </h3>

                  <p className="text-sm font-semibold text-cyan-200">
                    {item.subtitle}
                  </p>
                </div>

                <p className="text-base leading-relaxed text-slate-200 font-medium">
                  {item.description}
                </p>

                <div className="space-y-3 pt-2">
                  {item.bullets.map((b, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm text-slate-200 font-medium">
                      <CheckCircle2 className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  <Link href={item.ctaLink}>
                    <LiquidGlassButton variant="primary" className="px-6 py-3 text-sm font-bold gap-2">
                      <span>{item.ctaText}</span>
                      <ArrowRight className="h-4 w-4" />
                    </LiquidGlassButton>
                  </Link>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

