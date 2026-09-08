"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileText,
  Globe,
  LucideIcon,
  Radar,
  ShieldCheck,
} from "lucide-react";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";
import { BorderBeam } from "@/components/ui/border-beam";

interface VisualStep {
  number: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  icon: LucideIcon;
  highlights: string[];
  beamColor: string;
}

const visualSteps: VisualStep[] = [
  {
    number: "01",
    badge: "BƯỚC 01 // KHỞI TẠO MỤC TIÊU",
    title: "Khai Báo Tên Miền & Tài Sản Số",
    subtitle: "Chỉ cần nhập URL hoặc IP - Không cần cài đặt bất kỳ Agent nào",
    description:
      "Bạn chỉ cần nhập địa chỉ trang web (URL) hoặc cổng API Endpoint cần kiểm thử. ADQ Security tự động thu thập thông tin DNS, phát hiện tài sản ngầm và chuẩn bị môi trường quét sandbox trên nền tảng đám mây.",
    image: "/images/step-1.jpg",
    icon: Globe,
    highlights: [
      "Vận hành 100% Agentless SaaS Cloud",
      "Tự động khám phá Subdomains & Cổng mở",
      "Xác thực quyền sở hữu tên miền an toàn",
    ],
    beamColor: "#22d3ee",
  },
  {
    number: "02",
    badge: "BƯỚC 02 // THỰC THI KIỂM THỬ",
    title: "Tự Động Quét DAST & Stress Test L7",
    subtitle: "Thực thi 500+ kịch bản tấn công OWASP & đo lường ngưỡng RPS chịu tải",
    description:
      "Hệ thống tự động kích hoạt pipeline kiểm thử rà quét DAST phát hiện các lỗ hổng nguy hiểm (SQLi, XSS, CSRF, RCE, IDOR) đồng thời mô phỏng hàng triệu lượt truy cập Layer 7 đo lường độ chịu tải thực tế.",
    image: "/images/step-2.jpg",
    icon: Radar,
    highlights: [
      "Quét sâu toàn bộ URL & REST/GraphQL API",
      "Đo lường độ trễ Latency & ngưỡng RPS chịu tải",
      "Kiểm thử khả năng chặn lọc của WAF/Cloudflare",
    ],
    beamColor: "#10b981",
  },
  {
    number: "03",
    badge: "BƯỚC 03 // PHÂN TÍCH AI COPILOT",
    title: "AI Phân Tích Rủi Ro & Sinh Mã Sửa Lỗi",
    subtitle: "Loại bỏ 99.8% báo động giả & tự động tạo 1-Click Code Patch",
    description:
      "Mô hình AI Bảo mật của ADQ phân tích vết lỗ hổng (Root Cause), loại bỏ các cảnh báo nhiễu và tự động tạo ra đoạn mã nguồn khắc phục sự cố (Code Diff Patch) chính xác cho 7+ ngôn ngữ lập trình.",
    image: "/images/step-3.jpg",
    icon: BrainCircuit,
    highlights: [
      "Loại bỏ hoàn toàn cảnh báo giả nhiễu",
      "Tạo mã sửa lỗi tức thì (One-Click Diff Patch)",
      "Đánh giá điểm rủi ro kinh doanh chuẩn CVSS v3.1",
    ],
    beamColor: "#a855f7",
  },
  {
    number: "04",
    badge: "BƯỚC 04 // NHẬN BÁO CÁO & VÁ LỖI",
    title: "Phê Duyệt Bản Vá & Xuất Báo Cáo PDF",
    subtitle: "Tự động hóa luồng khắc phục sự cố & nghiệm thu an toàn",
    description:
      "Đội ngũ kỹ thuật dễ dàng xem đoạn mã vá lỗi, phê duyệt chỉ với 1 cú nhấp chuột và xuất báo cáo an ninh chuẩn Executive Report (PDF, JSON, Markdown) gửi tới ban quản trị hoặc đối tác.",
    image: "/images/step-4.jpg",
    icon: FileText,
    highlights: [
      "Áp dụng bản vá mã nguồn chỉ với 1-Click",
      "Báo cáo chuyên nghiệp chuẩn PDF & Markdown",
      "Tích hợp luồng thông báo Slack & Telegram",
    ],
    beamColor: "#f59e0b",
  },
];

export function CyberVisualStepper() {
  return (
    <div className="space-y-20 md:space-y-32">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-mono font-bold flex items-center justify-center gap-2">
          <ShieldCheck className="h-4 w-4 text-cyan-400" />
          <span>HÀNH TRÌNH BẢO VỆ 4 BƯỚC</span>
        </p>
        <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">
          Triển Khai Kiểm Thử An Ninh Trong 4 Bước Đơn Giản
        </h2>
        <p className="text-base md:text-lg text-slate-200 leading-relaxed max-w-2xl mx-auto font-medium">
          Trực quan hóa từng bước vận hành tự động 100% trên nền tảng đám mây đám mây ADQ Security.
        </p>
      </div>

      <div className="space-y-16 md:space-y-28">
        {visualSteps.map((step, idx) => {
          const Icon = step.icon;
          const isEven = idx % 2 === 0;

          return (
            <div
              key={step.number}
              className={`grid gap-10 lg:grid-cols-2 items-center ${
                isEven ? "" : "lg:grid-flow-dense"
              }`}
            >
              {/* IMAGE COLUMN */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96, filter: "blur(6px)" }}
                whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className={isEven ? "lg:col-start-1" : "lg:col-start-2"}
              >
                <LiquidGlassCard className="group relative overflow-hidden rounded-3xl p-2.5 md:p-3 border-cyan-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                    <Image
                      src={step.image}
                      alt={step.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 600px"
                      className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020617]/70 via-transparent to-transparent" />
                  </div>

                  <BorderBeam
                    size={260}
                    duration={10}
                    colorFrom={step.beamColor}
                    colorTo="#38bdf8"
                    borderWidth={1.5}
                  />
                </LiquidGlassCard>
              </motion.div>

              {/* CONTENT COLUMN */}
              <motion.div
                initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                className={`space-y-5 ${isEven ? "lg:col-start-2" : "lg:col-start-1"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-mono font-extrabold text-sm shrink-0">
                    {step.number}
                  </div>
                  <span className="font-mono text-xs font-extrabold tracking-widest text-cyan-300 uppercase">
                    {step.badge}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
                    {step.title}
                  </h3>
                  <p className="text-sm font-semibold text-cyan-200">
                    {step.subtitle}
                  </p>
                </div>

                <p className="text-base leading-relaxed text-slate-200 font-medium">
                  {step.description}
                </p>

                <div className="space-y-2.5 pt-2 border-t border-white/10">
                  {step.highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-slate-200 font-medium">
                      <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

