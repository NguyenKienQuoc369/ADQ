"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { 
  getScanJobStatus, 
  getScanAssurance, 
  exportReport, 
  AssuranceMatrix as AssuranceMatrixType,
  EvaluatedSecurityControl,
  ScopeLimitation
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { getEntitlements } from "@/lib/entitlements";
import { StageTimeline } from "@/components/scan/stage-timeline";
import { CoverageSummary } from "@/components/scan/coverage-summary";
import { AssuranceMatrix } from "@/components/scan/assurance-matrix";
import { WhatADQCheckedModal } from "@/components/scan/what-adq-checked-modal";
import { AiAnalysisCard } from "@/components/scan/ai-analysis-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  ShieldCheck, 
  Globe, 
  Download, 
  RefreshCw, 
  Layers, 
  Terminal, 
  Sparkles,
  Loader2,
  FileText,
  AlertCircle
} from "lucide-react";

export default function ScanResultDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const scanId = typeof params?.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobData, setJobData] = useState<any>(null);
  const [assurance, setAssurance] = useState<AssuranceMatrixType | null>(null);
  const [isWhatCheckedOpen, setIsWhatCheckedOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"assurance" | "hosts" | "ai" | "raw">("assurance");

  const effectiveTier = user?.packageTier || "FREE";
  const entitlements = getEntitlements(effectiveTier);

  const fetchScanDetails = async () => {
    if (!scanId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getScanJobStatus(scanId);
      const scanJob = data?.job || data;
      setJobData(scanJob);

      if (scanJob?.assurance_matrix) {
        setAssurance(scanJob.assurance_matrix);
      } else {
        const assRes = await getScanAssurance(scanId);
        if (assRes?.assurance) {
          setAssurance(assRes.assurance);
        }
      }
    } catch (err: any) {
      setError(err?.message || "Không thể tải dữ liệu phiên quét an ninh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScanDetails();
  }, [scanId]);

  const handleExport = async (format: "markdown" | "json" | "html") => {
    try {
      const report = await exportReport(scanId, format);
      const blob = new Blob([report.content], { type: report.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = report.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Xuất báo cáo thất bại: ${e.message}`);
    }
  };

  if (loading) {
    return (
      <DashboardShell area="dashboard">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm font-mono text-slate-400">
            Đang tải dữ liệu Security Assurance Matrix...
          </p>
        </div>
      </DashboardShell>
    );
  }

  if (error || !jobData) {
    return (
      <DashboardShell area="dashboard">
        <div className="max-w-2xl mx-auto my-12 p-6 rounded-2xl border border-rose-800/40 bg-rose-950/20 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Không tìm thấy phiên quét</h3>
          <p className="text-xs text-slate-300">{error || "Scan job không tồn tại hoặc đã hết hạn lưu trữ."}</p>
          <Button
            onClick={() => router.push("/dashboard/results")}
            className="border border-slate-700 bg-slate-800 text-slate-200 text-xs"
          >
            Quay lại Lịch sử Quét
          </Button>
        </div>
      </DashboardShell>
    );
  }

  const targetUrl = jobData.target || "N/A";
  const status = (jobData.status || "COMPLETED").toUpperCase();
  const startedAt = jobData.started_at ? new Date(jobData.started_at * 1000).toLocaleString("vi-VN") : "N/A";
  const liveHosts = jobData.live_hosts || jobData.subdomains?.http_live || [];

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Navigation & Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/results"
                className="inline-flex items-center text-xs text-slate-400 hover:text-white transition mr-2"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Lịch sử
              </Link>
              <Badge className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono">
                {assurance?.engine_version || "ADQ Omni Engine v2.0"}
              </Badge>
              <span className={`text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full border ${
                status === "COMPLETED" 
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : status === "RUNNING"
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse"
                  : "bg-rose-500/20 text-rose-300 border-rose-500/40"
              }`}>
                {status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                {targetUrl}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono pt-1">
              <span>Scan ID: <strong className="text-slate-300">{scanId}</strong></span>
              <span>•</span>
              <span>Bắt đầu: <strong className="text-slate-300">{startedAt}</strong></span>
              <span>•</span>
              <span>Gói đánh giá: <strong className="text-cyan-400">{effectiveTier}</strong></span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchScanDetails}
              className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs h-8"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Làm mới
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport("markdown")}
              className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs h-8"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Xuất Markdown
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport("json")}
              className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs h-8"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Xuất JSON
            </Button>
          </div>
        </div>

        {/* 1. Live Stage Timeline */}
        {assurance?.stages_summary && (
          <StageTimeline
            stages={assurance.stages_summary}
            currentStageId={jobData.current_stage}
            isScanning={status === "RUNNING"}
          />
        )}

        {/* 2. Coverage & Assurance Summary */}
        {assurance?.coverage_summary && (
          <CoverageSummary
            coverage={assurance.coverage_summary}
            onOpenWhatChecked={() => setIsWhatCheckedOpen(true)}
          />
        )}

        {/* 3. Main Content Tabs */}
        <div className="space-y-4">
          <div className="flex border-b border-slate-800 gap-2">
            <button
              onClick={() => setActiveTab("assurance")}
              className={`pb-3 px-3 text-xs font-bold font-mono transition flex items-center gap-1.5 border-b-2 ${
                activeTab === "assurance"
                  ? "border-cyan-400 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Security Assurance Matrix ({assurance?.controls?.length || 0})
            </button>

            <button
              onClick={() => setActiveTab("ai")}
              className={`pb-3 px-3 text-xs font-bold font-mono transition flex items-center gap-1.5 border-b-2 ${
                activeTab === "ai"
                  ? "border-cyan-400 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              AI Copilot Analysis
            </button>

            <button
              onClick={() => setActiveTab("hosts")}
              className={`pb-3 px-3 text-xs font-bold font-mono transition flex items-center gap-1.5 border-b-2 ${
                activeTab === "hosts"
                  ? "border-cyan-400 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Globe className="w-4 h-4" />
              Live Hosts & Bề mặt ({liveHosts.length})
            </button>

            <button
              onClick={() => setActiveTab("raw")}
              className={`pb-3 px-3 text-xs font-bold font-mono transition flex items-center gap-1.5 border-b-2 ${
                activeTab === "raw"
                  ? "border-cyan-400 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Terminal className="w-4 h-4" />
              Raw Execution Logs
            </button>
          </div>

          {/* TAB 1: Assurance Matrix */}
          {activeTab === "assurance" && assurance?.controls && (
            <AssuranceMatrix controls={assurance.controls} />
          )}

          {/* TAB 2: AI Analysis */}
          {activeTab === "ai" && (
            <div className="space-y-4">
              <AiAnalysisCard
                userTier={effectiveTier}
                aiSummary={jobData.ai_analysis || jobData.ai_summary || jobData.recommendations}
                target={targetUrl}
              />
            </div>
          )}

          {/* TAB 3: Live Hosts */}
          {activeTab === "hosts" && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">Danh sách Hosts & Tên miền phụ phát hiện</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
                <table className="min-w-full text-left text-xs font-mono">
                  <thead className="border-b border-slate-800 bg-slate-900 text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">URL / Host</th>
                      <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                      <th className="px-4 py-2.5 font-medium">Tiêu đề Trang</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {liveHosts.map((h: any, idx: number) => {
                      const url = typeof h === "string" ? h : h.url || h.host;
                      const code = typeof h === "string" ? 200 : h.status_code || 200;
                      const title = typeof h === "string" ? "Live Host" : h.title || "-";
                      return (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="px-4 py-2.5 text-cyan-300">{url}</td>
                          <td className="px-4 py-2.5 text-emerald-400">HTTP {code}</td>
                          <td className="px-4 py-2.5 text-slate-300">{title}</td>
                        </tr>
                      );
                    })}
                    {liveHosts.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                          Không có live host nào được phát hiện trong lượt quét này.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Raw Logs */}
          {activeTab === "raw" && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400">
                <span>Scanner Engine Console Output</span>
                <span>Worker: {jobData.worker_id || "worker-main"}</span>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap max-h-96 text-[11px] text-slate-300 leading-relaxed">
                {jobData.stdout_tail || "Không có log bổ sung."}
              </pre>
            </div>
          )}
        </div>

        {/* Modal "What ADQ Checked" */}
        {assurance?.controls && assurance?.scope_limitations && (
          <WhatADQCheckedModal
            isOpen={isWhatCheckedOpen}
            onClose={() => setIsWhatCheckedOpen(false)}
            controls={assurance.controls}
            scopeLimitations={assurance.scope_limitations}
          />
        )}
      </div>
    </DashboardShell>
  );
}
