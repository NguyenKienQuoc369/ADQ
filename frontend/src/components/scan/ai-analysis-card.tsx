"use client";

import React from "react";
import { Sparkles, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface AiAnalysisCardProps {
  userTier: string;
  aiSummary?: string | null;
  target?: string;
}

export function AiAnalysisCard({ userTier, aiSummary, target }: AiAnalysisCardProps) {
  const router = useRouter();
  const isFree = userTier === "FREE";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-xl font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Báo Cáo Phân Tích Lỗ Hổng Từ AI Copilot
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                GPT-4o Deep Engine
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Đánh giá rủi ro an ninh, xâu chuỗi kịch bản khai thác PoC và đề xuất khắc phục
            </p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative mt-4 min-h-[140px]">
        {isFree ? (
          <>
            {/* Lớp hiển thị nội dung mẫu giả lập bị làm mờ kính */}
            <div className="space-y-2 select-none filter blur-[5px] opacity-40 pointer-events-none text-xs text-slate-300">
              <p>
                <strong>Phân tích mục tiêu {target || "https://example.com"}:</strong> Hệ thống phát hiện 3 điểm rủi ro trung bình bao gồm cấu hình CORS Header thiếu chặt chẽ, lộ lọt Endpoint API Swagger và chính sách CSP chưa tối ưu.
              </p>
              <p>
                <strong>Kịch bản tấn công tiềm tàng:</strong> Kẻ tấn công có thể lợi dụng CORS Misconfiguration kết hợp Cross-Site Scripting để chiếm quyền điều khiển Token phiên đăng nhập của người dùng.
              </p>
              <p>
                <strong>Khuyến nghị khắc phục:</strong> Giới hạn Access-Control-Allow-Origin, bật HttpOnly và cấu hình WAF Cloudflare chặn các payload độc hại.
              </p>
            </div>

            {/* Overlay Khóa Kèm Nút Nâng cấp PRO */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 text-center bg-slate-950/75 rounded-xl border border-cyan-500/20 backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 mb-2 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                <Lock className="h-5 w-5" />
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                Báo Cáo Phân Tích Chuyên Sâu Của AI Bị Khóa
              </h4>
              <p className="text-[11px] text-slate-300 max-w-sm mt-1 mb-3">
                Gói Dùng Thử Miễn Phí không bao gồm phân tích AI chuyên sâu. Hãy nâng cấp lên gói <strong>PRO</strong> để tự động nhận đánh giá lỗ hổng & sinh mã vá.
              </p>
              <Button
                onClick={() => router.push("/dashboard/billing")}
                className="h-8 px-4 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-[0_0_15px_rgba(6,182,212,0.25)] rounded-xl transition active:scale-98"
              >
                <span>Nâng Cấp Gói PRO (199K/tháng)</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-200 leading-relaxed">
            {aiSummary ? (
              <MarkdownRenderer content={aiSummary} />
            ) : (
              <div className="space-y-1.5">
                <p className="text-slate-300">
                  Chưa có báo cáo phân tích AI cho phiên quét này.
                </p>
                <p className="text-[11px] text-slate-500">
                  Kết quả rà quét kỹ thuật vẫn đã được lưu đầy đủ. Phân tích AI sẽ xuất hiện khi AI Engine được bật và tạo báo cáo thành công.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
