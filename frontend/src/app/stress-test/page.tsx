"use client";

import React, { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  History,
  LoaderCircle,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  StopCircle,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { getEntitlements } from "@/lib/entitlements";
import {
  createStressJob,
  getStressJob,
  stopStressJob,
  getStressHistory,
  streamStressJob,
  getTargetVerificationStatus,
  StressJobState,
} from "@/lib/api";

type StressPhase = "PREPARE" | "RAMP UP" | "STEADY LOAD" | "COOLDOWN" | "COMPLETE";

const PHASES: Array<{ id: StressPhase; name: string; desc: string }> = [
  { id: "PREPARE", name: "PREPARE", desc: "Chuẩn bị" },
  { id: "RAMP UP", name: "RAMP UP", desc: "Tăng tải" },
  { id: "STEADY LOAD", name: "STEADY LOAD", desc: "Duy trì tải" },
  { id: "COOLDOWN", name: "COOLDOWN", desc: "Giảm tải" },
  { id: "COMPLETE", name: "COMPLETE", desc: "Hoàn tất" },
];

function cleanBaseUrl(raw: string): string {
  let cleaned = (raw || "").trim();
  if (!cleaned) return "";
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned.replace(/\/+$/, "");
}

function StressTestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialJobId = searchParams?.get("jobId");
  const initialTarget = searchParams?.get("target") || "";

  const { user } = useAuth();
  const userTier = user?.packageTier || "FREE";
  const entitlements = getEntitlements(userTier);
  const isFreeTier = userTier === "FREE" || entitlements.stressDailyLimit === 0;

  // Form Configuration State
  const [targetUrl, setTargetUrl] = useState(initialTarget || "https://");
  const [endpointPath, setEndpointPath] = useState("/");
  const [durationSec, setDurationSec] = useState<number>(userTier === "PRO_MAX" ? 30 : 15);
  const [targetRps, setTargetRps] = useState<number>(userTier === "PRO_MAX" ? 100 : 50);

  // Target Verification State
  const [isVerifyingTarget, setIsVerifyingTarget] = useState(false);
  const [isTargetVerified, setIsTargetVerified] = useState<boolean | null>(null);

  // Active Job & Telemetry State
  const [activeJobId, setActiveJobId] = useState<string | null>(initialJobId);
  const [jobState, setJobState] = useState<StressJobState | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Real-time chart telemetry history
  const [telemetryHistory, setTelemetryHistory] = useState<
    Array<{ time: string; rps: number; latencyMs: number; errorRate: number }>
  >([]);

  // History Tab State
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<StressJobState[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Check target verification status
  useEffect(() => {
    let active = true;
    const checkTarget = async () => {
      const cleaned = cleanBaseUrl(targetUrl);
      if (!cleaned || cleaned === "https://" || cleaned === "http://") {
        setIsTargetVerified(null);
        return;
      }
      setIsVerifyingTarget(true);
      try {
        const res = await getTargetVerificationStatus(cleaned);
        if (active) {
          setIsTargetVerified(Boolean(res?.verified));
        }
      } catch {
        if (active) setIsTargetVerified(false);
      } finally {
        if (active) setIsVerifyingTarget(false);
      }
    };

    const timer = setTimeout(checkTarget, 600);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [targetUrl]);

  // Load initial or restored Job State
  useEffect(() => {
    if (!activeJobId) return;

    let isMounted = true;
    const abortCtrl = new AbortController();

    const fetchSnapshot = async () => {
      try {
        const snapshot = await getStressJob(activeJobId);
        if (isMounted && snapshot) {
          setJobState(snapshot);
          if (snapshot.target_url) setTargetUrl(snapshot.target_url);
        }
      } catch (err: any) {
        console.error("Failed to fetch stress snapshot:", err);
      }
    };

    fetchSnapshot();

    // Stream SSE events
    streamStressJob(
      activeJobId,
      (chunk) => {
        if (!isMounted) return;
        setJobState((prev) => {
          const nextState = { ...(prev || {}), ...chunk };
          const metrics = chunk.metrics || prev?.metrics;
          if (metrics) {
            const nowTime = new Date().toLocaleTimeString("vi-VN", { hour12: false });
            const latVal = parseInt(String(metrics.p95_latency || metrics.avg_latency || 0), 10) || 0;
            setTelemetryHistory((hist) => [
              ...hist.slice(-25),
              {
                time: nowTime,
                rps: Number(metrics.rps || 0),
                latencyMs: latVal,
                errorRate: Number(metrics.error_rate || 0),
              },
            ]);
          }
          return nextState as StressJobState;
        });
      },
      abortCtrl.signal
    ).catch(() => {});

    return () => {
      isMounted = false;
      abortCtrl.abort();
    };
  }, [activeJobId]);

  // Load history list when tab toggled
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await getStressHistory();
      if (res?.history) {
        setHistoryList(res.history);
      }
    } catch (err) {
      console.error("Failed to load stress history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleToggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) void loadHistory();
  };

  // Start Stress Test Handler
  const handleStartStress = async () => {
    const cleanOrigin = cleanBaseUrl(targetUrl);
    if (!cleanOrigin) {
      setErrorMessage("Vui lòng nhập URL mục tiêu hợp lệ.");
      return;
    }
    if (isFreeTier) {
      setErrorMessage("Gói FREE không hỗ trợ Stress Test. Vui lòng nâng cấp lên PRO hoặc PRO MAX.");
      return;
    }
    if (!isTargetVerified) {
      setErrorMessage("Mục tiêu chưa được xác minh quyền sở hữu. Vui lòng xác minh tại trang Scan trước.");
      return;
    }

    setErrorMessage(null);
    setIsStarting(true);
    setTelemetryHistory([]);

    try {
      const totalReqs = targetRps * durationSec;
      const res = await createStressJob({
        target_url: cleanOrigin,
        target_requests: totalReqs,
        duration: `${durationSec}s`,
        waf_type: "standard",
      });

      if (res?.job_id) {
        setActiveJobId(res.job_id);
        router.push(`/stress-test?jobId=${res.job_id}&target=${encodeURIComponent(cleanOrigin)}`);
      } else {
        setErrorMessage(res?.message || "Không thể khởi tạo tiến trình kiểm thử.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Lỗi khi gửi yêu cầu bắn tải.");
    } finally {
      setIsStarting(false);
    }
  };

  // Stop Stress Test Handler
  const handleStopStress = async () => {
    if (!activeJobId || isStopping) return;
    setIsStopping(true);
    try {
      await stopStressJob(activeJobId);
    } catch (err: any) {
      console.error("Stop error:", err);
    } finally {
      setIsStopping(false);
    }
  };

  const handleResetNewTest = () => {
    setActiveJobId(null);
    setJobState(null);
    setTelemetryHistory([]);
    router.push("/stress-test");
  };

  // Derive Phase & Progress
  const currentStatus = String(jobState?.status || "QUEUED").toUpperCase();
  const isRunning = currentStatus === "RUNNING" || currentStatus === "QUEUED";
  const isCompleted = currentStatus === "COMPLETED";
  const isCancelled = currentStatus === "CANCELLED";
  const isFailed = currentStatus === "FAILED";

  const currentPhase: StressPhase = useMemo(() => {
    if (jobState?.phase) return jobState.phase as StressPhase;
    if (isCompleted || isCancelled || isFailed) return "COMPLETE";
    if (currentStatus === "QUEUED") return "PREPARE";
    const prog = jobState?.progress || 0;
    if (prog < 15) return "RAMP UP";
    if (prog < 85) return "STEADY LOAD";
    return "COOLDOWN";
  }, [jobState, currentStatus, isCompleted, isCancelled, isFailed]);

  const metrics = jobState?.metrics || {
    total_requests: 0,
    rps: 0,
    avg_latency: "0ms",
    p50_latency: "0ms",
    p95_latency: "0ms",
    p99_latency: "0ms",
    error_rate: 0,
    timeouts: 0,
    status_200: 0,
    status_403_waf_blocked: 0,
    status_429_rate_limited: 0,
    status_500_crashed: 0,
    other_status: 0,
  };

  const stabilityVerdict = jobState?.verdict || (isCompleted ? (Number(metrics.error_rate) === 0 ? "ỔN ĐỊNH" : Number(metrics.error_rate) < 5 ? "CÓ DẤU HIỆU GIẢM HIỆU NĂNG" : "KHÔNG ỔN ĐỊNH") : null);

  return (
    <DashboardShell area="dashboard">
      <div className="mx-auto max-w-6xl space-y-6 text-[#F5F5F5]">
        {/* Top Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#242424] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-white" />
              <h1 className="text-xl font-bold tracking-tight text-white">ADQ STRESS TEST</h1>
              <Badge className="bg-[#111111] text-xs text-neutral-300 border border-[#242424]">
                Layer 7 Load Testing
              </Badge>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Kiểm thử tải Layer 7 có kiểm soát & quan sát tính ổn định hệ thống dưới áp lực lưu lượng.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleHistory}
              className="h-8 border-[#242424] bg-[#0A0A0A] hover:bg-[#151515] text-xs text-neutral-300 gap-1.5"
            >
              <History className="h-3.5 w-3.5" />
              {showHistory ? "Đóng Lịch sử" : "Lịch sử Test"}
            </Button>

            {activeJobId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetNewTest}
                className="h-8 border-[#242424] bg-[#0A0A0A] hover:bg-[#151515] text-xs text-neutral-300 gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Thiết lập Mới
              </Button>
            )}
          </div>
        </div>

        {/* History Drawer */}
        {showHistory && (
          <Card className="border-[#242424] bg-[#0A0A0A]">
            <CardHeader className="pb-3 border-b border-[#242424]">
              <CardTitle className="text-sm font-semibold text-white flex items-center justify-between">
                <span>Lịch Sử Các Phiên Stress Test</span>
                {loadingHistory && <LoaderCircle className="h-4 w-4 animate-spin text-neutral-400" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {historyList.length === 0 ? (
                <p className="text-xs text-neutral-500 py-4 text-center">Chưa có phiên kiểm thử tải nào được lưu.</p>
              ) : (
                <div className="divide-y divide-[#1A1A1A] max-h-60 overflow-y-auto">
                  {historyList.map((item) => (
                    <div
                      key={item.job_id}
                      className="py-2.5 flex items-center justify-between hover:bg-[#0F0F0F] px-2 rounded cursor-pointer transition"
                      onClick={() => {
                        setActiveJobId(item.job_id);
                        setShowHistory(false);
                      }}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-medium text-white truncate">{item.target_url}</p>
                        <p className="text-[11px] text-neutral-500">
                          {item.created_at ? new Date(item.created_at * 1000).toLocaleString("vi-VN") : "Gần đây"} •{" "}
                          {item.duration_sec}s • {item.target_requests} requests
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono text-neutral-300">
                          p95: {item.metrics?.p95_latency || "0ms"}
                        </span>
                        <Badge
                          className={`text-[10px] ${
                            item.status === "COMPLETED"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : item.status === "CANCELLED"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}
                        >
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* FREE Tier Notice */}
        {isFreeTier && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Gói FREE không hỗ trợ tính năng Stress Test</p>
              <p className="mt-1 text-neutral-300">
                Vui lòng nâng cấp lên <strong>PRO</strong> (1 lượt/ngày) hoặc <strong>PRO MAX</strong> (10 lượt/ngày) để thực hiện kiểm thử tải hệ thống.
              </p>
            </div>
          </div>
        )}

        {/* MAIN VIEW: Mission Control or Configuration */}
        {!activeJobId ? (
          /* Pre-Test Configuration Screen */
          <div className="grid gap-6 md:grid-cols-3">
            {/* Target & Authorization Card */}
            <Card className="border-[#242424] bg-[#0A0A0A] md:col-span-2">
              <CardHeader className="pb-3 border-b border-[#242424]">
                <CardTitle className="text-sm font-semibold text-white flex items-center justify-between">
                  <span>Mục Tiêu & Xác Minh Quyền Sở Hữu</span>
                  <Badge className="bg-[#111111] text-[10px] text-neutral-400 border border-[#242424]">
                    Gói {userTier} • Giới hạn {entitlements.stressDailyLimit} lượt/ngày
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-neutral-300">Target URL (Domain hoặc Endpoint)</label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="h-9 font-mono text-xs border-[#242424] bg-[#050505] text-white focus:border-white"
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {isVerifyingTarget ? (
                      <span className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        Đang kiểm tra quyền sở hữu...
                      </span>
                    ) : isTargetVerified === true ? (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                        <ShieldCheck className="h-4 w-4" />
                        Đã xác minh quyền sở hữu hợp lệ
                      </span>
                    ) : isTargetVerified === false ? (
                      <span className="flex items-center gap-1.5 text-xs text-rose-400 font-mono">
                        <ShieldAlert className="h-4 w-4" />
                        Chưa xác minh quyền sở hữu mục tiêu này
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-500">Nhập URL để kiểm tra xác thực quyền sở hữu.</span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#1A1A1A]">
                  <label className="text-xs font-medium text-neutral-300">Đường dẫn Endpoint</label>
                  <Input
                    value={endpointPath}
                    onChange={(e) => setEndpointPath(e.target.value)}
                    placeholder="/"
                    className="mt-1.5 h-9 font-mono text-xs border-[#242424] bg-[#050505] text-white focus:border-white"
                  />
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Mặc định bắn tải vào trang chủ hoặc endpoint API cụ thể (VD: /api/v1/health).
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Load Profile Configuration */}
            <Card className="border-[#242424] bg-[#0A0A0A]">
              <CardHeader className="pb-3 border-b border-[#242424]">
                <CardTitle className="text-sm font-semibold text-white">Cấu Hình Tải (Load Profile)</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-300">Thời gian bắn</span>
                    <span className="font-mono text-white font-semibold">{durationSec} giây</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[15, 30, 60].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setDurationSec(sec)}
                        disabled={userTier === "PRO" && sec > 30}
                        className={`h-8 rounded border text-xs font-mono transition ${
                          durationSec === sec
                            ? "border-white bg-white text-black font-semibold"
                            : "border-[#242424] bg-[#050505] text-neutral-400 hover:text-white"
                        } ${userTier === "PRO" && sec > 30 ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-300">Tốc độ gửi (Target RPS)</span>
                    <span className="font-mono text-white font-semibold">{targetRps} RPS</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[30, 50, 100].map((rps) => (
                      <button
                        key={rps}
                        type="button"
                        onClick={() => setTargetRps(rps)}
                        disabled={userTier === "PRO" && rps > 100}
                        className={`h-8 rounded border text-xs font-mono transition ${
                          targetRps === rps
                            ? "border-white bg-white text-black font-semibold"
                            : "border-[#242424] bg-[#050505] text-neutral-400 hover:text-white"
                        } cursor-pointer`}
                      >
                        {rps} RPS
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1A1A1A] text-xs text-neutral-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Tổng request dự kiến:</span>
                    <span className="font-mono text-white font-semibold">{targetRps * durationSec} reqs</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Concurrency dự kiến:</span>
                    <span className="font-mono text-white font-semibold">{minConcurrency(targetRps)} users</span>
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                    {errorMessage}
                  </div>
                )}

                <Button
                  onClick={handleStartStress}
                  disabled={isStarting || isFreeTier || !isTargetVerified}
                  className="w-full h-10 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow transition cursor-pointer"
                >
                  {isStarting ? (
                    <>
                      <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                      Đang Khởi Tạo...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2 fill-current" />
                      Bắt Đầu Stress Test
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Active / Completed Mission Control Screen */
          <div className="space-y-6">
            {/* 1. Target + Status Top Banner */}
            <div className="rounded-lg border border-[#242424] bg-[#0A0A0A] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400 font-mono">Mục tiêu:</span>
                  <span className="text-sm font-bold font-mono text-white truncate">
                    {jobState?.target_url || targetUrl}
                  </span>
                  <Badge
                    className={`text-[11px] font-mono px-2 py-0.5 ${
                      isRunning
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                        : isCompleted
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : isCancelled
                        ? "bg-neutral-500/10 text-neutral-400 border border-neutral-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {currentStatus === "RUNNING"
                      ? "ĐANG TEST"
                      : currentStatus === "QUEUED"
                      ? "ĐANG CHỜ"
                      : currentStatus === "COMPLETED"
                      ? "HOÀN TẤT"
                      : currentStatus === "CANCELLED"
                      ? "ĐÃ HỦY"
                      : "LỖI"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-neutral-400">
                  Job ID: <span className="font-mono text-neutral-300">{activeJobId}</span> • Cấu hình:{" "}
                  <span className="font-mono text-white font-medium">
                    {jobState?.target_requests || targetRps * durationSec} requests
                  </span>{" "}
                  trong <span className="font-mono text-white font-medium">{jobState?.duration_sec || durationSec}s</span>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isRunning && (
                  <Button
                    onClick={handleStopStress}
                    disabled={isStopping}
                    variant="outline"
                    className="h-9 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold gap-1.5"
                  >
                    {isStopping ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <StopCircle className="h-4 w-4" />
                    )}
                    Dừng Test
                  </Button>
                )}

                {isCompleted && (
                  <Button
                    onClick={() =>
                      router.push(
                        `/copilot?stressJobId=${activeJobId}&target=${encodeURIComponent(
                          jobState?.target_url || targetUrl
                        )}`
                      )
                    }
                    className="h-9 bg-white hover:bg-neutral-200 text-black text-xs font-semibold gap-1.5 shadow"
                  >
                    <Bot className="h-4 w-4" />
                    Phân tích với Copilot
                  </Button>
                )}
              </div>
            </div>

            {/* 2. Top Phase Runner */}
            <div className="rounded-lg border border-[#242424] bg-[#0A0A0A] p-4">
              <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-3">
                Tiến Trình Thực Thi (Phase Runner)
              </div>
              <div className="grid grid-cols-5 gap-2">
                {PHASES.map((p, idx) => {
                  const isCurrent = currentPhase === p.id;
                  const isPast =
                    (currentPhase === "COMPLETE" && isCompleted) ||
                    (p.id === "PREPARE" && currentPhase !== "PREPARE") ||
                    (p.id === "RAMP UP" && ["STEADY LOAD", "COOLDOWN", "COMPLETE"].includes(currentPhase)) ||
                    (p.id === "STEADY LOAD" && ["COOLDOWN", "COMPLETE"].includes(currentPhase)) ||
                    (p.id === "COOLDOWN" && currentPhase === "COMPLETE");

                  return (
                    <div
                      key={p.id}
                      className={`p-2.5 rounded border text-center transition ${
                        isCurrent
                          ? "border-amber-500/50 bg-amber-500/10 text-white"
                          : isPast
                          ? "border-emerald-500/30 bg-emerald-500/5 text-neutral-300"
                          : "border-[#1F1F1F] bg-[#050505] text-neutral-600"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {isCurrent && isRunning ? (
                          <LoaderCircle className="h-3 w-3 animate-spin text-amber-400" />
                        ) : isPast ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <span className="text-[10px] font-mono text-neutral-500">{idx + 1}</span>
                        )}
                        <span className="text-xs font-mono font-bold tracking-tight">{p.name}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-neutral-400">{p.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Live Performance Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-[#242424] bg-[#0A0A0A] p-4">
                <p className="text-[11px] font-mono text-neutral-400 uppercase">Tốc Độ Thực Tế</p>
                <p className="mt-1 text-2xl font-bold font-mono text-white">
                  {metrics.rps || 0}{" "}
                  <span className="text-xs font-normal text-neutral-400">RPS</span>
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500">Mục tiêu: {jobState?.target_rps || targetRps} RPS</p>
              </div>

              <div className="rounded-lg border border-[#242424] bg-[#0A0A0A] p-4">
                <p className="text-[11px] font-mono text-neutral-400 uppercase">p95 Latency</p>
                <p className="mt-1 text-2xl font-bold font-mono text-white">
                  {metrics.p95_latency || "0ms"}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500">p50: {metrics.p50_latency || "0ms"} • p99: {metrics.p99_latency || "0ms"}</p>
              </div>

              <div className="rounded-lg border border-[#242424] bg-[#0A0A0A] p-4">
                <p className="text-[11px] font-mono text-neutral-400 uppercase">Tổng Request Đã Gửi</p>
                <p className="mt-1 text-2xl font-bold font-mono text-white">
                  {(metrics.total_requests || 0).toLocaleString()}{" "}
                  <span className="text-xs font-normal text-neutral-400">
                    / {(jobState?.target_requests || targetRps * durationSec).toLocaleString()}
                  </span>
                </p>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#1F1F1F] overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-300"
                    style={{ width: `${Math.min(100, jobState?.progress || 0)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-[#242424] bg-[#0A0A0A] p-4">
                <p className="text-[11px] font-mono text-neutral-400 uppercase">Error Rate</p>
                <p
                  className={`mt-1 text-2xl font-bold font-mono ${
                    Number(metrics.error_rate || 0) > 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {metrics.error_rate || 0}%
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  Timeouts: {metrics.timeouts || 0} • 5xx: {metrics.status_500_crashed || 0}
                </p>
              </div>
            </div>

            {/* 4. Live Charts & Response Distribution */}
            <div className="grid gap-6 md:grid-cols-3">
              {/* Telemetry Chart */}
              <Card className="border-[#242424] bg-[#0A0A0A] md:col-span-2">
                <CardHeader className="pb-2 border-b border-[#242424] flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-mono font-semibold text-white uppercase">
                    Biểu Đồ Tải & Latency Thời Gian Thực
                  </CardTitle>
                  <span className="text-[10px] font-mono text-neutral-400">Đơn vị: RPS & ms</span>
                </CardHeader>
                <CardContent className="p-4">
                  {telemetryHistory.length < 2 ? (
                    <div className="h-44 flex items-center justify-center text-xs text-neutral-500">
                      {isRunning ? "Đang thu thập telemetry điểm tải..." : "Không có đủ điểm đo telemetry để vẽ biểu đồ."}
                    </div>
                  ) : (
                    <div className="h-44 w-full">
                      {/* Lightweight SVG Telemetry Line Chart */}
                      <svg className="h-full w-full overflow-visible" viewBox="0 0 500 150">
                        {/* Grid lines */}
                        <line x1="0" y1="30" x2="500" y2="30" stroke="#1A1A1A" strokeDasharray="3 3" />
                        <line x1="0" y1="75" x2="500" y2="75" stroke="#1A1A1A" strokeDasharray="3 3" />
                        <line x1="0" y1="120" x2="500" y2="120" stroke="#1A1A1A" strokeDasharray="3 3" />

                        {/* Latency line */}
                        {(() => {
                          const maxLat = Math.max(100, ...telemetryHistory.map((d) => d.latencyMs));
                          const points = telemetryHistory
                            .map((d, i) => {
                              const x = (i / (telemetryHistory.length - 1)) * 500;
                              const y = 140 - (d.latencyMs / maxLat) * 120;
                              return `${x},${y}`;
                            })
                            .join(" ");
                          return (
                            <>
                              <polyline fill="none" stroke="#F5F5F5" strokeWidth="2" points={points} />
                              {telemetryHistory.map((d, i) => {
                                const x = (i / (telemetryHistory.length - 1)) * 500;
                                const y = 140 - (d.latencyMs / maxLat) * 120;
                                return <circle key={i} cx={x} cy={y} r="2.5" fill="#FFFFFF" />;
                              })}
                            </>
                          );
                        })()}
                      </svg>
                      <div className="mt-2 flex justify-between text-[10px] font-mono text-neutral-500">
                        <span>Bắt đầu</span>
                        <span>Điểm đo gần nhất: {metrics.p95_latency || "0ms"} (p95)</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Response Code Distribution */}
              <Card className="border-[#242424] bg-[#0A0A0A]">
                <CardHeader className="pb-2 border-b border-[#242424]">
                  <CardTitle className="text-xs font-mono font-semibold text-white uppercase">
                    Phân Phối Mã Trạng Thái HTTP
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-neutral-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      2xx Thành công
                    </span>
                    <span className="font-mono text-white font-bold">{metrics.status_200 || 0}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-neutral-300">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      403 WAF Block
                    </span>
                    <span className="font-mono text-white font-bold">{metrics.status_403_waf_blocked || 0}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-neutral-300">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      429 Rate Limit
                    </span>
                    <span className="font-mono text-white font-bold">{metrics.status_429_rate_limited || 0}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-neutral-300">
                      <span className="h-2 w-2 rounded-full bg-rose-400" />
                      5xx Server Error
                    </span>
                    <span className="font-mono text-white font-bold">{metrics.status_500_crashed || 0}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-neutral-300">
                      <span className="h-2 w-2 rounded-full bg-rose-400" />
                      Timeouts
                    </span>
                    <span className="font-mono text-white font-bold">{metrics.timeouts || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 5. Completion Verdict Summary */}
            {isCompleted && (
              <Card className="border-[#242424] bg-[#0A0A0A]">
                <CardHeader className="pb-3 border-b border-[#242424]">
                  <CardTitle className="text-sm font-semibold text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Kết Luận Đánh Giá Hiệu Năng
                    </span>
                    {stabilityVerdict && (
                      <Badge
                        className={`text-xs font-mono font-bold px-3 py-1 ${
                          stabilityVerdict === "ỔN ĐỊNH"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : stabilityVerdict === "CÓ DẤU HIỆU GIẢM HIỆU NĂNG"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {stabilityVerdict}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 text-xs text-neutral-300 leading-relaxed space-y-3">
                  <p>
                    Trong profile test với{" "}
                    <strong className="text-white font-mono">{metrics.total_requests} requests</strong> (tốc độ đạt{" "}
                    <strong className="text-white font-mono">{metrics.rps} RPS</strong>), hệ thống ghi nhận latency p95
                    đạt <strong className="text-white font-mono">{metrics.p95_latency}</strong> và tỷ lệ lỗi là{" "}
                    <strong className="text-white font-mono">{metrics.error_rate}%</strong>.
                  </p>
                  <div className="p-3 rounded bg-[#050505] border border-[#1F1F1F] text-[11px] text-neutral-400 flex items-center justify-between">
                    <span>Cần phân tích sâu nguyên nhân tăng latency hoặc tối ưu cấu hình?</span>
                    <Button
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/copilot?stressJobId=${activeJobId}&target=${encodeURIComponent(
                            jobState?.target_url || targetUrl
                          )}`
                        )
                      }
                      className="h-7 bg-white hover:bg-neutral-200 text-black font-semibold text-xs px-3"
                    >
                      Hỏi Trợ lý Copilot
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function minConcurrency(rps: number): number {
  return Math.min(50, Math.max(5, Math.floor(rps * 0.3)));
}

export default function StressTestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <StressTestContent />
    </Suspense>
  );
}
