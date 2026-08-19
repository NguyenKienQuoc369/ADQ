"use client";

import React, { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  ShieldAlert,
  Sparkles,
  Bot,
  Send,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Copy,
  Check,
  Zap,
  Terminal,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  Layers,
  Radio,
  FileCode2,
  Maximize2,
  Minimize2,
  Lock,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { AiAnalysisCard } from "@/components/scan/ai-analysis-card";
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

function FormattedAiMessage({ text }: { text: string }) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-sm leading-relaxed font-sans text-slate-100 antialiased">
      {parts.map((part, index) => {
        if (part.startsWith("```")) {
          const firstLineEnd = part.indexOf("\n");
          const lang = part.slice(3, firstLineEnd > 0 ? firstLineEnd : 3).trim();
          const code = firstLineEnd > 0 ? part.slice(firstLineEnd + 1, -3).trim() : part.slice(3, -3).trim();
          return (
            <div key={index} className="my-3 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-slate-100 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-400">
                <span className="font-mono font-medium text-cyan-400">{lang || "snippet"}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(code)}
                  className="flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700 hover:text-white transition"
                >
                  {copiedCode === code ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto p-3 font-mono text-xs text-emerald-300/90 leading-5">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        const lines = part.split("\n");
        return (
          <div key={index} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} className="h-1" />;

              if (trimmed.startsWith("### ")) {
                return (
                  <h4 key={lIdx} className="mt-3 mb-1 font-bold text-sm text-cyan-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    {renderInline(trimmed.replace(/^###\s+/, ""))}
                  </h4>
                );
              }
              if (trimmed.startsWith("#### ")) {
                return (
                  <h5 key={lIdx} className="mt-2 mb-1 font-semibold text-xs text-slate-200 uppercase tracking-wider">
                    {renderInline(trimmed.replace(/^####\s+/, ""))}
                  </h5>
                );
              }
              if (trimmed.startsWith("---")) {
                return <div key={lIdx} className="my-2 border-t border-slate-700/60" />;
              }
              if (/^(\*|-)\s+/.test(trimmed)) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1.5">
                    <span className="text-cyan-400 mt-0.5">•</span>
                    <div className="flex-1 text-slate-200">{renderInline(trimmed.replace(/^(\*|-)\s+/, ""))}</div>
                  </div>
                );
              }
              if (/^\d+\.\s+/.test(trimmed)) {
                const num = trimmed.match(/^\d+/)?.[0];
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1.5">
                    <span className="font-semibold text-cyan-400">{num}.</span>
                    <div className="flex-1 text-slate-200">{renderInline(trimmed.replace(/^\d+\.\s+/, ""))}</div>
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
  const isProMaxUser = userTier === "PRO_MAX" || userTier === "ENTERPRISE";
  const isProUser = userTier === "PRO" || isProMaxUser;
  const isFreeLimitExceeded = userTier === "FREE" && (user?.scansToday ?? 0) >= 2;
const projectId = searchParams.get("projectId");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [projectName, setProjectName] = useState("");
  const [target, setTarget] = useState("");
  const [tier, setTier] = useState("STARTER");
  const [jobId, setJobId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);

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
        if (detail.summary) {
          const s = detail.summary;
          setSubdomains(s.subdomains ?? 0);
          setLiveHosts(s.liveHosts ?? 0);
          setCrawledUrls(s.crawledUrls ?? 0);
          setOpenPorts(s.openPorts ?? 0);
          setVulnCount(s.totalVulns ?? (s.critical ?? 0) + (s.high ?? 0) + (s.medium ?? 0));
        }

        const findings = detail.findings || {};
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
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [copilotMessages, copilotLoading]);

  useEffect(() => {
    if (!jobId || !isScanning) return;

    let tick = 0;
    const interval = setInterval(async () => {
      tick++;
      try {
        const res = await getScanJobStatus(jobId);
        const job = res?.job || res || {};
        const currentStatus = String(job.status || "").toLowerCase();

        if (currentStatus === "running" || currentStatus === "queued") {
          setNodes((prev) => ({
            ...prev,
            node_recon: { ...prev.node_recon, status: "completed" },
            node_port: { ...prev.node_port, status: tick >= 2 ? "completed" : "running" },
            node_crawl: { ...prev.node_crawl, status: tick >= 4 ? "completed" : tick >= 2 ? "running" : "pending" },
            node_nuclei: { ...prev.node_nuclei, status: tick >= 6 ? "completed" : tick >= 4 ? "running" : "pending" },
            node_secrets: { ...prev.node_secrets, status: tick >= 8 ? "completed" : tick >= 6 ? "running" : "pending" },
            node_logic: { ...prev.node_logic, status: tick >= 9 ? "completed" : tick >= 8 ? "running" : "pending" },
            node_ai: { ...prev.node_ai, status: "running" },
          }));
        }

        if (currentStatus === "done" || currentStatus === "completed") {
          setIsScanning(false);
          clearInterval(interval);

          setNodes((prev) => {
            const updated = { ...prev };
            Object.keys(updated).forEach((k) => {
              updated[k] = { ...updated[k], status: "completed" };
            });
            return updated;
          });

          const httpLive = Array.isArray(job.subdomains?.http_live) ? job.subdomains.http_live : [];
          const allSubs = Array.isArray(job.subdomains?.all) ? job.subdomains.all : [];
          const ports = Array.isArray(job.highlights?.ports) ? job.highlights.ports : [];
          const urls = Array.isArray(job.urls?.combined) ? job.urls.combined : [];
          const nuclei = Array.isArray(job.vulnerabilities?.nuclei) ? job.vulnerabilities.nuclei : [];

          setSubdomains(allSubs.length || (target ? 1 : 0));
          setLiveHosts(httpLive.length || (target ? 1 : 0));
          setCrawledUrls(urls.length);
          setOpenPorts(ports.length || 2);
          setVulnCount(nuclei.length);
          setVulnerabilities(nuclei);

          const rawAdv = safeString(job.action_advice || job.actionAdvice || "");
          setRawActionAdvice(rawAdv);

          let parsedAdvice: ActionAdvice[] = [];
          if (rawAdv.trim()) {
            const lines = rawAdv.split("\n").filter((l) => l.trim() && !l.startsWith("🧭"));
            parsedAdvice = lines.map((l, idx) => ({
              vulnerabilityId: `vuln-${idx}`,
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
        <Card className="border border-slate-800/80 bg-slate-900/90 shadow-xl backdrop-blur-md">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  <CardTitle className="text-2xl font-bold tracking-tight text-white">
                    Recon & Vulnerability Scan
                  </CardTitle>
                </div>
                <CardDescription className="mt-1 text-sm text-slate-400">
                  {projectName ? `Phiên làm việc: ${projectName}` : "Hệ thống quét an ninh tự động hóa đa tầng và AI Copilot."}
                </CardDescription>
              </div>
              {projectId ? (
                <Badge className="border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 font-mono" variant="muted">
                  Session ID: {projectId.slice(0, 14)}...
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Target Mục Tiêu (Cố định theo phiên)</span>
                  {projectId ? (
                    <span className="text-[11px] text-cyan-400 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Đã khóa mục tiêu
                    </span>
                  ) : null}
                </label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    readOnly={Boolean(projectId && target)}
                    placeholder="https://example.com hoặc domain.vn"
                    disabled={isScanning}
                    className="h-12 pl-11 pr-4 border-slate-700 bg-slate-950/80 text-white placeholder:text-slate-500 focus:border-cyan-500 text-sm read-only:text-cyan-300 read-only:bg-slate-950 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Gói SaaS Engine</label>
                <div className="flex gap-2">
                  {(["STARTER", "DEVSEC PRO", "FINTECH MAX"] as string[]).map((t) => {
                    const isAllowed = 
                      t === "STARTER" ||
                      (t === "DEVSEC PRO" && (isProUser || isProMaxUser)) ||
                      (t === "FINTECH MAX" && isProMaxUser);

                    return (
                      <Button
                        key={t}
                        type="button"
                        variant={tier === t ? "default" : "outline"}
                        disabled={isScanning || !isAllowed}
                        onClick={() => isAllowed && setTier(t)}
                        className={
                          !isAllowed
                            ? "h-12 border-slate-900 bg-slate-950/40 text-slate-600 cursor-not-allowed opacity-50 relative"
                            : tier === t
                            ? "h-12 border border-cyan-500/60 bg-cyan-500/20 text-cyan-200 font-medium hover:bg-cyan-500/30"
                            : "h-12 border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white"
                        }
                      >
                        {!isAllowed && <Lock className="h-3 w-3 mr-1 text-slate-600" />}
                        {t}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div></div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              {scanError ? (
                <div className="flex items-center gap-2 text-sm text-rose-400">
                  <AlertCircle className="h-4 w-4" /> {scanError}
                </div>
              ) : (
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" /> Sẵn sàng quét mục tiêu đã liên kết
                </div>
              )}

              <Button
                type="button"
                onClick={startScan}
                disabled={isScanning || !target.trim()}
                className="h-11 px-6 rounded-xl font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isScanning ? (
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin text-white" />
                    Đang quét pipeline...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Zap className="h-4 w-4 fill-white" />
                    Bắt đầu quét
                  </span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-800/80 bg-slate-900/90 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-cyan-400" />
              Live DAG Execution Visualizer (Tiến trình quét liên hoàn)
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Theo dõi luồng thực thi dữ liệu giữa các công cụ bảo mật từ Recon đến AI Analysis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              {nodeArray.map((node, index) => {
                const IconComponent = node.icon;
                const isLast = index === nodeArray.length - 1;

                return (
                  <React.Fragment key={node.id}>
                    <div
                      className={`flex flex-col gap-1.5 rounded-xl border p-3 min-w-[135px] flex-1 transition-all ${
                        node.status === "running"
                          ? "border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/50"
                          : node.status === "completed"
                          ? "border-emerald-500/60 bg-emerald-950/20 text-slate-200"
                          : node.status === "failed"
                          ? "border-rose-500/60 bg-rose-950/20"
                          : "border-slate-800 bg-slate-900/60 opacity-65"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">
                          {node.step}
                        </span>
                        {node.status === "running" ? (
                          <LoaderCircle className="h-4 w-4 animate-spin text-cyan-400" />
                        ) : node.status === "completed" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <IconComponent className="h-4 w-4 text-slate-500" />
                        )}
                      </div>
                      <div className="mt-1 text-xs font-bold text-white truncate">{node.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">{node.sublabel}</div>
                    </div>

                    {!isLast ? (
                      <div className="hidden lg:flex items-center justify-center px-1">
                        <ArrowRight
                          className={`h-4 w-4 ${
                            node.status === "completed"
                              ? "text-emerald-400"
                              : node.status === "running"
                              ? "text-cyan-400 animate-pulse"
                              : "text-slate-700"
                          }`}
                        />
                      </div>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
                <div className="text-xs text-slate-400">Subdomains</div>
                <div className="mt-1 text-2xl font-bold text-cyan-400">{subdomains}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
                <div className="text-xs text-slate-400">Live Hosts</div>
                <div className="mt-1 text-2xl font-bold text-emerald-400">{liveHosts}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
                <div className="text-xs text-slate-400">Cổng Dịch Vụ</div>
                <div className="mt-1 text-2xl font-bold text-amber-400">{openPorts}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
                <div className="text-xs text-slate-400">Lỗ Hổng Nuclei</div>
                <div className="mt-1 text-2xl font-bold text-rose-400">{vulnCount}</div>
              </div>
            </div>

            <Card className="border border-slate-800 bg-slate-900/90 shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-400" />
                      AI Action Advice (Nguyên nhân & Hành động gợi ý)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                      Được tự động đúc kết từ kết quả trinh sát và phát hiện lỗ hổng.
                    </CardDescription>
                  </div>
                  {actionAdvice.length > 0 ? (
                    <Badge className="border-emerald-500/40 text-emerald-300 text-xs" variant="muted">
                      {actionAdvice.length} khuyến nghị
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {actionAdvice.length > 0 ? (
                  <div className="space-y-2.5">
                    {actionAdvice.map((adv, idx) => (
                      <div
                        key={idx}
                        className="group flex items-start gap-3 rounded-xl border border-slate-800/90 bg-slate-950/60 p-3 hover:border-slate-700 transition"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-xs font-bold text-emerald-400">
                          {idx + 1}
                        </span>
                        <div className="flex-1 text-xs text-slate-200 leading-5">
                          {adv.rootCause}
                        </div>
                        <Button
                          onClick={() =>
                            handleCopilotSend(
                              `Hãy hướng dẫn chi tiết cách thực hiện hành động này: "${adv.rootCause}"`
                            )
                          }
                          size="sm"
                          type="button"
                          variant="ghost"
                          className="shrink-0 h-7 text-[11px] text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/10"
                        >
                          Hỏi AI <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <AiAnalysisCard 
                    userTier={userTier} 
                    aiSummary={rawActionAdvice} 
                    target={target} 
                  />
                )}
              </CardContent>
            </Card>

            <Card className="border border-slate-800 bg-slate-900/90 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                  Lỗ hổng bảo mật & Phát hiện CVE
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vulnerabilities.length > 0 ? (
                  <div className="space-y-2">
                    {vulnerabilities.map((v, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3">
                        <div>
                          <div className="text-xs font-bold text-slate-100">{v.title}</div>
                          <div className="text-[11px] font-mono text-slate-400">{v.endpoint}</div>
                        </div>
                        <Badge className="text-[10px]" variant="danger">{v.severity || "MEDIUM"}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 text-center py-4">
                    Không tìm thấy lỗ hổng CRITICAL/HIGH tức thì trên các endpoint công khai.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-5">
            <Card className="flex flex-col h-full border border-slate-800/80 bg-slate-900/90 shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-white">ADQ Security Copilot</CardTitle>
                      <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        AI Agent Active (Gemini Engine)
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => setIsChatExpanded(true)}
                    size="sm"
                    type="button"
                    variant="outline"
                    className="h-7 text-[11px] border-slate-700 bg-slate-800/60 text-slate-300 hover:text-white"
                  >
                    <Maximize2 className="mr-1 h-3 w-3" /> Mở rộng
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col justify-between p-4 space-y-3">
                <div className="h-[430px] overflow-y-auto space-y-3.5 pr-1.5">
                  {copilotMessages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[90%] rounded-2xl p-3.5 text-xs ${
                          m.sender === "user"
                            ? "bg-cyan-600 text-white rounded-br-none shadow-md"
                            : "bg-slate-950/90 border border-slate-800/90 rounded-bl-none shadow-md"
                        }`}
                      >
                        {m.sender === "copilot" ? (
                          <FormattedAiMessage text={m.text} />
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {copilotLoading ? (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-bl-none border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400 flex items-center gap-2">
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                        Copilot đang suy nghĩ...
                      </div>
                    </div>
                  ) : null}
                  <div ref={chatBottomRef} />
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => handleCopilotSend("Hãy hướng dẫn tôi tạo file vercel.json có đầy đủ security headers bảo mật nhất.")}
                    className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-cyan-300 hover:bg-slate-800 hover:text-white transition flex items-center gap-1"
                  >
                    <FileCode2 className="h-3 w-3" /> vercel.json mẫu
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopilotSend("Làm thế nào để phòng chống lỗi BOLA và XSS trên ứng dụng này?")}
                    className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-emerald-300 hover:bg-slate-800 hover:text-white transition flex items-center gap-1"
                  >
                    <ShieldCheck className="h-3 w-3" /> Vá BOLA & XSS
                  </button>
                </div>

                <div className="flex gap-2 pt-1">
                  <Input
                    value={copilotInput}
                    onChange={(e) => setCopilotInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCopilotSend()}
                    placeholder="Hỏi cách vá lỗi, kiểm tra bảo mật..."
                    className="h-10 text-xs border-slate-700 bg-slate-950 text-white placeholder:text-slate-500 focus:border-cyan-500"
                  />
                  <Button
                    onClick={() => handleCopilotSend()}
                    type="button"
                    disabled={copilotLoading || !copilotInput.trim()}
                    className="h-10 px-3.5 bg-cyan-600 hover:bg-cyan-500 text-white shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {isChatExpanded && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsChatExpanded(false)} />
            <div className="relative z-10 flex flex-col h-full max-h-[90vh] w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 p-4 bg-slate-950">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">ADQ Security Copilot — Full Workspace</h3>
                    <p className="text-xs font-mono text-cyan-400">Target: {target || "Chưa có"} | Phiên: {projectId || "Tạm thời"}</p>
                  </div>
                </div>
                <Button
                  onClick={() => setIsChatExpanded(false)}
                  size="sm"
                  type="button"
                  variant="outline"
                  className="border-slate-800 text-slate-300"
                >
                  <Minimize2 className="mr-1.5 h-4 w-4" /> Thu nhỏ
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/60">
                {copilotMessages.map((m, idx) => (
                  <div key={idx} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-sm ${
                        m.sender === "user"
                          ? "bg-cyan-600 text-white rounded-br-none shadow-md"
                          : "bg-slate-900 border border-slate-800 rounded-bl-none shadow-md"
                      }`}
                    >
                      {m.sender === "copilot" ? (
                        <FormattedAiMessage text={m.text} />
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                      )}
                    </div>
                  </div>
                ))}
                {copilotLoading ? (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-none border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin text-cyan-400" />
                      Copilot đang suy nghĩ...
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-950 flex gap-2">
                <Input
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCopilotSend()}
                  placeholder="Nhập câu hỏi hoặc yêu cầu sinh mã khắc phục..."
                  className="h-12 border-slate-800 bg-slate-900 text-white"
                />
                <Button
                  onClick={() => handleCopilotSend()}
                  type="button"
                  disabled={copilotLoading || !copilotInput.trim()}
                  className="h-12 px-6 bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default function ScanLandingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-slate-400">
          Loading scan pipeline...
        </div>
      }
    >
      <ScanLandingContent />
    </Suspense>
  );
}
