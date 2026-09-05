"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Zap, Shield, Sparkles, Bot, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface PlansModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PlansModal({ isOpen, onClose }: PlansModalProps) {
  const router = useRouter();
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans text-[#ededed] selection:bg-white selection:text-black">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-4xl rounded-lg border border-[#222222] bg-[#000000] p-6 sm:p-8 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto"
        >
          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-neutral-700 bg-neutral-800 text-white text-[11px] font-mono">
              <Sparkles className="h-3 w-3" /> GÓI DỊCH VỤ
            </div>
            <h2 className="text-xl font-semibold text-white tracking-tight">
              Bắt Đầu Trải Nghiệm Bảo Mật Cùng ADQ
            </h2>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              Lựa chọn gói dịch vụ tối ưu cho nhu cầu rà quét lỗ hổng và kiểm thử an ninh hạ tầng.
            </p>
          </div>

          {/* 3 Cột Gói Cước */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* GÓI 1: FREE */}
            <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-5 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-mono text-neutral-400 uppercase">Gói 1</div>
                <h3 className="text-sm font-semibold text-white mt-1">Dùng Thử Miễn Phí</h3>
                <div className="text-xl font-bold font-mono text-white mt-2">0 VNĐ</div>
                <p className="text-[11px] text-neutral-500 mt-0.5">Dành cho trải nghiệm ban đầu</p>
                <div className="border-t border-[#222222] my-4" />
                <ul className="space-y-2 text-xs text-neutral-300">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-white shrink-0" />
                    <span><strong>2 lượt quét DAST</strong></span>
                  </li>
                  <li className="flex items-center gap-2 text-neutral-600">
                    <X className="h-3.5 w-3.5 text-neutral-600 shrink-0" />
                    <span>Không có phân tích AI</span>
                  </li>
                  <li className="flex items-center gap-2 text-neutral-600">
                    <X className="h-3.5 w-3.5 text-neutral-600 shrink-0" />
                    <span>Khóa Stress Test</span>
                  </li>
                  <li className="flex items-center gap-2 text-neutral-600">
                    <X className="h-3.5 w-3.5 text-neutral-600 shrink-0" />
                    <span>Khóa AI Copilot</span>
                  </li>
                </ul>
              </div>
              <Button
                variant="outline"
                onClick={onClose}
                className="mt-6 h-8 w-full border-[#333333] bg-[#111111] hover:bg-neutral-800 text-xs text-neutral-300 rounded-md cursor-pointer"
              >
                Tiếp Tục Với Gói Miễn Phí
              </Button>
            </div>

            {/* GÓI 2: PRO */}
            <div className="relative rounded-lg border border-white bg-[#000000] p-5 flex flex-col justify-between shadow-sm">
              <div className="absolute -top-2.5 right-4 bg-white text-black text-[9px] font-bold px-2 py-0.5 rounded-full font-mono">
                PHỔ BIẾN
              </div>
              <div>
                <div className="text-[10px] font-mono text-neutral-400 uppercase">Gói 2</div>
                <h3 className="text-sm font-semibold text-white mt-1">Chuyên Nghiệp (PRO)</h3>
                <div className="text-xl font-bold font-mono text-white mt-2">199.000 <span className="text-xs text-neutral-500 font-normal font-sans">/ tháng</span></div>
                <p className="text-[11px] text-neutral-500 mt-0.5">Tối ưu cho Pentester & DevSecOps</p>
                <div className="border-t border-[#222222] my-4" />
                <ul className="space-y-2 text-xs text-neutral-200">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-white shrink-0" />
                    <span><strong>Quét DAST không giới hạn</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-white shrink-0" />
                    <span><strong>Phân tích chuyên sâu với AI</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-white shrink-0" />
                    <span>Stress Test L7 (<strong>1 lượt/ngày</strong>)</span>
                  </li>
                  <li className="flex items-center gap-2 text-neutral-600">
                    <X className="h-3.5 w-3.5 text-neutral-600 shrink-0" />
                    <span>Khóa AI Copilot</span>
                  </li>
                </ul>
              </div>
              <Button
                onClick={() => {
                  onClose();
                  router.push("/dashboard/billing");
                }}
                className="mt-6 h-8 w-full bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm transition active:scale-[0.99] cursor-pointer"
              >
                Nâng Cấp Gói PRO
              </Button>
            </div>

            {/* GÓI 3: PRO MAX */}
            <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-5 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-mono text-neutral-400 uppercase">Gói 3</div>
                <h3 className="text-sm font-semibold text-white mt-1">Cao Cấp (PRO MAX)</h3>
                <div className="text-xl font-bold font-mono text-white mt-2">499.000 <span className="text-xs text-neutral-500 font-normal font-sans">/ tháng</span></div>
                <p className="text-[11px] text-neutral-500 mt-0.5">Toàn quyền hạ tầng & Agentic AI</p>
                <div className="border-t border-[#222222] my-4" />
                <ul className="space-y-2 text-xs text-neutral-200">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-white shrink-0" />
                    <span><strong>Quét DAST không giới hạn + AI</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-white shrink-0" />
                    <span><strong>Mở khóa toàn bộ AI Copilot Chat</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-white shrink-0" />
                    <span>Stress Test L7 (<strong>10 lượt/ngày</strong>)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-white shrink-0" />
                    <span>Sinh bản vá One-Click Patch</span>
                  </li>
                </ul>
              </div>
              <Button
                onClick={() => {
                  onClose();
                  router.push("/dashboard/billing");
                }}
                className="mt-6 h-8 w-full border border-[#333333] bg-[#111111] hover:bg-neutral-800 text-white font-medium text-xs rounded-md transition active:scale-[0.99] cursor-pointer"
              >
                Nâng Cấp PRO MAX
              </Button>
            </div>
          </div>

          <div className="text-center pt-2 border-t border-[#222222]">
            <button
              onClick={onClose}
              className="text-xs text-neutral-400 hover:text-white transition cursor-pointer"
            >
              Tiếp tục vào Dashboard với Gói Dùng Thử Miễn Phí →
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
