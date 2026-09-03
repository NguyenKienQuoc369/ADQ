"use client";

import React, { Suspense, useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Flame,
  Globe,
  LoaderCircle,
  ShieldCheck,
  Zap,
  Save,
  BookmarkCheck,
  PlusCircle,
  Terminal,
  Activity,
  Sliders,
  Code2,
  Crosshair,
  RefreshCw,
  Search,
  Copy,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { getEntitlements } from "@/lib/entitlements";
import {
  getProjectById,
  saveProjectDetail,
  detectWaf,
  discoverEndpoints,
  createStressJob,
  getStressJob,
  streamStressJob,
  StressJobState,
  startStressVerification,
  checkStressVerification,
} from "@/lib/api";

interface DiscoveredEndpoint {
  id: string;
  path: string;
  method: "GET" | "POST" | "PUT";
  impactScore: number;
  description: string;
}

interface StressMetrics {
  totalRequests: number;
  actualRps: number;
  status200: number;
  status403WafBlocked: number;
  status429RateLimited: number;
  status500Crashed: number;
  p95LatencyMs: string | number;
  targetHealth: number;
  targetTemp: number;
}

function cleanBaseUrl(raw: string): string {
  let cleaned = (raw || "").trim();
  if (!cleaned) return "";
  cleaned = cleaned.replace(/-[a-f0-9]{6}$/i, "");
  cleaned = cleaned.replace(/\/-[a-f0-9]{6}/gi, "");
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned.replace(/\/+$/, "");
}

function getRandomSpoofedIp(): string {
  const octets = [
    [14, 232, Math.floor(Math.random() * 254) + 1, Math.floor(Math.random() * 254) + 1],
    [113, 161, Math.floor(Math.random() * 254) + 1, Math.floor(Math.random() * 254) + 1],
    [42, 112, Math.floor(Math.random() * 254) + 1, Math.floor(Math.random() * 254) + 1],
    [171, 244, Math.floor(Math.random() * 254) + 1, Math.floor(Math.random() * 254) + 1],
    [103, 145, Math.floor(Math.random() * 254) + 1, Math.floor(Math.random() * 254) + 1],
  ];
  return octets[Math.floor(Math.random() * octets.length)].join(".");
}

function generateWafBypassTemplate(wafType: string): string {
  const upper = (wafType || "").toUpperCase();
  if (upper.includes("CLOUDFLARE")) {
    return JSON.stringify({
      "CF-Connecting-IP": "127.0.0.1",
      "X-Forwarded-For": "1.1.1.1, 127.0.0.1",
      "X-Real-IP": "127.0.0.1",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Cache-Control": "no-cache",
    }, null, 2);
  }
  if (upper.includes("AWS") || upper.includes("CLOUDFRONT")) {
    return JSON.stringify({
      "X-Forwarded-For": "10.0.0.1",
      "X-Originating-IP": "127.0.0.1",
      "User-Agent": "Amazon CloudFront Evaluator / 2.0",
      "Cache-Control": "max-age=0",
    }, null, 2);
  }
  return JSON.stringify({
    "X-Forwarded-For": "127.0.0.1",
    "X-Real-IP": "127.0.0.1",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Cache-Control": "no-cache",
  }, null, 2);
}

function StressTestContent() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const userTier = user?.packageTier || "FREE";
  const entitlements = getEntitlements(userTier);
  const isFreeTier = entitlements.stressDailyLimit === 0;

  const [projectName, setProjectName] = useState("");
  const [baseTarget, setBaseTarget] = useState("");
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("");

  // Cấu hình tải
  const [totalRequestsInput, setTotalRequestsInput] = useState<number>(30000);
  const [durationInput, setDurationInput] = useState<number>(15);
  const [concurrencyVUs, setConcurrencyVUs] = useState<number>(100);

  // WAF & Bypass Code
  const [isDetectingWaf, setIsDetectingWaf] = useState(false);
  const [wafName, setWafName] = useState<string | null>(null);
  const [wafDetected, setWafDetected] = useState<boolean>(false);
  const [bypassCode, setBypassCode] = useState<string>(generateWafBypassTemplate("CLOUDFLARE"));

  // Ref lưu tỷ lệ thành công tức thời
  const passRatioRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);

  // Danh sách Endpoints
  const [isScanningEndpoints, setIsScanningEndpoints] = useState(false);
  const [discoveredEndpoints, setDiscoveredEndpoints] = useState<DiscoveredEndpoint[]>([]);

  const [isRunning, setIsRunning] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<"IDLE" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED">("IDLE");
  const [jobError, setJobError] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const reconnectAttemptsRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isTerminalRef = useRef<boolean>(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);

  const [metrics, setMetrics] = useState<StressMetrics>({
    totalRequests: 0,
    actualRps: 0,
    status200: 0,
    status403WafBlocked: 0,
    status429RateLimited: 0,
    status500Crashed: 0,
    p95LatencyMs: "0ms",
    targetHealth: 100,
    targetTemp: 38,
  });

  // Ownership Verification (Meta Tag)
  const [verificationStatus, setVerificationStatus] = useState<"UNVERIFIED" | "VERIFYING" | "VERIFIED" | "FAILED">("UNVERIFIED");
  const [verificationToken, setVerificationToken] = useState<string>("");
  const [metaTagString, setMetaTagString] = useState<string>("");
  const [isStartingVerification, setIsStartingVerification] = useState<boolean>(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState<boolean>(false);
  const [verificationMessage, setVerificationMessage] = useState<string>("");
  const [isCopiedMeta, setIsCopiedMeta] = useState<boolean>(false);

  useEffect(() => {
    setVerificationStatus("UNVERIFIED");
    setVerificationToken("");
    setMetaTagString("");
    setVerificationMessage("");
  }, [baseTarget]);

  const handleStartVerification = async () => {
    const clean = cleanBaseUrl(baseTarget);
    if (!clean) {
      alert("Vui lòng nhập tên miền mục tiêu.");
      return;
    }
    setIsStartingVerification(true);
    appendLog(`[OWNERSHIP] Đang khởi tạo mã xác minh Meta Tag cho ${clean}...`);
    try {
      const res = await startStressVerification(clean);
      if (res?.ok && res.meta_tag) {
        setMetaTagString(res.meta_tag);
        setVerificationToken(res.verification_token);
        setVerificationStatus(res.verified ? "VERIFIED" : "UNVERIFIED");
        appendLog(`[OWNERSHIP] Đã cấp thẻ Meta Tag xác minh. Vui lòng thêm vào thẻ <head> của website.`);
      }
    } catch (e: any) {
      appendLog(`[OWNERSHIP LỖI] ${e?.message || "Không thể khởi tạo mã xác minh"}`);
    } finally {
      setIsStartingVerification(false);
    }
  };

  const handleCheckVerification = async () => {
    const clean = cleanBaseUrl(baseTarget);
    if (!clean) {
      alert("Vui lòng nhập tên miền mục tiêu.");
      return;
    }
    setIsCheckingVerification(true);
    setVerificationStatus("VERIFYING");
    appendLog(`[OWNERSHIP] Đang kết nối tới ${clean} để quét thẻ Meta Tag xác minh...`);
    try {
      const res = await checkStressVerification(clean);
      if (res?.verified) {
        setVerificationStatus("VERIFIED");
        setVerificationMessage(res.message || "Đã xác minh quyền sở hữu thành công.");
        appendLog(`[OWNERSHIP THÀNH CÔNG] Đã xác minh quyền sở hữu mục tiêu ${clean}! Đã mở khóa bắn tải.`);
      } else {
        setVerificationStatus("FAILED");
        setVerificationMessage(res.message || "Không tìm thấy thẻ Meta Tag hợp lệ.");
        appendLog(`[OWNERSHIP THẤT BẠI] ${res.message || "Không tìm thấy thẻ Meta Tag"}`);
      }
    } catch (e: any) {
      setVerificationStatus("FAILED");
      setVerificationMessage(e?.message || "Lỗi kiểm tra xác minh");
      appendLog(`[OWNERSHIP LỖI] ${e?.message || "Lỗi kiểm tra xác minh"}`);
    } finally {
      setIsCheckingVerification(false);
    }
  };

  const copyMetaTag = () => {
    if (!metaTagString) return;
    navigator.clipboard.writeText(metaTagString);
    setIsCopiedMeta(true);
    setTimeout(() => setIsCopiedMeta(false), 2000);
  };

  const [logs, setLogs] = useState<string[]>([
    `[ADQ-SOC] Hệ thống Stress Test Engine đã kết nối SOC Cluster.`,
  ]);

  // Secret-Safe localStorage helpers: ONLY stores jobId and target, ZERO secrets
  const saveActiveJob = (jobId: string, target: string) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("adq_active_stress_job", JSON.stringify({ jobId, target, startedAt: Date.now() }));
    } catch {}
  };

  const clearActiveJob = () => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem("adq_active_stress_job");
    } catch {}
  };

  const applyJobState = (state: StressJobState) => {
    if (!state) return;
    setJobStatus(state.status);
    if (state.error_safe) {
      setJobError(state.error_safe);
    }

    const raw = state.metrics || {};
    const curTotal = Number(raw.total_requests || 0);
    const curRps = Number(raw.rps || 0);
    const s200 = Number(raw.status_200 || 0);
    const s403 = Number(raw.status_403_waf_blocked || 0);
    const s429 = Number(raw.status_429_rate_limited || 0);
    const s500 = Number(raw.status_500_crashed || 0);
    const p95 = String(raw.p95_latency || "0ms");

    const totalResp = s200 + s403 + s429 + s500;
    if (totalResp > 0) {
      passRatioRef.current = s200 / totalResp;
    }

    const targetTotal = Number(state.target_requests || totalRequestsInput || 1000);
    const health = Math.max(10, Math.floor(100 - (s200 / Math.max(1, curTotal || targetTotal)) * 85));
    const temp = Math.min(99, Math.floor(38 + (s200 / Math.max(1, curTotal || targetTotal)) * 60));

    setMetrics({
      totalRequests: curTotal,
      actualRps: curRps,
      status200: s200,
      status403WafBlocked: s403,
      status429RateLimited: s429,
      status500Crashed: s500,
      p95LatencyMs: p95,
      targetHealth: health,
      targetTemp: temp,
    });
  };

  const connectJobStream = async (jobId: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    try {
      await streamStressJob(
        jobId,
        (chunk: StressJobState) => {
          applyJobState(chunk);
          reconnectAttemptsRef.current = 0;

          if (chunk.status === "QUEUED") {
            setJobStatus("QUEUED");
          } else if (chunk.status === "RUNNING") {
            setJobStatus("RUNNING");
            setIsRunning(true);
            isRunningRef.current = true;
          } else if (chunk.status === "COMPLETED") {
            setJobStatus("COMPLETED");
            setIsRunning(false);
            isRunningRef.current = false;
            isTerminalRef.current = true;
            clearActiveJob();
            appendLog(`[HOÀN TẤT] Tiến trình ${jobId} hoàn thành thành công.`);
            const m = chunk.metrics || {};
            appendLog(`[KẾT QUẢ THẬT] 200 OK: ${(m.status_200 || 0).toLocaleString()} | 403 Blocked: ${(m.status_403_waf_blocked || 0).toLocaleString()} | 429 Limit: ${(m.status_429_rate_limited || 0).toLocaleString()} | 500 Crash: ${(m.status_500_crashed || 0).toLocaleString()} | P95: ${m.p95_latency || "0ms"}`);
          } else if (chunk.status === "FAILED") {
            setJobStatus("FAILED");
            setIsRunning(false);
            isRunningRef.current = false;
            isTerminalRef.current = true;
            setJobError(chunk.error_safe || "Tiến trình kiểm thử tải thất bại.");
            clearActiveJob();
            appendLog(`[THẤT BẠI] Tiến trình ${jobId}: ${chunk.error_safe || "Lỗi không xác định"}`);
          }
        },
        ac.signal
      );
    } catch (err: any) {
      if (ac.signal.aborted) return;

      // SSE disconnected or network error: do NOT mark FAILED immediately
      if (!isTerminalRef.current) {
        try {
          const latest = await getStressJob(jobId);
          if (latest) {
            applyJobState(latest);
            if (latest.status === "COMPLETED" || latest.status === "FAILED") {
              setIsRunning(false);
              isRunningRef.current = false;
              isTerminalRef.current = true;
              clearActiveJob();
              return;
            }
          }
        } catch {}

        // Bounded reconnect policy: max 5 attempts with backoff
        if (reconnectAttemptsRef.current < 5) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * 2 ** (reconnectAttemptsRef.current - 1), 5000);
          appendLog(`[SSE MẤT KẾT NỐI] Tự động kết nối lại lần ${reconnectAttemptsRef.current}/5 sau ${delay}ms...`);
          setTimeout(() => {
            if (!isTerminalRef.current) {
              connectJobStream(jobId);
            }
          }, delay);
        } else {
          appendLog(`[SSE CẢNH BÁO] Không thể duy trì kết nối SSE sau 5 lần thử. Kiểm tra trạng thái cuối cùng...`);
          try {
            const finalSnap = await getStressJob(jobId);
            if (finalSnap) {
              applyJobState(finalSnap);
              if (finalSnap.status === "COMPLETED" || finalSnap.status === "FAILED") {
                setIsRunning(false);
                isRunningRef.current = false;
                isTerminalRef.current = true;
                clearActiveJob();
              }
            }
          } catch {}
        }
      }
    }
  };

  useEffect(() => {
    setMounted(true);

    // F5 / Refresh Recovery
    const checkSavedJob = async () => {
      if (typeof window === "undefined") return;
      try {
        const raw = localStorage.getItem("adq_active_stress_job");
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (!saved?.jobId) {
          clearActiveJob();
          return;
        }

        appendLog(`[HỆ THỐNG] Phát hiện phiên bắn tải đang hoạt động: ${saved.jobId}. Đang khôi phục trạng thái...`);
        const state = await getStressJob(saved.jobId);
        if (state) {
          setActiveJobId(state.job_id);
          applyJobState(state);
          if (state.status === "QUEUED" || state.status === "RUNNING") {
            setIsRunning(true);
            isRunningRef.current = true;
            isTerminalRef.current = false;
            appendLog(`[HỆ THỐNG] Đang tiếp tục kết nối SSE với tiến trình ${state.job_id}...`);
            connectJobStream(state.job_id);
          } else if (state.status === "COMPLETED") {
            setIsRunning(false);
            isRunningRef.current = false;
            clearActiveJob();
            appendLog(`[HỆ THỐNG] Phiên ${state.job_id} đã hoàn tất.`);
          } else if (state.status === "FAILED") {
            setIsRunning(false);
            isRunningRef.current = false;
            setJobError(state.error_safe || "Tiến trình thất bại");
            clearActiveJob();
            appendLog(`[HỆ THỐNG] Phiên ${state.job_id} thất bại: ${state.error_safe || "Lỗi không xác định"}`);
          }
        }
      } catch (err: any) {
        clearActiveJob();
      }
    };

    checkSavedJob();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const calculatedRps = useMemo(() => {
    if (durationInput <= 0) return 0;
    return Math.round(totalRequestsInput / durationInput);
  }, [totalRequestsInput, durationInput]);

  const targetFullUrl = useMemo(() => {
    const clean = cleanBaseUrl(baseTarget);
    if (!clean) return "";
    let endpoint = (selectedEndpoint || "").trim();
    if (endpoint && !endpoint.startsWith("/")) {
      endpoint = `/${endpoint}`;
    }
    return `${clean}${endpoint}`;
  }, [baseTarget, selectedEndpoint]);

  useEffect(() => {
    if (!projectId) return;

    getProjectById(projectId)
      .then((p) => {
        if (!p) return;
        setProjectName(p.name || "");
        const rawDomain = p.projectDetail?.summary?.domain || p.domain || "";
        const clean = cleanBaseUrl(rawDomain);
        if (clean) setBaseTarget(clean);

        const summary = (p.projectDetail?.summary as Record<string, any>) || {};
        if (summary.stressTest) {
          const st = summary.stressTest;
          if (st.metrics) setMetrics(st.metrics);
          if (st.wafName) {
            setWafName(st.wafName);
            setWafDetected(st.wafDetected ?? true);
            passRatioRef.current = st.wafDetected ? 0 : 1;
          }
          if (st.baseTarget) setBaseTarget(cleanBaseUrl(st.baseTarget));
          if (st.selectedEndpoint) setSelectedEndpoint(st.selectedEndpoint);
          if (st.totalRequestsInput) setTotalRequestsInput(st.totalRequestsInput);
          if (st.durationInput) setDurationInput(st.durationInput);
          if (st.concurrencyVUs) setConcurrencyVUs(st.concurrencyVUs);
          if (st.bypassCode) setBypassCode(st.bypassCode);
          if (st.discoveredEndpoints) setDiscoveredEndpoints(st.discoveredEndpoints);
        }
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const appendLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // 1. QUÉT ENDPOINTS THẬT TỪ BACKEND
  const handleScanEndpoints = async () => {
    const clean = cleanBaseUrl(baseTarget);
    if (!clean) {
      alert("Vui lòng nhập tên miền hoặc URL mục tiêu.");
      return;
    }
    setIsScanningEndpoints(true);
    appendLog(`[CRAWLER] Đang trích xuất cấu trúc endpoint thực tế từ ${clean}...`);

    try {
      const res = await discoverEndpoints(clean);
      const rawEndpoints = res?.endpoints || (res as any)?.paths || (res as any)?.urls || [];

      if (Array.isArray(rawEndpoints) && rawEndpoints.length > 0) {
        const parsedList: DiscoveredEndpoint[] = rawEndpoints.map((epStr: string, idx: number) => {
          let pathOnly = epStr.trim();
          try {
            if (pathOnly.startsWith("http://") || pathOnly.startsWith("https://")) {
              const u = new URL(pathOnly);
              pathOnly = u.pathname + u.search;
            }
          } catch {}

          if (!pathOnly.startsWith("/")) pathOnly = `/${pathOnly}`;
          const isPost = pathOnly.includes("login") || pathOnly.includes("auth") || pathOnly.includes("checkout") || pathOnly.includes("pay");
          const isSearch = pathOnly.includes("search") || pathOnly.includes("filter") || pathOnly.includes("query");

          return {
            id: `ep-real-${idx + 1}`,
            path: pathOnly,
            method: isPost ? "POST" : "GET",
            impactScore: isPost ? 96 : isSearch ? 88 : Math.max(30, 80 - idx * 5),
            description: isPost
              ? "Endpoint xác thực DB (Tắc nghẽn CPU & Row Locking)"
              : isSearch
              ? "Truy vấn dữ liệu Full-Text Search (Tắc nghẽn Disk I/O)"
              : "Endpoint API dữ liệu thời gian thực (Bypass CDN Cache)",
          };
        });

        setDiscoveredEndpoints(parsedList);
        setSelectedEndpoint(parsedList[0].path);
        appendLog(`[THÀNH CÔNG] Đã phát hiện ${parsedList.length} endpoints thực tế. Đã chọn: ${parsedList[0].path}`);
      } else {
        appendLog(`[CRAWLER NOTICE] Không phát hiện thêm endpoint động từ ${clean}. Thiết lập Root Path ("/").`);
        setDiscoveredEndpoints([
          {
            id: "ep-root",
            path: "/",
            method: "GET",
            impactScore: 60,
            description: "Root Target Endpoint (Trang chủ hoặc API Gateway)",
          },
        ]);
        setSelectedEndpoint("/");
      }
    } catch (e: any) {
      appendLog(`[LỖI CRAWLER] ${e?.message || "Không thể kết nối crawler backend"}`);
    } finally {
      setIsScanningEndpoints(false);
    }
  };

  // 2. NHẬN DIỆN WAF THẬT TỪ BACKEND
  const handleDetectWaf = async () => {
    const clean = cleanBaseUrl(baseTarget);
    if (!clean) {
      alert("Vui lòng nhập tên miền mục tiêu.");
      return;
    }
    setIsDetectingWaf(true);
    appendLog(`[WAF ENGINE] Đang gửi signature probes tới ${clean} để phân tích WAF thực tế...`);

    try {
      const res = await detectWaf(clean);
      if (res && res.waf_detected) {
        const detectedName = res.waf_name || "Cloudflare WAF / Bot Management";
        setWafDetected(true);
        setWafName(detectedName);
        passRatioRef.current = 0; // CÓ WAF -> KHÓA CỨNG 100% TIA ĐỎ
        const generatedCode = generateWafBypassTemplate(detectedName);
        setBypassCode(generatedCode);
        appendLog(`[WAF PHÁT HIỆN] ${detectedName}. Đã kích hoạt khiên chặn (100% Red Beams).`);
      } else {
        setWafDetected(false);
        setWafName("Không phát hiện WAF (Trực tiếp Máy chủ Gốc)");
        passRatioRef.current = 1.0; // KHÔNG WAF -> 100% TIA XANH
        setBypassCode(generateWafBypassTemplate("STANDARD"));
        appendLog(`[WAF THÔNG BÁO] Không phát hiện hệ thống tường lửa WAF bảo vệ.`);
      }
    } catch (e: any) {
      appendLog(`[WAF LỖI] ${e?.message || "Không thể phân tích WAF"}`);
    } finally {
      setIsDetectingWaf(false);
    }
  };

  // 3. CANVAS CYBER BATTLE MAP: NGUỒN TIA TỪ TÂM ADQ CLUSTER + KHIÊN TRÒN WAF
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const setupCanvasSize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.parentElement?.getBoundingClientRect() || { width: 900, height: 380 };
      canvas.width = rect.width * dpr;
      canvas.height = 380 * dpr;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      return { width: rect.width, height: 380 };
    };

    let { width, height } = setupCanvasSize();

    const handleResize = () => {
      const dims = setupCanvasSize();
      width = dims.width;
      height = dims.height;
    };
    window.addEventListener("resize", handleResize);

    interface ParticlePoint {
      x: number;
      y: number;
    }

    interface Packet {
      id: number;
      ip: string;
      startX: number;
      startY: number;
      controlX: number;
      controlY: number;
      targetX: number;
      targetY: number;
      progress: number;
      speed: number;
      isBypassed: boolean;
      history: ParticlePoint[];
      isDead: boolean;
    }

    interface Spark {
      x: number;
      y: number;
      vx: number;
      vy: number;
      alpha: number;
      size: number;
      color: string;
      life: number;
    }

    interface Shockwave {
      x: number;
      y: number;
      radius: number;
      maxRadius: number;
      color: string;
      alpha: number;
    }

    let packets: Packet[] = [];
    let sparks: Spark[] = [];
    let shockwaves: Shockwave[] = [];

    let packetCounter = 0;
    let targetShakeIntensity = 0;
    let shieldEnergyFlash = 0;
    let radarAngle = 0;
    let frameTick = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      frameTick++;

      const clusterX = 90;
      const clusterY = height * 0.5;
      const targetX = width - 110;
      const targetY = height * 0.5;
      const shieldRadius = 65;

      // 1. VẼ GRID NHẸ
      ctx.save();
      ctx.strokeStyle = "rgba(14, 165, 233, 0.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 36) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();

      radarAngle += 0.03;

      // 2. VẼ TRẠM ADQ MASTER CLUSTER
      ctx.save();
      const clusterPulse = (Math.sin(radarAngle * 2.5) + 1) * 0.5;

      ctx.strokeStyle = isRunningRef.current ? "rgba(6, 182, 212, 0.6)" : "rgba(100, 116, 139, 0.2)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(clusterX, clusterY, 32 + clusterPulse * 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = isRunningRef.current ? "#083344" : "#0f172a";
      ctx.strokeStyle = isRunningRef.current ? "#06b6d4" : "#334155";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(clusterX - 26, clusterY - 26, 52, 52, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isRunningRef.current ? "#22d3ee" : "#475569";
      ctx.beginPath();
      ctx.arc(clusterX, clusterY, 7 + clusterPulse * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(clusterX, clusterY, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.fillText("ADQ CLUSTER", clusterX - 28, clusterY + 42);
      ctx.restore();

      // 3. SINH TIA BẮN TỪ TÂM (clusterX, clusterY)
      if (isRunningRef.current && frameTick % 3 === 0 && packets.length < 14) {
        const startX = clusterX;
        const startY = clusterY;

        const isBypassed = Math.random() < passRatioRef.current;

        const angleToTarget = Math.atan2(targetY - startY, targetX - startX);
        const endX = isBypassed ? targetX : targetX - Math.cos(angleToTarget) * shieldRadius;
        const endY = isBypassed ? targetY + (Math.random() - 0.5) * 16 : targetY - Math.sin(angleToTarget) * shieldRadius;

        const midX = (startX + endX) * 0.5;
        const midY = (startY + endY) * 0.5 + (Math.random() - 0.5) * 60;

        packets.push({
          id: packetCounter++,
          ip: getRandomSpoofedIp(),
          startX,
          startY,
          controlX: midX,
          controlY: midY,
          targetX: endX,
          targetY: endY,
          progress: 0,
          speed: Math.random() * 0.032 + 0.026,
          isBypassed,
          history: [],
          isDead: false,
        });
      }

      // 4. CẬP NHẬT VÀ VẼ TIA LASER
      packets.forEach((p) => {
        p.progress += p.speed;

        const t = Math.min(1, p.progress);
        const currX = (1 - t) * (1 - t) * p.startX + 2 * (1 - t) * t * p.controlX + t * t * p.targetX;
        const currY = (1 - t) * (1 - t) * p.startY + 2 * (1 - t) * t * p.controlY + t * t * p.targetY;

        p.history.push({ x: currX, y: currY });
        if (p.history.length > 5) p.history.shift();

        // XỬ LÝ VA CHẠM
        if (p.progress >= 1 && !p.isDead) {
          p.isDead = true;

          if (!p.isBypassed) {
            shieldEnergyFlash = 1.0;
            if (shockwaves.length < 4) {
              shockwaves.push({
                x: p.targetX,
                y: p.targetY,
                radius: 4,
                maxRadius: 22,
                color: "#ef4444",
                alpha: 1.0,
              });
            }

            if (sparks.length < 18) {
              for (let k = 0; k < 5; k++) {
                const angle = Math.atan2(p.startY - p.targetY, p.startX - p.targetX) + (Math.random() - 0.5) * 1.2;
                const spd = Math.random() * 3 + 1.5;
                sparks.push({
                  x: p.targetX,
                  y: p.targetY,
                  vx: Math.cos(angle) * spd,
                  vy: Math.sin(angle) * spd,
                  alpha: 1.0,
                  size: Math.random() * 1.5 + 1,
                  color: "#ff3b5c",
                  life: 1.0,
                });
              }
            }
          } else {
            targetShakeIntensity = 6;
            if (shockwaves.length < 4) {
              shockwaves.push({
                x: targetX,
                y: targetY,
                radius: 6,
                maxRadius: 32,
                color: "#10b981",
                alpha: 1.0,
              });
            }

            if (sparks.length < 18) {
              for (let k = 0; k < 6; k++) {
                const angle = Math.random() * Math.PI * 2;
                const spd = Math.random() * 4 + 2;
                sparks.push({
                  x: targetX,
                  y: targetY,
                  vx: Math.cos(angle) * spd,
                  vy: Math.sin(angle) * spd,
                  alpha: 1.0,
                  size: Math.random() * 2 + 1,
                  color: "#00ffcc",
                  life: 1.0,
                });
              }
            }
          }
        }

        if (p.history.length > 1 && !p.isDead) {
          ctx.save();
          const beamColor = p.isBypassed ? "#10b981" : "#ef4444";
          ctx.strokeStyle = beamColor;
          ctx.lineWidth = p.isBypassed ? 2 : 1.8;

          ctx.beginPath();
          ctx.moveTo(p.history[0].x, p.history[0].y);
          for (let h = 1; h < p.history.length; h++) {
            ctx.lineTo(p.history[h].x, p.history[h].y);
          }
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(currX, currY, 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = p.isBypassed ? "rgba(167, 243, 208, 0.85)" : "rgba(254, 202, 202, 0.85)";
          ctx.font = "8px monospace";
          ctx.fillText(p.ip, currX - 16, currY - 6);
          ctx.restore();
        }
      });

      packets = packets.filter((p) => !p.isDead);

      // 5. CẬP NHẬT TIA LỬA
      sparks.forEach((sp) => {
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vx *= 0.92;
        sp.vy *= 0.92;
        sp.life -= 0.06;
        sp.alpha = Math.max(0, sp.life);

        ctx.save();
        ctx.fillStyle = sp.color;
        ctx.globalAlpha = sp.alpha;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      sparks = sparks.filter((sp) => sp.life > 0);

      // 6. CẬP NHẬT SÓNG XUNG KÍCH
      shockwaves.forEach((sw) => {
        sw.radius += 2;
        sw.alpha -= 0.07;

        ctx.save();
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = Math.max(0, sw.alpha);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
      shockwaves = shockwaves.filter((sw) => sw.alpha > 0);

      // 7. VẼ KHIÊN TRÒN WAF
      ctx.save();
      const isShieldActive = wafDetected || isRunningRef.current;
      const baseShieldColor = shieldEnergyFlash > 0 ? "#ef4444" : "#00f0ff";

      ctx.strokeStyle = baseShieldColor;
      ctx.fillStyle = shieldEnergyFlash > 0 ? "rgba(239, 68, 68, 0.12)" : "rgba(0, 240, 255, 0.05)";
      ctx.lineWidth = shieldEnergyFlash > 0 ? 2.5 : 1.5;

      ctx.beginPath();
      ctx.arc(targetX, targetY, shieldRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (isShieldActive) {
        ctx.strokeStyle = shieldEnergyFlash > 0 ? "rgba(239, 68, 68, 0.5)" : "rgba(56, 189, 248, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(targetX, targetY, shieldRadius + 5, radarAngle, radarAngle + Math.PI * 0.6);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(targetX, targetY, shieldRadius + 5, radarAngle + Math.PI, radarAngle + Math.PI * 1.6);
        ctx.stroke();
      }

      if (shieldEnergyFlash > 0) shieldEnergyFlash -= 0.08;

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 9px monospace";
      ctx.fillText("WAF CIRCULAR SHIELD", targetX - 48, targetY - shieldRadius - 10);
      ctx.restore();

      // 8. VẼ MÁY CHỦ ĐÍCH
      const shakeX = targetShakeIntensity > 0 ? (Math.random() - 0.5) * targetShakeIntensity : 0;
      const shakeY = targetShakeIntensity > 0 ? (Math.random() - 0.5) * targetShakeIntensity : 0;
      if (targetShakeIntensity > 0) targetShakeIntensity -= 0.5;

      const sx = targetX + shakeX;
      const sy = targetY + shakeY;

      ctx.save();
      ctx.fillStyle = "#0f172a";
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(sx - 24, sy - 30, 48, 60, 6);
      ctx.fill();
      ctx.stroke();

      for (let b = 0; b < 3; b++) {
        const by = sy - 20 + b * 16;
        ctx.fillStyle = "#1e293b";
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(sx - 18, by, 36, 11, 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = b === 0 ? "#10b981" : "#38bdf8";
        ctx.beginPath();
        ctx.arc(sx - 12, by + 5.5, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.fillText("TARGET CORE", sx - 28, sy + 44);
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [wafDetected]);

  // 4. THỰC THI BẮN TẢI ASYNC DEDICATED WORKER (PHASE 2C)
  const executeStressTest = async () => {
    if (!targetFullUrl || isRunning || isDispatching) return;
    setIsDispatching(true);
    setJobError(null);
    const startTs = Date.now();
    const targetTotal = Number(totalRequestsInput || 30000);
    const durSeconds = Number(durationInput || 15);
    const rps = Math.round(targetTotal / durSeconds);

    passRatioRef.current = 0;

    setMetrics({
      totalRequests: 0,
      actualRps: rps,
      status200: 0,
      status403WafBlocked: 0,
      status429RateLimited: 0,
      status500Crashed: 0,
      p95LatencyMs: "0ms",
      targetHealth: 100,
      targetTemp: 38,
    });

    appendLog(`[BẮT ĐẦU TẢI L7] Mục tiêu: ${targetFullUrl}`);
    appendLog(`Thông số: Tổng ${targetTotal.toLocaleString()} reqs trong ${durSeconds}s -> Tốc độ: ${rps} RPS | VUs: ${concurrencyVUs}`);

    try {
      let parsedHeaders: Record<string, string> = {};
      try {
        parsedHeaders = JSON.parse(bypassCode);
      } catch {
        parsedHeaders = { "X-Forwarded-For": "127.0.0.1" };
      }

      const payload = {
        target_url: targetFullUrl,
        target_requests: targetTotal,
        duration: `${durSeconds}s`,
        bypass_code: bypassCode || "",
        waf_type: wafName || "standard",
        custom_headers: parsedHeaders,
      };

      appendLog(`[DISPATCH] Đang gửi yêu cầu khởi tạo tới Dedicated Stress Worker...`);
      const res = await createStressJob(payload);

      if (res?.ok && res.job_id) {
        const jId = res.job_id;
        setActiveJobId(jId);
        setJobStatus("QUEUED");
        setIsRunning(true);
        isRunningRef.current = true;
        isTerminalRef.current = false;
        saveActiveJob(jId, cleanBaseUrl(baseTarget));
        appendLog(`[QUEUE ACCEPTED] Tiến trình ${jId} đã được đưa vào hàng đợi Dedicated Worker (202 Accepted).`);
        appendLog(`[SSE STREAM] Đang kết nối kênh sự kiện realtime /api/stress/${jId}/stream...`);
        connectJobStream(jId);
      } else {
        throw new Error(res?.message || "Không nhận được xác nhận từ hệ thống hàng đợi");
      }
    } catch (e: any) {
      const errMsg = e?.message || "Kiểm thử thất bại";
      setJobError(errMsg);
      setJobStatus("FAILED");
      setIsRunning(false);
      isRunningRef.current = false;
      appendLog(`[LỖI THỰC THI] ${errMsg}`);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleSaveSession = async () => {
    if (!projectId) {
      alert("Vui lòng gắn một Project ID để lưu phiên này.");
      return;
    }
    setIsSaving(true);
    try {
      await saveProjectDetail(projectId, {
        stressTest: {
          baseTarget,
          selectedEndpoint,
          totalRequestsInput,
          durationInput,
          concurrencyVUs,
          bypassCode,
          wafName,
          wafDetected,
          metrics,
          discoveredEndpoints,
          logs: logs.slice(-50),
          updatedAt: new Date().toISOString(),
        },
      });
      setIsSavedSuccess(true);
      setTimeout(() => setIsSavedSuccess(false), 3000);
    } catch {
      alert("Không tìm thấy Project này trong CSDL. Vui lòng tạo dự án mới ở Dashboard.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isFreeTier) {
    return (
      <DashboardShell area="dashboard">
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="w-full max-w-xl rounded-lg border border-[#222222] bg-[#000000] p-8 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900">
              <Flame className="h-6 w-6 text-white" />
            </div>

            <span className="inline-block mb-3 border border-neutral-700 bg-neutral-800 text-white text-[10px] font-mono px-2.5 py-0.5 rounded-full">
              DÀNH CHO GÓI PRO / PRO MAX
            </span>

            <h1 className="text-xl font-semibold text-white">
              Stress Test L7 chưa khả dụng trên gói FREE
            </h1>

            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-neutral-400">
              Gói FREE không bao gồm Stress Test, kiểm tra WAF hoặc bypass validation.
              Nâng cấp lên PRO hoặc PRO MAX để kích hoạt kiểm thử chuyên sâu.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-4 text-left">
                <p className="text-[11px] font-mono uppercase text-neutral-400">Gói PRO</p>
                <p className="mt-1 text-sm font-semibold text-white">1 lượt Stress Test / ngày</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Endpoint discovery, WAF detection và load testing.
                </p>
              </div>

              <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-4 text-left">
                <p className="text-[11px] font-mono uppercase text-neutral-400">Gói PRO MAX</p>
                <p className="mt-1 text-sm font-semibold text-white">10 lượt Stress Test / ngày</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Hạn mức cao nhất cho kiểm thử hệ thống SOC.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
              <Button
                onClick={() => router.push("/dashboard/billing")}
                className="h-8 bg-white hover:bg-neutral-200 text-black font-medium text-xs rounded-md px-4 shadow-sm cursor-pointer"
              >
                Nâng cấp gói PRO
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

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 text-[#ededed] font-sans">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#222222] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
                <Flame className="h-5 w-5 text-white" /> Stress Test L7 & Bypass WAF
              </h1>
              {projectId && (
                <span className="text-[10px] font-mono border border-neutral-700 bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full" suppressHydrationWarning>
                  TARGET: {projectName || projectId}
                </span>
              )}
              <span className="text-[10px] font-mono border border-neutral-700 bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full" suppressHydrationWarning>
                TIER: {userTier}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Stream trực tiếp tiến độ kiểm thử tải từ cụm Backend Cluster, tự động đồng bộ kết quả thực tế.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="h-8 text-xs border border-[#333333] bg-[#111111] text-white hover:bg-neutral-800 rounded-md transition"
              disabled={isSaving || isRunning}
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
              onClick={() => router.push("/dashboard/projects")}
              size="sm"
              variant="outline"
              className="h-8 text-xs border border-[#333333] bg-[#111111] text-white hover:bg-neutral-800 rounded-md"
            >
              <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Phiên Mới
            </Button>
          </div>
        </div>

        {/* 1. MỤC TIÊU & SCAN ENDPOINTS */}
        <div className="rounded-lg border border-[#222222] bg-[#000000]">
          <div className="p-4 border-b border-[#222222] flex flex-row items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-white" /> 1. Mục Tiêu & Rà Quét Endpoints
            </h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDetectWaf}
                disabled={isDetectingWaf || !baseTarget.trim()}
                className="h-7 text-xs border-[#333333] bg-[#111111] hover:bg-neutral-800 text-white rounded-md"
              >
                {isDetectingWaf ? <LoaderCircle className="h-3 w-3 animate-spin mr-1" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
                Quét WAF
              </Button>
              <Button
                size="sm"
                onClick={handleScanEndpoints}
                disabled={isScanningEndpoints || !baseTarget.trim()}
                className="h-7 text-xs bg-white hover:bg-neutral-200 text-black font-medium rounded-md"
              >
                {isScanningEndpoints ? <LoaderCircle className="h-3 w-3 animate-spin mr-1" /> : <Search className="h-3 w-3 mr-1" />}
                Quét Endpoints
              </Button>
            </div>
          </div>
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                <Input
                  onChange={(e) => {
                    if (jobStatus !== "QUEUED" && jobStatus !== "RUNNING" && !isRunning) {
                      setBaseTarget(e.target.value);
                      if (jobStatus !== "IDLE") {
                        setJobStatus("IDLE");
                        setActiveJobId(null);
                        clearActiveJob();
                      }
                    }
                  }}
                  value={baseTarget}
                  placeholder="Tên miền mục tiêu (vd: https://example.com)"
                  disabled={isRunning || isDispatching || jobStatus === "QUEUED" || jobStatus === "RUNNING"}
                  className="pl-9 bg-[#0a0a0a] border-[#333333] text-white placeholder:text-neutral-500 text-xs h-9 rounded-md"
                />
              </div>
              <div className="sm:w-1/2 relative">
                <Crosshair className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                <Input
                  onChange={(e) => {
                    if (jobStatus !== "QUEUED" && jobStatus !== "RUNNING" && !isRunning) {
                      setSelectedEndpoint(e.target.value);
                    }
                  }}
                  value={selectedEndpoint}
                  placeholder="Endpoint (vd: /api/v1/auth/login)"
                  disabled={isRunning || isDispatching || jobStatus === "QUEUED" || jobStatus === "RUNNING"}
                  className="pl-9 bg-[#0a0a0a] border-[#333333] text-white font-mono text-xs h-9 rounded-md"
                />
              </div>
            </div>

            {discoveredEndpoints.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-cyan-400" /> Chọn Endpoint mục tiêu (Xếp hạng theo độ tổn thương máy chủ):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {discoveredEndpoints.map((ep) => {
                    const isSelected = selectedEndpoint === ep.path;
                    return (
                      <div
                        key={ep.id}
                        onClick={() => setSelectedEndpoint(ep.path)}
                        className={`p-2.5 rounded-md border cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? "bg-neutral-900 border-white text-white"
                            : "bg-[#0a0a0a] border-[#222222] hover:border-neutral-700 text-neutral-300"
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded border border-neutral-700 bg-neutral-800 text-white">
                              {ep.method}
                            </span>
                            <span className="font-mono text-xs font-medium text-white truncate">{ep.path}</span>
                          </div>
                          <p className="text-[10px] text-neutral-500 truncate">{ep.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-mono font-medium ${ep.impactScore > 85 ? "text-rose-400" : ep.impactScore > 60 ? "text-amber-400" : "text-neutral-400"}`}>
                            {ep.impactScore}% Điểm Nghẽn
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. XÁC MINH QUYỀN SỞ HỮU (META TAG) */}
        <div className="rounded-lg border border-[#222222] bg-[#000000]">
          <div className="p-4 border-b border-[#222222] flex flex-row items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-white" /> 2. Xác Minh Quyền Sở Hữu Mục Tiêu (Meta Tag)
            </h2>
            <div className="flex items-center gap-2">
              {verificationStatus === "VERIFIED" ? (
                <span className="text-[10px] font-mono border border-emerald-700 bg-emerald-950 text-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> ĐÃ XÁC MINH
                </span>
              ) : verificationStatus === "FAILED" ? (
                <span className="text-[10px] font-mono border border-rose-700 bg-rose-950 text-rose-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> CHƯA HỢP LỆ
                </span>
              ) : (
                <span className="text-[10px] font-mono border border-amber-700 bg-amber-950 text-amber-300 px-2.5 py-0.5 rounded-full">
                  CẦN XÁC MINH
                </span>
              )}
            </div>
          </div>
          <div className="p-4 sm:p-5 space-y-3">
            <p className="text-xs text-neutral-400 leading-relaxed">
              Để ngăn chặn tấn công trái phép, bạn phải chứng minh quyền quản trị mục tiêu bằng cách chèn thẻ meta bảo mật do ADQ cấp vào thẻ <code className="text-white bg-neutral-900 px-1 py-0.5 rounded">&lt;head&gt;</code> của trang chủ website.
            </p>

            {metaTagString ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-[#0a0a0a] border border-[#333333] rounded-md p-2.5 font-mono text-xs text-emerald-300 overflow-x-auto select-all">
                    {metaTagString}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyMetaTag}
                    className="h-9 text-xs border-[#333333] bg-[#111111] hover:bg-neutral-800 text-white rounded-md shrink-0"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    {isCopiedMeta ? "Đã chép" : "Sao chép"}
                  </Button>
                </div>
                {verificationMessage && (
                  <p className={`text-xs font-mono ${verificationStatus === "VERIFIED" ? "text-emerald-400" : "text-rose-400"}`}>
                    {verificationMessage}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={handleCheckVerification}
                    disabled={isCheckingVerification || !baseTarget.trim()}
                    className="h-8 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs rounded-md shadow-sm cursor-pointer"
                  >
                    {isCheckingVerification ? <LoaderCircle className="h-3 w-3 animate-spin mr-1.5" /> : <ShieldCheck className="h-3 w-3 mr-1.5" />}
                    Kiểm Tra & Kích Hoạt Quyền Sở Hữu
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleStartVerification}
                    disabled={isStartingVerification || !baseTarget.trim()}
                    className="h-8 text-xs text-neutral-400 hover:text-white"
                  >
                    Cấp mã mới
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  size="sm"
                  onClick={handleStartVerification}
                  disabled={isStartingVerification || !baseTarget.trim()}
                  className="h-8 bg-white hover:bg-neutral-200 text-black font-medium text-xs rounded-md shadow-sm cursor-pointer"
                >
                  {isStartingVerification ? <LoaderCircle className="h-3 w-3 animate-spin mr-1.5" /> : <ShieldCheck className="h-3 w-3 mr-1.5" />}
                  Lấy Mã Xác Minh Meta Tag
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 3. CẤU HÌNH TOÁN HỌC & WAF BYPASS CODE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg border border-[#222222] bg-[#000000]">
            <div className="p-4 border-b border-[#222222]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2">
                <Sliders className="h-3.5 w-3.5 text-white" /> 3. Cấu Hình Tải Toán Học (Total Reqs / Duration = RPS)
              </h3>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-neutral-400">Tổng Số Request Cần Bắn:</label>
                  <Input
                    type="number"
                    value={totalRequestsInput}
                    onChange={(e) => setTotalRequestsInput(Number(e.target.value))}
                    disabled={isRunning}
                    className="bg-[#0a0a0a] border-[#333333] text-white font-mono text-xs h-9 rounded-md"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-neutral-400">Thời Gian Duy Trì (Giây):</label>
                  <Input
                    type="number"
                    value={durationInput}
                    onChange={(e) => setDurationInput(Number(e.target.value))}
                    disabled={isRunning}
                    className="bg-[#0a0a0a] border-[#333333] text-white font-mono text-xs h-9 rounded-md"
                  />
                </div>
              </div>

              <div className="p-3 rounded-md bg-[#0a0a0a] border border-[#222222] grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-[10px] text-neutral-500 uppercase font-mono">Tốc Độ Bắn Tải (RPS)</p>
                  <p className="text-xl font-bold text-white font-mono mt-0.5">{calculatedRps.toLocaleString()} <span className="text-xs text-neutral-500 font-normal">req/s</span></p>
                </div>
                <div>
                  <p className="text-[10px] text-neutral-500 uppercase font-mono">Luồng Mô Phỏng (VUs)</p>
                  <p className="text-xl font-bold text-white font-mono mt-0.5">{concurrencyVUs} <span className="text-xs text-neutral-500 font-normal">VUs</span></p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Điều chỉnh số Máy Ảo Đồng Thời (VUs):</span>
                  <span className="font-mono text-white">{concurrencyVUs} VUs</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max={mounted ? (isFreeTier ? 50 : 1000) : 1000}
                  step="10"
                  value={concurrencyVUs}
                  onChange={(e) => setConcurrencyVUs(Number(e.target.value))}
                  disabled={isRunning}
                  suppressHydrationWarning
                  className="w-full accent-white cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[#222222] bg-[#000000]">
            <div className="p-4 border-b border-[#222222] flex flex-row items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2">
                <Code2 className="h-3.5 w-3.5 text-white" /> 3. WAF Signature & Bypass Headers Code
              </h3>
              <span className="text-[10px] font-mono border border-neutral-700 bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full">
                {wafName || "Chưa quét WAF"}
              </span>
            </div>
            <div className="p-4 sm:p-5 space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400 flex justify-between font-mono">
                  <span>Custom Evasion Headers / Code:</span>
                  <span className="text-neutral-500 text-[10px]">JSON Format</span>
                </label>
                <textarea
                  value={bypassCode}
                  onChange={(e) => setBypassCode(e.target.value)}
                  disabled={isRunning}
                  rows={6}
                  className="w-full rounded-md bg-[#0a0a0a] border border-[#333333] p-3 font-mono text-xs text-white focus:outline-none focus:border-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. BẢN ĐỒ CHIẾN TRƯỜNG ADQ MASTER CLUSTER vs TARGET CIRCULAR SHIELD */}
        <div className="rounded-lg border border-[#222222] bg-[#000000] overflow-hidden">
          <div className="py-3 px-4 border-b border-[#222222] flex flex-row items-center justify-between bg-[#0a0a0a]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-2 font-mono">
              <Activity className="h-3.5 w-3.5 text-white animate-pulse" /> ADQ Cluster vs Target Circular Shield
            </h3>
            <div className="flex items-center gap-3">
              {activeJobId && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#333333] bg-neutral-900 text-[10px] font-mono text-neutral-300">
                  <span className="text-neutral-500">JOB:</span>
                  <span className="text-cyan-400 font-semibold">{activeJobId}</span>
                  {jobStatus === "QUEUED" && (
                    <span className="text-amber-400 ml-1 font-bold animate-pulse">[QUEUED]</span>
                  )}
                  {jobStatus === "RUNNING" && (
                    <span className="text-emerald-400 ml-1 font-bold animate-pulse">[RUNNING]</span>
                  )}
                  {jobStatus === "COMPLETED" && (
                    <span className="text-blue-400 ml-1 font-bold">[COMPLETED]</span>
                  )}
                  {jobStatus === "FAILED" && (
                    <span className="text-rose-400 ml-1 font-bold">[FAILED]</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Tia Xanh: Vượt WAF / Core 200 OK
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> Tia Đỏ: Bị WAF Chặn (403 Block)
                </span>
              </div>
            </div>
          </div>
          {jobError && (
            <div className="mx-4 mt-3 p-2.5 rounded-md border border-rose-800/60 bg-rose-950/40 text-xs font-mono text-rose-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{jobError}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setJobError(null)}
                className="h-6 px-2 text-[10px] text-rose-400 hover:text-white"
              >
                Đóng
              </Button>
            </div>
          )}
          <div className="p-0 relative bg-[#000000]">
            <canvas ref={canvasRef} className="w-full h-96 block" />

            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-md bg-black/80 border border-[#222222] backdrop-blur-md hidden sm:flex items-center gap-3 text-xs font-mono">
                <span className="text-neutral-400">Target HP: <strong className="text-white">{metrics.targetHealth}%</strong></span>
                <span className="text-neutral-400">Temp: <strong className="text-amber-400">{metrics.targetTemp}°C</strong></span>
              </div>
              <Button
                onClick={executeStressTest}
                disabled={
                  isRunning ||
                  isDispatching ||
                  jobStatus === "QUEUED" ||
                  jobStatus === "RUNNING" ||
                  !targetFullUrl ||
                  verificationStatus !== "VERIFIED" ||
                  isFreeTier
                }
                className={`h-9 px-6 font-semibold text-xs rounded-md shadow-sm transition ${
                  verificationStatus === "VERIFIED" && !isRunning && !isDispatching && jobStatus !== "QUEUED" && jobStatus !== "RUNNING"
                    ? "bg-white hover:bg-neutral-200 text-black cursor-pointer"
                    : "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700"
                }`}
              >
                {isDispatching ? (
                  <>
                    <LoaderCircle className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Đang Khởi Tạo...
                  </>
                ) : jobStatus === "QUEUED" ? (
                  <>
                    <LoaderCircle className="h-3.5 w-3.5 mr-1.5 animate-spin text-amber-400" /> Đang Xếp Hàng (QUEUED)...
                  </>
                ) : isRunning || jobStatus === "RUNNING" ? (
                  <>
                    <LoaderCircle className="h-3.5 w-3.5 mr-1.5 animate-spin text-emerald-400" /> Đang Phóng Tải (RUNNING)...
                  </>
                ) : verificationStatus !== "VERIFIED" ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Cần Xác Minh Quyền Sở Hữu
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5 mr-1.5 fill-black" /> Khởi Động Đòn Bắn Tải
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* 4 THẺ METRICS ĐO LƯỜNG NHANH */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-[#222222] bg-[#000000] p-3.5">
            <p className="text-[11px] font-mono uppercase text-neutral-500">Tổng Requests</p>
            <p className="text-xl font-bold text-white font-mono mt-1">
              {metrics.totalRequests.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-[#222222] bg-[#000000] p-3.5">
            <p className="text-[11px] font-mono uppercase text-neutral-500">Vượt WAF (200 OK)</p>
            <p className="text-xl font-bold text-emerald-400 font-mono mt-1">
              {metrics.status200.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-[#222222] bg-[#000000] p-3.5">
            <p className="text-[11px] font-mono uppercase text-neutral-500">WAF Block (403)</p>
            <p className="text-xl font-bold text-rose-400 font-mono mt-1">
              {metrics.status403WafBlocked.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-[#222222] bg-[#000000] p-3.5">
            <p className="text-[11px] font-mono uppercase text-neutral-500">Độ Trễ P95</p>
            <p className="text-xl font-bold text-white font-mono mt-1">
              {metrics.p95LatencyMs}
            </p>
          </div>
        </div>

        {/* Live Terminal Logs */}
        <div className="rounded-lg border border-[#222222] bg-[#000000]">
          <div className="py-2.5 px-4 border-b border-[#222222] flex flex-row items-center justify-between">
            <h3 className="text-xs font-mono font-medium text-neutral-400 flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-white" /> Live Stress Engine Output
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLogs([`[ADQ-SOC] Đã làm mới nhật ký kiểm thử.`])}
              className="h-6 text-[10px] text-neutral-400 hover:text-white px-2"
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Xóa Log
            </Button>
          </div>
          <div className="p-3">
            <div
              ref={logContainerRef}
              className="h-36 overflow-y-auto font-mono text-xs text-neutral-300 space-y-1 rounded-md bg-[#0a0a0a] p-3 border border-[#222222]"
            >
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`leading-relaxed ${
                    log.includes("[WAF PHÁT HIỆN]") || log.includes("[LỖI")
                      ? "text-rose-400"
                      : log.includes("[HOÀN TẤT]") || log.includes("[THÀNH CÔNG]")
                      ? "text-emerald-400"
                      : log.includes("[KẾT QUẢ THẬT]") || log.includes("[BẮT ĐẦU") || log.includes("[ADQ CLUSTER]")
                      ? "text-amber-300"
                      : "text-slate-300"
                  }`}
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function StressTestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#000000]" />}>
      <StressTestContent />
    </Suspense>
  );
}
