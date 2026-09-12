"use client";

import React, { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ProjectWorkspaceShell } from "@/components/project-workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Globe,
  History,
  KeyRound,
  LoaderCircle,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  StopCircle,
  Target,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { getEntitlements } from "@/lib/entitlements";
import {
  createStressJob,
  getStressJob,
  stopStressJob,
  getStressHistory,
  getStressEndpoints,
  verifyBypass,
  streamStressJob,
  getVerificationStatus,
  getProjectById,
  StressJobState,
} from "@/lib/api";

type StressPhase = "PREPARE" | "RAMP UP" | "STEADY LOAD" | "COOLDOWN" | "COMPLETE";

const PHASES: Array<{ id: StressPhase; name: string; desc: string }> = [
  { id: "PREPARE", name: "PREPARE", desc: "Chuẩn bị & Kết nối" },
  { id: "RAMP UP", name: "RAMP UP", desc: "Tăng tải ban đầu" },
  { id: "STEADY LOAD", name: "STEADY LOAD", desc: "Duy trì tải mục tiêu" },
  { id: "COOLDOWN", name: "COOLDOWN", desc: "Giảm tải & Hoàn tất" },
  { id: "COMPLETE", name: "COMPLETE", desc: "Báo cáo tổng kết" },
];

function cleanBaseUrl(raw: string): string {
  let cleaned = (raw || "").trim();
  if (!cleaned) return "";
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned.replace(/\/+$/, "");
}

function minConcurrency(rps: number): number {
  return Math.min(100, Math.max(5, Math.floor(rps * 0.4)));
}

function StressTestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialJobId = searchParams?.get("jobId");
  const initialTarget = searchParams?.get("target") || "";
  const projectId = searchParams?.get("projectId") || null;

  const { user } = useAuth();
  const userTier = user?.packageTier || "FREE";
  const entitlements = getEntitlements(userTier);
  const isFreeTier = userTier === "FREE" || entitlements.stressDailyLimit === 0;

  // Maximum scalable allowed limits by tier
  const maxRequestsAllowed = userTier === "PRO_MAX" ? 25000 : userTier === "PRO" ? 5000 : 0;
  const maxRpsAllowed = userTier === "PRO_MAX" ? 300 : userTier === "PRO" ? 150 : 0;

  // Form Configuration State
  const [targetUrl, setTargetUrl] = useState(initialTarget || "https://");
  const [endpointPath, setEndpointPath] = useState("/");
  const [totalRequests, setTotalRequests] = useState<number>(userTier === "PRO_MAX" ? 450 : 300);
  const [targetRps, setTargetRps] = useState<number>(30);

  // Derived nominal duration
  const nominalDurationSec = useMemo(() => {
    return Math.max(1, Math.ceil(totalRequests / Math.max(1, targetRps)));
  }, [totalRequests, targetRps]);

  // Endpoint Discovery State
  const [discoveredEndpoints, setDiscoveredEndpoints] = useState<
    Array<{ path: string; status?: number; title?: string; source?: string }>
  >([]);
  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState(false);
  const [endpointDiscoveryAttempted, setEndpointDiscoveryAttempted] = useState(false);

  // Authorized Test Credential State
  const [bypassCode, setBypassCode] = useState("");
  const [wafType, setWafType] = useState("standard");
  const [isVerifyingBypass, setIsVerifyingBypass] = useState(false);
  const [bypassVerifyResult, setBypassVerifyResult] = useState<{
    ok: boolean;
    is_valid: boolean;
    status_no_bypass: number;
    status_with_bypass: number;
    message: string;
  } | null>(null);

  // Target Verification State
  const [isVerifyingTarget, setIsVerifyingTarget] = useState(false);
  const [isTargetVerified, setIsTargetVerified] = useState<boolean | null>(null);

  // Active Job & Telemetry State
  const [activeJobId, setActiveJobId] = useState<string | null>(initialJobId);
  const [jobState, setJobState] = useState<StressJobState | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Real-time chart telemetry history (Dual-series: RPS & Latency)
  const [telemetryHistory, setTelemetryHistory] = useState<
    Array<{ time: string; rps: number; latencyMs: number; errorRate: number }>
  >([]);

  // History Tab State
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<StressJobState[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Hydrate target from project if not set in query
  useEffect(() => {
    if (!projectId || initialTarget) return;
    getProjectById(projectId)
      .then((proj) => {
        const rawTarget = proj?.projectDetail?.summary?.domain || proj?.domain || "";
        if (rawTarget) {
          const cleaned = cleanBaseUrl(rawTarget);
          setTargetUrl(cleaned);
        }
      })
      .catch(() => {});
  }, [projectId, initialTarget]);

  // Target scoped reset: clear endpoints and credentials when target changes
  const handleTargetUrlChange = (newUrl: string) => {
    setTargetUrl(newUrl);
    setDiscoveredEndpoints([]);
    setEndpointDiscoveryAttempted(false);
    setBypassCode("");
    setBypassVerifyResult(null);
  };

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
        const res = await getVerificationStatus(cleaned);
        if (active) {
          setIsTargetVerified(Boolean(res?.verified));
        }
      } catch {
        if (active) setIsTargetVerified(false);
      } finally {
        if (active) setIsVerifyingTarget(false);
      }
    };

    const timer = setTimeout(checkTarget, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [targetUrl]);

  // Load initial or restored Job State and Stream Continuous SSE Events
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
          if (snapshot.endpoint) setEndpointPath(snapshot.endpoint);

          // Seed initial chart point if metrics present
          if (snapshot.metrics) {
            const initialLat = parseInt(String(snapshot.metrics.p95_latency || snapshot.metrics.avg_latency || 0), 10) || 0;
            const nowTime = new Date().toLocaleTimeString("vi-VN", { hour12: false });
            setTelemetryHistory((prev) => {
              if (prev.length > 0) return prev;
              return [{
                time: nowTime,
                rps: Number(snapshot.metrics?.rps || 0),
                latencyMs: initialLat,
                errorRate: Number(snapshot.metrics?.error_rate || 0),
              }];
            });
          }
        }
      } catch (err: any) {
        console.error("Failed to fetch stress snapshot:", err);
      }
    };

    fetchSnapshot();

    // Stream SSE events continuously
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
              ...hist.slice(-60),
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
    ).catch((err) => {
      console.warn("Stress stream connection notice:", err);
    });

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

  // Discover Endpoints Handler
  const handleDiscoverEndpoints = async () => {
    const cleanOrigin = cleanBaseUrl(targetUrl);
    if (!cleanOrigin) return;
    setIsLoadingEndpoints(true);
    setEndpointDiscoveryAttempted(true);
    try {
      const res = await getStressEndpoints(cleanOrigin);
      if (res?.endpoints && Array.isArray(res.endpoints)) {
        setDiscoveredEndpoints(res.endpoints);
      } else {
        setDiscoveredEndpoints([]);
      }
    } catch (err: any) {
      console.error("Discover endpoints error:", err);
      setDiscoveredEndpoints([]);
    } finally {
      setIsLoadingEndpoints(false);
    }
  };

  // Verify Bypass / Authorized Credential Handler
  const handleVerifyBypass = async () => {
    const cleanOrigin = cleanBaseUrl(targetUrl);
    if (!cleanOrigin || !bypassCode.trim()) return;
    setIsVerifyingBypass(true);
    setBypassVerifyResult(null);
    try {
      const res = await verifyBypass({
        target_url: cleanOrigin,
        bypass_code: bypassCode.trim(),
        waf_type: wafType,
      });
      setBypassVerifyResult(res);
    } catch (err: any) {
      setBypassVerifyResult({
        ok: false,
        is_valid: false,
        status_no_bypass: 0,
        status_with_bypass: 0,
        message: err?.message || "Lỗi kiểm tra credential.",
      });
    } finally {
      setIsVerifyingBypass(false);
    }
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

    if (totalRequests <= 0 || totalRequests > maxRequestsAllowed) {
      setErrorMessage(`Số lượng request phải từ 1 đến ${maxRequestsAllowed} cho gói ${userTier}.`);
      return;
    }

    if (targetRps <= 0 || targetRps > maxRpsAllowed) {
      setErrorMessage(`Target RPS phải từ 1 đến ${maxRpsAllowed} RPS cho gói ${userTier}.`);
      return;
    }

    setErrorMessage(null);
    setIsStarting(true);
    setTelemetryHistory([]);

    try {
      const formattedEndpoint = endpointPath.trim().startsWith("/") ? endpointPath.trim() : `/${endpointPath.trim()}`;
      const res = await createStressJob({
        target_url: cleanOrigin,
        endpoint: formattedEndpoint,
        target_requests: totalRequests,
        duration: `${nominalDurationSec}s`,
        waf_type: wafType,
        bypass_code: bypassCode.trim(),
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
    setErrorMessage(null);
    router.push("/stress-test");
  };

  // Derive Phase & Progress
  const currentStatus = String(jobState?.status || "QUEUED").toUpperCase();
  const isRunning = currentStatus === "RUNNING" || currentStatus === "QUEUED";
  const isCompleted = currentStatus === "COMPLETED";
  const isCancelled = currentStatus === "CANCELLED";
  const isFailed = currentStatus === "FAILED";

  const configuredTarget = jobState?.configured_requests || jobState?.target_requests || totalRequests;
  const currentMetrics = jobState?.metrics || {
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

  const currentPhase: StressPhase = useMemo(() => {
    if (jobState?.phase) return jobState.phase as StressPhase;
    if (isCompleted || isCancelled || isFailed) return "COMPLETE";
    if (currentStatus === "QUEUED") return "PREPARE";
    const attempts = currentMetrics.total_requests || 0;
    const prog = (attempts / Math.max(1, configuredTarget)) * 100;
    if (attempts === 0) return "PREPARE";
    if (prog < 15) return "RAMP UP";
    if (prog < 85) return "STEADY LOAD";
    if (prog < 100) return "COOLDOWN";
    return "COMPLETE";
  }, [jobState, currentStatus, isCompleted, isCancelled, isFailed, currentMetrics.total_requests, configuredTarget]);

  const stabilityVerdict = jobState?.verdict || (isCompleted ? (Number(currentMetrics.error_rate) === 0 ? "ỔN ĐỊNH" : Number(currentMetrics.error_rate) < 5 ? "CÓ DẤU HIỆU GIẢM HIỆU NĂNG" : "KHÔNG ỔN ĐỊNH") : null);

  const fullTargetDisplay = useMemo(() => {
    const origin = cleanBaseUrl(jobState?.target_url || targetUrl);
    const ep = (jobState?.endpoint || endpointPath).trim();
    const formattedEp = ep.startsWith("/") ? ep : `/${ep}`;
    return formattedEp === "/" ? origin : `${origin}${formattedEp}`;
  }, [jobState?.target_url, targetUrl, jobState?.endpoint, endpointPath]);

  // Scalable request presets
  const requestPresets = userTier === "PRO_MAX"
    ? [450, 1000, 5000, 10000, 25000]
    : [300, 1000, 2500, 5000];

  const rpsPresets = userTier === "PRO_MAX"
    ? [30, 50, 100, 200, 300]
    : [30, 50, 100, 150];

  return (
    <ProjectWorkspaceShell
      activeTab="stress"
      targetUrlOverride={cleanBaseUrl(targetUrl)}
      isVerifiedOverride={isTargetVerified === true}
    >
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
              Kiểm thử tải Layer 7 theo số lượng request cố định (Fixed Request Count) & quan sát độ ổn định hệ thống thời gian thực.
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
                <span>Lịch Sử Các Phiên Stress Test (Durable PostgreSQL History)</span>
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
                        <p className="text-xs font-mono font-medium text-white truncate">
                          {item.full_target_url || `${item.target_url || ""}${item.endpoint || ""}` || item.target_url}
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          {item.created_at ? new Date(item.created_at * 1000).toLocaleString("vi-VN") : "Gần đây"} •{" "}
                          Đã gửi: {item.metrics?.total_requests || item.attempted_requests || 0} / {item.configured_requests || item.target_requests} reqs •{" "}
                          RPS: {item.metrics?.rps || item.target_rps || 0} • {item.actual_duration_sec ? `${item.actual_duration_sec}s` : `${item.duration_sec}s`}
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
            {/* Target & Endpoint Selection Card */}
            <Card className="border-[#242424] bg-[#0A0A0A] md:col-span-2 space-y-4">
              <CardHeader className="pb-3 border-b border-[#242424]">
                <CardTitle className="text-sm font-semibold text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-white" />
                    Mục Tiêu & Điểm Bắn Tải (Target & Endpoint)
                  </span>
                  <Badge className="bg-[#111111] text-[10px] text-neutral-400 border border-[#242424]">
                    Gói {userTier} • Giới hạn {entitlements.stressDailyLimit} lượt/ngày
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-5">
                {/* Domain / Target URL */}
                <div>
                  <label className="text-xs font-medium text-neutral-300">Target URL (Origin Domain)</label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      value={targetUrl}
                      onChange={(e) => handleTargetUrlChange(e.target.value)}
                      placeholder="https://example.com"
                      className="h-9 font-mono text-xs border-[#242424] bg-[#050505] text-white focus:border-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isLoadingEndpoints || !targetUrl}
                      onClick={handleDiscoverEndpoints}
                      className="h-9 border-[#242424] bg-[#111111] hover:bg-[#1A1A1A] text-xs text-neutral-200 shrink-0 gap-1.5"
                    >
                      {isLoadingEndpoints ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Globe className="h-3.5 w-3.5" />
                      )}
                      Khám phá Endpoints
                    </Button>
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
                        Đã xác minh quyền sở hữu hợp lệ (Ownership Verified)
                      </span>
                    ) : isTargetVerified === false ? (
                      <span className="flex items-center gap-1.5 text-xs text-rose-400 font-mono">
                        <ShieldAlert className="h-4 w-4" />
                        Chưa xác minh quyền sở hữu mục tiêu này (yêu cầu thẻ meta trên trang Scan)
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-500">Nhập URL để kiểm tra xác thực quyền sở hữu.</span>
                    )}
                  </div>
                </div>

                {/* Discovered Endpoints List / Selector */}
                {discoveredEndpoints.length > 0 ? (
                  <div className="rounded-lg border border-[#242424] bg-[#050505] p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-300">
                        Endpoints Đã Phát Hiện ({discoveredEndpoints.length})
                      </span>
                      <button
                        type="button"
                        onClick={handleDiscoverEndpoints}
                        className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 font-mono cursor-pointer"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Làm mới
                      </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto divide-y divide-[#1A1A1A]">
                      {discoveredEndpoints.map((ep, idx) => (
                        <div
                          key={idx}
                          onClick={() => setEndpointPath(ep.path)}
                          className={`py-1.5 px-2 flex items-center justify-between text-xs font-mono rounded cursor-pointer transition ${
                            endpointPath === ep.path
                              ? "bg-white/10 text-white font-semibold border border-white/20"
                              : "text-neutral-400 hover:bg-[#111111] hover:text-white"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-[#151515] text-neutral-300 border border-[#2A2A2A]">
                              GET
                            </span>
                            <span className="truncate">{ep.path}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {ep.status && (
                              <Badge className="text-[9px] bg-neutral-900 border-[#2A2A2A] text-neutral-300">
                                HTTP {ep.status}
                              </Badge>
                            )}
                            {ep.source && (
                              <span className="text-[9px] text-neutral-500 uppercase">{ep.source}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : endpointDiscoveryAttempted && !isLoadingEndpoints ? (
                  <div className="p-3 rounded border border-[#242424] bg-[#050505] text-xs text-neutral-400 flex items-center justify-between">
                    <span>Không tìm thấy endpoint tự động qua crawl. Anh có thể nhập path thủ công bên dưới.</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDiscoverEndpoints}
                      className="h-7 border-[#242424] bg-[#111111] hover:bg-[#1A1A1A] text-[11px] text-neutral-300 shrink-0"
                    >
                      Thử lại
                    </Button>
                  </div>
                ) : null}

                {/* Endpoint Path Input */}
                <div className="pt-2 border-t border-[#1A1A1A]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-neutral-300">Đường dẫn Endpoint Mục Tiêu (Path Fallback)</label>
                    <span className="text-[11px] font-mono text-neutral-500">
                      Mục tiêu hoàn chỉnh: <strong className="text-neutral-300">{fullTargetDisplay}</strong>
                    </span>
                  </div>
                  <Input
                    value={endpointPath}
                    onChange={(e) => setEndpointPath(e.target.value)}
                    placeholder="/"
                    className="mt-1.5 h-9 font-mono text-xs border-[#242424] bg-[#050505] text-white focus:border-white"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["/", "/robots.txt", "/api/health", "/api/v1/status", "/login", "/search"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setEndpointPath(p)}
                        className={`text-[11px] font-mono px-2 py-0.5 rounded border transition ${
                          endpointPath === p
                            ? "border-white bg-white text-black font-semibold"
                            : "border-[#242424] bg-[#0A0A0A] text-neutral-400 hover:text-white"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Authorized Test Credential Card (Bypass Verification) */}
            <Card className="border-[#242424] bg-[#0A0A0A] md:col-span-2">
              <CardHeader className="pb-3 border-b border-[#242424]">
                <CardTitle className="text-sm font-semibold text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-white" />
                    Authorized Test Credential (Quyền Kiểm Thử Phê Duyệt)
                  </span>
                  <Badge className="bg-[#111111] text-[10px] text-neutral-400 border border-[#242424]">
                    Tùy chọn (Optional cho WAF / Bot Guard)
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-neutral-300">Loại WAF / Cơ Chế Xác Thực</label>
                    <select
                      value={wafType}
                      onChange={(e) => setWafType(e.target.value)}
                      className="mt-1.5 w-full h-9 rounded-md border border-[#242424] bg-[#050505] px-3 text-xs text-white focus:border-white focus:outline-none font-mono"
                    >
                      <option value="standard">Standard Web Server / Reverse Proxy</option>
                      <option value="vercel">Vercel Deployment Protection Bypass</option>
                      <option value="cloudflare">Cloudflare Clearance / Custom Token</option>
                      <option value="custom_bearer">Custom Bearer / JWT Token</option>
                      <option value="header_cookie">Custom Header / Cookie Pair</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-300">Mã Token / Bypass Credential</label>
                    <div className="mt-1.5 flex gap-2">
                      <Input
                        type="password"
                        value={bypassCode}
                        onChange={(e) => {
                          setBypassCode(e.target.value);
                          setBypassVerifyResult(null);
                        }}
                        placeholder="Nhập secret token, header hoặc pass..."
                        className="h-9 font-mono text-xs border-[#242424] bg-[#050505] text-white focus:border-white"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isVerifyingBypass || !bypassCode.trim()}
                        onClick={handleVerifyBypass}
                        className="h-9 border-[#242424] bg-[#111111] hover:bg-[#1A1A1A] text-xs text-neutral-200 shrink-0 gap-1.5"
                      >
                        {isVerifyingBypass ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5" />
                        )}
                        Xác minh
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Bypass Verification Feedback Badge */}
                {bypassVerifyResult && (
                  <div
                    className={`p-3 rounded border text-xs flex items-start gap-2.5 ${
                      bypassVerifyResult.is_valid
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                    }`}
                  >
                    {bypassVerifyResult.is_valid ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <div className="font-semibold flex items-center gap-2">
                        <span>{bypassVerifyResult.is_valid ? "Credential Hợp Lệ" : "Credential Không Khả Dụng"}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-current">
                          HTTP {bypassVerifyResult.status_with_bypass}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-90">{bypassVerifyResult.message}</p>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Bảo mật: Credential chỉ được truyền an toàn trong phiên thực thi để điều phối bypass WAF có thẩm quyền và tuyệt đối không bao giờ được lưu trữ plain-text hay xuất hiện trong lịch sử/public API.
                </p>
              </CardContent>
            </Card>

            {/* Scalable Load Profile Configuration */}
            <Card className="border-[#242424] bg-[#0A0A0A]">
              <CardHeader className="pb-3 border-b border-[#242424]">
                <CardTitle className="text-sm font-semibold text-white flex items-center justify-between">
                  <span>Cấu Hình Tải Mở Rộng</span>
                  <Badge className="bg-[#111111] text-[10px] text-neutral-400 border border-[#242424]">
                    Max {maxRequestsAllowed.toLocaleString()} reqs • {maxRpsAllowed} RPS
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {/* Total Requests (Authoritative Hard Target) */}
                <div>
                  <div className="flex justify-between text-xs items-center">
                    <span className="text-neutral-300 font-medium">Tổng request mục tiêu</span>
                    <span className="font-mono text-white font-bold">{totalRequests.toLocaleString()} reqs</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {requestPresets.map((reqs) => (
                      <button
                        key={reqs}
                        type="button"
                        onClick={() => setTotalRequests(reqs)}
                        disabled={reqs > maxRequestsAllowed}
                        className={`h-7 px-2.5 rounded border text-xs font-mono transition ${
                          totalRequests === reqs
                            ? "border-white bg-white text-black font-semibold"
                            : "border-[#242424] bg-[#050505] text-neutral-400 hover:text-white"
                        } ${reqs > maxRequestsAllowed ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {reqs >= 1000 ? `${reqs / 1000}k` : reqs}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={maxRequestsAllowed}
                    value={totalRequests}
                    onChange={(e) => setTotalRequests(Math.min(maxRequestsAllowed, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                    className="mt-2 h-8 font-mono text-xs border-[#242424] bg-[#050505] text-white focus:border-white"
                    placeholder={`Nhập số request (tối đa ${maxRequestsAllowed})`}
                  />
                </div>

                {/* Target RPS (Pacing Target) */}
                <div>
                  <div className="flex justify-between text-xs items-center">
                    <span className="text-neutral-300 font-medium">Target RPS (Tốc độ pacing)</span>
                    <span className="font-mono text-white font-bold">{targetRps} RPS</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {rpsPresets.map((rps) => (
                      <button
                        key={rps}
                        type="button"
                        onClick={() => setTargetRps(rps)}
                        disabled={rps > maxRpsAllowed}
                        className={`h-7 px-2.5 rounded border text-xs font-mono transition ${
                          targetRps === rps
                            ? "border-white bg-white text-black font-semibold"
                            : "border-[#242424] bg-[#050505] text-neutral-400 hover:text-white"
                        } ${rps > maxRpsAllowed ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {rps} RPS
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={maxRpsAllowed}
                    value={targetRps}
                    onChange={(e) => setTargetRps(Math.min(maxRpsAllowed, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                    className="mt-2 h-8 font-mono text-xs border-[#242424] bg-[#050505] text-white focus:border-white"
                    placeholder={`Nhập RPS (tối đa ${maxRpsAllowed})`}
                  />
                </div>

                {/* Estimated Nominal Duration Display */}
                <div className="pt-3 border-t border-[#1A1A1A] text-xs text-neutral-400 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span>Duration dự kiến:</span>
                    <span className="font-mono text-white font-semibold">~{nominalDurationSec} giây (~{nominalDurationSec}s)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Concurrency tối đa:</span>
                    <span className="font-mono text-white font-semibold">{minConcurrency(targetRps)} workers</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 pt-1">
                    * Engine đảm bảo phân phối đủ <strong>{totalRequests.toLocaleString()} requests</strong> mục tiêu.
                  </p>
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
                      Bắt Đầu Stress Test ({totalRequests.toLocaleString()} reqs)
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-neutral-400 font-mono">Mục tiêu:</span>
                  <span className="text-sm font-bold font-mono text-white truncate">
                    {fullTargetDisplay}
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
                      ? "ĐANG TEST (LIVE)"
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
                  Job ID: <span className="font-mono text-neutral-300">{activeJobId}</span> • Mục tiêu:{" "}
                  <span className="font-mono text-white font-medium">
                    {configuredTarget.toLocaleString()} requests
                  </span>{" "}
                  với Target RPS: <span className="font-mono text-white font-medium">{jobState?.target_rps || targetRps}</span> (Dự kiến: ~{jobState?.nominal_duration_sec || nominalDurationSec}s)
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
                <p className="text-[11px] font-mono text-neutral-400 uppercase">RPS Thực Tế Trung Bình</p>
                <p className="mt-1 text-2xl font-bold font-mono text-white">
                  {currentMetrics.rps || 0}{" "}
                  <span className="text-xs font-normal text-neutral-400">RPS</span>
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500">Target RPS: {jobState?.target_rps || targetRps} RPS</p>
              </div>

              <div className="rounded-lg border border-[#242424] bg-[#0A0A0A] p-4">
                <p className="text-[11px] font-mono text-neutral-400 uppercase">p95 Latency</p>
                <p className="mt-1 text-2xl font-bold font-mono text-white">
                  {currentMetrics.p95_latency || "0ms"}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500">p50: {currentMetrics.p50_latency || "0ms"} • p99: {currentMetrics.p99_latency || "0ms"}</p>
              </div>

              <div className="rounded-lg border border-[#242424] bg-[#0A0A0A] p-4">
                <p className="text-[11px] font-mono text-neutral-400 uppercase">Tổng Request Đã Gửi</p>
                <p className="mt-1 text-2xl font-bold font-mono text-white">
                  {(currentMetrics.total_requests || 0).toLocaleString()}{" "}
                  <span className="text-xs font-normal text-neutral-400">
                    / {configuredTarget.toLocaleString()}
                  </span>
                </p>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#1F1F1F] overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-300"
                    style={{ width: `${Math.min(100, ((currentMetrics.total_requests || 0) / Math.max(1, configuredTarget)) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-[#242424] bg-[#0A0A0A] p-4">
                <p className="text-[11px] font-mono text-neutral-400 uppercase">Tỷ Lệ Lỗi (Error Rate)</p>
                <p
                  className={`mt-1 text-2xl font-bold font-mono ${
                    Number(currentMetrics.error_rate || 0) > 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {currentMetrics.error_rate || 0}%
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  Timeouts: {currentMetrics.timeouts || 0} • 5xx: {currentMetrics.status_500_crashed || 0}
                </p>
              </div>
            </div>

            {/* 4. Live Charts & Response Distribution */}
            <div className="grid gap-6 md:grid-cols-3">
              {/* Dual-Series Real-Time Telemetry Chart (RPS & Latency) */}
              <Card className="border-[#242424] bg-[#0A0A0A] md:col-span-2">
                <CardHeader className="pb-2 border-b border-[#242424] flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-mono font-semibold text-white uppercase flex items-center gap-2">
                    <span>Biểu Đồ Tải & Latency Thời Gian Thực</span>
                    {isRunning && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />}
                  </CardTitle>
                  <div className="flex items-center gap-3 text-[10px] font-mono">
                    <span className="flex items-center gap-1 text-neutral-300">
                      <span className="h-2 w-2 rounded-full bg-white" />
                      RPS ({currentMetrics.rps || 0})
                    </span>
                    <span className="flex items-center gap-1 text-purple-400">
                      <span className="h-2 w-2 rounded-full bg-purple-400" />
                      p95 ({currentMetrics.p95_latency || "0ms"})
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {telemetryHistory.length === 0 ? (
                    <div className="h-44 flex items-center justify-center text-xs text-neutral-500">
                      {isRunning ? "Đang thu thập telemetry điểm tải trực tiếp..." : "Chưa có dữ liệu telemetry."}
                    </div>
                  ) : (
                    <div className="h-44 w-full relative">
                      {/* Real-time Dual SVG Line Chart */}
                      {(() => {
                        const rpsVals = telemetryHistory.map((d) => d.rps);
                        const latVals = telemetryHistory.map((d) => d.latencyMs);
                        const maxRPS = Math.max(10, Math.ceil(Math.max(...rpsVals, 1) * 1.2));
                        const maxLat = Math.max(50, Math.ceil(Math.max(...latVals, 1) * 1.2));
                        const n = telemetryHistory.length;

                        const rpsPoints = telemetryHistory
                          .map((d, i) => {
                            const x = n > 1 ? (i / (n - 1)) * 460 + 20 : 250;
                            const y = 135 - (d.rps / maxRPS) * 115;
                            return `${x},${y}`;
                          })
                          .join(" ");

                        const latPoints = telemetryHistory
                          .map((d, i) => {
                            const x = n > 1 ? (i / (n - 1)) * 460 + 20 : 250;
                            const y = 135 - (d.latencyMs / maxLat) * 115;
                            return `${x},${y}`;
                          })
                          .join(" ");

                        return (
                          <svg className="h-full w-full overflow-visible" viewBox="0 0 500 150">
                            {/* Horizontal Grid lines */}
                            <line x1="20" y1="20" x2="480" y2="20" stroke="#1A1A1A" strokeDasharray="3 3" />
                            <line x1="20" y1="75" x2="480" y2="75" stroke="#1A1A1A" strokeDasharray="3 3" />
                            <line x1="20" y1="135" x2="480" y2="135" stroke="#1A1A1A" />

                            {/* Left Y-Axis Scale (RPS) */}
                            <text x="5" y="24" fill="#A3A3A3" fontSize="9" fontFamily="monospace">{maxRPS}</text>
                            <text x="5" y="79" fill="#737373" fontSize="9" fontFamily="monospace">{Math.round(maxRPS / 2)}</text>
                            <text x="5" y="138" fill="#525252" fontSize="9" fontFamily="monospace">0</text>

                            {/* Right Y-Axis Scale (Latency ms) */}
                            <text x="485" y="24" fill="#C084FC" fontSize="9" fontFamily="monospace">{maxLat}ms</text>
                            <text x="485" y="79" fill="#9333EA" fontSize="9" fontFamily="monospace">{Math.round(maxLat / 2)}ms</text>
                            <text x="485" y="138" fill="#6B21A8" fontSize="9" fontFamily="monospace">0ms</text>

                            {/* RPS Line (White/Cyan) */}
                            {n > 1 && (
                              <polyline fill="none" stroke="#FFFFFF" strokeWidth="2.5" points={rpsPoints} />
                            )}
                            {telemetryHistory.map((d, i) => {
                              const x = n > 1 ? (i / (n - 1)) * 460 + 20 : 250;
                              const y = 135 - (d.rps / maxRPS) * 115;
                              return <circle key={`rps-${i}`} cx={x} cy={y} r="2.5" fill="#FFFFFF" />;
                            })}

                            {/* Latency Line (Purple) */}
                            {n > 1 && (
                              <polyline fill="none" stroke="#C084FC" strokeWidth="2" strokeDasharray="2 1" points={latPoints} />
                            )}
                            {telemetryHistory.map((d, i) => {
                              const x = n > 1 ? (i / (n - 1)) * 460 + 20 : 250;
                              const y = 135 - (d.latencyMs / maxLat) * 115;
                              return <circle key={`lat-${i}`} cx={x} cy={y} r="2" fill="#C084FC" />;
                            })}
                          </svg>
                        );
                      })()}
                      <div className="mt-2 flex justify-between text-[10px] font-mono text-neutral-500">
                        <span>Bắt đầu: {telemetryHistory[0]?.time || "--:--:--"}</span>
                        <span>Mẫu đo: {telemetryHistory.length} điểm • Mới nhất: {telemetryHistory[telemetryHistory.length - 1]?.time || "--:--:--"}</span>
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
                    <span className="font-mono text-white font-bold">{currentMetrics.status_200 || 0}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-neutral-300">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      403 WAF Block
                    </span>
                    <span className="font-mono text-white font-bold">{currentMetrics.status_403_waf_blocked || 0}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-neutral-300">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      429 Rate Limit
                    </span>
                    <span className="font-mono text-white font-bold">{currentMetrics.status_429_rate_limited || 0}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-neutral-300">
                      <span className="h-2 w-2 rounded-full bg-rose-400" />
                      5xx Server Error
                    </span>
                    <span className="font-mono text-white font-bold">{currentMetrics.status_500_crashed || 0}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-neutral-300">
                      <span className="h-2 w-2 rounded-full bg-rose-400" />
                      Timeouts
                    </span>
                    <span className="font-mono text-white font-bold">{currentMetrics.timeouts || 0}</span>
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
                      Báo Cáo Tổng Kết Phiên Kiểm Thử Tải (Load Profile Summary)
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
                <CardContent className="p-5 text-xs text-neutral-300 leading-relaxed space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded bg-[#050505] border border-[#1F1F1F]">
                    <div>
                      <span className="text-[10px] text-neutral-500 uppercase font-mono block">Tổng Request Mục Tiêu</span>
                      <span className="text-sm font-mono font-bold text-white">{configuredTarget.toLocaleString()} reqs</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-500 uppercase font-mono block">Đã Gửi Thực Tế</span>
                      <span className="text-sm font-mono font-bold text-emerald-400">
                        {(currentMetrics.total_requests || 0).toLocaleString()} / {configuredTarget.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-500 uppercase font-mono block">Thời Gian Thực Tế</span>
                      <span className="text-sm font-mono font-bold text-white">
                        {jobState?.actual_duration_sec ? `${jobState.actual_duration_sec}s` : `~${nominalDurationSec}s`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-500 uppercase font-mono block">Lý Do Hoàn Tất</span>
                      <span className="text-xs font-mono font-bold text-neutral-200">
                        {jobState?.completion_reason || "TARGET_REQUESTS_REACHED"}
                      </span>
                    </div>
                  </div>

                  <p>
                    Hệ thống đã phân phối đầy đủ{" "}
                    <strong className="text-white font-mono">{(currentMetrics.total_requests || 0).toLocaleString()} requests</strong> đến endpoint{" "}
                    <strong className="text-white font-mono">{jobState?.endpoint || endpointPath}</strong> với tốc độ trung bình đạt{" "}
                    <strong className="text-white font-mono">{currentMetrics.rps} RPS</strong>. Latency p95 đạt{" "}
                    <strong className="text-white font-mono">{currentMetrics.p95_latency}</strong> và tỷ lệ lỗi là{" "}
                    <strong className="text-white font-mono">{currentMetrics.error_rate}%</strong>.
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
    </ProjectWorkspaceShell>
  );
}

export default function StressTestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <StressTestContent />
    </Suspense>
  );
}
