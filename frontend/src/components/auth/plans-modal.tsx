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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl font-sans text-slate-100 selection:bg-cyan-500 selection:text-black">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94 }}
          className="relative w-full max-w-4xl rounded-3xl border border-cyan-500/30 bg-slate-950 p-6 sm:p-8 shadow-[0_0_80px_rgba(6,182,212,0.18)] flex flex-col max-h-[92vh] overflow-y-auto"
        >
          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
              <Sparkles className="h-3.5 w-3.5" /> CHỌN GÓI DỊCH VỤ PHÙ HỢP
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Bắt Đầu Trải Nghiệm Bảo Mật Cùng ADQ Security
            </h2>
            <p className="text-xs text-slate-400 max-w-lg mx-auto">
              Lựa chọn gói dịch vụ tối ưu cho nhu cầu rà quét lỗ hổng và kiểm thử an ninh hạ tầng của bạn.
            </p>
          </div>

          {/* 3 Cột Gói Cước */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* GÓI 1: FREE */}
            <div className="rounded-2xl border border-white/[0.08] bg-slate-900/50 p-5 flex flex-col justify-between hover:border-slate-700 transition">
              <div>
                <div className="text-xs font-bold font-mono text-slate-400 uppercase">Gói 1</div>
                <h3 className="text-base font-bold text-white mt-1">Dùng Thử Miễn Phí</h3>
                <div className="text-xl font-extrabold text-slate-200 mt-2">0 VNĐ</div>
                <p className="text-[11px] text-slate-400 mt-1">Dành cho trải nghiệm thử nghiệm</p>
                <div className="border-t border-white/[0.06] my-4" />
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span><strong>2 lượt quét DAST</strong></span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-500">
                    <X className="h-4 w-4 text-slate-600 shrink-0" />
                    <span>Không có phân tích AI</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-500">
                    <X className="h-4 w-4 text-slate-600 shrink-0" />
                    <span>Khóa tính năng Stress Test</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-500">
                    <X className="h-4 w-4 text-slate-600 shrink-0" />
                    <span>Khóa AI Copilot Chat</span>
                  </li>
                </ul>
              </div>
              <Button
                variant="outline"
                onClick={onClose}
                className="mt-6 h-9 w-full border-slate-800 bg-slate-950 text-xs text-slate-300 hover:text-white rounded-xl"
              >
                Tiếp Tục Với Gói Miễn Phí
              </Button>
            </div>

            {/* GÓI 2: PRO */}
            <div className="relative rounded-2xl border border-cyan-500/50 bg-gradient-to-b from-cyan-950/30 to-slate-950 p-5 flex flex-col justify-between shadow-[0_0_30px_rgba(6,182,212,0.12)]">
              <div className="absolute -top-2.5 right-4 bg-cyan-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                PHỔ BIẾN
              </div>
              <div>
                <div className="text-xs font-bold font-mono text-cyan-400 uppercase">Gói 2</div>
                <h3 className="text-base font-bold text-white mt-1">Chuyên Nghiệp (PRO)</h3>
                <div className="text-xl font-extrabold text-cyan-300 mt-2">199.000 <span className="text-xs text-slate-400 font-normal">/ tháng</span></div>
                <p className="text-[11px] text-slate-400 mt-1">Tối ưu cho Pentester & DevSecOps</p>
                <div className="border-t border-cyan-500/20 my-4" />
                <ul className="space-y-2 text-xs text-slate-200">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span><strong>Quét DAST không giới hạn</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span><strong>Phân tích lỗ hổng chuyên sâu với AI</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span>Stress Test L7 (<strong>1 lượt/ngày</strong>)</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-500">
                    <X className="h-4 w-4 text-slate-600 shrink-0" />
                    <span>Khóa AI Copilot Chat</span>
                  </li>
                </ul>
              </div>
              <Button
                onClick={() => {
                  onClose();
                  router.push("/dashboard/billing");
                }}
                className="mt-6 h-9 w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md rounded-xl transition active:scale-98"
              >
                Nâng Cấp Gói PRO
              </Button>
            </div>

            {/* GÓI 3: PRO MAX */}
            <div className="rounded-2xl border border-purple-500/40 bg-gradient-to-b from-purple-950/20 to-slate-950 p-5 flex flex-col justify-between hover:border-purple-500/60 transition">
              <div>
                <div className="text-xs font-bold font-mono text-purple-400 uppercase">Gói 3</div>
                <h3 className="text-base font-bold text-white mt-1">Cao Cấp (PRO MAX)</h3>
                <div className="text-xl font-extrabold text-purple-300 mt-2">499.000 <span className="text-xs text-slate-400 font-normal">/ tháng</span></div>
                <p className="text-[11px] text-slate-400 mt-1">Toàn quyền hạ tầng và Agentic AI</p>
                <div className="border-t border-purple-500/20 my-4" />
                <ul className="space-y-2 text-xs text-slate-200">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-purple-400 shrink-0" />
                    <span><strong>Quét DAST không giới hạn + AI</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-purple-400 shrink-0" />
                    <span><strong>Mở khóa toàn bộ AI Copilot Chat</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-purple-400 shrink-0" />
                    <span>Stress Test L7 (<strong>10 lượt/ngày</strong>)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-purple-400 shrink-0" />
                    <span>Sinh bản vá One-Click Patch tự động</span>
                  </li>
                </ul>
              </div>
              <Button
                onClick={() => {
                  onClose();
                  router.push("/dashboard/billing");
                }}
                className="mt-6 h-9 w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md rounded-xl transition active:scale-98"
              >
                Nâng Cấp PRO MAX
              </Button>
            </div>
          </div>

          <div className="text-center pt-2 border-t border-white/[0.06]">
            <button
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-cyan-400 transition underline underline-offset-4"
            >
              Tiếp tục vào Dashboard với Gói Dùng Thử Miễn Phí →
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
