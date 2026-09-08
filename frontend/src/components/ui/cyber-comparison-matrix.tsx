"use client";

import React from "react";
import { Check, X, ShieldCheck, Zap } from "lucide-react";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";

interface ComparisonRow {
  feature: string;
  traditional: string;
  adq: string;
  highlight?: boolean;
}

const comparisonData: ComparisonRow[] = [
  {
    feature: "Chi phí kiểm thử an ninh",
    traditional: "50.000.000đ - 200.000.000đ / lần quét",
    adq: "Chỉ từ 0đ (Tối ưu 90% ngân sách)",
    highlight: true,
  },
  {
    feature: "Thời gian hoàn thành rà quét",
    traditional: "2 - 4 tuần chờ đợi báo cáo",
    adq: "Chỉ 5 - 15 phút (Tự động hóa 100%)",
    highlight: true,
  },
  {
    feature: "Tần suất thực hiện",
    traditional: "1 - 2 lần / năm (Theo đợt)",
    adq: "24/7/365 Liên tục bất kỳ lúc nào",
  },
  {
    feature: "Phương thức khắc phục lỗi",
    traditional: "Báo cáo PDF thụ động, tự tìm cách sửa",
    adq: "AI Copilot tự động sinh mã nguồn vá lỗi (1-Click Diff)",
    highlight: true,
  },
  {
    feature: "Yêu cầu cài đặt hạ tầng",
    traditional: "Cài Agent / Cấu hình phức tạp",
    adq: "100% Agentless Cloud - Không can thiệp server",
  },
  {
    feature: "Kiểm thử tải L7 Stress Test",
    traditional: "Tính phí thêm dịch vụ bên ngoài",
    adq: "Tích hợp sẵn trong cùng một Console",
  },
];

export function CyberComparisonMatrix() {
  return (
    <div className="space-y-8">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-mono flex items-center justify-center gap-1.5 font-bold">
          <Zap className="h-4 w-4 text-cyan-400" />
          <span>So sánh hiệu quả</span>
        </p>
        <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">
          Tại sao doanh nghiệp chọn ADQ Security?
        </h2>
        <p className="text-base text-slate-200 leading-relaxed max-w-2xl mx-auto">
          So sánh thực tế giữa phương pháp Đánh giá an ninh (Pentest) truyền thống và Nền tảng tự động hóa bằng AI của ADQ.
        </p>
      </div>

      <LiquidGlassCard className="p-6 md:p-8 overflow-x-auto border-cyan-500/30">
        <table className="w-full min-w-[640px] text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-sm font-mono uppercase tracking-wider text-slate-400">
              <th className="pb-4 pt-2 font-bold w-1/3 text-white">Tiêu chí so sánh</th>
              <th className="pb-4 pt-2 font-bold w-1/3 text-slate-400">Pentest Truyền Thống</th>
              <th className="pb-4 pt-2 font-bold w-1/3 text-cyan-300 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan-400" />
                <span>ADQ SECURITY</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06] text-sm md:text-base">
            {comparisonData.map((row, idx) => (
              <tr
                key={idx}
                className={`transition-colors hover:bg-cyan-950/20 ${
                  row.highlight ? "bg-cyan-500/[0.04]" : ""
                }`}
              >
                <td className="py-4 font-bold text-white pr-4">
                  {row.feature}
                </td>
                <td className="py-4 text-slate-400 pr-4 flex items-center gap-2">
                  <X className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{row.traditional}</span>
                </td>
                <td className="py-4 font-semibold text-cyan-200 flex items-center gap-2">
                  <Check className="h-5 w-5 text-cyan-400 shrink-0 font-bold" />
                  <span>{row.adq}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </LiquidGlassCard>
    </div>
  );
}

