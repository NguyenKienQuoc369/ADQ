"use client";

import React, { useState } from "react";
import { EvaluatedSecurityControl, ControlStatus, Severity } from "@/lib/api";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  MinusCircle, 
  ChevronDown, 
  ChevronRight, 
  ShieldAlert, 
  Copy, 
  Check, 
  Code, 
  ExternalLink,
  Lock,
  Layers,
  Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AssuranceMatrixProps {
  controls: EvaluatedSecurityControl[];
  onInspectFinding?: (finding: any) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  HIGH: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  MEDIUM: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  LOW: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  INFO: "bg-slate-700/40 text-slate-300 border-slate-600",
};

export function AssuranceMatrix({ controls, onInspectFinding }: AssuranceMatrixProps) {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterStage, setFilterStage] = useState<string>("ALL");
  const [expandedControlId, setExpandedControlId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredControls = controls.filter((ctrl) => {
    if (filterStatus !== "ALL" && ctrl.status !== filterStatus) return false;
    if (filterStage !== "ALL" && ctrl.stage_id !== filterStage) return false;
    return true;
  });

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: ControlStatus) => {
    switch (status) {
      case "PASS":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PASS
          </span>
        );
      case "FAIL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            FAIL
          </span>
        );
      case "INCONCLUSIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            INCONCLUSIVE
          </span>
        );
      case "NOT_TESTED":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <MinusCircle className="w-3.5 h-3.5" />
            NOT TESTED
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-400 mr-1">Trạng thái:</span>
          {["ALL", "FAIL", "PASS", "INCONCLUSIVE", "NOT_TESTED"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 rounded-lg text-xs font-medium font-mono transition ${
                filterStatus === st
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50"
              }`}
            >
              {st === "ALL" ? "Tất cả (" + controls.length + ")" : st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Giai đoạn:</span>
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono"
          >
            <option value="ALL">Tất cả giai đoạn</option>
            <option value="recon_infra">01. Recon & Infra</option>
            <option value="web_mapping">02. Web Mapping</option>
            <option value="dast_active">03. Active DAST</option>
            <option value="deep_logic">04. Deep Logic</option>
          </select>
        </div>
      </div>

      {/* Controls List / Accordion */}
      <div className="space-y-3">
        {filteredControls.map((control) => {
          const isExpanded = expandedControlId === control.id;
          const isFail = control.status === "FAIL";
          const isPass = control.status === "PASS";

          return (
            <div
              key={control.id}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                isExpanded
                  ? "border-cyan-500/40 bg-slate-900/95 ring-1 ring-cyan-500/20"
                  : isFail
                  ? "border-rose-900/40 bg-slate-900/60 hover:border-rose-700/50"
                  : isPass
                  ? "border-slate-800/80 bg-slate-900/50 hover:border-slate-700"
                  : "border-slate-800/40 bg-slate-950/40 opacity-75"
              }`}
            >
              {/* Header Row */}
              <div
                onClick={() => setExpandedControlId(isExpanded ? null : control.id)}
                className="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 select-none"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-slate-400">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-cyan-300">
                        {control.code}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">[{control.id}]</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${SEVERITY_COLORS[control.severity_if_failed] || "bg-slate-800 text-slate-300"}`}>
                        {control.severity_if_failed}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {control.stage_name}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-white">
                      {control.title_vi || control.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                      {control.description_vi || control.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                  {control.findings_count > 0 && (
                    <span className="text-xs font-mono font-bold text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2.5 py-0.5 rounded-full">
                      {control.findings_count} vi phạm
                    </span>
                  )}
                  {getStatusBadge(control.status)}
                </div>
              </div>

              {/* Expanded Detail Panel */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 space-y-4 bg-slate-950/50">
                  {/* Status Justification */}
                  <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-3.5 text-xs text-slate-300">
                    <span className="font-bold text-slate-200">Đánh giá kiểm soát: </span>
                    {control.reason}
                  </div>

                  {/* Findings Breakdown */}
                  {control.findings && control.findings.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Danh sách vi phạm phát hiện ({control.findings.length})
                      </h5>
                      <div className="space-y-2">
                        {control.findings.map((f, fIdx) => (
                          <div
                            key={fIdx}
                            className="rounded-lg border border-rose-900/30 bg-rose-950/20 p-3 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white">
                                {f.title || f.template_id || f.name || "Phát hiện bất thường"}
                              </span>
                              <span className="font-mono text-[10px] text-rose-300 uppercase">
                                {f.severity || control.severity_if_failed}
                              </span>
                            </div>
                            {f.endpoint && (
                              <div className="font-mono text-[11px] text-slate-300">
                                <span className="text-slate-500">Endpoint: </span>
                                {f.endpoint}
                              </div>
                            )}
                            {f.cve && (
                              <div className="font-mono text-[10px] text-slate-400">
                                <span className="text-slate-500">Mã phân loại: </span>
                                {f.cve}
                              </div>
                            )}
                            {f.description && (
                              <p className="text-[11px] text-slate-400 mt-1">
                                {f.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actionable Remediation Guide */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5" />
                      Hướng dẫn khắc phục đề xuất (Actionable Remediation)
                    </h5>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                      {control.remediation_guide}
                    </p>

                    {control.remediation_code_snippet && (
                      <div className="relative rounded-lg bg-slate-950 border border-slate-800 p-3.5 font-mono text-xs text-slate-300">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
                          <span>Snippet Cấu hình Khắc phục</span>
                          <button
                            onClick={() => handleCopy(control.id, control.remediation_code_snippet || "")}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800 text-cyan-400 transition text-[10px]"
                          >
                            {copiedId === control.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Đã sao chép</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Sao chép</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="overflow-x-auto text-[11px] leading-relaxed text-amber-200">
                          {control.remediation_code_snippet}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Standards & CWE */}
                  <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-400 font-mono">
                    <span>OWASP: <strong className="text-slate-300">{control.owasp_category}</strong></span>
                    <span>•</span>
                    <span>CWE: <strong className="text-slate-300">{control.cwe_ids.join(", ") || "N/A"}</strong></span>
                    <span>•</span>
                    <span>Gói yêu cầu: <strong className="text-cyan-400">{control.minimum_tier}</strong></span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredControls.length === 0 && (
          <div className="text-center py-10 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
            Không tìm thấy kiểm soát an ninh nào phù hợp với bộ lọc.
          </div>
        )}
      </div>
    </div>
  );
}

