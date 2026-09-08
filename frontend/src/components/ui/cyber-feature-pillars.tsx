"use client";

import React from "react";
import { motion } from "framer-motion";
import { LucideIcon, BrainCircuit, Cpu, Radar, ScanSearch, ShieldCheck, Zap } from "lucide-react";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";

interface FeaturePillar {
  id: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
  color: string;
}

const pillars: FeaturePillar[] = [
  {
    id: "01",
    icon: Radar,
    title: "DAST Web & API Scanner",
    subtitle: "Rà quét lỗ hổng ứng dụng tự động 24/7",
    description:
      "Tự động phát hiện các lỗ hổng nguy hiểm theo OWASP Top 10 (SQL Injection, XSS, CSRF, SSRF, RCE, IDOR) mà không cần can thiệp mã nguồn.",
    highlights: [
      "Quét tự động toàn bộ đường dẫn Endpoint & API",
      "Đánh giá mức độ rủi ro kinh doanh CVSS v3.1",
      "Báo cáo chi tiết định dạng PDF, JSON, Markdown",
    ],
    color: "cyan",
  },
  {
    id: "02",
    icon: Zap,
    title: "Layer 7 Stress Testing",
    subtitle: "Kiểm thử ngưỡng chịu tải & độ chống chịu WAF",
    description:
      "Mô phỏng hàng triệu truy cập tầng ứng dụng HTTP/HTTPS nhằm đo lường chỉ số RPS chịu tải thực tế và phát hiện điểm nghẽn trước khi bị tấn công.",
    highlights: [
      "Giám sát độ trễ Latency & tỷ lệ lỗi HTTP Status",
      "Đánh giá hiệu quả chặn lọc của Cloudflare/WAF",
      "An toàn 100% không làm hư hại dữ liệu cơ sở",
    ],
    color: "emerald",
  },
  {
    id: "03",
    icon: BrainCircuit,
    title: "AI Copilot Remediation",
    subtitle: "Trợ lý AI tự động sinh bản vá mã nguồn",
    description:
      "Mô hình AI bảo mật phân loại báo động giả (False-Positive Elimination) và tự động tạo mã nguồn vá lỗi (1-Click Code Patch Diff) tức thì.",
    highlights: [
      "Tự tạo Code Diff sửa lỗi cho 7+ ngôn ngữ",
      "Phân tích nguyên nhân gốc rễ Root Cause",
      "Tích hợp trực tiếp với luồng CI/CD GitHub/GitLab",
    ],
    color: "purple",
  },
  {
    id: "04",
    icon: Cpu,
    title: "APK Mobile Security Audit",
    subtitle: "Phân tích tĩnh & động cho ứng dụng di động",
    description:
      "Kiểm toán file APK/AAB Android, phát hiện các mã độc ẩn, chứng chỉ bảo mật hết hạn và rò rỉ khóa API bí mật trong mã nguồn ứng dụng.",
    highlights: [
      "Phân tích Reverse Engineering mã nguồn APK",
      "Phát hiện Hardcoded API Keys & Secrets",
      "Đánh giá nguy cơ rò rỉ quyền dữ liệu cá nhân",
    ],
    color: "cyan",
  },
];

export function CyberFeaturePillars() {
  return (
    <div className="space-y-10">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-mono flex items-center justify-center gap-1.5 font-bold">
          <ShieldCheck className="h-4 w-4 text-cyan-400" />
          <span>Nền tảng toàn diện</span>
        </p>
        <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">
          4 Trụ Cột Bảo Vệ Bề Mặt Số Doanh Nghiệp
        </h2>
        <p className="text-base text-slate-200 leading-relaxed max-w-2xl mx-auto">
          Tích hợp trọn bộ công nghệ kiểm thử và phản ứng tự động hóa trên một Console duy nhất.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {pillars.map((item, idx) => {
          const Icon = item.icon;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
            >
              <LiquidGlassCard className="h-full p-6 md:p-8 space-y-5 border-cyan-500/30 hover:border-cyan-400/70 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.3)] shrink-0">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-widest">
                        TRỤ CỘT {item.id}
                      </span>
                      <h3 className="text-xl md:text-2xl font-bold text-white leading-tight">
                        {item.title}
                      </h3>
                    </div>
                  </div>
                </div>

                <p className="text-sm font-semibold text-cyan-200">
                  {item.subtitle}
                </p>

                <p className="text-sm md:text-base text-slate-200 leading-relaxed">
                  {item.description}
                </p>

                <div className="pt-2 border-t border-white/10 space-y-2">
                  {item.highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-xs md:text-sm text-slate-300 font-medium">
                      <span className="h-2 w-2 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </LiquidGlassCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
