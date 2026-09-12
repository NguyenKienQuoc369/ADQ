"use client";

import React, { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { getEntitlements } from "@/lib/entitlements";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  UploadCloud,
  FileCode2,
  LoaderCircle,
  Save,
  BookmarkCheck,
  PlusCircle,
  Lock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  Globe,
  Layers,
  Key,
  Info,
  History,
} from "lucide-react";
import {
  getProjectById,
  saveProjectDetail,
  createApkAuditJob,
  getApkAuditJobStatus,
  getApkAuditJobResult,
  cancelApkAuditJob,
  getApkAuditHistory,
  ApkAuditResultPayload,
  ApkJobStatusResponse,
  ApkFinding,
} from "@/lib/api";
import { RescanConfirmModal } from "@/components/scan/rescan-confirm-modal";

type JobStatus =
  | "idle"
  | "uploading"
  | "queued"
  | "validating"
  | "decompiling"
  | "analyzing"
  | "partial"
  | "completed"
  | "failed"
  | "cancelling"
  | "cancelled";

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

function ApkAuditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const { user } = useAuth();
  const entitlements = getEntitlements(user?.packageTier || "FREE");
  const isAllowed = entitlements.apkAudit;

  const [projectName, setProjectName] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Real Job State Machine
  const [jobState, setJobState] = useState<JobStatus>("idle");
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStage, setJobStage] = useState<string>("");
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [jobError, setJobError] = useState<string | null>(null);

  // Result & Persistence
  const [analysisResult, setAnalysisResult] = useState<ApkAuditResultPayload | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [showRescanModal, setShowRescanModal] = useState(false);

  // History State
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<ApkJobStatusResponse[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Polling ref
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPolling();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [clearPolling]);

  // Load existing project data if projectId is present
  useEffect(() => {
    if (!projectId) return;

    getProjectById(projectId)
      .then((p) => {
        if (!p) return;
        setProjectName(p.name || "");
        const summary = (p.projectDetail?.summary as Record<string, any>) || {};
        if (summary.apkAudit) {
          setAnalysisResult(summary.apkAudit);
          setJobState("completed");
        }
      })
      .catch((e) => console.warn("Load APK detail error:", e));
  }, [projectId]);

  // Poll job status
  const startPolling = useCallback(
    (jobId: string) => {
      clearPolling();
      isPollingRef.current = true;

      const poll = async () => {
        if (!isPollingRef.current) return;

        try {
          const statusResp = await getApkAuditJobStatus(jobId);
          if (!isPollingRef.current) return;

          const rawStatus = (statusResp.status || "").toUpperCase();
          const progress = typeof statusResp.progress === "number" ? statusResp.progress : 0;
          setJobProgress(progress);
          setJobStage(statusResp.stage || "");

          if (rawStatus === "QUEUED") {
            setJobState("queued");
          } else if (rawStatus === "VALIDATING") {
            setJobState("validating");
          } else if (rawStatus === "DECOMPILING") {
            setJobState("decompiling");
          } else if (rawStatus === "ANALYZING") {
            setJobState("analyzing");
          } else if (rawStatus === "CANCELLING") {
            setJobState("cancelling");
          } else if (rawStatus === "CANCELLED") {
            setJobState("cancelled");
            clearPolling();
            return;
          } else if (rawStatus === "FAILED") {
            setJobState("failed");
            setJobError(statusResp.error || "Quá trình phân tích APK thất bại.");
            clearPolling();
            return;
          } else if (rawStatus === "COMPLETED" || rawStatus === "PARTIAL") {
            setJobState(rawStatus === "PARTIAL" ? "partial" : "completed");
            clearPolling();

            // Fetch final sanitized result
            try {
              const resResp = await getApkAuditJobResult(jobId);
              if (resResp.ok && resResp.result) {
                setAnalysisResult(resResp.result);
              }
            } catch (err: any) {
              console.error("Failed to fetch APK job result:", err);
              setJobError(err?.message || "Không thể tải kết quả phân tích.");
            }
            return;
          }

          // Schedule next poll tick
          if (isPollingRef.current) {
            pollTimerRef.current = setTimeout(poll, 1500);
          }
        } catch (err: any) {
          console.warn("Poll status error:", err);
          // If network error, retry after 2s without crashing UI
          if (isPollingRef.current) {
            pollTimerRef.current = setTimeout(poll, 2000);
          }
        }
      };

      poll();
    },
    [clearPolling]
  );

  const startAnalysis = async () => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".apk")) {
      setJobError("Chỉ chấp nhận tệp định dạng .apk Android.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setJobError("Kích thước tệp vượt quá giới hạn 100 MB.");
      return;
    }

    clearPolling();
    setJobError(null);
    setJobState("uploading");
    setJobStage("Đang tải tệp lên máy chủ...");
    setJobProgress(5);
    setAnalysisResult(null);

    abortControllerRef.current = new AbortController();

    try {
      const resp = await createApkAuditJob(
        file,
        projectId || undefined,
        abortControllerRef.current.signal
      );

      if (resp.ok && resp.job_id) {
        setCurrentJobId(resp.job_id);
        setJobState("queued");
        setJobStage("Đã xếp hàng xử lý...");
        setJobProgress(resp.progress || 10);
        startPolling(resp.job_id);
      } else {
        setJobState("failed");
        setJobError(resp.message || "Không thể khởi tạo phiên kiểm toán APK.");
      }
    } catch (err: any) {
      setJobState("failed");
      const msg = err?.message || "Lỗi tải lên tệp APK.";
      setJobError(msg);
    }
  };

  const handleCancelClick = async () => {
    if (!currentJobId) return;

    setJobState("cancelling");
    setJobStage("Đang gửi yêu cầu hủy...");

    try {
      await cancelApkAuditJob(currentJobId);
      setJobState("cancelled");
      setJobStage("Phiên kiểm toán đã bị hủy.");
      clearPolling();
    } catch (err: any) {
      console.error("Cancel job failed:", err);
      setJobError(err?.message || "Không thể hủy phiên kiểm toán.");
    }
  };

  const handleUploadClick = () => {
    const isBusy =
      jobState === "uploading" ||
      jobState === "queued" ||
      jobState === "validating" ||
      jobState === "decompiling" ||
      jobState === "analyzing" ||
      jobState === "cancelling";

    if (isBusy || !file) return;

    const hasExistingData = analysisResult !== null;
    const isSuppressed =
      typeof window !== "undefined" &&
      localStorage.getItem("adq_suppress_rescan_warning") === "true";

    if (hasExistingData && !isSuppressed) {
      setShowRescanModal(true);
      return;
    }

    startAnalysis();
  };

  const handleSaveSession = async () => {
    if (!projectId) {
      alert("Vui lòng gắn một Project ID hoặc tạo dự án để lưu phiên này.");
      return;
    }
    if (!analysisResult) return;

    setIsSaving(true);
    try {
      await saveProjectDetail(projectId, {
        apkAudit: analysisResult,
      });
      setIsSavedSuccess(true);
      setTimeout(() => setIsSavedSuccess(false), 3000);
    } catch (e) {
      console.error("Save APK audit failed:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await getApkAuditHistory();
      if (res?.history && Array.isArray(res.history)) {
        setHistoryList(res.history);
      }
    } catch (err) {
      console.error("Failed to load APK audit history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleToggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) void loadHistory();
  };

  const selectHistoryJob = async (jobId: string) => {
    setCurrentJobId(jobId);
    setShowHistory(false);
    setJobError(null);
    clearPolling();
    try {
      const statusResp = await getApkAuditJobStatus(jobId);
      const rawStatus = (statusResp.status || "").toUpperCase();
      if (rawStatus === "COMPLETED" || rawStatus === "PARTIAL") {
        setJobState(rawStatus === "PARTIAL" ? "partial" : "completed");
        setJobProgress(100);
        const resResp = await getApkAuditJobResult(jobId);
        if (resResp.ok && resResp.result) {
          setAnalysisResult(resResp.result);
        }
      } else if (rawStatus === "FAILED") {
        setJobState("failed");
        setJobError(statusResp.error || "Phiên kiểm toán đã thất bại trước đó.");
      } else {
        setJobState("queued");
        startPolling(jobId);
      }
    } catch (err: any) {
      console.error("Failed to load history job:", err);
      setJobError(err?.message || "Không thể tải lại phiên kiểm toán.");
    }
  };

  const handleNewSession = () => {
    clearPolling();
    setFile(null);
    setAnalysisResult(null);
    setCurrentJobId(null);
    setJobState("idle");
    setJobStage("");
    setJobProgress(0);
    setJobError(null);
  };

  if (!isAllowed) {
    return (
      <DashboardShell area="dashboard">
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="w-full max-w-xl rounded-lg border border-[#222222] bg-[#000000] p-8 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900">
              <Shield className="h-6 w-6 text-white" />
            </div>

            <span className="inline-block mb-3 border border-neutral-700 bg-neutral-800 text-white text-[10px] font-mono px-2.5 py-0.5 rounded-full">
              DÀNH CHO GÓI PRO MAX
            </span>

            <h1 className="text-xl font-semibold text-white">
              Kiểm Toán An Ninh Mobile APK
            </h1>

            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-neutral-400">
              APK Audit là bộ công cụ kiểm toán bảo mật ứng dụng Android chuyên sâu
              và chỉ khả dụng trên gói PRO MAX đang hoạt động.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-4 text-left">
                <p className="text-[11px] font-mono uppercase text-neutral-400">FREE / PRO</p>
                <p className="mt-1 text-sm font-semibold text-white">Chưa bao gồm APK Audit</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Tiếp tục sử dụng các công cụ quét và phân tích bảo mật có trong gói.
                </p>
              </div>

              <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-4 text-left">
                <p className="text-[11px] font-mono uppercase text-neutral-400">PRO MAX</p>
                <p className="mt-1 text-sm font-semibold text-white">Mở khóa APK Audit</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Phân tích APK, kiểm tra quyền ứng dụng, bóc tách hardcoded secrets.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
              <Button
                onClick={() => router.push("/dashboard/billing")}
                className="h-8 bg-white hover:bg-neutral-200 text-black font-medium text-xs rounded-md px-4 shadow-sm cursor-pointer"
              >
                Nâng cấp PRO MAX
              </Button>

              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
                className="h-8 border-[#333333] bg-[#111111] hover:bg-neutral-800 text-neutral-300 text-xs rounded-md px-4"
              >
                Quay lại Dashboard
              </Button>
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const isJobActive =
    jobState === "uploading" ||
    jobState === "queued" ||
    jobState === "validating" ||
    jobState === "decompiling" ||
    jobState === "analyzing" ||
    jobState === "cancelling";

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 text-[#ededed] font-sans">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#222222] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
                <FileCode2 className="h-5 w-5 text-white" /> Dịch Ngược & Kiểm Toán File APK
              </h1>
              {projectId && (
                <span className="text-[10px] font-mono border border-neutral-700 bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full">
                  TARGET: {projectName || projectId}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Phân tích tĩnh tệp nhị phân Android, bóc tách Secret Keys, cờ Manifest và lỗ hổng mã nguồn.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleHistory}
              className="h-8 text-xs border border-[#333333] bg-[#111111] text-neutral-300 hover:bg-neutral-800 rounded-md gap-1.5"
            >
              <History className="h-3.5 w-3.5" />
              {showHistory ? "Đóng Lịch Sử" : "Lịch Sử Audit"}
            </Button>

            <Button
              className="h-8 text-xs border border-[#333333] bg-[#111111] text-white hover:bg-neutral-800 rounded-md transition"
              disabled={isSaving || isJobActive || !analysisResult}
              onClick={handleSaveSession}
              size="sm"
              variant="outline"
            >
              {isSaving ? (
                <LoaderCircle className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : isSavedSuccess ? (
                <BookmarkCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5" />
              )}
              {isSavedSuccess ? "Đã Lưu Phiên" : "Lưu Kết Quả"}
            </Button>

            <Button
              onClick={handleNewSession}
              size="sm"
              variant="outline"
              className="h-8 text-xs border border-[#333333] bg-[#111111] text-white hover:bg-neutral-800 rounded-md"
            >
              <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Phiên Mới
            </Button>
          </div>
        </div>

        {/* History Drawer */}
        {showHistory && (
          <div className="rounded-lg border border-[#222222] bg-[#0A0A0A] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#222222] pb-2">
              <span className="text-xs font-semibold text-white flex items-center gap-2">
                <History className="h-3.5 w-3.5" /> Lịch Sử Các Phiên Kiểm Toán APK
              </span>
              {loadingHistory && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-neutral-400" />}
            </div>
            {historyList.length === 0 ? (
              <p className="text-xs text-neutral-500 py-3 text-center">Chưa có phiên kiểm toán APK nào.</p>
            ) : (
              <div className="divide-y divide-[#1A1A1A] max-h-56 overflow-y-auto">
                {historyList.map((item) => (
                  <div
                    key={item.job_id}
                    onClick={() => selectHistoryJob(item.job_id)}
                    className="py-2.5 px-2 flex items-center justify-between text-xs hover:bg-[#111111] rounded cursor-pointer transition"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-white font-medium truncate">Job ID: {item.job_id}</p>
                      <p className="text-[11px] text-neutral-500">
                        {item.created_at ? new Date(item.created_at * 1000).toLocaleString("vi-VN") : "Gần đây"} • Stage: {item.stage || item.status}
                      </p>
                    </div>
                    <Badge
                      className={`text-[10px] ${
                        item.status === "COMPLETED"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : item.status === "FAILED"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upload & Execution Panel */}
        <div className="rounded-lg border border-[#222222] bg-[#000000] p-6 space-y-4">
          <div className="flex flex-col items-center justify-center border border-dashed border-[#333333] rounded-lg p-8 bg-[#0a0a0a] text-center hover:border-neutral-500 transition">
            <UploadCloud className="h-9 w-9 text-neutral-400 mb-3" />
            <p className="text-sm font-semibold text-white mb-1">Tải lên tệp APK Android (.apk)</p>
            <p className="text-xs text-neutral-400 max-w-sm mb-4">
              Hệ thống sẽ tiến hành Decompile bằng Jadx/Apktool và kiểm toán chữ ký, phân quyền, lỗ hổng.
            </p>
            <input
              type="file"
              accept=".apk"
              disabled={isJobActive}
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setJobError(null);
              }}
              className="text-xs text-neutral-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-white file:text-black hover:file:bg-neutral-200 cursor-pointer disabled:opacity-50"
            />
            {file && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <span className="text-xs font-mono text-neutral-300">
                  {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
                {!isJobActive ? (
                  <Button
                    className="h-8 px-4 bg-white hover:bg-neutral-200 text-black text-xs font-medium rounded-md shadow-sm cursor-pointer"
                    onClick={handleUploadClick}
                  >
                    Bắt Đầu Kiểm Toán
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={handleCancelClick}
                    disabled={jobState === "cancelling"}
                  >
                    <Ban className="h-3.5 w-3.5 mr-1" />
                    {jobState === "cancelling" ? "Đang hủy..." : "Hủy Kiểm Toán"}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Active Job Status & Progress */}
          {isJobActive && (
            <div className="rounded-md border border-neutral-800 bg-[#0c0c0c] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <LoaderCircle className="h-4 w-4 animate-spin text-white" />
                  <span className="font-semibold text-white uppercase tracking-wider text-[11px]">
                    Trạng Thái: {jobState}
                  </span>
                  {currentJobId && (
                    <span className="text-[10px] font-mono text-neutral-500">
                      ID: {currentJobId}
                    </span>
                  )}
                </div>
                <span className="font-mono text-neutral-300">{jobProgress}%</span>
              </div>

              <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-white h-full transition-all duration-300"
                  style={{ width: `${Math.max(5, jobProgress)}%` }}
                />
              </div>

              {jobStage && (
                <p className="text-[11px] text-neutral-400 font-mono">
                  Giai đoạn: {jobStage}
                </p>
              )}
            </div>
          )}

          {/* Error Banner */}
          {jobError && (
            <div className="rounded-md border border-rose-500/40 bg-rose-950/20 p-3.5 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-rose-300">Lỗi Kiểm Toán APK</p>
                <p className="text-rose-200/80 leading-relaxed font-mono text-[11px]">
                  {jobError}
                </p>
              </div>
            </div>
          )}

          {/* Cancelled Banner */}
          {jobState === "cancelled" && (
            <div className="rounded-md border border-amber-500/40 bg-amber-950/20 p-3.5 flex items-center gap-3">
              <Ban className="h-4 w-4 text-amber-400 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-amber-300">Phiên Đã Bị Hủy: </span>
                <span className="text-amber-200/80">Tác vụ giải mã APK đã được dừng lại an toàn.</span>
              </div>
            </div>
          )}

          {/* Partial Warning Banner */}
          {analysisResult?.partial && (
            <div className="rounded-md border border-amber-500/40 bg-amber-950/20 p-3.5 flex items-start gap-3">
              <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-amber-300">Chế Độ Phân Tích Thu Gọn (Partial Analysis)</p>
                <p className="text-amber-200/80 leading-relaxed">
                  Một số công cụ decompilation chuyên sâu gặp cảnh báo hoặc giới hạn. Hệ thống đã tự động trích xuất tĩnh qua cơ chế ZIP Fallback.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Real Analysis Results */}
        {analysisResult && (
          <div className="space-y-6">
            {/* Metadata Overview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* App / Package Info */}
              <div className="rounded-lg border border-[#222222] bg-[#000000] p-4 space-y-2.5">
                <p className="text-xs font-semibold text-white flex items-center gap-2 border-b border-[#222222] pb-2">
                  <Shield className="h-3.5 w-3.5 text-white" /> Thông Tin Ứng Dụng
                </p>
                <div className="text-xs space-y-1.5 text-neutral-300 font-mono">
                  <p>
                    <span className="text-neutral-500">Package:</span>{" "}
                    <span className="text-white">{analysisResult.package || "Không xác định"}</span>
                  </p>
                  <p>
                    <span className="text-neutral-500">Version:</span>{" "}
                    <span className="text-white">{analysisResult.version || "Không xác định"}</span>
                  </p>
                  <p>
                    <span className="text-neutral-500">Target SDK:</span>{" "}
                    <span className="text-white">
                      {analysisResult.sdk?.targetSdkVersion || "N/A"}
                    </span>{" "}
                    <span className="text-neutral-500">
                      (Min: {analysisResult.sdk?.minSdkVersion || "N/A"})
                    </span>
                  </p>
                  <p>
                    <span className="text-neutral-500">Mode:</span>{" "}
                    <span className="text-white uppercase text-[10px]">
                      {analysisResult.analysisMode || "N/A"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Manifest Security Flags */}
              <div className="rounded-lg border border-[#222222] bg-[#000000] p-4 space-y-2.5">
                <p className="text-xs font-semibold text-white flex items-center gap-2 border-b border-[#222222] pb-2">
                  <Lock className="h-3.5 w-3.5 text-white" /> Cấu Hình Manifest
                </p>
                <div className="text-xs space-y-1.5 text-neutral-300 font-mono">
                  <p className="flex items-center justify-between">
                    <span className="text-neutral-500">Debuggable:</span>
                    <span
                      className={
                        analysisResult.manifest?.debuggable === true
                          ? "text-rose-400 font-semibold"
                          : "text-emerald-400"
                      }
                    >
                      {analysisResult.manifest?.debuggable === true
                        ? "TRUE (Nguy cơ)"
                        : analysisResult.manifest?.debuggable === false
                        ? "FALSE (An toàn)"
                        : "N/A"}
                    </span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-neutral-500">AllowBackup:</span>
                    <span
                      className={
                        analysisResult.manifest?.allowBackup === true
                          ? "text-amber-400 font-semibold"
                          : "text-neutral-300"
                      }
                    >
                      {analysisResult.manifest?.allowBackup === true
                        ? "TRUE (Bật)"
                        : analysisResult.manifest?.allowBackup === false
                        ? "FALSE"
                        : "N/A"}
                    </span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-neutral-500">Cleartext Traffic:</span>
                    <span
                      className={
                        analysisResult.manifest?.usesCleartextTraffic === true
                          ? "text-rose-400 font-semibold"
                          : "text-emerald-400"
                      }
                    >
                      {analysisResult.manifest?.usesCleartextTraffic === true
                        ? "TRUE (HTTP allowed)"
                        : analysisResult.manifest?.usesCleartextTraffic === false
                        ? "FALSE (Strict HTTPS)"
                        : "N/A"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Signing & Certificates */}
              <div className="rounded-lg border border-[#222222] bg-[#000000] p-4 space-y-2.5">
                <p className="text-xs font-semibold text-white flex items-center gap-2 border-b border-[#222222] pb-2">
                  <Key className="h-3.5 w-3.5 text-white" /> Chữ Ký & Chứng Chỉ
                </p>
                <div className="text-xs space-y-1.5 text-neutral-300 font-mono">
                  <p className="flex items-center justify-between">
                    <span className="text-neutral-500">Trạng Thái Ký:</span>
                    <span
                      className={
                        analysisResult.signing?.isSigned ? "text-emerald-400" : "text-rose-400"
                      }
                    >
                      {analysisResult.signing?.isSigned ? "Đã Ký (Signed)" : "Chưa Ký"}
                    </span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-neutral-500">Scheme:</span>
                    <span className="text-white uppercase">
                      {analysisResult.signing?.scheme || "N/A"}
                    </span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-neutral-500">Debug Cert:</span>
                    <span
                      className={
                        analysisResult.signing?.debugCert ? "text-rose-400 font-semibold" : "text-neutral-400"
                      }
                    >
                      {analysisResult.signing?.debugCert ? "Phát hiện" : "Không"}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Findings List */}
            <div className="rounded-lg border border-[#222222] bg-[#000000] overflow-hidden">
              <div className="p-4 border-b border-[#222222] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  Phát Hiện Lỗ Hổng & Rủi Ro Bảo Mật ({(analysisResult.findings || []).length})
                </h3>
              </div>
              <div className="divide-y divide-[#222222]">
                {(analysisResult.findings || []).length === 0 ? (
                  <div className="p-6 text-center text-xs text-neutral-500">
                    Không phát hiện lỗ hổng nghiêm trọng nào trong tệp APK này.
                  </div>
                ) : (
                  (analysisResult.findings || []).map((finding: ApkFinding, i: number) => {
                    const isCritical = finding.severity === "CRITICAL";
                    const isHigh = finding.severity === "HIGH";
                    const isMed = finding.severity === "MEDIUM";

                    return (
                      <div key={finding.id || i} className="p-4 text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                isCritical
                                  ? "border-rose-500/50 bg-rose-950/40 text-rose-300 font-bold"
                                  : isHigh
                                  ? "border-rose-500/30 bg-rose-950/20 text-rose-300"
                                  : isMed
                                  ? "border-amber-500/30 bg-amber-950/20 text-amber-300"
                                  : "border-neutral-700 bg-neutral-800 text-neutral-300"
                              }`}
                            >
                              {finding.severity}
                            </span>
                            <span className="font-semibold text-white">{finding.title}</span>
                          </div>
                          {finding.file && (
                            <span className="text-[10px] font-mono text-neutral-500 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded">
                              {finding.file}
                            </span>
                          )}
                        </div>

                        <p className="text-neutral-400 leading-relaxed">{finding.description}</p>

                        {finding.evidence && (
                          <div className="rounded bg-neutral-950 border border-neutral-800 p-2 font-mono text-[11px] text-neutral-300 overflow-x-auto">
                            <span className="text-neutral-500 select-none">Bằng chứng: </span>
                            {finding.evidence}
                          </div>
                        )}

                        {finding.remediation && (
                          <div className="text-[11px] text-emerald-400/90 font-mono">
                            <span className="text-neutral-500">Khắc phục: </span>
                            {finding.remediation}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Permissions & Discovered Endpoints */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Permissions */}
              <div className="rounded-lg border border-[#222222] bg-[#000000] p-4 space-y-3">
                <h4 className="text-xs font-semibold text-white flex items-center gap-2 border-b border-[#222222] pb-2">
                  <Layers className="h-3.5 w-3.5 text-white" /> Quyền Ứng Dụng Yêu Cầu (
                  {(analysisResult.permissions || []).length})
                </h4>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {(analysisResult.permissions || []).length === 0 ? (
                    <p className="text-xs text-neutral-500">Không khai báo uses-permission.</p>
                  ) : (
                    (analysisResult.permissions || []).map((perm, idx) => (
                      <div
                        key={idx}
                        className={`text-[11px] font-mono p-1.5 rounded border flex items-center justify-between ${
                          perm.isDangerous
                            ? "border-rose-500/30 bg-rose-950/20 text-rose-300"
                            : "border-neutral-800 bg-[#0a0a0a] text-neutral-300"
                        }`}
                      >
                        <span className="truncate">{perm.name}</span>
                        {perm.isDangerous && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-900/40 text-rose-300 shrink-0 ml-2">
                            DANGEROUS
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Endpoints */}
              <div className="rounded-lg border border-[#222222] bg-[#000000] p-4 space-y-3">
                <h4 className="text-xs font-semibold text-white flex items-center gap-2 border-b border-[#222222] pb-2">
                  <Globe className="h-3.5 w-3.5 text-white" /> Endpoints & URLs Phát Hiện (
                  {(analysisResult.endpoints || []).length})
                </h4>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {(analysisResult.endpoints || []).length === 0 ? (
                    <p className="text-xs text-neutral-500">Không tìm thấy URL/Endpoint tĩnh.</p>
                  ) : (
                    (analysisResult.endpoints || []).map((ep, idx) => (
                      <div
                        key={idx}
                        className="text-[11px] font-mono p-1.5 rounded border border-neutral-800 bg-[#0a0a0a] text-neutral-300 truncate"
                      >
                        {ep}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rescan Confirm Modal */}
        <RescanConfirmModal
          isOpen={showRescanModal}
          onClose={() => setShowRescanModal(false)}
          onConfirm={(dontShowAgain) => {
            if (dontShowAgain && typeof window !== "undefined") {
              localStorage.setItem("adq_suppress_rescan_warning", "true");
            }
            setShowRescanModal(false);
            startAnalysis();
          }}
          onCreateNewSession={() => {
            setShowRescanModal(false);
            router.push("/dashboard/projects");
          }}
        />
      </div>
    </DashboardShell>
  );
}

export default function ApkAuditPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#000000]" />}>
      <ApkAuditContent />
    </Suspense>
  );
}

