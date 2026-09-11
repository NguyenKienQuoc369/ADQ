"use client";

import React from "react";
import { Check, X, AlertTriangle, Loader2 } from "lucide-react";
import { StageSummary } from "@/lib/api";

interface TopStageRunnerProps {
  stages?: StageSummary[];
  currentStageId?: string;
  isScanning?: boolean;
}

const DEFAULT_STAGES = [
  { id: "recon_infra", label: "RECON", nameVi: "Thu Thập Tài Sản" },
  { id: "web_mapping", label: "WEB MAPPING", nameVi: "Lập Bản Đồ Ứng Dụng" },
  { id: "dast_active", label: "ACTIVE DAST", nameVi: "Kiểm Thử Chủ Động" },
  { id: "deep_logic", label: "DEEP LOGIC", nameVi: "Phân Tích Logic Chuyên Sâu" },
];

export function TopStageRunner({ stages = [], currentStageId, isScanning }: TopStageRunnerProps) {
  const stageMap = new Map(stages.map((s) => [s.stage_id, s]));

  return (
    <div className="rounded-xl border border-[#242424] bg-[#0A0A0A] p-3.5 sm:p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        {DEFAULT_STAGES.map((def, idx) => {
          const stage = stageMap.get(def.id);
          const isCompleted = stage?.state === "COMPLETED";
          const isInProgress =
            stage?.state === "IN_PROGRESS" ||
            (isScanning && currentStageId === def.id) ||
            (isScanning && !currentStageId && idx === 0);
          const isFailed = stage?.state === "FAILED";
          const isWarning = stage?.state === "SKIPPED" || (stage?.inconclusive_count || 0) > 0;
          const isQueued = !isCompleted && !isInProgress && !isFailed && !isWarning;

          let statusIndicator = (
            <span className="h-2 w-2 rounded-full bg-[#444444]" />
          );
          let badgeText = "QUEUED";
          let badgeClass = "border-[#333333] bg-[#141414] text-[#888888]";

          if (isCompleted) {
            statusIndicator = <Check className="h-3.5 w-3.5 text-[#22C55E]" />;
            badgeText = "COMPLETED";
            badgeClass = "border-[#22C55E]/40 bg-[#22C55E]/10 text-[#22C55E]";
          } else if (isInProgress) {
            statusIndicator = (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
              </span>
            );
            badgeText = "RUNNING";
            badgeClass = "border-white/40 bg-white/10 text-white";
          } else if (isFailed) {
            statusIndicator = <X className="h-3.5 w-3.5 text-[#EF4444]" />;
            badgeText = "FAILED";
            badgeClass = "border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]";
          } else if (isWarning) {
            statusIndicator = <AlertTriangle className="h-3.5 w-3.5 text-[#EAB308]" />;
            badgeText = "WARNING";
            badgeClass = "border-[#EAB308]/40 bg-[#EAB308]/10 text-[#EAB308]";
          }

          const completedCount = stage
            ? stage.pass_count + stage.fail_count + stage.inconclusive_count + stage.not_tested_count
            : 0;
          const totalControls = stage?.total_controls || 0;

          return (
            <div
              key={def.id}
              className={`rounded-lg border p-3 transition-all duration-200 flex flex-col justify-between ${
                isInProgress
                  ? "border-[#3A3A3A] bg-[#0F0F0F] ring-1 ring-white/20"
                  : isCompleted
                  ? "border-[#242424] bg-[#0A0A0A]"
                  : "border-[#1C1C1C] bg-[#080808]"
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="font-mono text-[10px] text-[#666666]">
                  STAGE 0{idx + 1}
                </span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border ${badgeClass}`}
                >
                  {badgeText}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <div className="flex h-5 w-5 items-center justify-center shrink-0">
                  {statusIndicator}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#F5F5F5] truncate font-mono tracking-tight">
                    {def.label}
                  </div>
                  <div className="text-[10px] text-[#888888] truncate font-sans">
                    {def.nameVi}
                  </div>
                </div>
              </div>

              {stage && totalControls > 0 && (
                <div className="mt-2.5 pt-1.5 border-t border-[#1C1C1C] flex items-center justify-between text-[10px] font-mono text-[#888888]">
                  <span>
                    {stage.pass_count > 0 && <span className="text-[#22C55E] mr-1">{stage.pass_count}P</span>}
                    {stage.fail_count > 0 && <span className="text-[#EF4444] mr-1">{stage.fail_count}F</span>}
                    {stage.inconclusive_count > 0 && <span className="text-[#EAB308] mr-1">{stage.inconclusive_count}I</span>}
                    {stage.not_tested_count > 0 && <span className="text-[#666666] mr-1">{stage.not_tested_count}N</span>}
                  </span>
                  <span className="text-white font-semibold">{completedCount} / {totalControls}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
