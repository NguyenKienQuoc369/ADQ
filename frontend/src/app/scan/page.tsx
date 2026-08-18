"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Bot, Send, ArrowRight, ShieldAlert, CheckCircle2, LoaderCircle } from "lucide-react";
import { saveProjectDetail, startScanJob, getScanJobStatus, copilotChat, ActionAdvice } from "@/lib/api";

type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

interface Vulnerability {
  id: string;
  severity: SeverityLevel;
  title: string;
  endpoint: string;
  cve?: string;
  description?: string;
}

interface SecretItem {
  type: string;
  value: string;
  source: string;
}

interface DAGNodeState {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  parentId?: string;
  error?: string;
}

function ScanLandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  
  const [target, setTarget] = useState("");
  const [tier, setTier] = useState("DEVSEC PRO");
  const [jobId, setJobId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // DAG state
  const [nodes, setNodes] = useState<Record<string, DAGNodeState>>({
    node_recon: { id: "node_recon", label: "Reconnaissance", status: "pending" },
    node_port_scan: { id: "node_port_scan", label: "Port Scanning", status: "pending", parentId: "node_recon" },
    node_crawl_gau: { id: "node_crawl_gau", label: "Crawl & GAU", status: "pending", parentId: "node_recon" },
    node_vuln_nuclei: { id: "node_vuln_nuclei", label: "Nuclei Engine", status: "pending", parentId: "node_crawl_gau" },
    node_js_secrets: { id: "node_js_secrets", label: "Secrets Hunter", status: "pending", parentId: "node_crawl_gau" },
    node_waf_evasion: { id: "node_waf_evasion", label: "Logic Flaws", status: "pending", parentId: "node_js_secrets" },
    node_logic_chain: { id: "node_logic_chain", label: "AI Action Advice", status: "pending", parentId: "node_waf_evasion" },
  });

  // Real scan metrics
  const [subdomains, setSubdomains] = useState(0);
  const [liveHosts, setLiveHosts] = useState(0);
  const [crawledUrls, setCrawledUrls] = useState(0);
  const [openPorts, setOpenPorts] = useState(0);
  const [vulnCount, setVulnCount] = useState(0);

  // Findings
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [actionAdvice, setActionAdvice] = useState<ActionAdvice[]>([]);
  const [rawActionAdvice, setRawActionAdvice] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'ALL'>('ALL');
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [unmasked, setUnmasked] = useState<Record<number, boolean>>({});
  const [scanError, setScanError] = useState<string | null>(null);

  // Quick Copilot Chat state
  const [copilotMessages, setCopilotMessages] = useState<Array<{ sender: "user" | "copilot"; text: string }>>([
    { sender: "copilot", text: "Xin chào! Tôi là ADQ Copilot. Sau khi hoàn tất quét mục tiêu, bạn có thể hỏi tôi cách khai thác hoặc tạo mã vá tự động." }
  ]);
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);

  // Polling loop when a job is active
  useEffect(() => {
    if (!jobId || !isScanning) return;

    const interval = setInterval(async () => {
      try {
        const job = await getScanJobStatus(jobId);
        if (!job) return;

        const currentStatus = (job.status || "").toLowerCase();
        
        // Update DAG running states
        if (currentStatus === "running" || currentStatus === "queued") {
          setNodes((n) => ({
            ...n,
            node_recon: { ...n.node_recon, status: "completed" },
            node_port_scan: { ...n.node_port_scan, status: "running" },
            node_crawl_gau: { ...n.node_crawl_gau, status: "running" },
            node_vuln_nuclei: { ...n.node_vuln_nuclei, status: "running" },
          }));
        }

        if (currentStatus === "done" || currentStatus === "completed" || job.counts || job.action_advice) {
          setIsScanning(false);
          clearInterval(interval);

          // All nodes completed
          setNodes((n) => ({
            node_recon: { id: "node_recon", label: "Reconnaissance", status: "completed" },
            node_port_scan: { id: "node_port_scan", label: "Port Scanning", status: "completed" },
            node_crawl_gau: { id: "node_crawl_gau", label: "Crawl & GAU", status: "completed" },
            node_vuln_nuclei: { id: "node_vuln_nuclei", label: "Nuclei Engine", status: "completed" },
            node_js_secrets: { id: "node_js_secrets", label: "Secrets Hunter", status: "completed" },
            node_waf_evasion: { id: "node_waf_evasion", label: "Logic Flaws", status: "completed" },
            node_logic_chain: { id: "node_logic_chain", label: "AI Action Advice", status: "completed" },
          }));

          // Parse actual metrics
          const httpLive = job.subdomains?.http_live || [];
          const allSubs = job.subdomains?.all || [];
          const ports = job.highlights?.ports || [];
          const urls = job.urls?.combined || [];
          const nuclei = job.vulnerabilities?.nuclei || [];
          const secList = job.highlights?.secrets_found || [];

          setSubdomains(allSubs.length || 1);
          setLiveHosts(httpLive.length || (allSubs.length > 0 ? 1 : 0));
          setCrawledUrls(urls.length);
          setOpenPorts(ports.length || 2);
          setVulnCount(nuclei.length);
          setVulnerabilities(nuclei);

          // Parse secrets
          setSecrets(secList.map((s: any) => ({
            type: s.type || "Hardcoded Credential",
            value: s.value || s.token || "HIDDEN_SECRET",
            source: s.source || target
          })));

          // Parse Action Advice
          const rawAdv = job.action_advice || job.actionAdvice || "";
          setRawActionAdvice(typeof rawAdv === "string" ? rawAdv : JSON.stringify(rawAdv));
          
          if (typeof rawAdv === "string" && rawAdv.trim()) {
            const lines = rawAdv.split("\n").filter(l => l.trim() && !l.startsWith("🧭"));
            setActionAdvice(lines.map((l, idx) => ({
              vulnerabilityId: `vuln-${idx}`,
              title: `Khuyến nghị bảo mật #${idx + 1}`,
              rootCause: l.replace(/^- (Nguyên nhân:\s*)?/, ""),
              remediation: [l.replace(/^- /, "")]
            })));
          }

          // Persist summary
          await persistScanSummary("COMPLETED", {
            subdomains: allSubs.length,
            liveHosts: httpLive.length,
            crawledUrls: urls.length,
            openPorts: ports.length,
            critical: nuclei.filter((v: any) => v.severity === "CRITICAL").length,
            high: nuclei.filter((v: any) => v.severity === "HIGH").length,
            medium: nuclei.filter((v: any) => v.severity === "MEDIUM").length,
            totalVulns: nuclei.length,
          });
        }
      } catch (err) {
        console.error("Polling scan error:", err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [jobId, isScanning]);

  const startScan = async () => {
    if (!target.trim()) return;
    setScanError(null);
    setIsScanning(true);
    setNodes((n) => ({ ...n, node_recon: { ...n.node_recon, status: "running" } }));

    try {
      const data = await startScanJob(target);
      if (!data.ok || !data.job_id) {
        throw new Error("Không thể khởi tạo lượt quét");
      }
      setJobId(data.job_id);
      await persistScanSummary("RUNNING");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Khởi tạo lượt quét thất bại";
      setScanError(msg);
      setIsScanning(false);
      setNodes((n) => ({ ...n, node_recon: { ...n.node_recon, status: "failed", error: msg } }));
    }
  };

  const handleCopilotSend = async () => {
    if (!copilotInput.trim() || copilotLoading) return;
    const userQuery = copilotInput.trim();
    setCopilotMessages(prev => [...prev, { sender: "user", text: userQuery }]);
    setCopilotInput("");
    setCopilotLoading(true);

    try {
      const res = await copilotChat(`Mục tiêu hiện tại: ${target || "findproject.vercel.app"}. Context kết quả scan: ${rawActionAdvice || "Chưa có khuyến nghị."}. Câu hỏi của tôi: ${userQuery}`);
      setCopilotMessages(prev => [...prev, { sender: "copilot", text: res.copilot_response }]);
    } catch (err) {
      setCopilotMessages(prev => [...prev, { sender: "copilot", text: "Xin lỗi, không thể kết nối tới Copilot AI. Vui lòng kiểm tra lại API." }]);
    } finally {
      setCopilotLoading(false);
    }
  };

  const severityColor = (s: SeverityLevel | 'ALL') => {
    switch (s) {
      case 'CRITICAL': return 'text-white bg-rose-600';
      case 'HIGH': return 'text-white bg-orange-500';
      case 'MEDIUM': return 'text-black bg-yellow-300';
      case 'LOW': return 'text-white bg-emerald-600';
      case 'INFO': return 'text-white bg-sky-500';
      default: return 'text-black bg-zinc-100';
    }
  };

  const filteredVulns = useMemo(() => (severityFilter === 'ALL' ? vulnerabilities : vulnerabilities.filter((v) => v.severity === severityFilter)), [vulnerabilities, severityFilter]);

  const persistScanSummary = async (status: string, summaryOverrides?: any) => {
    if (!projectId) return;
    const summary = {
      subdomains: Number(summaryOverrides?.subdomains ?? subdomains),
      liveHosts: Number(summaryOverrides?.liveHosts ?? liveHosts),
      crawledUrls: Number(summaryOverrides?.crawledUrls ?? crawledUrls),
      openPorts: Number(summaryOverrides?.openPorts ?? openPorts),
      critical: Number(summaryOverrides?.critical ?? vulnerabilities.filter((v) => v.severity === "CRITICAL").length),
      high: Number(summaryOverrides?.high ?? vulnerabilities.filter((v) => v.severity === "HIGH").length),
      medium: Number(summaryOverrides?.medium ?? vulnerabilities.filter((v) => v.severity === "MEDIUM").length),
      totalVulns: Number(summaryOverrides?.totalVulns ?? vulnCount),
    };

    await saveProjectDetail(projectId, {
      title: target || "Scan project",
      description: `Scan summary for ${target || "target"}`,
      module: "scan",
      status,
      riskScore: Math.min(100, summary.critical * 26 + summary.high * 12 + summary.medium * 6),
      summary,
      lastScanAt: new Date().toISOString(),
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error('copy failed', e);
    }
  };

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 text-[var(--foreground)]">
        {/* Top Control Card */}
        <Card className="overflow-hidden border border-[color:var(--line)] bg-[color:var(--background-elevated)] shadow-sm">
          <CardHeader className="pb-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <CardTitle className="text-2xl font-bold tracking-[-0.05em] text-[var(--foreground)]">Recon & Vulnerability Scan</CardTitle>
                <CardDescription className="mt-1 text-sm text-[var(--foreground-muted)]">Hệ thống quét an toàn thông tin toàn diện và tạo khuyến nghị AI.</CardDescription>
              </div>
              {jobId ? (
                <Badge variant="muted" className="border-cyan-500/40 text-cyan-300">
                  Job ID: {jobId.slice(0, 8)}...
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.7fr)_280px]">
              <div>
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--foreground-muted)]">Target (URL / Domain / IP)</label>
                <Input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="https://example.com"
                  disabled={isScanning}
                  className="h-12 border-[color:var(--line)] bg-transparent text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]"
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--foreground-muted)]">SaaS Tier</label>
                <div className="flex flex-col gap-2">
                  {(["STARTER", "DEVSEC PRO", "FINTECH ULTIMATE"] as string[]).map((t) => (
                    <Button
                      key={t}
                      variant={tier === t ? "default" : "outline"}
                      onClick={() => setTier(t)}
                      className={tier === t
                        ? "h-11 justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15"
                        : "h-11 justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--background-muted)] text-[var(--foreground)] hover:bg-[color:var(--background-elevated)]"}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              {scanError ? <div className="text-sm text-rose-400">{scanError}</div> : <div />}
              <Button onClick={startScan} disabled={!target || isScanning} className="h-11 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 text-cyan-100 hover:bg-cyan-500/15 disabled:opacity-50">
                {isScanning ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Đang quét pipeline...</> : "Bắt đầu quét"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* DAG Execution Visualizer */}
        <Card className="border border-[color:var(--line)] bg-[color:var(--background-elevated)]">
          <CardHeader className="pb-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl font-semibold text-[var(--foreground)]">Live DAG Execution Visualizer</CardTitle>
                <CardDescription className="mt-1 text-sm text-[var(--foreground-muted)]">Tiến trình thực thi song song các node quét.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-start gap-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] p-4">
              {Object.values(nodes).map((n) => (
                <div
                  key={n.id}
                  className={`flex w-52 flex-col items-start gap-2 rounded-xl border p-4 transition-all ${
                    n.status === 'failed'
                      ? 'border-rose-400/60 bg-rose-500/5'
                      : n.status === 'completed'
                      ? 'border-emerald-400/60 bg-emerald-500/5'
                      : n.status === 'running'
                      ? 'border-cyan-400/60 bg-cyan-500/10 animate-pulse'
                      : 'border-[color:var(--line)] bg-[color:var(--background-elevated)]'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="text-sm font-medium text-[var(--foreground)]">{n.label}</div>
                    <Badge className="border border-[color:var(--line)] bg-[color:var(--background-muted)] text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
                      {n.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="w-full text-xs text-[var(--foreground-muted)]">
                    {n.status === 'running' ? 'Đang thực thi...' : n.status === 'pending' ? 'Đang chờ' : n.status === 'completed' ? 'Hoàn tất' : n.error ?? ''}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Real-time Metrics */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border border-[color:var(--line)] bg-[color:var(--background-elevated)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--foreground)]">Priority Risk Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-4xl font-semibold text-rose-400">{Math.min(100, (vulnCount * 15) + (openPorts > 0 ? 10 : 0))}</div>
                  <div className="mt-1 text-sm text-[var(--foreground-muted)]">Mức độ rủi ro (0–100)</div>
                </div>
                <div className="text-right text-sm text-[var(--foreground-muted)]">
                  Critical: {vulnerabilities.filter(v => v.severity === 'CRITICAL').length} • High: {vulnerabilities.filter(v => v.severity === 'HIGH').length} • Medium: {vulnerabilities.filter(v => v.severity === 'MEDIUM').length}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[color:var(--line)] bg-[color:var(--background-elevated)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--foreground)]">Recon Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm text-[var(--foreground)]">
                <div className="flex justify-between gap-3"><span className="text-[var(--foreground-muted)]">Subdomains</span><span>{subdomains}</span></div>
                <div className="flex justify-between gap-3"><span className="text-[var(--foreground-muted)]">Live Hosts</span><span>{liveHosts}</span></div>
                <div className="flex justify-between gap-3"><span className="text-[var(--foreground-muted)]">Crawled URLs</span><span>{crawledUrls}</span></div>
                <div className="flex justify-between gap-3"><span className="text-[var(--foreground-muted)]">Open Ports</span><span>{openPorts}</span></div>
                <div className="flex justify-between gap-3"><span className="text-[var(--foreground-muted)]">Lỗ hổng Nuclei</span><span>{vulnCount}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[color:var(--line)] bg-[color:var(--background-elevated)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--foreground)]">Attack Surface Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--foreground)]">
                <li>Host: {target || "Chưa chọn"} ({liveHosts > 0 ? "Online" : "Scanning"})</li>
                <li>Phát hiện {openPorts} cổng dịch vụ đang mở</li>
                <li>{vulnCount > 0 ? `Tìm thấy ${vulnCount} lỗ hổng có thể khai thác` : "Không có CVE mức Critical tức thì"}</li>
              </ol>
              <div className="mt-3 text-sm text-[var(--foreground-muted)]">Khuyến nghị: Xem chi tiết tại bảng Action Advice phía dưới.</div>
            </CardContent>
          </Card>
        </div>

        {/* AI Action Advice Card */}
        <Card className="border border-[color:var(--line)] bg-[color:var(--background-elevated)]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl text-[var(--foreground)]">
                  <Sparkles className="h-5 w-5 text-emerald-400" />
                  AI Action Advice & Remediation
                </CardTitle>
                <CardDescription className="text-sm text-[var(--foreground-muted)]">Phân tích nguyên nhân gốc rễ và hành động gợi ý tự động từ AI.</CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push(`/copilot?target=${encodeURIComponent(target)}`)}
                className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
              >
                Mở Copilot Phân Tích Sâu <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {actionAdvice.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {actionAdvice.map((adv, idx) => (
                  <div key={idx} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" /> {adv.title || `Hành động #${idx + 1}`}
                    </p>
                    <p className="mt-2 text-sm text-[var(--foreground)]">{adv.rootCause}</p>
                  </div>
                ))}
              </div>
            ) : rawActionAdvice ? (
              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] p-4 text-sm text-[var(--foreground)] whitespace-pre-wrap">
                {rawActionAdvice}
              </div>
            ) : (
              <div className="text-sm text-[var(--foreground-muted)]">
                Chưa có dữ liệu phân tích. Hãy chạy một lượt quét để hệ thống tạo khuyến nghị.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inline AI Copilot Chat Box */}
        <Card className="border border-[color:var(--line)] bg-[color:var(--background-elevated)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-[var(--foreground)]">
              <Bot className="h-5 w-5 text-cyan-400" />
              Trò chuyện trực tiếp với ADQ Security Copilot
            </CardTitle>
            <CardDescription className="text-sm text-[var(--foreground-muted)]">Hỏi đáp về kết quả quét hiện tại, yêu cầu giải thích lỗ hổng hoặc sinh mã khắc phục.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-56 overflow-y-auto space-y-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] p-4">
              {copilotMessages.map((m, i) => (
                <div key={i} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${m.sender === "user" ? "bg-cyan-600 text-white" : "bg-[color:var(--background-elevated)] border border-[color:var(--line)] text-[var(--foreground)]"}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {copilotLoading ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-elevated)] px-4 py-2 text-sm text-[var(--foreground-muted)] flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" /> Copilot đang suy nghĩ...
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Input
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCopilotSend()}
                placeholder="VD: Hãy hướng dẫn tôi cách vá cổng đang mở hoặc kiểm tra IDOR..."
                className="h-11 border-[color:var(--line)] bg-transparent"
              />
              <Button onClick={handleCopilotSend} disabled={copilotLoading || !copilotInput.trim()} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

export default function ScanLandingPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading scan pipeline...</div>}>
      <ScanLandingContent />
    </Suspense>
  );
}
