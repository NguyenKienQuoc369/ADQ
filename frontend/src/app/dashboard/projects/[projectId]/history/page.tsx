"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  FileText,
  Shield,
  Zap,
  Download,
  ArrowRight,
  LoaderCircle,
  AlertCircle,
  ExternalLink,
  History,
  Clock,
} from "lucide-react";
import { ProjectWorkspaceShell } from "@/components/project-workspace-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getProjectById,
  getScanResults,
  getStressHistory,
  ScanResult,
  StressJobState,
} from "@/lib/api";

export default function ProjectHistoryPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params?.projectId ?? "").trim();

  const [project, setProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [stressHistory, setStressHistory] = useState<StressJobState[]>([]);
  const [activeTab, setActiveTab] = useState<"scan" | "stress">("scan");

  useEffect(() => {
    if (!projectId) {
      router.replace("/dashboard");
      return;
    }

    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        const proj = await getProjectById(projectId);
        if (!active) return;
        setProject(proj);

        const rawTarget =
          proj?.projectDetail?.summary?.domain || proj?.domain || "";

        try {
          const scans = await getScanResults();
          if (active && scans) {
            // Filter scans for this target if matching, otherwise show all scans
            const matched = scans.filter(
              (s) =>
                rawTarget &&
                (s.target.includes(rawTarget) || rawTarget.includes(s.target))
            );
            setScanHistory(matched.length > 0 ? matched : scans);
          }
        } catch {}

        try {
          const stressRes = await getStressHistory();
          if (active && stressRes?.ok && stressRes.history) {
            const matched = stressRes.history.filter(
              (s: any) =>
                rawTarget &&
                (s.target_url?.includes(rawTarget) ||
                  rawTarget.includes(s.target_url || ""))
            );
            setStressHistory(
              matched.length > 0 ? matched : stressRes.history
            );
          }
        } catch {}
      } catch (err: any) {
        if (active) setError(err?.message || "Không thể tải lịch sử dự án.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [projectId, router]);

  const exportScanJson = (scan: ScanResult) => {
    const blob = new Blob([JSON.stringify(scan, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scan.target || scan.id}-scan-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ProjectWorkspaceShell activeTab="history">
      <div className="space-y-6">
        <div className="rounded-lg border border-[#222222] bg-[#000000] p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#222222] pb-5 mb-5">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Lịch Sử Kiểm Thử & Báo Cáo
              </h1>
              <p className="text-xs text-neutral-400 mt-1">
                Lịch sử các phiên Scan và Stress Test đã thực thi trên mục tiêu của dự án.
              </p>
            </div>

            {/* Type selector toggle */}
            <div className="flex items-center gap-1 bg-[#0a0a0a] p-1 rounded-md border border-[#222222]">
              <button
                type="button"
                onClick={() => setActiveTab("scan")}
                className={`px-3 py-1 text-xs rounded font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "scan"
                    ? "bg-white text-black font-semibold"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Shield className="h-3 w-3" /> Scan ({scanHistory.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("stress")}
                className={`px-3 py-1 text-xs rounded font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "stress"
                    ? "bg-white text-black font-semibold"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Zap className="h-3 w-3" /> Stress Test ({stressHistory.length})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400 gap-3">
              <LoaderCircle className="h-6 w-6 animate-spin text-white" />
              <p className="text-xs font-mono">Đang tải lịch sử phiên kiểm thử...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-md bg-rose-950/20 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          ) : activeTab === "scan" ? (
            scanHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#222222] bg-[#0a0a0a] mb-3">
                  <Shield className="h-6 w-6 text-neutral-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">Chưa có phiên Scan nào</h3>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                  Khởi chạy phiên rà quét DAST đầu tiên để phân tích an ninh mục tiêu.
                </p>
                <Link href={`/scan?projectId=${projectId}`} className="mt-4">
                  <Button className="h-8 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm">
                    Bắt đầu Scan
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {scanHistory.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md border border-[#222222] bg-[#0a0a0a] p-4 hover:border-neutral-700 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white font-mono">{s.target}</span>
                        <span className="border border-neutral-700 bg-neutral-800 text-[10px] font-mono text-neutral-300 px-2 py-0.5 rounded-full">
                          {s.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono mt-1 flex flex-wrap items-center gap-3">
                        <span>ID: <span className="text-neutral-300">{s.id}</span></span>
                        <span>•</span>
                        <span>Bắt đầu: {new Date(s.startedAt).toLocaleString("vi-VN")}</span>
                        <span>•</span>
                        <span>{s.vulnerabilities?.length || 0} findings</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => exportScanJson(s)}
                        className="h-7 text-xs border border-[#333333] bg-[#111111] hover:bg-neutral-800 text-white rounded-md cursor-pointer"
                      >
                        <Download className="h-3 w-3 mr-1" /> JSON
                      </Button>
                      <Link href={`/scan?projectId=${projectId}&jobId=${s.id}`}>
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-white hover:bg-neutral-200 text-black font-semibold rounded-md cursor-pointer"
                        >
                          Mở kết quả <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : stressHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#222222] bg-[#0a0a0a] mb-3">
                <Zap className="h-6 w-6 text-neutral-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Chưa có phiên Stress Test nào</h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                Thực thi bài kiểm thử tải có kiểm soát để đo đạc độ ổn định hạ tầng.
              </p>
              <Link href={`/stress-test?projectId=${projectId}`} className="mt-4">
                <Button className="h-8 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm">
                  Bắt đầu Stress Test
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {stressHistory.map((st) => (
                <div
                  key={st.job_id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md border border-[#222222] bg-[#0a0a0a] p-4 hover:border-neutral-700 transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white font-mono">{st.target_url}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          st.verdict === "ỔN ĐỊNH"
                            ? "text-emerald-400 bg-emerald-950/40 border-emerald-500/30"
                            : st.verdict?.includes("GIẢM")
                            ? "text-amber-400 bg-amber-950/40 border-amber-500/30"
                            : "text-rose-400 bg-rose-950/40 border-rose-500/30"
                        }`}
                      >
                        {st.verdict || st.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400 font-mono mt-1 flex flex-wrap items-center gap-3">
                      <span>ID: <span className="text-neutral-300">{st.job_id}</span></span>
                      <span>•</span>
                      <span>{st.target_rps} RPS</span>
                      <span>•</span>
                      <span>p95: {st.metrics?.p95_latency || "0ms"}</span>
                      <span>•</span>
                      <span>Error: {typeof st.metrics?.error_rate === "number" ? st.metrics.error_rate.toFixed(1) : (st.metrics?.error_rate || "0.0")}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href={`/stress-test?projectId=${projectId}&jobId=${st.job_id}`}>
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-white hover:bg-neutral-200 text-black font-semibold rounded-md cursor-pointer"
                      >
                        Xem chi tiết <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProjectWorkspaceShell>
  );
}
