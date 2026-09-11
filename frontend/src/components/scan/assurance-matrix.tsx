"use client";

import React, { useState } from "react";
import { EvaluatedSecurityControl, ControlStatus } from "@/lib/api";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  MinusCircle, 
  ChevronDown, 
  ChevronRight, 
  ShieldCheck,
  Loader2,
  FileText,
  Search,
  Layers,
  Info
} from "lucide-react";

interface AssuranceMatrixProps {
  controls: EvaluatedSecurityControl[];
  onInspectFinding?: (finding: any) => void;
  targetDomain?: string;
}

const SEVERITY_BADGES: Record<string, { label: string; class: string }> = {
  CRITICAL: { label: "CRITICAL", class: "border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]" },
  HIGH: { label: "HIGH", class: "border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]" },
  MEDIUM: { label: "MEDIUM", class: "border-[#EAB308]/40 bg-[#EAB308]/10 text-[#EAB308]" },
  LOW: { label: "LOW", class: "border-[#333333] bg-[#141414] text-[#A3A3A3]" },
  INFO: { label: "INFO", class: "border-[#333333] bg-[#141414] text-[#888888]" },
};

export function AssuranceMatrix({ controls, onInspectFinding, targetDomain = "" }: AssuranceMatrixProps) {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterStage, setFilterStage] = useState<string>("ALL");
  const [expandedControlId, setExpandedControlId] = useState<string | null>(null);

  const filteredControls = controls.filter((ctrl) => {
    if (filterStatus !== "ALL" && ctrl.status !== filterStatus) return false;
    if (filterStage !== "ALL" && ctrl.stage_id !== filterStage) return false;
    return true;
  });

  const getStatusBadge = (status: ControlStatus | string) => {
    switch (status) {
      case "PASS":
        return (
          <span className="inline-flex w-[100px] items-center justify-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border border-[#22C55E]/40 bg-[#22C55E]/10 text-[#22C55E]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PASS
          </span>
        );
      case "FAIL":
        return (
          <span className="inline-flex w-[100px] items-center justify-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]">
            <XCircle className="w-3.5 h-3.5" />
            FAIL
          </span>
        );
      case "INCONCLUSIVE":
        return (
          <span className="inline-flex w-[100px] items-center justify-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border border-[#EAB308]/40 bg-[#EAB308]/10 text-[#EAB308]">
            <AlertTriangle className="w-3.5 h-3.5" />
            INCONCL
          </span>
        );
      case "RUNNING":
        return (
          <span className="inline-flex w-[100px] items-center justify-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border border-white/40 bg-white/10 text-white">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            RUNNING
          </span>
        );
      case "QUEUED":
        return (
          <span className="inline-flex w-[100px] items-center justify-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border border-[#333333] bg-[#141414] text-[#666666]">
            QUEUED
          </span>
        );
      case "NOT_TESTED":
      default:
        return (
          <span className="inline-flex w-[100px] items-center justify-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border border-[#333333] bg-[#141414] text-[#666666]">
            <MinusCircle className="w-3.5 h-3.5" />
            NOT TESTED
          </span>
        );
    }
  };

  return (
    <div className="space-y-3">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#242424] bg-[#0A0A0A] p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-[#888888] mr-1 font-mono">Trạng thái:</span>
          {["ALL", "FAIL", "PASS", "INCONCLUSIVE", "NOT_TESTED"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2.5 py-1 rounded text-xs font-medium font-mono transition cursor-pointer ${
                filterStatus === st
                  ? "bg-white text-black font-bold"
                  : "bg-[#141414] text-[#A3A3A3] hover:text-white border border-[#242424]"
              }`}
            >
              {st === "ALL" ? `Tất cả (${controls.length})` : st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#888888] font-mono">Giai đoạn:</span>
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="rounded border border-[#242424] bg-[#141414] px-2.5 py-1 text-xs text-[#F5F5F5] focus:outline-none focus:border-[#444444] font-mono cursor-pointer"
          >
            <option value="ALL">Tất cả giai đoạn</option>
            <option value="recon_infra">01. Recon & Infra</option>
            <option value="web_mapping">02. Web Mapping</option>
            <option value="dast_active">03. Active DAST</option>
            <option value="deep_logic">04. Deep Logic</option>
          </select>
        </div>
      </div>

      {/* Controls List (Target Collapsed Height ~96-104px) */}
      <div className="space-y-2">
        {filteredControls.map((control) => {
          const isExpanded = expandedControlId === control.id;
          const isFail = control.status === "FAIL";
          const isPass = control.status === "PASS";
          const sevMeta = SEVERITY_BADGES[control.severity_if_failed] || SEVERITY_BADGES.INFO;

          return (
            <div
              key={control.id}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                isExpanded
                  ? "border-[#3A3A3A] bg-[#0F0F0F]"
                  : isFail
                  ? "border-[#EF4444]/30 bg-[#0A0A0A] hover:border-[#EF4444]/50"
                  : isPass
                  ? "border-[#242424] bg-[#0A0A0A] hover:border-[#333333]"
                  : "border-[#1C1C1C] bg-[#080808] opacity-85"
              }`}
            >
              {/* Header Row */}
              <div
                onClick={() => setExpandedControlId(isExpanded ? null : control.id)}
                className="p-3.5 sm:p-4 min-h-[96px] cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 select-none"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="mt-1 text-[#666666] shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-white" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1 font-mono">
                      <span className="text-xs font-bold text-white">
                        {control.code}
                      </span>
                      <span className="text-[11px] text-[#666666]">[{control.id}]</span>
                      <span className={`w-[72px] text-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${sevMeta.class}`}>
                        {sevMeta.label}
                      </span>
                      <span className="text-[10px] text-[#888888] bg-[#141414] px-2 py-0.5 rounded border border-[#242424]">
                        {control.stage_name}
                      </span>
                    </div>

                    <h4 className="text-xs sm:text-sm font-semibold text-[#F5F5F5] truncate">
                      {control.title_vi || control.title}
                    </h4>
                    <p className="text-[11px] sm:text-xs text-[#888888] line-clamp-1 mt-0.5 font-sans">
                      {control.description_vi || control.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
                  {control.findings_count > 0 && (
                    <span className="text-xs font-mono font-bold text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/30 px-2.5 py-0.5 rounded">
                      {control.findings_count} vi phạm
                    </span>
                  )}
                  {getStatusBadge(control.status)}
                </div>
              </div>

              {/* Expanded Detail Panel — Strict Evidence Scope Only */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-[#242424] space-y-3.5 bg-[#050505]">
                  {/* 1. ASSESSMENT */}
                  <div className="rounded-lg bg-[#0A0A0A] border border-[#242424] p-3 text-xs leading-relaxed space-y-1">
                    <div className="text-[10px] font-mono uppercase font-bold text-[#888888] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-white" />
                      Đánh Giá Kiểm Soát (Assessment)
                    </div>
                    <p className="text-[#A3A3A3] font-sans">
                      {control.reason || (
                        control.status === "PASS"
                          ? "Trình kiểm thử đã hoàn thành đầy đủ quy trình kiểm tra và không phát hiện vi phạm nào trong phạm vi rà quét được kích hoạt."
                          : control.status === "FAIL"
                          ? "Bằng chứng kỹ thuật xác nhận phát hiện vi phạm quy chuẩn an toàn tương ứng."
                          : control.status === "INCONCLUSIVE"
                          ? "Trình kiểm thử đã thực thi nhưng dữ liệu phản hồi từ mục tiêu không đủ để đưa ra kết luận đạt/không đạt tin cậy."
                          : "Kiểm soát này chưa được kích hoạt do thiếu điều kiện tiền đề hoặc cấu hình xác thực bổ sung."
                      )}
                    </p>
                  </div>

                  {/* 2. WHAT WAS TESTED & 3. OBSERVED EVIDENCE */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* WHAT WAS TESTED */}
                    <div className="rounded-lg bg-[#0A0A0A] border border-[#242424] p-3 space-y-1.5">
                      <div className="text-[#666666] font-mono text-[10px] uppercase font-bold flex items-center gap-1.5">
                        <Search className="w-3 h-3 text-white" />
                        Phạm Vi Đã Kiểm Tra (What Was Tested)
                      </div>
                      <p className="text-[#A3A3A3] font-sans leading-relaxed">
                        {control.description_vi || control.description || "Rà soát cấu hình, phản hồi HTTP và kiểm tra vector tấn công tương ứng trên toàn bộ các tài sản và endpoint đã khám phá."}
                      </p>
                    </div>

                    {/* OBSERVED EVIDENCE */}
                    <div className="rounded-lg bg-[#0A0A0A] border border-[#242424] p-3 space-y-1.5">
                      <div className="text-[#666666] font-mono text-[10px] uppercase font-bold flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-white" />
                        Bằng Chứng Quan Sát (Observed Evidence)
                      </div>
                      <div className="text-[#A3A3A3] font-mono text-[11px] leading-relaxed">
                        {control.evidence ? (
                          <div className="truncate">{String(control.evidence)}</div>
                        ) : control.status === "PASS" ? (
                          <span>Mục tiêu: {targetDomain || "target"} — Không ghi nhận phản hồi bất thường hoặc dấu hiệu khai thác thành công.</span>
                        ) : (
                          <span>Ghi nhận từ pipeline thực thi: {control.findings_count} chỉ dấu quan sát được.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 4. AFFECTED ASSETS & FINDINGS LIST */}
                  {control.findings && control.findings.length > 0 && (
                    <div className="rounded-lg bg-[#0A0A0A] border border-[#EF4444]/30 p-3 space-y-2">
                      <div className="text-[10px] font-mono font-bold uppercase text-[#EF4444] flex items-center gap-1.5">
                        <Layers className="w-3 h-3" />
                        Tài Sản Ảnh Hưởng & Chi Tiết Vi Phạm ({control.findings.length})
                      </div>
                      <div className="space-y-1.5">
                        {control.findings.map((f: any, fIdx: number) => (
                          <div
                            key={fIdx}
                            className="rounded border border-[#EF4444]/20 bg-[#050505] p-2 text-xs text-[#A3A3A3] flex items-center justify-between gap-2"
                          >
                            <span className="font-mono text-white truncate text-[11px]">
                              {f.endpoint || f.matched || f.title || "Phát hiện lỗ hổng"}
                            </span>
                            {onInspectFinding && (
                              <button
                                onClick={() => onInspectFinding(f)}
                                className="text-[10px] text-[#EF4444] hover:underline font-mono shrink-0 cursor-pointer"
                              >
                                Xem &rarr;
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 5. TECHNICAL REFERENCES & 6. TECHNICAL METADATA */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-[#0A0A0A] border border-[#242424] p-3 space-y-1.5">
                      <div className="text-[#666666] font-mono text-[10px] uppercase font-bold">
                        Tham Chiếu Kỹ Thuật (Technical References)
                      </div>
                      <div className="space-y-1 text-[#A3A3A3] font-mono text-[11px]">
                        <div><strong className="text-white">OWASP:</strong> {control.owasp_category || "N/A"}</div>
                        <div><strong className="text-white">CWE:</strong> {control.cwe_ids?.join(", ") || "N/A"}</div>
                        <div><strong className="text-white">Detector ID:</strong> {control.id}</div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-[#0A0A0A] border border-[#242424] p-3 space-y-1.5">
                      <div className="text-[#666666] font-mono text-[10px] uppercase font-bold">
                        Siêu Dữ Liệu Kỹ Thuật (Technical Metadata)
                      </div>
                      <div className="space-y-1 text-[#A3A3A3] font-mono text-[11px]">
                        <div><strong className="text-white">Giai đoạn:</strong> {control.stage_name} ({control.stage_id})</div>
                        <div><strong className="text-white">Gói tối thiểu:</strong> {control.minimum_tier}</div>
                        <div><strong className="text-white">Thời điểm kiểm tra:</strong> {control.tested_at ? new Date(control.tested_at * 1000).toLocaleTimeString() : "N/A"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
