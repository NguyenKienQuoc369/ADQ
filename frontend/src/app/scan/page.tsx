"use client";

import React, { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Globe,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  LoaderCircle,
  Check,
  Zap,
  Radio,
  Save,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
  Activity,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Code
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { getEntitlements } from "@/lib/entitlements";
import { AiAnalysisCard } from "@/components/scan/ai-analysis-card";
import { RescanConfirmModal } from "@/components/scan/rescan-confirm-modal";
import { TopStageRunner } from "@/components/scan/top-stage-runner";
import { AssuranceMatrix } from "@/components/scan/assurance-matrix";
import { WhatADQCheckedModal } from "@/components/scan/what-adq-checked-modal";
import { OwnershipVerificationCard } from "@/components/scan/ownership-verification-card";
import {
  getProjectById,
  saveProjectDetail,
  startScanJob,
  getScanJobStatus,
  getScanEndpoints,
  getTargetVerificationStatus,
  startTargetVerification,
  checkTargetVerification,
  streamScanJob,
  ActionAdvice,
  ScanEndpoint,
  AssuranceMatrix as AssuranceMatrixType,
  EvaluatedSecurityControl,
  StageSummary,
} from "@/lib/api";

type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

interface Vulnerability {
  id: string;
  severity: SeverityLevel;
  title: string;
  endpoint: string;
  cve?: string;
  description?: string;
  evidence?: string;
}

interface ActivityEvent {
  id: string;
  time: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

function safeString(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    return val.text || val.content || val.message || JSON.stringify(val);
  }
  return String(val);
}

function ScanLandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const userTier = user?.packageTier || "FREE";
  const entitlements = getEntitlements(userTier);

  const isFreeLimitExceeded =
    entitlements.scanLifetimeLimit !== null &&
    (user?.scansToday ?? 0) >= entitlements.scanLifetimeLimit;
  const projectId = searchParams.get("projectId");

  const [projectName, setProjectName] = useState("");
  const [target, setTarget] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<"IDLE" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED">("IDLE");
  const [startedAtTime, setStartedAtTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Server-Authoritative Ownership Verification State
  const [verificationStatus, setVerificationStatus] = useState<"UNVERIFIED" | "VERIFYING" | "VERIFIED" | "FAILED">("UNVERIFIED");
  const [verificationToken, setVerificationToken] = useState<string>("");
  const [metaTagString, setMetaTagString] = useState<string>("");
  const [verificationExpiresIn, setVerificationExpiresIn] = useState<number>(3600);
  const [verificationMessage, setVerificationMessage] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingServerStatus, setIsCheckingServerStatus] = useState(false);

  // Telemetry & Live Scan Metrics
  const [subdomains, setSubdomains] = useState(0);
  const [liveHosts, setLiveHosts] = useState(0);
  const [crawledUrls, setCrawledUrls] = useState(0);
  const [openPorts, setOpenPorts] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [vulnCount, setVulnCount] = useState(0);

  // Live Assurance Matrix & Stages
  const [assuranceMatrix, setAssuranceMatrix] = useState<AssuranceMatrixType | null>(null);
  const [stages, setStages] = useState<StageSummary[]>([]);
  const [currentStageId, setCurrentStageId] = useState<string>("recon_infra");
  const [isWhatCheckedOpen, setIsWhatCheckedOpen] = useState(false);

  // Findings & Action Advice
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [discoveredEndpoints, setDiscoveredEndpoints] = useState<ScanEndpoint[]>([]);
  const [actionAdvice, setActionAdvice] = useState<ActionAdvice[]>([]);
  const [rawActionAdvice, setRawActionAdvice] = useState<string>("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Live Activity Stream (bounded 8 items)
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);

  // States lưu phiên & xác nhận ghi đè
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [showRescanModal, setShowRescanModal] = useState(false);

  // 1. Elapsed timer
  useEffect(() => {
    let timer: any;
    if (isScanning && startedAtTime) {
      timer = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startedAtTime.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isScanning, startedAtTime]);

  const addActivity = (message: string, type: ActivityEvent["type"] = "info") => {
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];
    setActivityFeed((prev) => [
      { id: `act_${Date.now()}_${Math.random()}`, time: timeStr, message, type },
      ...prev.slice(0, 7),
    ]);
  };

  // 2. Hydrate Project or Target from URL
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    getProjectById(projectId)
      .then((p) => {
        if (cancelled || !p) return;
        setProjectName(p.name || "");
        const boundDomain = p.domain || p.projectDetail?.title || "";
        const detail = p.projectDetail || {};
        const summary = (detail.summary as Record<string, any>) || {};

        const scanDomain = String(summary.domain || boundDomain || "")
          .trim()
          .replace(/^https?:\/\//i, "")
          .split("/")[0];

        if (scanDomain) {
          setTarget(scanDomain);
        }

        if (summary) {
          setSubdomains(summary.subdomains ?? 0);
          setLiveHosts(summary.liveHosts ?? 0);
          setCrawledUrls(summary.crawledUrls ?? 0);
          setOpenPorts(summary.openPorts ?? 0);
          setVulnCount(summary.totalVulns ?? (summary.critical ?? 0) + (summary.high ?? 0) + (summary.medium ?? 0));

          const savedJobId = String(summary.lastJobId || "").trim();
          if (savedJobId) {
            setJobId(savedJobId);
            if (detail.status === "RUNNING" || summary.lastScanStatus === "RUNNING") {
              setIsScanning(true);
              setScanStatus("RUNNING");
              setStartedAtTime(new Date());
            } else if (detail.status === "COMPLETED") {
              setScanStatus("COMPLETED");
            }
          }
        }

        const findings = summary.findings || {};
        if (Array.isArray(findings.vulnerabilities) && findings.vulnerabilities.length > 0) {
          setVulnerabilities(findings.vulnerabilities);
        }
        if (Array.isArray(findings.actionAdvice) && findings.actionAdvice.length > 0) {
          setActionAdvice(findings.actionAdvice);
        }
        if (findings.rawActionAdvice) {
          setRawActionAdvice(findings.rawActionAdvice);
        }
        if (summary.ai_summary) {
          setAiSummary(summary.ai_summary);
        }
      })
      .catch((e) => console.warn("Load project detail error:", e));

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // 3. Persistent Server-Side Verification Hydration on Target Change
  useEffect(() => {
    const raw = target.trim();
    if (!raw) {
      setVerificationStatus("UNVERIFIED");
      setVerificationToken("");
      setMetaTagString("");
      return;
    }

    let cancelled = false;
    setIsCheckingServerStatus(true);

    getTargetVerificationStatus(raw)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.verified) {
          setVerificationStatus("VERIFIED");
          setVerificationMessage("");
        } else {
          setVerificationStatus("UNVERIFIED");
          if (res.token) {
            setVerificationToken(res.token);
            setMetaTagString(`<meta name="adq-verification" content="${res.token}">`);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setVerificationStatus("UNVERIFIED");
      })
      .finally(() => {
        if (!cancelled) setIsCheckingServerStatus(false);
      });

    return () => {
      cancelled = true;
    };
  }, [target]);

  // 4. Verification Handlers
  const handleFetchVerificationToken = async (targetOverride?: string) => {
    const raw = (targetOverride || target).trim();
    if (!raw) return;
    try {
      setIsVerifying(true);
      setVerificationStatus("VERIFYING");
      setVerificationMessage("Đang tạo mã xác minh quyền sở hữu...");
      const res = await startTargetVerification(raw);
      if (res.ok) {
        setVerificationToken(res.verification_token);
        setMetaTagString(res.meta_tag);
        if (res.expires_in) {
          setVerificationExpiresIn(res.expires_in);
        }
        if (res.verified) {
          setVerificationStatus("VERIFIED");
          setVerificationMessage("Mục tiêu đã được xác minh quyền sở hữu thành công.");
        } else {
          setVerificationStatus("UNVERIFIED");
          setVerificationMessage("");
        }
      }
    } catch (err: any) {
      setVerificationStatus("FAILED");
      setVerificationMessage(err?.message || "Không thể khởi tạo mã xác minh.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!target.trim()) return;
    setIsVerifying(true);
    setVerificationMessage("");
    try {
      const res = await checkTargetVerification(target.trim());
      if (res.ok && res.verified) {
        setVerificationStatus("VERIFIED");
        setVerificationMessage(res.message || "Xác minh quyền sở hữu thành công! Bạn có thể bắt đầu quét an ninh.");
      } else {
        setVerificationStatus("FAILED");
        setVerificationMessage(res.message || "Không tìm thấy thẻ meta xác minh hợp lệ trong trang chủ.");
      }
    } catch (err: any) {
      setVerificationStatus("FAILED");
      setVerificationMessage(err?.message || "Lỗi kiểm tra xác minh.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetVerification = () => {
    setVerificationStatus("UNVERIFIED");
    setVerificationToken("");
    setMetaTagString("");
    setVerificationMessage("");
  };

  // 5. Start Scan Trigger
  const handleStartScanClick = async () => {
    if (isScanning || !target.trim()) return;

    if (verificationStatus !== "VERIFIED") {
      await handleFetchVerificationToken();
      return;
    }

    const hasExistingData =
      vulnerabilities.length > 0 ||
      actionAdvice.length > 0 ||
      subdomains > 0;

    const isSuppressed =
      typeof window !== "undefined" &&
      localStorage.getItem("adq_suppress_rescan_warning") === "true";

    if (hasExistingData && !isSuppressed) {
      setShowRescanModal(true);
      return;
    }

    startScan();
  };

  const handleConfirmRescan = (dontShowAgain: boolean) => {
    if (dontShowAgain && typeof window !== "undefined") {
      localStorage.setItem("adq_suppress_rescan_warning", "true");
    }
    setShowRescanModal(false);
    startScan();
  };

  const handleCreateNewSession = () => {
    setShowRescanModal(false);
    startScan();
  };

  const startScan = async () => {
    if (isScanning || !target.trim()) return;

    setScanError(null);
    setDiscoveredEndpoints([]);
    setVulnerabilities([]);
    setActivityFeed([]);
    setIsScanning(true);
    setScanStatus("RUNNING");
    setStartedAtTime(new Date());
    setElapsedSeconds(0);
    setCurrentStageId("recon_infra");

    addActivity(`Bắt đầu khởi tạo tiến trình quét mục tiêu: ${target.trim()}`, "info");

    try {
      const data = await startScanJob(target.trim());
      if (!data.ok || !data.job_id) {
        throw new Error("Không nhận được Job ID từ hệ thống quét.");
      }

      setJobId(data.job_id);
      addActivity(`Job ID: ${data.job_id} đã được đưa vào hàng đợi xử lý SOC Engine.`, "info");
      await persistScanSummary("RUNNING", { jobId: data.job_id });
    } catch (err: any) {
      setIsScanning(false);
      setScanStatus("FAILED");
      setScanError(err?.message || "Lỗi khi khởi chạy tiến trình quét.");
      addActivity(`Lỗi khởi chạy quét: ${err?.message}`, "error");
    }
  };

  // 6. Polling & SSE Stream for Live Scan Job
  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    const abortController = new AbortController();

    // Setup SSE listener if running
    if (isScanning) {
      streamScanJob(
        jobId,
        (event) => {
          if (cancelled) return;
          if (event.status) {
            const st = String(event.status).toUpperCase();
            if (st === "COMPLETED" || st === "DONE") {
              setIsScanning(false);
              setScanStatus("COMPLETED");
              addActivity("Tiến trình quét hoàn tất thành công.", "success");
            } else if (st === "FAILED") {
              setIsScanning(false);
              setScanStatus("FAILED");
              addActivity("Tiến trình quét gặp sự cố gián đoạn.", "error");
            }
          }

          if (event.assurance_matrix) {
            setAssuranceMatrix(event.assurance_matrix);
            if (event.assurance_matrix.stages_summary) {
              setStages(event.assurance_matrix.stages_summary);
            }
          }
        },
        abortController.signal
      ).catch(() => {});
    }

    // Polling fallback every 2 seconds
    const interval = setInterval(async () => {
      try {
        const res = await getScanJobStatus(jobId);
        if (!res.ok || cancelled) return;

        const job = res.job ?? res;
        const status = String(job.status || "").toUpperCase();

        if (job.assurance_matrix) {
          setAssuranceMatrix(job.assurance_matrix);
          if (job.assurance_matrix.stages_summary) {
            setStages(job.assurance_matrix.stages_summary);
          }
        }

        const liveData = job.live_data || {};
        const allSubs = liveData.subdomains || job.subdomains?.all || [];
        const httpLive = liveData.live_hosts || job.subdomains?.http_live || [];
        const ports = liveData.open_ports || job.ports?.open || [];
        const urls = liveData.crawled_urls || job.urls?.combined || [];

        setSubdomains(allSubs.length);
        setLiveHosts(httpLive.length);
        setOpenPorts(ports.length);
        setCrawledUrls(urls.length);
        setRequestCount(allSubs.length * 8 + ports.length * 4 + urls.length * 2);

        const nucleiFindings = liveData.nuclei_findings || job.vulnerabilities?.nuclei || [];
        const nuclei: Vulnerability[] = nucleiFindings.map((f: any, idx: number) => ({
          id: `vuln-${idx}`,
          severity: (f.severity || "MEDIUM").toUpperCase() as SeverityLevel,
          title: f.template_id || f.title || "Phát hiện lỗ hổng",
          endpoint: f.matched || f.url || target,
          cve: f.cve_id,
          description: f.description,
          evidence: f.matched || f.raw,
        }));

        setVulnCount(nuclei.length);
        setVulnerabilities(nuclei);

        if (job.ai_summary) {
          setAiSummary(job.ai_summary);
        }

        if (status === "COMPLETED" || status === "DONE") {
          setIsScanning(false);
          setScanStatus("COMPLETED");

          let parsedAdvice: ActionAdvice[] = [];
          const rawAdv = safeString(job.recommendations || job.action_advice || job.raw_action_advice);
          if (rawAdv) {
            setRawActionAdvice(rawAdv);
            const lines = rawAdv.split("\n").filter((l: string) => l.trim().startsWith("-"));
            parsedAdvice = lines.slice(0, 5).map((l: string, idx: number) => ({
              id: `advice-${idx + 1}`,
              vulnerabilityId: `vuln-${idx + 1}`,
              title: `Khuyến nghị #${idx + 1}`,
              rootCause: l.replace(/^- (Nguyên nhân:\s*)?/, ""),
              remediation: [l.replace(/^- /, "")],
            }));
            setActionAdvice(parsedAdvice);
          }

          await persistScanSummary("COMPLETED", {
            subdomains: allSubs.length,
            liveHosts: httpLive.length,
            crawledUrls: urls.length,
            openPorts: ports.length,
            critical: nuclei.filter((v) => v.severity === "CRITICAL").length,
            high: nuclei.filter((v) => v.severity === "HIGH").length,
            medium: nuclei.filter((v) => v.severity === "MEDIUM").length,
            totalVulns: nuclei.length,
            vulnerabilities: nuclei,
            actionAdvice: parsedAdvice,
            rawActionAdvice: rawAdv,
            ai_summary: job.ai_summary,
          });
        }
      } catch (err) {
        console.warn("[Polling Error]:", err);
      }
    }, isScanning ? 2000 : 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      abortController.abort();
    };
  }, [jobId, isScanning, target]);

  const persistScanSummary = async (status: string, overrides?: any) => {
    if (!projectId) return;
    try {
      const summary = {
        domain: target,
        lastJobId: String(overrides?.jobId ?? jobId ?? ""),
        lastScanStatus: status,
        subdomains: Number(overrides?.subdomains ?? subdomains),
        liveHosts: Number(overrides?.liveHosts ?? liveHosts),
        crawledUrls: Number(overrides?.crawledUrls ?? crawledUrls),
        openPorts: Number(overrides?.openPorts ?? openPorts),
        critical: Number(overrides?.critical ?? vulnerabilities.filter((v) => v.severity === "CRITICAL").length),
        high: Number(overrides?.high ?? vulnerabilities.filter((v) => v.severity === "HIGH").length),
        medium: Number(overrides?.medium ?? vulnerabilities.filter((v) => v.severity === "MEDIUM").length),
        totalVulns: Number(overrides?.totalVulns ?? vulnCount),
        ai_summary: overrides?.ai_summary ?? aiSummary,
      };

      await saveProjectDetail(projectId, {
        title: target || projectName || "Scan session",
        description: `Scan session for ${target || "target"}`,
        module: "scan",
        status,
        riskScore: Math.min(100, summary.critical * 26 + summary.high * 12 + summary.medium * 6),
        summary,
        findings: {
          vulnerabilities: overrides?.vulnerabilities ?? vulnerabilities,
          actionAdvice: overrides?.actionAdvice ?? actionAdvice,
          rawActionAdvice: overrides?.rawActionAdvice ?? rawActionAdvice,
        },
        lastScanAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("[persistScanSummary] Error:", e);
    }
  };

  const handleSaveSessionManually = async () => {
    if (!projectId) {
      alert("Vui lòng gắn một Project ID hoặc tạo dự án để lưu phiên này.");
      return;
    }
    setIsSavingSession(true);
    try {
      await persistScanSummary("COMPLETED");
      setIsSavedSuccess(true);
      setTimeout(() => setIsSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Save session failed", err);
    } finally {
      setIsSavingSession(false);
    }
  };

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  // Compute terminal controls progress
  const controlsList = assuranceMatrix?.controls || [];
  const completedControlsCount = controlsList.filter(
    (c) => c.status === "PASS" || c.status === "FAIL" || c.status === "INCONCLUSIVE" || c.status === "NOT_TESTED"
  ).length;
  const totalControlsCount = controlsList.length || 19;

  return (
    <DashboardShell area="dashboard">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-5 font-sans">
        {/* PRE-SCAN / TARGET INPUT & VERIFICATION PANEL */}
        <div className="rounded-xl border border-[#242424] bg-[#0A0A0A] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#1C1C1C]">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight font-mono flex items-center gap-2">
                <Globe className="h-4 w-4 text-white" />
                LIVE SCAN MISSION CONTROL
              </h2>
              <p className="text-xs text-[#888888]">
                Rà quét bảo mật chủ động toàn diện 19 kiểm soát kỹ thuật theo chuẩn OWASP & ISO 27001
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-[#141414] border border-[#242424] text-[#A3A3A3]">
                Gói hiện tại: <strong className="text-white">{userTier}</strong>
              </span>
              {projectId && (
                <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-[#141414] border border-[#242424] text-[#888888]">
                  Project: <strong className="text-[#A3A3A3]">{projectName || projectId}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Target Input Form */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Input
                placeholder="Nhập tên miền hoặc URL mục tiêu (vd: example.com, https://app.example.com)..."
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                disabled={isScanning}
                className="h-10 bg-[#000000] border-[#242424] text-[#F5F5F5] placeholder-[#555555] font-mono text-xs rounded-md focus:border-[#444444]"
              />
              {isCheckingServerStatus && (
                <div className="absolute right-3 top-3">
                  <LoaderCircle className="h-4 w-4 text-[#888888] animate-spin" />
                </div>
              )}
            </div>

            <Button
              onClick={handleStartScanClick}
              disabled={isScanning || !target.trim() || isFreeLimitExceeded}
              className="h-10 px-5 bg-white hover:bg-[#E5E5E5] text-black font-semibold text-xs rounded-md shadow-sm transition active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <LoaderCircle className="h-4 w-4 mr-1.5 animate-spin" /> Đang Quét...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-1.5 text-black" /> Bắt Đầu Quét
                </>
              )}
            </Button>
          </div>

          {/* Ownership Verification Card */}
          {target.trim() && (
            <OwnershipVerificationCard
              target={target}
              verificationToken={verificationToken}
              metaTagString={metaTagString}
              verificationStatus={verificationStatus}
              verificationMessage={verificationMessage}
              isVerifying={isVerifying}
              expiresIn={verificationExpiresIn}
              onFetchToken={() => handleFetchVerificationToken()}
              onCheckVerification={handleCheckVerification}
              onResetVerification={handleResetVerification}
            />
          )}

          {isFreeLimitExceeded && (
            <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 p-3 text-xs text-[#EF4444] font-mono flex items-center justify-between">
              <span>Bạn đã sử dụng hết 2 lượt quét miễn phí trọn đời. Vui lòng nâng cấp lên gói PRO để quét không giới hạn.</span>
              <Button
                size="sm"
                onClick={() => router.push("/dashboard/billing")}
                className="h-7 bg-white text-black font-semibold text-xs rounded px-3"
              >
                Nâng Cấp PRO
              </Button>
            </div>
          )}
        </div>

        {/* SCAN RUNNING & RESULTS SECTION */}
        {(jobId || isScanning || scanStatus !== "IDLE" || vulnerabilities.length > 0) && (
          <div className="space-y-4">
            {/* 1. TOP COMPACT SCAN HEADER */}
            <div className="rounded-xl border border-[#242424] bg-[#0A0A0A] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-[#141414] border border-[#242424] flex items-center justify-center shrink-0">
                  <Globe className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white font-mono">{target}</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        scanStatus === "COMPLETED"
                          ? "border-[#22C55E]/40 bg-[#22C55E]/10 text-[#22C55E]"
                          : scanStatus === "FAILED"
                          ? "border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]"
                          : "border-white/40 bg-white/10 text-white animate-pulse"
                      }`}
                    >
                      {scanStatus}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#888888] font-mono mt-0.5 flex items-center gap-2">
                    <span>Job: {jobId}</span>
                    <span>&bull;</span>
                    <span>Thời gian: {formatElapsed(elapsedSeconds)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {projectId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveSessionManually}
                    disabled={isSavingSession}
                    className="h-8 text-xs border-[#242424] bg-[#141414] hover:bg-[#222222] text-[#A3A3A3] hover:text-white rounded font-mono cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {isSavedSuccess ? "Đã Lưu" : isSavingSession ? "Đang lưu..." : "Lưu Phiên"}
                  </Button>
                )}
                {!isScanning && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRescanModal(true)}
                    className="h-8 text-xs border-[#242424] bg-[#141414] hover:bg-[#222222] text-white rounded font-mono cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Quét Lại
                  </Button>
                )}
              </div>
            </div>

            {/* 2. TOP STAGE RUNNER (REQUIRED AT TOP) */}
            <TopStageRunner stages={stages} currentStageId={currentStageId} isScanning={isScanning} />

            {/* 3. LIVE METRICS ROW */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                { label: "Subdomains", val: subdomains },
                { label: "Live Hosts", val: liveHosts },
                { label: "Crawled URLs", val: crawledUrls },
                { label: "Controls Progress", val: `${completedControlsCount} / ${totalControlsCount}` },
                { label: "Findings", val: vulnCount, highlight: vulnCount > 0 },
              ].map((m, idx) => (
                <div key={idx} className="rounded-xl border border-[#242424] bg-[#0A0A0A] p-3 text-center">
                  <div className="text-[10px] font-mono text-[#888888] uppercase">{m.label}</div>
                  <div
                    className={`text-base sm:text-lg font-bold font-mono mt-0.5 ${
                      m.highlight ? "text-[#EF4444]" : "text-white"
                    }`}
                  >
                    {m.val}
                  </div>
                </div>
              ))}
            </div>

            {/* 4. LIVE SECURITY CONTROLS / ASSURANCE MATRIX */}
            <div className="rounded-xl border border-[#242424] bg-[#0A0A0A] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#1C1C1C]">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-white" />
                    Ma Trận Kiểm Soát An Ninh (19 Controls)
                  </h3>
                  <p className="text-[11px] text-[#888888]">
                    Đánh giá độc lập 4 trạng thái kỹ thuật (PASS, FAIL, INCONCLUSIVE, NOT TESTED)
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsWhatCheckedOpen(true)}
                  className="h-7 text-[11px] font-mono border-[#242424] bg-[#141414] text-[#A3A3A3] hover:text-white rounded"
                >
                  Quy Trình Kiểm Tra
                </Button>
              </div>

              <AssuranceMatrix controls={controlsList} />
            </div>

            {/* 5. LIVE ACTIVITY FEED */}
            {activityFeed.length > 0 && (
              <div className="rounded-xl border border-[#242424] bg-[#0A0A0A] p-4 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-[#1C1C1C]">
                  <h4 className="text-xs font-bold text-white font-mono uppercase flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-white" />
                    Nhật Ký Hoạt Động Thời Gian Thực
                  </h4>
                  <span className="text-[10px] font-mono text-[#666666]">Real-time Event Stream</span>
                </div>
                <div className="space-y-1.5 font-mono text-xs">
                  {activityFeed.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-start gap-2.5 py-1 px-2 rounded bg-[#050505] border border-[#141414]"
                    >
                      <span className="text-[10px] text-[#666666] shrink-0 mt-0.5">{act.time}</span>
                      <span
                        className={`text-[11px] flex-1 ${
                          act.type === "error"
                            ? "text-[#EF4444]"
                            : act.type === "warning"
                            ? "text-[#EAB308]"
                            : act.type === "success"
                            ? "text-[#22C55E]"
                            : "text-[#A3A3A3]"
                        }`}
                      >
                        {act.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. FINDINGS LIST */}
            {vulnerabilities.length > 0 && (
              <div className="rounded-xl border border-[#242424] bg-[#0A0A0A] p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#1C1C1C]">
                  <h4 className="text-xs sm:text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-[#EF4444]" />
                    Phát Hiện Vi Phạm An Ninh ({vulnerabilities.length})
                  </h4>
                </div>
                <div className="space-y-2">
                  {vulnerabilities.map((v) => (
                    <div
                      key={v.id}
                      className="rounded-lg border border-[#EF4444]/30 bg-[#050505] p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white font-mono">{v.title}</span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]">
                          {v.severity}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#888888] font-mono truncate">{v.endpoint}</div>
                      {v.description && <p className="text-[11px] text-[#A3A3A3] mt-1">{v.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. CONSOLIDATED AI RISK ASSESSMENT (SINGLE AI PRESENTATION) */}
            <AiAnalysisCard userTier={userTier} aiSummary={aiSummary} target={target} isScanning={isScanning} />
          </div>
        )}

        {/* MODALS */}
        <RescanConfirmModal
          isOpen={showRescanModal}
          onClose={() => setShowRescanModal(false)}
          onConfirm={handleConfirmRescan}
          onCreateNewSession={handleCreateNewSession}
        />

        <WhatADQCheckedModal
          isOpen={isWhatCheckedOpen}
          onClose={() => setIsWhatCheckedOpen(false)}
          controls={assuranceMatrix?.controls || []}
          scopeLimitations={assuranceMatrix?.scope_limitations || []}
        />
      </div>
    </DashboardShell>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <ScanLandingContent />
    </Suspense>
  );
}
