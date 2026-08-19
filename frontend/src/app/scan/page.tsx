"use client";

import React, { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  ShieldAlert,
  Sparkles,
  Bot,
  Send,
  LoaderCircle,
  Check,
  Zap,
  Terminal,
  KeyRound,
  AlertCircle,
  Radio,
  Save,
  BookmarkCheck,
  PlusCircle,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { AiAnalysisCard } from "@/components/scan/ai-analysis-card";
import { RescanConfirmModal } from "@/components/scan/rescan-confirm-modal";
import { getProjectById, saveProjectDetail, startScanJob, getScanJobStatus, copilotChat, ActionAdvice } from "@/lib/api";

type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

interface Vulnerability {
  id: string;
  severity: SeverityLevel;
  title: string;
  endpoint: string;
  cve?: string;
  description?: string;
}

interface DAGNodeState {
  id: string;
  step: number;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
}

interface ChatMessage {
  sender: "user" | "copilot";
  text: string;
}

function parseMarkdown(content: string) {
  const blocks = content.split("\n\n");
  return (
    <div className="space-y-3">
      {blocks.map((block, bIdx) => {
        if (block.startsWith("```")) {
          const lines = block.split("\n");
          const code = lines.slice(1, -1).join("\n");
          return (
            <div key={bIdx} className="relative rounded-lg bg-slate-950 border border-slate-800 p-3 font-mono text-xs text-slate-300">
              <pre className="overflow-x-auto">{code}</pre>
            </div>
          );
        }
        const lines = block.split("\n");
        return (
          <div key={bIdx} className="space-y-1">
            {lines.map((line, lIdx) => {
              if (line.startsWith("### ")) {
                return (
                  <h4 key={lIdx} className="text-sm font-bold text-white mt-2">
                    {renderInline(line.replace("### ", ""))}
                  </h4>
                );
              }
              if (line.startsWith("## ")) {
                return (
                  <h3 key={lIdx} className="text-base font-bold text-white mt-3">
                    {renderInline(line.replace("## ", ""))}
                  </h3>
                );
              }
              if (line.startsWith("- ") || line.startsWith("* ")) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 ml-2">
                    <span className="text-cyan-400 mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
                    <p className="text-slate-200">{renderInline(line.slice(2))}</p>
                  </div>
                );
              }
              return (
                <p key={lIdx} className="text-slate-200">
                  {renderInline(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-cyan-200">
          {seg.slice(2, -2)}
        </strong>
      );
    }
    if (seg.startsWith("`") && seg.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-amber-300 border border-slate-700">
          {seg.slice(1, -1)}
        </code>
      );
    }
    return seg;
  });
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
  const userTier = (user?.packageTier || "FREE").toUpperCase();
  const isFreeLimitExceeded = userTier === "FREE" && (user?.scansToday ?? 0) >= 2;
  const projectId = searchParams.get("projectId");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [projectName, setProjectName] = useState("");
  const [target, setTarget] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // States lưu phiên & xác nhận ghi đè
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [showRescanModal, setShowRescanModal] = useState(false);

  const [nodes, setNodes] = useState<Record<string, DAGNodeState>>({
    node_recon: { step: 1, id: "node_recon", label: "Recon & DNS", sublabel: "Subfinder / DNSX", icon: Globe, status: "pending" },
    node_port: { step: 2, id: "node_port", label: "Port Scan", sublabel: "Naabu Fast Port", icon: Radio, status: "pending" },
    node_crawl: { step: 3, id: "node_crawl", label: "Crawl URL", sublabel: "Katana & GAU", icon: Terminal, status: "pending" },
    node_nuclei: { step: 4, id: "node_nuclei", label: "Nuclei Engine", sublabel: "CVE / Misconfigs", icon: ShieldAlert, status: "pending" },
    node_secrets: { step: 5, id: "node_secrets", label: "Secrets Hunter", sublabel: "Hardcoded Keys", icon: KeyRound, status: "pending" },
    node_logic: { step: 6, id: "node_logic", label: "Logic Flaws", sublabel: "Attack Vector", icon: Zap, status: "pending" },
    node_ai: { step: 7, id: "node_ai", label: "AI Advice", sublabel: "Gemini Copilot", icon: Sparkles, status: "pending" },
  });

  const [subdomains, setSubdomains] = useState(0);
  const [liveHosts, setLiveHosts] = useState(0);
  const [crawledUrls, setCrawledUrls] = useState(0);
  const [openPorts, setOpenPorts] = useState(0);
  const [vulnCount, setVulnCount] = useState(0);

  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [actionAdvice, setActionAdvice] = useState<ActionAdvice[]>([]);
  const [rawActionAdvice, setRawActionAdvice] = useState<string>("");
  const [scanError, setScanError] = useState<string | null>(null);

  const [copilotMessages, setCopilotMessages] = useState<ChatMessage[]>([
    {
      sender: "copilot",
      text: "Xin chào! Tôi là **ADQ Security Copilot**. Sau khi khởi chạy quét mục tiêu, tôi sẽ phân tích các phát hiện và hỗ trợ bạn tạo bản vá hoặc cấu hình bảo mật trực tiếp.",
    },
  ]);
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    getProjectById(projectId)
      .then((p) => {
        if (cancelled || !p) return;
        setProjectName(p.name || "");
        const boundDomain = p.domain || p.projectDetail?.title || "";
        if (boundDomain) setTarget(boundDomain);

        const detail = p.projectDetail || {};
        const summary = (detail.summary as Record<string, any>) || {};

        if (summary) {
          setSubdomains(summary.subdomains ?? 0);
          setLiveHosts(summary.liveHosts ?? 0);
          setCrawledUrls(summary.crawledUrls ?? 0);
          setOpenPorts(summary.openPorts ?? 0);
          setVulnCount(summary.totalVulns ?? (summary.critical ?? 0) + (summary.high ?? 0) + (summary.medium ?? 0));
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
        if (Array.isArray(findings.chatHistory) && findings.chatHistory.length > 0) {
          setCopilotMessages(findings.chatHistory);
        }

        if (detail.status === "COMPLETED" || (findings.actionAdvice && findings.actionAdvice.length > 0)) {
          setNodes((prev) => {
            const updated = { ...prev };
            Object.keys(updated).forEach((k) => {
              updated[k] = { ...updated[k], status: "completed" };
            });
            return updated;
          });
        }
      })
      .catch((e) => console.warn("Load project detail error:", e));

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!jobId || !isScanning) return;

    const interval = setInterval(async () => {
      try {
        const res = await getScanJobStatus(jobId);
        if (!res.ok) return;

        const { progress, live_data, status, recommendations } = res;

        setNodes((prev) => {
          const next = { ...prev };
          if (progress?.recon) next.node_recon.status = progress.recon === "done" ? "completed" : "running";
          if (progress?.port_scan) next.node_port.status = progress.port_scan === "done" ? "completed" : "running";
          if (progress?.crawl) next.node_crawl.status = progress.crawl === "done" ? "completed" : "running";
          if (progress?.nuclei) next.node_nuclei.status = progress.nuclei === "done" ? "completed" : "running";
          if (progress?.secrets) next.node_secrets.status = progress.secrets === "done" ? "completed" : "running";
          if (progress?.logic) next.node_logic.status = progress.logic === "done" ? "completed" : "running";
          if (progress?.ai_remediation) next.node_ai.status = progress.ai_remediation === "done" ? "completed" : "running";
          return next;
        });

        const allSubs = live_data?.subdomains || [];
        const httpLive = live_data?.live_hosts || [];
        const ports = live_data?.open_ports || [];
        const urls = live_data?.crawled_urls || [];
        const nuclei = (live_data?.nuclei_findings || []).map((f: any, idx: number) => ({
          id: `vuln-${idx}`,
          severity: (f.severity || "MEDIUM").toUpperCase() as SeverityLevel,
          title: f.template_id || f.title || "Phát hiện lỗ hổng",
          endpoint: f.matched || f.url || target,
          cve: f.cve_id,
          description: f.description,
        }));

        setSubdomains(allSubs.length);
        setLiveHosts(httpLive.length);
        setOpenPorts(ports.length);
        setCrawledUrls(urls.length);
        setVulnCount(nuclei.length);
        setVulnerabilities(nuclei);

        if (status === "completed" || status === "COMPLETED") {
          setIsScanning(false);
          setNodes((prev) => {
            const finished = { ...prev };
            Object.keys(finished).forEach((k) => {
              finished[k] = { ...finished[k], status: "completed" };
            });
            return finished;
          });

          let parsedAdvice: ActionAdvice[] = [];
          const rawAdv = safeString(recommendations);
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

            setCopilotMessages((prev) => [
              ...prev,
              {
                sender: "copilot",
                text: `✅ **Đã hoàn tất quét mục tiêu \`${target}\`!**\n\nTôi đã ghi nhận **${parsedAdvice.length} khuyến nghị bảo mật cốt lõi**. Bạn có thể hỏi chi tiết hoặc yêu cầu tạo file cấu hình / mã vá ngay bên dưới.`,
              },
            ]);
          }

          await persistScanSummary("COMPLETED", {
            subdomains: allSubs.length || 1,
            liveHosts: httpLive.length || 1,
            crawledUrls: urls.length,
            openPorts: ports.length || 2,
            critical: nuclei.filter((v: any) => v.severity === "CRITICAL").length,
            high: nuclei.filter((v: any) => v.severity === "HIGH").length,
            medium: nuclei.filter((v: any) => v.severity === "MEDIUM").length,
            totalVulns: nuclei.length,
            vulnerabilities: nuclei,
            actionAdvice: parsedAdvice,
            rawActionAdvice: rawAdv,
          });
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, isScanning, target]);

  const persistScanSummary = async (status: string, overrides?: any) => {
    if (!projectId) return;
    try {
      const summary = {
        subdomains: Number(overrides?.subdomains ?? subdomains),
        liveHosts: Number(overrides?.liveHosts ?? liveHosts),
        crawledUrls: Number(overrides?.crawledUrls ?? crawledUrls),
        openPorts: Number(overrides?.openPorts ?? openPorts),
        critical: Number(overrides?.critical ?? vulnerabilities.filter((v) => v.severity === "CRITICAL").length),
        high: Number(overrides?.high ?? vulnerabilities.filter((v) => v.severity === "HIGH").length),
        medium: Number(overrides?.medium ?? vulnerabilities.filter((v) => v.severity === "MEDIUM").length),
        totalVulns: Number(overrides?.totalVulns ?? vulnCount),
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
          chatHistory: overrides?.chatHistory ?? copilotMessages,
        },
        lastScanAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("[persistScanSummary] Ignored error:", e);
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

  const handleStartScanClick = () => {
    if (isScanning || !target.trim()) return;

    const hasExistingData =
      vulnerabilities.length > 0 ||
      actionAdvice.length > 0 ||
      subdomains > 0 ||
      nodes.node_recon.status === "completed";

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
    router.push("/dashboard/projects");
  };

  const startScan = async () => {
    if (isScanning || !target.trim()) return;

    setScanError(null);
    setIsScanning(true);
    setNodes((prev) => {
      const reset = { ...prev };
      Object.keys(reset).forEach((k) => {
        reset[k] = { ...reset[k], status: "pending" };
      });
      reset.node_recon.status = "running";
      return reset;
    });

    try {
      const data = await startScanJob(target.trim());
      if (!data.ok || !data.job_id) {
        throw new Error("Không thể khởi tạo lượt quét");
      }
      setJobId(data.job_id);
      await persistScanSummary("RUNNING");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Khởi tạo lượt quét thất bại";
      setScanError(msg);
      setIsScanning(false);
      setNodes((prev) => ({ ...prev, node_recon: { ...prev.node_recon, status: "failed", error: msg } }));
    }
  };

  const handleCopilotSend = async (customPrompt?: string) => {
    const query = (customPrompt || copilotInput).trim();
    if (!query || copilotLoading) return;

    const nextMessages: ChatMessage[] = [...copilotMessages, { sender: "user", text: query }];
    setCopilotMessages(nextMessages);
    if (!customPrompt) setCopilotInput("");
    setCopilotLoading(true);

    try {
      const promptContext = `Target: ${target || "findproject.vercel.app"}. Context kết quả scan: ${rawActionAdvice || "Chưa có khuyến nghị."}. Câu hỏi của tôi: ${query}`;
      const res = await copilotChat(promptContext);
      const answerText = safeString(res.copilot_response);
      const finalMessages: ChatMessage[] = [...nextMessages, { sender: "copilot", text: answerText }];
      setCopilotMessages(finalMessages);

      await persistScanSummary("COMPLETED", { chatHistory: finalMessages });
    } catch {
      setCopilotMessages((prev) => [
        ...prev,
        { sender: "copilot", text: "Xin lỗi, không thể kết nối tới Copilot AI lúc này. Vui lòng kiểm tra lại kết nối mạng." },
      ]);
    } finally {
      setCopilotLoading(false);
    }
  };

  const nodeArray = Object.values(nodes);

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 text-slate-100 font-sans">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Trung Tâm Rà Quét Lỗ Hổng</h1>
              {projectId && (
                <Badge className="text-[10px] font-mono border border-cyan-500/30 text-cyan-400 bg-cyan-950/40">
                  DỰ ÁN: {projectName || projectId}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Rà quét tự động đa tầng (Recon, Port, Crawl, Nuclei, Hardcoded Secrets & AI Copilot)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button className="h-8 text-xs border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 transition-all" disabled={isSavingSession || isScanning} onClick={handleSaveSessionManually} size="sm" variant="outline">
              {isSavingSession ? (
                <LoaderCircle className="h-3.5 w-3.5 mr-1.5 animate-spin"/>
              ) : isSavedSuccess ? (
                <BookmarkCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-400"/>
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5"/>
              )}
              {isSavedSuccess ? "Đã Lưu Phiên" : "Lưu Phiên Quét"}
            </Button>

            <Button className="h-8 text-xs border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800" onClick={handleCreateNewSession} size="sm" variant="outline">
              <PlusCircle className="h-3.5 w-3.5 mr-1.5 text-cyan-400"/> Phiên Mới
            </Button>
          </div>
        </div>

        {/* Input Target */}
        <Card className="border border-white/[0.08] bg-slate-950/80 shadow-xl">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"/>
                <Input onChange={(e) => setTarget(e.target.value)} value={target}
                  disabled={isScanning}
                  placeholder="Nhập tên miền mục tiêu (vd: target.com hoặc api.domain.vn)"
                  className="pl-9 bg-slate-900/90 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-500 text-sm h-10"
                />
              </div>
              <Button className="h-10 px-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs rounded-lg shadow-lg shadow-cyan-950/50" disabled={isScanning || isFreeLimitExceeded || !target.trim()} onClick={handleStartScanClick}>
                {isScanning ? (
                  <>
                    <LoaderCircle className="h-4 w-4 mr-2 animate-spin"/> Đang Rà Quét...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2"/> Bắt Đầu Quét
                  </>
                )}
              </Button>
            </div>
            {scanError && (
              <p className="text-xs text-rose-400 mt-2 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5"/> {scanError}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border border-white/[0.08] bg-slate-950/60 p-3">
            <p className="text-[11px] text-slate-400">Tên Miền Phụ</p>
            <p className="text-xl font-bold text-cyan-400 font-mono mt-1">{subdomains}</p>
          </Card>
          <Card className="border border-white/[0.08] bg-slate-950/60 p-3">
            <p className="text-[11px] text-slate-400">Live Hosts</p>
            <p className="text-xl font-bold text-emerald-400 font-mono mt-1">{liveHosts}</p>
          </Card>
          <Card className="border border-white/[0.08] bg-slate-950/60 p-3">
            <p className="text-[11px] text-slate-400">Endpoints Crawl</p>
            <p className="text-xl font-bold text-amber-400 font-mono mt-1">{crawledUrls}</p>
          </Card>
          <Card className="border border-white/[0.08] bg-slate-950/60 p-3">
            <p className="text-[11px] text-slate-400">Lỗ Hổng Phát Hiện</p>
            <p className="text-xl font-bold text-rose-400 font-mono mt-1">{vulnCount}</p>
          </Card>
        </div>

        {/* DAG 7 Steps */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {nodeArray.map((n) => {
            const Icon = n.icon;
            const isDone = n.status === "completed";
            const isRun = n.status === "running";
            return (
              <div
                key={n.id}
                className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                  isDone
                    ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400"
                    : isRun
                    ? "bg-cyan-950/30 border-cyan-500/50 text-cyan-300 ring-1 ring-cyan-500/30"
                    : "bg-slate-950/40 border-slate-800 text-slate-500"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4"/>
                  {isDone ? (
                    <Check className="h-3 w-3 text-emerald-400"/>
                  ) : isRun ? (
                    <LoaderCircle className="h-3 w-3 text-cyan-400 animate-spin"/>
                  ) : (
                    <span className="text-[10px] font-mono">{n.step}</span>
                  )}
                </div>
                <div className="mt-2">
                  <p className="text-xs font-bold truncate text-slate-200">{n.label}</p>
                  <p className="text-[10px] text-slate-400 truncate">{n.sublabel}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* AI Advice & Vuln List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="border border-white/[0.08] bg-slate-950/80 shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-400"/> Danh Sách Lỗ Hổng Chi Tiết
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto">
                  {vulnerabilities.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 font-mono">
                      Chưa có lỗ hổng nào được phát hiện trong phiên này.
                    </div>
                  ) : (
                    vulnerabilities.map((v) => (
                      <div key={v.id} className="p-3.5 hover:bg-slate-900/40 flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className="text-[9px] font-mono px-1.5 py-0" variant={v.severity === "CRITICAL" || v.severity === "HIGH" ? "destructive" : "default"}>
                              {v.severity}
                            </Badge>
                            <span className="font-bold text-slate-200">{v.title}</span>
                          </div>
                          <p className="font-mono text-[11px] text-slate-400">{v.endpoint}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* AI Action Advice Card */}
            <AiAnalysisCard aiSummary={rawActionAdvice} target={target} userTier={userTier}/>
          </div>

          {/* Copilot Chat Card */}
          <div className="lg:col-span-1">
            <Card className="border border-white/[0.08] bg-slate-950/80 shadow-xl flex flex-col h-[520px]">
              <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-white flex items-center gap-2">
                  <Bot className="h-4 w-4 text-cyan-400"/> Copilot Tương Tác
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
                {copilotMessages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl ${
                      m.sender === "user"
                        ? "bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 ml-4"
                        : "bg-slate-900 border border-slate-800 text-slate-300 mr-2"
                    }`}
                  >
                    {m.sender === "copilot" ? parseMarkdown(m.text) : m.text}
                  </div>
                ))}
                {copilotLoading && (
                  <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-2 text-slate-400 text-xs">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-400"/> Copilot đang suy nghĩ...
                  </div>
                )}
                <div ref={chatBottomRef} />
              </CardContent>
              <div className="p-3 border-t border-slate-800 flex gap-2">
                <Input onChange={(e) => setCopilotInput(e.target.value)} value={copilotInput}
                  onKeyDown={(e) => e.key === "Enter" && handleCopilotSend()}
                  placeholder="Hỏi về bản vá hoặc phân tích..."
                  className="bg-slate-900 border-slate-800 text-xs h-8 text-slate-100"
                />
                <Button onClick={() => handleCopilotSend()}
                  size="sm"
                  disabled={copilotLoading || !copilotInput.trim()}
                  className="h-8 px-3 bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  <Send className="h-3.5 w-3.5"/>
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Modal Xác Nhận Ghi Đè */}
        <RescanConfirmModal isOpen={showRescanModal} onClose={() => setShowRescanModal(false)}
          onConfirm={handleConfirmRescan}
          onCreateNewSession={handleCreateNewSession}
        />
      </div>
    </DashboardShell>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#020617]" />}>
      <ScanLandingContent/>
    </Suspense>
  );
}
