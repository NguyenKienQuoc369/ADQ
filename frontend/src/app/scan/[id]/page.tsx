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
import { TopStageRunner } from "@/components/scan/top-stage-runner";
import { CoverageSummary } from "@/components/scan/coverage-summary";
import { AssuranceMatrix } from "@/components/scan/assurance-matrix";
import { DiscoveredAssets } from "@/components/scan/discovered-assets";
import { WhatADQCheckedModal } from "@/components/scan/what-adq-checked-modal";
import { AiAnalysisCard } from "@/components/scan/ai-analysis-card";
import { Button } from "@/components/ui/button";
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
  const [activeTab, setActiveTab] = useState<"assurance" | "assets" | "ai" | "raw">("assurance");

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
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <p className="text-sm font-mono text-[#888888]">
            Đang tải dữ liệu Security Assurance Matrix...
          </p>
        </div>
      </DashboardShell>
    );
  }

  if (error || !jobData) {
    return (
      <DashboardShell area="dashboard">
        <div className="max-w-2xl mx-auto my-12 p-6 rounded-2xl border border-[#EF4444]/40 bg-[#EF4444]/10 text-center space-y-4 font-mono">
          <AlertCircle className="w-10 h-10 text-[#EF4444] mx-auto" />
          <h3 className="text-base font-bold text-white">Không tìm thấy phiên quét</h3>
          <p className="text-xs text-[#A3A3A3]">{error || "Scan job không tồn tại hoặc đã hết hạn lưu trữ."}</p>
          <Button
            onClick={() => router.push("/dashboard/results")}
            className="border border-[#242424] bg-[#141414] text-white text-xs hover:bg-[#222222]"
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
  const openPorts = jobData.open_ports || jobData.ports?.open || [];
  const crawledUrls = jobData.crawled_urls || jobData.urls?.combined || [];

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
        {/* Top Navigation & Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#242424] pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-mono">
              <Link
                href="/dashboard/results"
                className="inline-flex items-center text-xs text-[#888888] hover:text-white transition mr-2"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Lịch sử
              </Link>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#242424] bg-[#141414] text-[#A3A3A3]">
                {assurance?.engine_version || "ADQ Omni Engine v2.0"}
              </span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded border ${
                status === "COMPLETED" 
                  ? "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/40"
                  : status === "RUNNING"
                  ? "bg-white/10 text-white border-white/40 animate-pulse"
                  : "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/40"
              }`}>
                {status === "COMPLETED" ? "SCAN COMPLETE ✓" : status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-white" />
                {targetUrl}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#888888] font-mono pt-1">
              <span>Scan ID: <strong className="text-[#F5F5F5]">{scanId}</strong></span>
              <span>•</span>
              <span>Bắt đầu: <strong className="text-[#F5F5F5]">{startedAt}</strong></span>
              <span>•</span>
              <span>Gói đánh giá: <strong className="text-white">{effectiveTier}</strong></span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchScanDetails}
              className="border-[#242424] bg-[#141414] text-[#A3A3A3] hover:text-white hover:bg-[#222222] text-xs h-8 font-mono"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Làm mới
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport("markdown")}
              className="border-[#242424] bg-[#141414] text-[#A3A3A3] hover:text-white hover:bg-[#222222] text-xs h-8 font-mono"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Xuất Markdown
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport("json")}
              className="border-[#242424] bg-[#141414] text-[#A3A3A3] hover:text-white hover:bg-[#222222] text-xs h-8 font-mono"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Xuất JSON
            </Button>
          </div>
        </div>

        {/* 1. Top Stage Runner */}
        {assurance?.stages_summary && (
          <TopStageRunner
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
          <div className="flex border-b border-[#242424] gap-2 font-mono text-xs">
            <button
              onClick={() => setActiveTab("assurance")}
              className={`pb-3 px-3 font-bold transition flex items-center gap-1.5 border-b-2 cursor-pointer ${
                activeTab === "assurance"
                  ? "border-white text-white"
                  : "border-transparent text-[#888888] hover:text-white"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Assurance Matrix ({assurance?.controls?.length || 0})
            </button>

            <button
              onClick={() => setActiveTab("assets")}
              className={`pb-3 px-3 font-bold transition flex items-center gap-1.5 border-b-2 cursor-pointer ${
                activeTab === "assets"
                  ? "border-white text-white"
                  : "border-transparent text-[#888888] hover:text-white"
              }`}
            >
              <Globe className="w-4 h-4" />
              Discovered Assets
            </button>

            <button
              onClick={() => setActiveTab("ai")}
              className={`pb-3 px-3 font-bold transition flex items-center gap-1.5 border-b-2 cursor-pointer ${
                activeTab === "ai"
                  ? "border-white text-white"
                  : "border-transparent text-[#888888] hover:text-white"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              AI Risk Assessment
            </button>

            <button
              onClick={() => setActiveTab("raw")}
              className={`pb-3 px-3 font-bold transition flex items-center gap-1.5 border-b-2 cursor-pointer ${
                activeTab === "raw"
                  ? "border-white text-white"
                  : "border-transparent text-[#888888] hover:text-white"
              }`}
            >
              <Terminal className="w-4 h-4" />
              Raw Execution Logs
            </button>
          </div>

          {/* TAB 1: Assurance Matrix */}
          {activeTab === "assurance" && assurance?.controls && (
            <AssuranceMatrix controls={assurance.controls} targetDomain={targetUrl} />
          )}

          {/* TAB 2: Discovered Assets */}
          {activeTab === "assets" && (
            <DiscoveredAssets
              hosts={liveHosts}
              ports={openPorts}
              urls={crawledUrls}
              defaultTarget={targetUrl}
            />
          )}

          {/* TAB 3: AI Analysis */}
          {activeTab === "ai" && (
            <AiAnalysisCard
              userTier={effectiveTier}
              aiSummary={jobData.ai_summary || jobData.ai_analysis || jobData.recommendations}
              target={targetUrl}
            />
          )}

          {/* TAB 4: Raw Logs */}
          {activeTab === "raw" && (
            <div className="rounded-xl border border-[#242424] bg-[#0A0A0A] p-4 font-mono text-xs text-[#A3A3A3] space-y-3">
              <div className="flex items-center justify-between border-b border-[#242424] pb-2 text-[#888888]">
                <span>Scanner Engine Console Output</span>
                <span>Worker: {jobData.worker_id || "worker-main"}</span>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap max-h-96 text-[11px] text-[#A3A3A3] leading-relaxed">
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
