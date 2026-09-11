"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Folder,
  Shield,
  Zap,
  Bot,
  History,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  LoaderCircle,
  Clock,
  Layers,
  Activity,
  FileText,
} from "lucide-react";
import { ProjectWorkspaceShell } from "@/components/project-workspace-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getProjectById,
  getTargetVerificationStatus,
  getScanResults,
  getStressHistory,
  ScanResult,
  StressJobState,
} from "@/lib/api";

export default function ProjectOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params?.projectId ?? "").trim();

  const [project, setProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const [latestScan, setLatestScan] = useState<ScanResult | null>(null);
  const [latestStress, setLatestStress] = useState<StressJobState | null>(null);

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

        if (rawTarget) {
          try {
            const vRes = await getTargetVerificationStatus(rawTarget);
            if (active) setIsVerified(vRes.ok && vRes.verified);
          } catch {
            if (active) setIsVerified(false);
          }
        }

        // Load latest scan & stress jobs
        try {
          const scans = await getScanResults();
          if (active && scans && scans.length > 0) {
            // Find scan matching project target or just the latest
            const matched = scans.find(
              (s) =>
                rawTarget &&
                (s.target.includes(rawTarget) || rawTarget.includes(s.target))
            );
            setLatestScan(matched || scans[0]);
          }
        } catch {}

        try {
          const stressRes = await getStressHistory();
          if (active && stressRes?.ok && stressRes.history?.length > 0) {
            const matched = stressRes.history.find(
              (s: any) =>
                rawTarget &&
                (s.target_url.includes(rawTarget) ||
                  rawTarget.includes(s.target_url))
            );
            setLatestStress(matched || stressRes.history[0]);
          }
        } catch {}
      } catch (err: any) {
        if (active) {
          setError(err?.message || "Không thể tải thông tin dự án.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [projectId, router]);

  const targetDomain =
    project?.projectDetail?.summary?.domain || project?.domain || "";
  const projectName =
    project?.projectDetail?.title || project?.name || "Project";
  const projectDesc =
    project?.projectDetail?.description ||
    project?.projectDetail?.summary?.projectInfo ||
    "Không có mô tả bổ sung.";

  if (loading) {
    return (
      <ProjectWorkspaceShell activeTab="overview">
        <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-3 text-center">
          <LoaderCircle className="h-6 w-6 animate-spin text-white" />
          <p className="text-xs font-mono text-neutral-400">
            Đang tải dữ liệu Project {projectId}...
          </p>
        </div>
      </ProjectWorkspaceShell>
    );
  }

  if (error || !project) {
    return (
      <ProjectWorkspaceShell activeTab="overview">
        <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-6 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
          <h2 className="text-sm font-semibold text-white">
            {error || "Project không tồn tại hoặc bạn không có quyền truy cập."}
          </h2>
          <Button
            onClick={() => router.push("/dashboard")}
            className="h-8 bg-white text-black hover:bg-neutral-200 text-xs font-semibold"
          >
            Quay lại danh sách Projects
          </Button>
        </div>
      </ProjectWorkspaceShell>
    );
  }

  return (
    <ProjectWorkspaceShell
      activeTab="overview"
      targetUrlOverride={targetDomain}
      isVerifiedOverride={isVerified}
    >
      <div className="space-y-6">
        {/* Project Meta Card */}
        <div className="rounded-lg border border-[#222222] bg-[#000000] p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#222222] pb-5">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {projectName}
                </h1>
                <span className="text-xs font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                  ID: {projectId}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
                {projectDesc}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link href={`/scan?projectId=${projectId}`}>
                <Button className="h-8 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm transition active:scale-[0.99] cursor-pointer">
                  <Shield className="h-3.5 w-3.5 mr-1.5" /> Bắt đầu Scan
                </Button>
              </Link>
              <Link href={`/stress-test?projectId=${projectId}`}>
                <Button className="h-8 bg-neutral-900 hover:bg-neutral-800 text-white border border-[#333333] font-medium text-xs rounded-md transition cursor-pointer">
                  <Zap className="h-3.5 w-3.5 mr-1.5" /> Stress Test
                </Button>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
            <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-4 space-y-1">
              <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                Mục tiêu (Target)
              </span>
              <p className="text-sm font-semibold text-white font-mono truncate">
                {targetDomain || "Chưa thiết lập"}
              </p>
            </div>

            <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-4 space-y-1">
              <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                Xác minh quyền sở hữu
              </span>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                {isVerified ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Đã xác minh
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" /> Chưa xác minh
                  </span>
                )}
              </p>
            </div>

            <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-4 space-y-1">
              <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                Phiên Scan gần nhất
              </span>
              <p className="text-sm font-semibold text-white font-mono">
                {latestScan
                  ? `${latestScan.vulnerabilities?.length || 0} findings`
                  : "Chưa thực hiện"}
              </p>
            </div>

            <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-4 space-y-1">
              <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                Độ ổn định Stress Test
              </span>
              <p className="text-sm font-semibold text-white font-mono">
                {latestStress?.verdict || "Chưa kiểm thử"}
              </p>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Scan */}
          <div className="rounded-lg border border-[#222222] bg-[#000000] p-5 flex flex-col justify-between space-y-4 hover:border-neutral-700 transition">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-md bg-neutral-900 border border-neutral-800 text-white">
                    <Shield className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Rà quét An ninh (Scan)</h3>
                </div>
                {latestScan && (
                  <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                    {latestScan.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Khám phá tài sản, kiểm tra 19 kiểm soát kỹ thuật, rà quét lỗ hổng DAST và tổng hợp đánh giá rủi ro an ninh AI.
              </p>
            </div>

            <Link href={`/scan?projectId=${projectId}`}>
              <Button className="w-full h-8 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm transition">
                Mở Scan Mission Control <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>

          {/* Card 2: Stress Test */}
          <div className="rounded-lg border border-[#222222] bg-[#000000] p-5 flex flex-col justify-between space-y-4 hover:border-neutral-700 transition">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-md bg-neutral-900 border border-neutral-800 text-white">
                    <Zap className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Kiểm thử Tải (Stress Test)</h3>
                </div>
                {latestStress && (
                  <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                    {latestStress.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Kiểm tra độ trễ, giới hạn chịu tải, tỷ lệ lỗi và năng lực đáp ứng của hạ tầng dưới các cấu hình tải có kiểm soát.
              </p>
            </div>

            <Link href={`/stress-test?projectId=${projectId}`}>
              <Button className="w-full h-8 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm transition">
                Mở Stress Test <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>

          {/* Card 3: Security Copilot */}
          <div className="rounded-lg border border-[#222222] bg-[#000000] p-5 flex flex-col justify-between space-y-4 hover:border-neutral-700 transition">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-md bg-neutral-900 border border-neutral-800 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">ADQ Security Copilot</h3>
                </div>
                <span className="text-[10px] font-mono text-neutral-300 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                  Gói PRO MAX
                </span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Trợ lý AI chuyên sâu phân tích nguyên nhân gốc rễ, diễn giải kết quả kỹ thuật và cung cấp hướng dẫn mã vá lỗi One-Click Patch.
              </p>
            </div>

            <Link href={`/copilot?projectId=${projectId}`}>
              <Button className="w-full h-8 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm transition">
                Trao đổi với Copilot <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </ProjectWorkspaceShell>
  );
}
