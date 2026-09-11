"use client";

import React from "react";
import { StageSummary } from "@/lib/api";
import { 
  Radar, 
  Layers, 
  ShieldAlert, 
  BrainCircuit, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MinusCircle, 
  HelpCircle,
  Loader2
} from "lucide-react";

interface StageTimelineProps {
  stages: StageSummary[];
  currentStageId?: string;
  isScanning?: boolean;
}

const STAGE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  recon_infra: Radar,
  web_mapping: Layers,
  dast_active: ShieldAlert,
  deep_logic: BrainCircuit,
};

export function StageTimeline({ stages, currentStageId, isScanning }: StageTimelineProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-200">
            Tiến Trình Đánh Giá Kiểm Soát Theo Giai Đoạn
          </h3>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {stages.filter(s => s.state === "COMPLETED").length} / {stages.length} Giai đoạn hoàn tất
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
        {stages.map((stage, idx) => {
          const Icon = STAGE_ICON_MAP[stage.stage_id] || Radar;
          const isCompleted = stage.state === "COMPLETED";
          const isInProgress = stage.state === "IN_PROGRESS" || (isScanning && currentStageId === stage.stage_id);
          const isFailed = stage.state === "FAILED";
          const isSkipped = stage.state === "SKIPPED" || stage.state === "NOT_TESTED";

          let borderClass = "border-slate-800 bg-slate-950/60 text-slate-400";
          let badgeClass = "bg-slate-800 text-slate-400 border-slate-700";
          let badgeLabel = "Chờ thực thi";

          if (isCompleted) {
            borderClass = "border-emerald-500/30 bg-emerald-950/10 text-emerald-300";
            badgeClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
            badgeLabel = "Hoàn tất";
          } else if (isInProgress) {
            borderClass = "border-cyan-500/50 bg-cyan-950/20 text-cyan-300 ring-1 ring-cyan-400/30 animate-pulse";
            badgeClass = "bg-cyan-500/20 text-cyan-300 border-cyan-400/50";
            badgeLabel = "Đang kiểm thử";
          } else if (isFailed) {
            borderClass = "border-rose-500/30 bg-rose-950/10 text-rose-300";
            badgeClass = "bg-rose-500/20 text-rose-300 border-rose-500/40";
            badgeLabel = "Gián đoạn";
          } else if (isSkipped) {
            borderClass = "border-slate-800/60 bg-slate-950/30 text-slate-500 opacity-60";
            badgeClass = "bg-slate-900 text-slate-500 border-slate-800";
            badgeLabel = "Bỏ qua (Tier)";
          }

          return (
            <div 
              key={stage.stage_id}
              className={`rounded-lg border p-4 transition-all duration-200 flex flex-col justify-between ${borderClass}`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-slate-500">STAGE 0{idx + 1}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badgeClass}`}>
                    {isInProgress && <Loader2 className="w-2.5 h-2.5 inline mr-1 animate-spin" />}
                    {badgeLabel}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-2 rounded-lg ${isInProgress ? "bg-cyan-500/20 text-cyan-400" : isCompleted ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white leading-tight">
                      {stage.name_vi || stage.name}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {stage.stage_id}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 mb-3">
                  {stage.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3 h-3 mr-0.5" />
                    {stage.pass_count}
                  </span>
                  <span className="text-slate-600">/</span>
                  <span className="inline-flex items-center text-rose-400 font-semibold">
                    <XCircle className="w-3 h-3 mr-0.5" />
                    {stage.fail_count}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {stage.total_controls} Controls
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

