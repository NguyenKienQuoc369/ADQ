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
    <div className="relative overflow-hidden rounded-lg border border-[#222222] bg-[#000000] p-5 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#222222] bg-[#0a0a0a] text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Báo Cáo Phân Tích Lỗ Hổng Từ AI Copilot
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border border-neutral-700 bg-neutral-800 text-neutral-300">
                GPT-4o Deep Engine
              </span>
            </h3>
            <p className="text-[11px] text-neutral-400">
              Đánh giá rủi ro an ninh, xâu chuỗi kịch bản khai thác PoC và đề xuất khắc phục
            </p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative mt-4 min-h-[120px]">
        {isFree ? (
          <>
            {/* Lớp hiển thị nội dung mẫu giả lập bị làm mờ kính */}
            <div className="space-y-2 select-none filter blur-[4px] opacity-30 pointer-events-none text-xs text-neutral-400">
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

            {/* Overlay Khóa Kèm Nút Nâng cấp PRO */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 text-center bg-[#000000]/80 rounded-lg border border-[#222222] backdrop-blur-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#222222] bg-[#0a0a0a] text-white mb-2">
                <Lock className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-semibold text-white tracking-wide">
                Báo Cáo Phân Tích Chuyên Sâu Của AI Bị Khóa
              </h4>
              <p className="text-[11px] text-neutral-400 max-w-sm mt-1 mb-3">
                Gói Dùng Thử Miễn Phí không bao gồm phân tích AI chuyên sâu. Hãy nâng cấp lên gói <strong>PRO</strong> để tự động nhận đánh giá lỗ hổng & sinh mã vá.
              </p>
              <Button
                onClick={() => router.push("/dashboard/billing")}
                className="h-7 px-3 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm transition active:scale-98"
              >
                <span>Nâng Cấp Gói PRO</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>
          </>
        ) : (
          <div className="text-xs text-neutral-200 leading-relaxed">
            {aiSummary ? (
              <MarkdownRenderer content={aiSummary} />
            ) : (
              <div className="space-y-1.5">
                <p className="text-neutral-300">
                  Chưa có báo cáo phân tích AI cho phiên quét này.
                </p>
                <p className="text-[11px] text-neutral-500">
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
