"use client";

import React, { useState } from "react";
import { Sparkles, Lock, ArrowRight, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface AiAnalysisCardProps {
  userTier: string;
  aiSummary?: string | null;
  target?: string;
  isScanning?: boolean;
  findingsCount?: number;
  onRetry?: () => void;
  isRetrying?: boolean;
  error?: string | null;
}

export function AiAnalysisCard({
  userTier,
  aiSummary,
  target = "",
  isScanning = false,
  findingsCount = 0,
  onRetry,
  isRetrying = false,
  error = null,
}: AiAnalysisCardProps) {
  const router = useRouter();
  const isFree = userTier === "FREE";

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#242424] bg-[#0A0A0A] p-4 sm:p-5 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#242424]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#242424] bg-[#141414] text-white shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#F5F5F5] font-mono flex items-center gap-2">
              AI RISK ASSESSMENT
            </h3>
            <p className="text-[11px] text-[#888888]">
              AI phân tích kết quả scan và đánh giá mức rủi ro dựa trên bằng chứng đã thu thập
            </p>
          </div>
        </div>

        {onRetry && !isScanning && !isFree && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
            className="h-7 px-2.5 text-xs font-mono border-[#242424] bg-[#141414] text-[#A3A3A3] hover:text-white rounded cursor-pointer self-start sm:self-center"
          >
            <RefreshCw className={`h-3 w-3 mr-1.5 ${isRetrying ? "animate-spin" : ""}`} />
            {isRetrying ? "AI đang phân tích..." : aiSummary ? "Tạo lại đánh giá" : "Thử lại"}
          </Button>
        )}
      </div>

      {/* Content Area */}
      <div className="relative mt-3.5 min-h-[90px]">
        {isFree ? (
          <>
            <div className="space-y-2 select-none filter blur-[4px] opacity-25 pointer-events-none text-xs text-[#888888]">
              <p>
                <strong>Mức rủi ro quan sát được:</strong> Hệ thống đã hoàn tất đánh giá các chỉ số an toàn và ghi nhận phạm vi kiểm thử kỹ thuật.
              </p>
              <p>
                <strong>Bề mặt tấn công:</strong> Các chỉ dấu quan sát được phân tích trong tương quan an ninh tổng thể.
              </p>
              <p>
                <strong>Phạm vi & Giới hạn:</strong> Đánh giá phản ánh các hạng mục đã thực thi trên mục tiêu.
              </p>
            </div>

            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 text-center bg-[#000000]/85 rounded-lg border border-[#242424] backdrop-blur-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#242424] bg-[#141414] text-white mb-2">
                <Lock className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-semibold text-white tracking-wide font-mono">
                BÁO CÁO PHÂN TÍCH RỦI RO AI BỊ KHÓA
              </h4>
              <p className="text-[11px] text-[#888888] max-w-sm mt-1 mb-3">
                Gói Dùng Thử Miễn Phí không bao gồm phân tích AI chuyên sâu. Nâng cấp lên gói <strong>PRO</strong> để nhận đánh giá rủi ro an ninh chi tiết từ AI Engine.
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
        ) : isScanning ? (
          <div className="flex items-center gap-3 p-4 text-xs text-[#888888] bg-[#050505] rounded-lg border border-[#1C1C1C] font-mono">
            <Sparkles className="w-4 h-4 text-white animate-spin shrink-0" />
            <span>Đang chờ phiên scan hoàn tất để tổng hợp bằng chứng...</span>
          </div>
        ) : isRetrying ? (
          <div className="flex items-center gap-3 p-4 text-xs text-[#888888] bg-[#050505] rounded-lg border border-[#1C1C1C] font-mono">
            <Sparkles className="w-4 h-4 text-white animate-spin shrink-0" />
            <span>AI đang phân tích kết quả scan...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-[#EF4444]/5 border border-[#EF4444]/20 text-xs font-mono">
            <div className="flex items-center gap-2 text-[#EF4444]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Không thể tạo đánh giá AI lúc này. ({error})</span>
            </div>
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="h-6 text-[11px] border-[#EF4444]/30 bg-[#141414] text-white hover:bg-[#222222]"
              >
                Thử lại
              </Button>
            )}
          </div>
        ) : (
          <div className="text-xs text-[#F5F5F5] leading-relaxed">
            {aiSummary ? (
              <div className="prose prose-invert max-w-none text-xs">
                <MarkdownRenderer content={aiSummary} />
              </div>
            ) : (
              <div className="space-y-1.5 p-3 rounded-lg bg-[#050505] border border-[#1C1C1C]">
                <p className="text-[#A3A3A3] font-mono text-xs">
                  Chưa có báo cáo phân tích AI cho phiên scan này.
                </p>
                <p className="text-[11px] text-[#666666]">
                  Kết quả rà quét kỹ thuật đã được lưu đầy đủ. Nhấn &quot;Tạo lại đánh giá&quot; để gửi yêu cầu phân tích rủi ro tới AI Engine.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
