"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle, ShieldCheck, Sparkles } from "lucide-react";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  tags: string[];
}

const faqs: FAQItem[] = [
  {
    id: "01",
    question: "ADQ Security quét lỗ hổng theo những tiêu chuẩn an toàn thông tin nào?",
    answer:
      "ADQ Security tích hợp pipeline rà quét DAST tự động tuân thủ tiêu chuẩn OWASP Top 10, CWE/SANS Top 25 và hệ thống phân loại rủi ro chuẩn quốc tế CVSS v3.1. Hệ thống liên tục cập nhật cơ sở dữ liệu lỗ hổng mới nhất (CVEs) để bảo vệ tài sản số của bạn.",
    tags: ["OWASP Top 10", "DAST", "CVSS v3.1", "CWE/SANS"],
  },
  {
    id: "02",
    question: "Hệ thống có yêu cầu cài đặt Agent hay can thiệp vào máy chủ không?",
    answer:
      "Không. ADQ Security vận hành theo mô hình 100% Agentless SaaS Cloud. Bạn chỉ cần nhập tên miền hoặc địa chỉ IP mục tiêu, hệ thống phòng thủ sẽ tự động rà quét bề mặt tấn công bên ngoài mà không làm ảnh hưởng đến hiệu năng hay mã nguồn máy chủ.",
    tags: ["100% Agentless", "SaaS Cloud", "Zero Friction"],
  },
  {
    id: "03",
    question: "Tính năng kiểm thử tải L7 Stress Test có an toàn cho dữ liệu gốc không?",
    answer:
      "Tuyệt đối an toàn. Quy trình Stress Test Layer 7 chỉ mô phỏng lưu lượng truy cập ứng dụng ở tầng ứng dụng HTTP/HTTPS nhằm đo lường ngưỡng chịu tải tối đa (RPS) và khả năng phản ứng của WAF/CDN. Dữ liệu gốc và cơ sở dữ liệu không bị sửa đổi hay ảnh hưởng.",
    tags: ["Layer 7 Stress", "RPS Benchmark", "Data Safe"],
  },
  {
    id: "04",
    question: "Dữ liệu rà quét và thông tin an ninh mạng được bảo mật như thế nào?",
    answer:
      "Tất cả kết quả kiểm thử được mã hóa end-to-end (AES-256) và quản lý theo mô hình phân vùng dự án riêng biệt (Project-based Isolation). Hệ thống cam kết tuân thủ nghiêm ngặt Luật An ninh mạng 24/2018/QH14 và Luật 86/2015/QH13 của Nước CHXHCN Việt Nam.",
    tags: ["Mã hóa AES-256", "Luật ANM 24/2018", "Project Isolation"],
  },
  {
    id: "05",
    question: "Trợ lý AI Copilot Triage có thể gợi ý bản vá cho những ngôn ngữ nào?",
    answer:
      "Trợ lý AI Copilot hỗ trợ phân tích chuyên sâu và tự động tạo mã nguồn bản vá (Code Patch Diff) chính xác cho các ngôn ngữ & framework phổ biến: React, Next.js, Node.js, Python (Django/FastAPI), Java (Spring Boot), PHP (Laravel) và Go.",
    tags: ["AI Remediation", "React/Node", "Python/Java", "One-Click Patch"],
  },
];

export function CyberFAQ() {
  const [openId, setOpenId] = useState<string | null>("01");

  const toggleFAQ = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-mono flex items-center justify-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-cyan-400" />
          <span>Giải đáp thắc mắc</span>
        </p>
        <h2 className="text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">
          Những câu hỏi thường gặp về ADQ Security.
        </h2>
        <p className="text-sm leading-relaxed text-slate-300">
          Mọi thông tin về tiêu chuẩn đánh giá, độ an toàn kiểm thử và khả năng tự động hóa bằng AI.
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-3.5 pt-2">
        {faqs.map((faq) => {
          const isOpen = openId === faq.id;

          return (
            <LiquidGlassCard
              key={faq.id}
              className={`transition-all duration-300 ${
                isOpen
                  ? "border-cyan-400/60 bg-slate-950/60 shadow-[0_0_30px_rgba(6,182,212,0.2)]"
                  : "border-white/[0.1] bg-slate-950/30 hover:border-cyan-400/40"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleFAQ(faq.id)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <span className="font-mono text-xs font-bold text-cyan-400/90 shrink-0">
                    [{faq.id}]
                  </span>
                  <h3 className="text-sm md:text-base font-bold text-white leading-snug">
                    {faq.question}
                  </h3>
                </div>

                <div
                  className={`h-7 w-7 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-300 ${
                    isOpen
                      ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-300 rotate-180"
                      : "border-white/10 bg-slate-900/60 text-slate-400"
                  }`}
                >
                  <ChevronDown className="h-4 w-4" />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-1 border-t border-white/[0.06] text-xs md:text-sm text-slate-300 leading-relaxed space-y-3">
                      <p>{faq.answer}</p>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {faq.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-cyan-950/50 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 font-medium"
                          >
                            <Sparkles className="h-2.5 w-2.5 text-cyan-400" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </LiquidGlassCard>
          );
        })}
      </div>
    </div>
  );
}

