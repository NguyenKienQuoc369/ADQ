"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Building2,
  CheckCircle2,
  FileCheck2,
  Globe as GlobeIcon,
  Radar,
  Rocket,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  X,
  Zap,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContainerTextFlip } from "@/components/ui/container-text-flip";
import { TextHoverEffect } from "@/components/ui/text-hover-effect";
import {
  LandingMotionEffects,
  SecurityPipeline,
} from "@/components/ui/landing-motion-effects";
import { EnhancedSecurityPipeline } from "@/components/ui/enhanced-pipeline";
import { EnterpriseFooter } from "@/components/ui/enterprise-footer";
import { RocketScrollIndicator } from "@/components/ui/rocket-scroll-indicator";
import { CyberMetricsStrip } from "@/components/ui/animated-counter";
import { BorderBeam } from "@/components/ui/border-beam";
import { Holographic3DCard } from "@/components/ui/holographic-3d-card";
import { CyberAuroraBackground } from "@/components/ui/cyber-aurora-background";
import { CyberScrambleText } from "@/components/ui/scramble-text";
import { LiquidGlassButton, LiquidGlassCard } from "@/components/ui/liquid-glass";
import { SecurityComplianceStrip } from "@/components/ui/security-compliance-strip";
import { CyberFAQ } from "@/components/ui/cyber-faq";
import { StickyMobileCTA } from "@/components/ui/sticky-mobile-cta";
import { CyberFeaturePillars } from "@/components/ui/cyber-feature-pillars";
import { CyberComparisonMatrix } from "@/components/ui/cyber-comparison-matrix";
import { CyberTechEcosystem } from "@/components/ui/cyber-tech-ecosystem";
import { CyberFeatureShowcase } from "@/components/ui/cyber-feature-showcase";
import { CyberVisualStepper } from "@/components/ui/cyber-visual-stepper";

const Globe = dynamic(
  () => import("@/components/ui/globe").then((mod) => mod.Globe),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] w-full animate-pulse rounded-3xl border border-cyan-500/20 bg-[#020617]/80" />
    ),
  }
);

const CyberShield3D = dynamic(
  () =>
    import("@/components/ui/cyber-shield-3d").then(
      (mod) => mod.CyberShield3D
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[340px] w-full items-center justify-center">
        <div className="h-40 w-40 animate-pulse rounded-full border border-cyan-500/20 bg-cyan-500/5 blur-sm" />
      </div>
    ),
  }
);

const heroWords = [
  "lỗ hổng",
  "rủi ro",
  "điểm yếu",
  "bề mặt tấn công",
];

const steps = [
  {
    number: "01",
    title: "Nhập mục tiêu",
    description: "Tạo một dự án, đặt tên, mô tả phạm vi và cung cấp website hoặc domain cần kiểm tra.",
  },
  {
    number: "02",
    title: "ADQ tự động phân tích",
    description: "Hệ thống thực hiện các bước rà soát theo pipeline và cập nhật tiến độ trong dashboard.",
  },
  {
    number: "03",
    title: "Ưu tiên vấn đề cần xử lý",
    description: "Kết quả được gom theo mức độ rủi ro để bạn tập trung vào những điểm cần xử lý trước.",
  },
  {
    number: "04",
    title: "Theo dõi trong một workspace",
    description: "Mỗi dự án lưu lại dữ liệu kiểm thử để bạn có thể quay lại tiếp tục phân tích khi cần.",
  },
];

const problemSolutions = [
  {
    id: "01",
    title: "Chi phí nhân sự chuyên trách quá đắt đỏ",
    desc: "ADQ tự động hóa quy trình rà quét giúp startup và SME tiếp cận công cụ bảo mật tiêu chuẩn mà không cần ngân sách lớn.",
    solutionTitle: "Tự Động Hóa Quy Trình DAST & SOC 24/7",
    solutionDetails: [
      "Thay thế chi phí pentest thủ công hàng nghìn USD bằng DAST Pipeline tự động.",
      "Lập bản đồ bề mặt tấn công, phát hiện cổng mở và kiểm thử lỗ hổng OWASP Top 10.",
      "Tiết kiệm 85% chi phí nhân sự security cho các đội ngũ công nghệ tinh gọn."
    ],
    impact: "Tiết kiệm 85% chi phí vận hành an toàn thông tin."
  },
  {
    id: "02",
    title: "Báo cáo kỹ thuật phức tạp khó hiểu",
    desc: "Trợ lý AI tổng hợp và giải thích rõ ràng từng lỗ hổng kèm các bước khắc phục từng dòng mã nguồn.",
    solutionTitle: "Trợ Lý AI Copilot Triage - Giải Thích Rủi Ro Tức Thì",
    solutionDetails: [
      "Diễn giải bằng chứng lỗ hổng (PoC) theo ngôn ngữ tiếng Việt tự nhiên.",
      "Gợi ý trực tiếp đoạn mã nguồn bản vá (Code Patch) cho React, Node.js, Python, Java, PHP.",
      "Phân loại ưu tiên CVSS v3.1 giúp lập trình viên sửa lỗi nhanh nhất."
    ],
    impact: "Rút ngắn 90% thời gian nghiên cứu & viết bản vá lỗi."
  },
  {
    id: "03",
    title: "Dữ liệu kiểm thử bị phân tán",
    desc: "Tích hợp toàn bộ lịch sử quét DAST, Stress test và APK audit trong một Workspace duy nhất.",
    solutionTitle: "Unified Cyber Workspace - Quản Lý Tập Trung 1 Nơi",
    solutionDetails: [
      "Quản lý theo dự án (Project-based Isolation) lưu trữ đầy đủ nhật ký rà quét.",
      "Hợp nhất lịch sử DAST Web Scan, Layer 7 Stress Test và APK Audit.",
      "Xuất báo cáo đa định dạng chuẩn doanh nghiệp: Markdown, HTML mã hóa & JSON."
    ],
    impact: "100% dữ liệu an ninh mạng được đồng bộ nhất quán."
  },
  {
    id: "04",
    title: "Thiếu công cụ phát hiện chủ động",
    desc: "Cảnh báo sớm bề mặt tấn công bị phơi bày trước khi kẻ xấu lợi dụng khai thác.",
    solutionTitle: "Proactive Surface Mapping - Cảnh Báo Sớm Mối Nguy",
    solutionDetails: [
      "Bộ công cụ kiểm tra API Key, OAuth tokens, JWT secrets cấu hình sai.",
      "Đối chiếu thông tin phát hiện với cơ sở dữ liệu rò rỉ dữ liệu.",
      "Đưa ra khuyến nghị vá lỗi và ngăn chặn lộ lọt thông tin nhạy cảm."
    ],
    impact: "Loại bỏ nguy cơ rò rỉ dữ liệu mật của khách hàng."
  }
];

const teamMembers = [
  {
    name: "Nguyễn Kiến Quốc",
    role: "Backend & System Architecture Lead",
    image: "/images/nguyenkienquoc-new.png",
    bio: "Phụ trách toàn bộ hệ thống Backend và kiến trúc bảo mật cốt lõi, phát triển động cơ rà quét DAST tự động, hạ tầng phân tán L7 Stress Testing và Agentic AI Copilot.",
  },
  {
    name: "Ngô Thiện Ân",
    role: "Business Strategy & Legal Lead",
    image: "/images/Ngothienan.png",
    bio: "Phụ trách xây dựng định hướng kinh tế, chiến lược phát triển sản phẩm, nghiên cứu chính sách pháp lý và tiêu chuẩn tuân thủ an toàn thông tin.",
  },
  {
    name: "Nguyễn Minh Đức",
    role: "Frontend & UI/UX Lead",
    image: "/images/nguyenminhduc.png",
    bio: "Phụ trách toàn bộ giao diện người dùng (Frontend), thiết kế trải nghiệm người dùng (UI/UX), đồ họa tương tác 3D và tối ưu hóa hiệu năng ứng dụng web.",
  },
];

function CyberSectionDivider() {
  return (
    <div className="relative mx-auto max-w-7xl px-4 md:px-8 py-2">
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] animate-pulse" />
    </div>
  );
}

export function LandingPage() {
  const { user } = useAuth();
  const [selectedChallenge, setSelectedChallenge] = useState<
    (typeof problemSolutions)[0] | null
  >(null);

  return (
    <div
      id="adq-landing"
      className="relative overflow-hidden bg-[#020617] text-slate-100 font-sans"
    >
      <LandingMotionEffects />
      <RocketScrollIndicator />
      <CyberAuroraBackground />

      {/* ============================================================ */}
      {/* HERO SECTION */}
      {/* ============================================================ */}
      <section className="relative mx-auto max-w-7xl px-4 pb-8 pt-8 md:px-8 md:pb-12 md:pt-12">
        <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          {/* HERO LEFT COLUMN */}
          <motion.div
            initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >


            <h1 className="max-w-4xl text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-slate-100 md:text-6xl">
              Phát hiện
              <br />
              <ContainerTextFlip words={heroWords} className="ml-2 text-cyan-300" />
              <br />
              trước khi chúng trở thành sự cố.
            </h1>

            <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              Nền tảng kiểm thử bảo mật tự động cho startup và SME. Rà soát lỗ hổng,
              lập bản đồ bề mặt tấn công và nhận hướng khắc phục tức thì — không cần cài agent.
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <Link href={user ? "/dashboard" : "/register"} suppressHydrationWarning>
                <LiquidGlassButton
                  variant="primary"
                  className="px-6 py-3 text-sm font-semibold"
                >
                  {user ? "Mở Dashboard" : "Bắt đầu miễn phí"}
                  <ArrowRight className="h-4 w-4" />
                </LiquidGlassButton>
              </Link>

              <Link href="#how-it-works">
                <LiquidGlassButton
                  variant="secondary"
                  className="px-6 py-3 text-sm font-semibold"
                >
                  Xem cách hoạt động
                </LiquidGlassButton>
              </Link>
            </div>

            {/* TRUST BADGES - SLEEK 1-LINE INDICATOR */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 pt-2 text-xs text-slate-300 font-medium">
              <span className="inline-flex items-center gap-1.5 text-slate-300">
                <ShieldCheck className="h-4 w-4 text-cyan-400" />
                <span>Quét tự động 7 bước</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-300">
                <Zap className="h-4 w-4 text-cyan-400" />
                <span>Không cần cài agent</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                <span>Phân tích rủi ro bằng AI</span>
              </span>
            </div>
          </motion.div>

          {/* HERO RIGHT COLUMN (INTERACTIVE 3D CYBER SHIELD SHOWCASE) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex items-center justify-center min-h-[380px]"
          >
            <CyberShield3D />
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* CYBER METRICS COUNT-UP STRIP */}
      {/* ============================================================ */}
      <CyberMetricsStrip />

      {/* ============================================================ */}
      {/* INTERNATIONAL COMPLIANCE STANDARDS STRIP */}
      {/* ============================================================ */}
      <SecurityComplianceStrip />
      <CyberSectionDivider />

      {/* ============================================================ */}
      {/* PROBLEM SECTION */}
      {/* ============================================================ */}
      <section className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-14">
        <div className="grid items-start gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <motion.div
            initial={{ opacity: 0, x: -20, filter: "blur(6px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-mono">
              <CyberScrambleText text="Bài toán ADQ giải quyết" />
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">
              <CyberScrambleText text="Không phải doanh nghiệp nào cũng có một đội security riêng." />
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Chi phí nhân sự chuyên trách quá đắt đỏ và các công cụ bảo mật hiện tại quá phức tạp. ADQ tự động hóa quy trình rà soát để mọi đội ngũ công nghệ đều tự bảo vệ mình dễ dàng.
            </p>
          </motion.div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            {problemSolutions.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ type: "spring", stiffness: 260, damping: 22, delay: idx * 0.1 }}
                whileHover={{ y: -4, scale: 1.01 }}
                onClick={() => setSelectedChallenge(item)}
                className="group relative overflow-hidden rounded-3xl border border-white/[0.15] bg-slate-950/20 p-5 backdrop-blur-md transition-all duration-300 hover:border-cyan-400/80 cursor-pointer min-h-[160px]"
                style={{
                  boxShadow: "inset 0 1px 1px 0 rgba(255, 255, 255, 0.2), 0 20px 40px -15px rgba(0, 0, 0, 0.5)",
                }}
              >
                {/* 1. Microscopic Specular Rim Glint */}
                <div className="pointer-events-none absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-80" />

                {/* 2. Liquid Horizon Internal Ambient Light */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.04] to-transparent" />

                {/* MẶT 1: THÁCH THỨC (MẶC ĐỊNH - KHÔNG HOVER) */}
                <div className="flex flex-col justify-between h-full transition-all duration-300 group-hover:opacity-0 group-hover:pointer-events-none relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold tracking-wider text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-rose-400" />
                      [THÁCH THỨC {item.id}]
                    </span>
                    <span className="text-xs font-mono text-cyan-300 font-bold animate-pulse">RÊ CHUỘT VÀO ➔</span>
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-200 font-medium">
                      {item.desc}
                    </p>
                  </div>
                </div>

                {/* MẶT 2: GIẢI PHÁP ADQ (HIỆN RỰC RỠ KHI RÊ CHUỘT VÀO) */}
                <div className="absolute inset-0 p-5 flex flex-col justify-between opacity-0 group-hover:opacity-100 transition-all duration-300 bg-[#030d22] border border-cyan-400/80 rounded-3xl shadow-[inset_0_0_30px_rgba(6,182,212,0.2)] z-20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold tracking-wider text-cyan-300 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                      [GIẢI PHÁP ADQ {item.id}]
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-cyan-200 mb-2">
                      {item.solutionTitle}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-100 font-medium">
                      {item.solutionDetails[0]}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CyberSectionDivider />

      {/* ============================================================ */}
      {/* FEATURE SHOWCASE ZIGZAG (HÌNH 1 BÊN NỘI DUNG 1 BÊN) */}
      {/* ============================================================ */}
      <section id="features" className="relative mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        <CyberFeatureShowcase />
      </section>

      <CyberSectionDivider />

      {/* ============================================================ */}
      {/* PIPELINE 7 GIAI ĐOẠN (ENHANCED SECURITY PIPELINE) */}
      {/* ============================================================ */}
      <section id="platform" className="relative mx-auto max-w-7xl px-4 md:px-8">
        <EnhancedSecurityPipeline />
      </section>
      <CyberSectionDivider />

      {/* ============================================================ */}
      {/* 4-STEP VISUAL JOURNEY STEPPER WITH IMAGES */}
      {/* ============================================================ */}
      <section
        id="how-it-works"
        className="relative mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24"
      >
        <CyberVisualStepper />
      </section>
      <CyberSectionDivider />

      {/* ============================================================ */}
      {/* ABOUT US / TEAM SECTION */}
      {/* ============================================================ */}
      <section
        id="about"
        className="relative mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12 text-center"
        >
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-mono">
            Đội Ngũ Sáng Lập & Phát Triển
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
            <CyberScrambleText text="Về Chúng Tôi — Đội Ngũ ADQ Security" />
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-xs md:text-sm leading-relaxed text-slate-300 font-sans">
            Được xây dựng bởi đội ngũ kỹ sư an ninh mạng và phát triển phần mềm với sứ mệnh tự động hóa toàn diện quy trình kiểm thử và bảo vệ ứng dụng Web & Mobile.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {teamMembers.map((member, index) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.12] bg-[#020617]/50 p-6 backdrop-blur-md transition-all duration-300 hover:border-cyan-400/50 hover:bg-[#020617]/80 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]"
              style={{
                boxShadow:
                  "inset 0 1px 1px 0 rgba(255, 255, 255, 0.1), 0 10px 30px -10px rgba(0, 0, 0, 0.5)",
              }}
            >
              {/* Corner accent glow */}
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl group-hover:bg-cyan-500/20 transition-all duration-500" />

              <div>
                {/* Square Photo container */}
                <div className="relative mb-5 aspect-square w-full overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-slate-900/70 via-slate-950/90 to-[#020617] p-2 sm:p-3 shadow-inner flex items-center justify-center">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(6,182,212,0.18),transparent_70%)]" />
                  <div className="relative h-full w-full">
                    <Image
                      src={member.image}
                      alt={member.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-contain object-center drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] transition-transform duration-500 group-hover:scale-105"
                      priority
                    />
                  </div>
                </div>

                {/* Member Info */}
                <div className="space-y-1.5">
                  <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 font-mono text-[10px] uppercase tracking-wider">
                    {member.role}
                  </Badge>
                  <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-cyan-300 transition-colors">
                    {member.name}
                  </h3>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-slate-300 font-sans">
                  {member.bio}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
      <CyberSectionDivider />

      {/* ============================================================ */}
      {/* PRICING SECTION (HOLOGRAPHIC 3D CARDS) */}
      {/* ============================================================ */}
      <section
        id="pricing"
        className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-14"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-7 text-center"
        >
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-mono">
            Bắt đầu nhỏ, mở rộng khi cần
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
            <CyberScrambleText text="Chọn mức công cụ phù hợp với nhu cầu kiểm thử." />
          </h2>
        </motion.div>

        <div className="grid gap-6 items-stretch lg:grid-cols-3">
          {/* FREE CARD */}
          <Holographic3DCard
            tier="free"
            cardId="ADQ-PASS // TIER-01 // BASIC"
            chipColor="silver"
          >
            <div>
              <div className="flex items-center justify-between">
                <Badge variant="muted">FREE</Badge>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                  TRẢI NGHIỆM
                </span>
              </div>

              <h3 className="mt-4 text-xl font-bold text-white">Khám phá ADQ</h3>
              <p className="mt-2 text-sm text-slate-400 min-h-[44px]">
                Dành cho người dùng muốn thử quy trình quét cơ bản.
              </p>

              <div className="mt-5 text-3xl font-extrabold text-white tracking-tight">
                0đ
              </div>
            </div>

            <div>
              <div className="mt-6 space-y-2.5 text-sm text-slate-300">
                <p className="flex items-center gap-2 text-slate-200">
                  <span className="text-cyan-400 font-bold">✓</span> 2 lượt DAST Scan trọn đời
                </p>
                <p className="flex items-center gap-2 text-slate-200">
                  <span className="text-cyan-400 font-bold">✓</span> Xuất báo cáo Markdown
                </p>
                <p className="flex items-center gap-2 text-slate-500 line-through">
                  <span>—</span> AI Analysis
                </p>
                <p className="flex items-center gap-2 text-slate-500 line-through">
                  <span>—</span> Stress Test
                </p>
              </div>

              <Link href="/register" className="mt-6 block">
                <LiquidGlassButton
                  variant="secondary"
                  className="w-full py-2.5 text-xs font-semibold"
                >
                  Bắt đầu miễn phí
                </LiquidGlassButton>
              </Link>
            </div>
          </Holographic3DCard>

          {/* PRO CARD */}
          <Holographic3DCard
            tier="pro"
            cardId="ADQ-SEC // TIER-02 // PRO"
            chipColor="cyan"
            beamEffect={
              <BorderBeam size={260} duration={8} colorFrom="#22d3ee" colorTo="#a855f7" borderWidth={2} />
            }
          >
            <div>
              <div className="flex items-center justify-between">
                <Badge className="border-cyan-500/30 bg-cyan-500/15 text-cyan-300 font-bold">
                  PRO
                </Badge>
                <span className="font-mono text-[10px] text-cyan-400 uppercase tracking-widest font-extrabold drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">
                  ★ KHUYÊN DÙNG
                </span>
              </div>

              <h3 className="mt-4 text-xl font-bold text-white">
                Kiểm thử thường xuyên
              </h3>
              <p className="mt-2 text-sm text-slate-300 min-h-[44px]">
                Dành cho đội ngũ cần rà soát bảo mật liên tục hơn.
              </p>

              <div className="mt-5 text-3xl font-extrabold text-white tracking-tight">
                199.000đ
                <span className="text-sm font-normal text-cyan-300/70"> / tháng</span>
              </div>
            </div>

            <div>
              <div className="mt-6 space-y-2.5 text-sm text-slate-200">
                <p className="flex items-center gap-2">
                  <span className="text-cyan-400 font-bold">✓</span> DAST Scan không giới hạn
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-cyan-400 font-bold">✓</span> AI Scan Analysis
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-cyan-400 font-bold">✓</span> 1 Stress Test / ngày
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-cyan-400 font-bold">✓</span> Markdown, JSON và HTML
                </p>
              </div>

              <Link href="/register" className="mt-6 block">
                <LiquidGlassButton
                  variant="primary"
                  className="w-full py-2.5 text-xs font-bold"
                >
                  Nâng cấp gói Pro ➔
                </LiquidGlassButton>
              </Link>
            </div>
          </Holographic3DCard>

          {/* PRO MAX CARD */}
          <Holographic3DCard
            tier="promax"
            cardId="ADQ-VIP // TIER-03 // ULTRA"
            chipColor="gold"
            beamEffect={
              <BorderBeam size={260} duration={6} colorFrom="#a855f7" colorTo="#f43f5e" borderWidth={2} />
            }
          >
            <div>
              <div className="flex items-center justify-between">
                <Badge className="border-purple-500/30 bg-purple-500/15 text-purple-300 font-bold">
                  PRO MAX
                </Badge>
                <span className="font-mono text-[10px] text-purple-400 uppercase tracking-widest font-extrabold drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]">
                  ★ FULL TÍNH NĂNG
                </span>
              </div>

              <h3 className="mt-4 text-xl font-bold text-white">
                Bộ công cụ đầy đủ
              </h3>
              <p className="mt-2 text-sm text-slate-300 min-h-[44px]">
                Dành cho nhu cầu kiểm thử và phân tích chuyên sâu.
              </p>

              <div className="mt-5 text-3xl font-extrabold text-white tracking-tight">
                499.000đ
                <span className="text-sm font-normal text-purple-300/70"> / tháng</span>
              </div>
            </div>

            <div>
              <div className="mt-6 space-y-2.5 text-sm text-slate-200">
                <p className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">✓</span> Toàn bộ quyền lợi PRO
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">✓</span> 10 Stress Test / ngày
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">✓</span> AI Copilot & Analyze
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">✓</span> One-Click Patch & APK Audit
                </p>
              </div>

              <Link href="/register" className="mt-6 block">
                <LiquidGlassButton
                  variant="secondary"
                  className="w-full py-2.5 text-xs font-bold border-purple-500/40 text-purple-200 hover:border-purple-300"
                >
                  Chọn gói Pro Max ➔
                </LiquidGlassButton>
              </Link>
            </div>
          </Holographic3DCard>
        </div>
      </section>
      <CyberSectionDivider />

      {/* ============================================================ */}
      {/* FREQUENTLY ASKED QUESTIONS (CYBER FAQ) */}
      {/* ============================================================ */}
      <section className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-14">
        <CyberFAQ />
      </section>
      <CyberSectionDivider />

      {/* ============================================================ */}
      {/* FINAL CTA */}
      {/* ============================================================ */}
      <section className="relative mx-auto max-w-7xl px-4 pb-14 pt-4 md:px-8 md:pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 20, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="group relative overflow-hidden rounded-3xl border border-white/[0.15] bg-slate-950/40 p-8 text-center backdrop-blur-md md:p-14 transition-all duration-500 hover:border-cyan-400/60"
          style={{
            boxShadow: "inset 0 1px 1px 0 rgba(255, 255, 255, 0.25), 0 20px 50px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* 1. Liquid Glass Top Specular Rim Glint */}
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-90 z-10" />

          {/* 2. Liquid Glass Horizon Internal Ambient Light */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/[0.06] to-transparent z-10" />

          {/* BACKGROUND CYBER IMAGE OVERLAY - SHARP & TRANSLUCENT */}
          <div className="absolute inset-0 z-0 pointer-events-none opacity-50 group-hover:opacity-70 transition-opacity duration-700">
            <Image
              src="/images/hero-cockpit.jpg"
              alt="Cyber Security Platform Background"
              fill
              className="object-cover object-center scale-105 brightness-110 contrast-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#020617]/90 via-[#020617]/30 to-[#020617]/50" />
          </div>

          <BorderBeam size={320} duration={10} colorFrom="#22d3ee" colorTo="#38bdf8" borderWidth={1.5} />

          <div className="relative z-10">
            <motion.div
              animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 shadow-[0_0_25px_rgba(6,182,212,0.3)] mb-2"
            >
              <Sparkles className="h-6 w-6 text-cyan-300" />
            </motion.div>

            <h2 className="mt-2 text-3xl font-semibold text-slate-100 md:text-5xl tracking-tight">
              Bảo vệ bề mặt số của bạn ngay hôm nay.
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              Khởi tạo dự án, thiết lập mục tiêu và để hệ thống phòng thủ ADQ Security giúp bạn phát hiện mọi mối nguy trước khi chúng trở thành sự cố an ninh nghiêm trọng.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href={user ? "/dashboard" : "/register"} suppressHydrationWarning>
                <LiquidGlassButton
                  variant="primary"
                  className="px-7 py-3 text-sm font-bold"
                >
                  {user ? "Đi tới Dashboard" : "Bắt đầu miễn phí ngay"}
                  <ArrowRight className="h-4 w-4" />
                </LiquidGlassButton>
              </Link>

              {!user && (
                <Link href="/login">
                  <LiquidGlassButton
                    variant="secondary"
                    className="px-6 py-3 text-sm font-semibold"
                  >
                    Đăng nhập hệ thống
                  </LiquidGlassButton>
                </Link>
              )}
            </div>
          </div>
        </motion.div>
      </section>

      {/* POPUP MODAL TƯƠNG TÁC CHO THÁCH THỨC & GIẢI PHÁP */}
      <AnimatePresence>
        {selectedChallenge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25 }}
              className="relative w-full max-w-2xl rounded-3xl border border-cyan-500/40 bg-[#020617] p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.25)] space-y-6 flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-cyan-400">
                  <ShieldCheck className="h-5 w-5 text-cyan-400" />
                  <span>[GIẢI PHÁP ADQ // THÁCH THỨC {selectedChallenge.id}]</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedChallenge(null)}
                  className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-5 text-slate-200 leading-relaxed pr-2">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">Thách thức đặt ra</span>
                  <h3 className="text-lg font-bold text-white mt-1">
                    {selectedChallenge.title}
                  </h3>
                </div>

                <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 space-y-2">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">Giải pháp ADQ Security</span>
                  <h4 className="text-base font-bold text-cyan-200">
                    {selectedChallenge.solutionTitle}
                  </h4>
                </div>

                <div className="space-y-2.5">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">Các tính năng hỗ trợ</span>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {selectedChallenge.solutionDetails.map((detail, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Hiệu quả: {selectedChallenge.impact}</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedChallenge(null)}
                  className="cursor-pointer rounded-xl bg-slate-900 border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition font-mono"
                >
                  Đóng lại
                </button>

                <Link
                  href={user ? "/dashboard" : "/register"}
                  onClick={() => setSelectedChallenge(null)}
                >
                  <LiquidGlassButton variant="primary" className="px-5 py-2 text-xs font-bold">
                    <span>Khám phá giải pháp ngay</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </LiquidGlassButton>
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <StickyMobileCTA />
      <EnterpriseFooter />
    </div>
  );
}
