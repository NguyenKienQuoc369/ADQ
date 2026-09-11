"use client";

import React from "react";
import { CoverageSummary as CoverageSummaryType } from "@/lib/api";
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  HelpCircle, 
  Info, 
  ExternalLink 
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CoverageSummaryProps {
  coverage: CoverageSummaryType;
  onOpenWhatChecked?: () => void;
}

export function CoverageSummary({ coverage, onOpenWhatChecked }: CoverageSummaryProps) {
  const {
    total_controls,
    tested_controls,
    passed_controls,
    failed_controls,
    inconclusive_controls,
    not_tested_controls,
    coverage_percentage,
    assurance_score,
    honest_coverage_statement,
  } = coverage;

  return (
    <div className="space-y-4">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Assurance Score */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Điểm Đảm Bảo Kiểm Soát
            </span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white">
              {assurance_score}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({passed_controls}/{tested_controls} Đạt)
            </span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                assurance_score >= 80 ? "bg-emerald-500" : assurance_score >= 50 ? "bg-amber-500" : "bg-rose-500"
              }`}
              style={{ width: `${Math.max(5, assurance_score)}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Tỷ lệ kiểm soát an ninh đạt yêu cầu trên tổng số kiểm soát đã test.
          </p>
        </div>

        {/* Scan Coverage */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Độ Bao Phủ Kiểm Thử
            </span>
            <Info className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white">
              {coverage_percentage}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({tested_controls}/{total_controls} Controls)
            </span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div 
              className="h-full bg-cyan-500 transition-all duration-500 rounded-full"
              style={{ width: `${Math.max(5, coverage_percentage)}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Đo lường danh mục kiểm soát thực tế được kiểm tra trong scan tier.
          </p>
        </div>

        {/* Controls Status Breakdown */}
        <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Phân Loại Trạng Thái 4 Chiều (4-State Matrix)
              </span>
              {onOpenWhatChecked && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenWhatChecked}
                  className="h-7 text-xs border-cyan-500/30 text-cyan-300 hover:bg-cyan-950/40 hover:text-cyan-200"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Danh mục kiểm tra
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-950/20 flex flex-col">
                <span className="flex items-center text-emerald-400 text-[11px] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 shrink-0" />
                  PASS
                </span>
                <span className="text-xl font-bold text-white mt-1">{passed_controls}</span>
                <span className="text-[10px] text-slate-400">Không có vi phạm</span>
              </div>

              <div className="p-2.5 rounded-lg border border-rose-500/20 bg-rose-950/20 flex flex-col">
                <span className="flex items-center text-rose-400 text-[11px] font-bold">
                  <XCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                  FAIL
                </span>
                <span className="text-xl font-bold text-white mt-1">{failed_controls}</span>
                <span className="text-[10px] text-slate-400">Phát hiện lỗ hổng</span>
              </div>

              <div className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-950/20 flex flex-col">
                <span className="flex items-center text-amber-400 text-[11px] font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 shrink-0" />
                  INCONCLUSIVE
                </span>
                <span className="text-xl font-bold text-white mt-1">{inconclusive_controls}</span>
                <span className="text-[10px] text-slate-400">Chưa kết luận</span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-700 bg-slate-950/50 flex flex-col">
                <span className="flex items-center text-slate-400 text-[11px] font-bold">
                  <MinusCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                  NOT TESTED
                </span>
                <span className="text-xl font-bold text-white mt-1">{not_tested_controls}</span>
                <span className="text-[10px] text-slate-400">Ngoài phạm vi</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Honest Transparency Statement */}
      <div className="rounded-lg border border-cyan-900/40 bg-cyan-950/20 p-3.5 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-cyan-300">Minh bạch & Trách nhiệm An ninh: </strong>
          {honest_coverage_statement || "Kết quả kiểm thử phản ánh mức độ tuân thủ của các kiểm soát tự động tại thời điểm quét. Không có công cụ an ninh nào có thể cam kết an toàn 100% tuyệt đối."}
        </div>
      </div>
    </div>
  );
}

