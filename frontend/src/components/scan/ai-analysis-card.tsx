"use client";

import React, { useState } from "react";
import { Sparkles, Lock, ArrowRight, RefreshCw, ShieldAlert, CheckCircle2 } from "lucide-react";
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
}

export function AiAnalysisCard({
  userTier,
  aiSummary,
  target = "",
  isScanning = false,
  findingsCount = 0,
  onRetry,
  isRetrying = false,
}: AiAnalysisCardProps) {
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
              Đánh giá rủi ro an ninh tổng quan, phân tích ngữ cảnh tấn công và các hạn chế phạm vi rà quét
            </p>
          </div>
        </div>

        {onRetry && !isScanning && !isFree && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
            className="h-7 px-2.5 text-xs font-mono border-[#242424] bg-[#141414] text-[#A3A3A3] hover:text-white rounded cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 mr-1.5 ${isRetrying ? "animate-spin" : ""}`} />
            {isRetrying ? "Đang xử lý..." : "Tạo Lại Đánh Giá"}
          </Button>
        )}
      </div>

      {/* Content Area */}
      <div className="relative mt-3.5 min-h-[100px]">
        {isFree ? (
          <>
            <div className="space-y-2 select-none filter blur-[4px] opacity-25 pointer-events-none text-xs text-[#888888]">
              <p>
                <strong>Đánh giá rủi ro an ninh:</strong> Hệ thống đã hoàn tất đánh giá các chỉ số an toàn và ghi nhận phạm vi kiểm thử kỹ thuật.
              </p>
              <p>
                <strong>Kịch bản phơi nhiễm tiềm tàng:</strong> Các chỉ dấu quan sát được phân tích trong tương quan an ninh tổng thể.
              </p>
              <p>
                <strong>Phạm vi & Giới hạn:</strong> Đánh giá phản ánh các kiểm soát đã thực thi trên mục tiêu.
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
        ) : isScanning && !aiSummary ? (
          <div className="flex items-center gap-3 p-4 text-xs text-[#888888] bg-[#050505] rounded-lg border border-[#1C1C1C] font-mono">
            <Sparkles className="w-4 h-4 text-white animate-spin shrink-0" />
            <span>Đang thu thập và tổng hợp dữ liệu rà quét để kích hoạt AI Risk Assessment...</span>
          </div>
        ) : (
          <div className="text-xs text-[#F5F5F5] leading-relaxed">
            {aiSummary ? (
              <MarkdownRenderer content={aiSummary} />
            ) : findingsCount === 0 ? (
              <div className="space-y-2 p-3.5 rounded-lg bg-[#050505] border border-[#1C1C1C]">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#22C55E]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tổng Quan Rủi Ro Quan Sát Được: THẤP (LOW)</span>
                </div>
                <p className="text-xs text-[#A3A3A3] font-sans">
                  Không ghi nhận phát hiện vi phạm bảo mật nào trong toàn bộ 19 kiểm soát kỹ thuật thuộc phạm vi quét đã thực thi.
                </p>
                <p className="text-[11px] text-[#666666] font-mono">
                  Lưu ý: Kết quả này phản ánh các kiểm soát và phạm vi đã kích hoạt trong phiên quét, không bảo đảm tuyệt đối rằng hệ thống không tồn tại các bề mặt tấn công chưa được kiểm tra.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 p-3 rounded-lg bg-[#050505] border border-[#1C1C1C]">
                <p className="text-[#A3A3A3] font-mono text-xs">
                  Chưa có báo cáo phân tích AI cho phiên quét này.
                </p>
                <p className="text-[11px] text-[#666666]">
                  Kết quả rà quét kỹ thuật đã được lưu đầy đủ. Nhấn &quot;Tạo Lại Đánh Giá&quot; để gửi yêu cầu phân tích rủi ro tới AI Engine.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
