"use client";

import React from "react";
import { Sparkles, Lock, ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface AiAnalysisCardProps {
  userTier: string;
  aiSummary?: string | null;
  target?: string;
  isScanning?: boolean;
}

export function AiAnalysisCard({ userTier, aiSummary, target, isScanning }: AiAnalysisCardProps) {
  const router = useRouter();
  const isFree = userTier === "FREE";

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#242424] bg-[#0A0A0A] p-4 sm:p-5 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#242424] bg-[#141414] text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#F5F5F5] flex items-center gap-2">
              AI Risk Assessment
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded border border-[#242424] bg-[#141414] text-[#A3A3A3]">
                ADQ Security Engine
              </span>
            </h3>
            <p className="text-[11px] text-[#888888]">
              Đánh giá rủi ro an ninh, xâu chuỗi kịch bản khai thác PoC và đề xuất khắc phục theo ưu tiên
            </p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative mt-3.5 min-h-[100px]">
        {isFree ? (
          <>
            <div className="space-y-2 select-none filter blur-[4px] opacity-25 pointer-events-none text-xs text-[#888888]">
              <p>
                <strong>Phân tích an ninh mục tiêu:</strong> Hệ thống tự động phát hiện các điểm rủi ro an ninh mạng, cấu hình Header thiếu chặt chẽ và chính sách CSP cần tối ưu hóa.
              </p>
              <p>
                <strong>Kịch bản tấn công tiềm tàng:</strong> Kẻ tấn công có thể lợi dụng sai sót cấu hình để truy vấn thông tin nhạy cảm.
              </p>
              <p>
                <strong>Khuyến nghị khắc phục:</strong> Thiết lập chính sách bảo mật máy chủ và cập nhật bản vá bảo mật chuẩn công nghiệp.
              </p>
            </div>

            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 text-center bg-[#000000]/85 rounded-lg border border-[#242424] backdrop-blur-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#242424] bg-[#141414] text-white mb-2">
                <Lock className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-semibold text-white tracking-wide">
                Báo Cáo Phân Tích Chuyên Sâu Của AI Bị Khóa
              </h4>
              <p className="text-[11px] text-[#888888] max-w-sm mt-1 mb-3">
                Gói Dùng Thử Miễn Phí không bao gồm phân tích AI chuyên sâu. Nâng cấp lên gói <strong>PRO</strong> để tự động nhận đánh giá lỗ hổng & sinh mã vá.
              </p>
              <Button
                onClick={() => router.push("/dashboard/billing")}
                className="h-7 px-3 bg-white hover:bg-[#E5E5E5] text-black font-semibold text-xs rounded-md shadow-sm transition active:scale-98 cursor-pointer"
              >
                <span>Nâng Cấp Gói PRO</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>
          </>
        ) : isScanning && !aiSummary ? (
          <div className="flex items-center gap-3 p-4 text-xs text-[#888888] bg-[#050505] rounded-lg border border-[#1C1C1C]">
            <Sparkles className="w-4 h-4 text-white animate-spin shrink-0" />
            <span>Đang thu thập và tổng hợp dữ liệu rà quét để kích hoạt AI Risk Assessment...</span>
          </div>
        ) : (
          <div className="text-xs text-[#F5F5F5] leading-relaxed">
            {aiSummary ? (
              <MarkdownRenderer content={aiSummary} />
            ) : (
              <div className="space-y-1.5 p-3 rounded-lg bg-[#050505] border border-[#1C1C1C]">
                <p className="text-[#A3A3A3]">
                  Chưa có báo cáo phân tích AI cho phiên quét này.
                </p>
                <p className="text-[11px] text-[#666666]">
                  Kết quả rà quét kỹ thuật đã được lưu đầy đủ. Phân tích AI sẽ xuất hiện khi AI Engine được kích hoạt và tạo báo cáo thành công.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
