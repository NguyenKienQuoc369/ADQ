"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { Bug, Check, Copy, Download, FileText, Radio, Search, ShieldAlert, Terminal } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModuleFrame, ModuleSection } from "@/components/workspace/module-frame";
import { formatDateTime } from "@/lib/utils";

interface Vulnerability {
  id: number;
  title: string;
  cveId: string;
  severity: string;
  cvss: number;
  host: string;
  endpoint: string;
  source: string;
  rawRequest: string;
  rawResponse: string;
  oastCorrelation: string | null;
  createdAt: string;
}

interface OastCallback {
  id: string;
  timestamp: string;
  remoteIp: string;
  method: string;
  path: string;
  userAgent: string;
  headers: Record<string, string>;
}

export default function VulnerabilityTriageAndOAST() {
  const [activeTab, setActiveTab] = useState<"triage" | "oast">("triage");
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [oastCallbacks, setOastCallbacks] = useState<OastCallback[]>([]);
  const [liveOastPing, setLiveOastPing] = useState<OastCallback | null>(null);
  const [sseConnected, setSseConnected] = useState(false);

  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    // read projectId from browser URL on client mount to avoid SSR useSearchParams issues
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const pid = sp.get("projectId");
      setProjectId(pid);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // fetch vulnerabilities; if projectId present, pass it to the API
        const res = await fetch(`/api/vulnerabilities${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`);
        const data = await res.json();
        if (mounted && data.ok && data.vulnerabilities) {
          setVulnerabilities(data.vulnerabilities);
          setSelectedVuln((current: Vulnerability | null) => current ?? data.vulnerabilities[0] ?? null);
        }
      } catch (err) {
        console.error("Failed to fetch vulnerabilities", err);
      }
    })();

    const eventSource = new EventSource(`/api/oast/stream/sse`);

    eventSource.onopen = () => {
      if (!mounted) return;
      setSseConnected(true);
    };

    eventSource.onmessage = (event) => {
      if (!mounted) return;
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "OAST_PINGBACK" && parsed.data) {
          const newCb = parsed.data;
          setOastCallbacks((prev) => [newCb, ...prev.slice(0, 19)]);
          setLiveOastPing(newCb);
          setTimeout(() => setLiveOastPing(null), 4000);
        }
      } catch (e) {
        console.error("Error parsing OAST SSE stream", e);
      }
    };

    eventSource.onerror = () => {
      if (!mounted) return;
      setSseConnected(false);
      eventSource.close();
    };

    return () => {
      mounted = false;
      eventSource.close();
    };
  }, []);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const exportReport = async (format: "markdown" | "json") => {
    if (!selectedVuln) return;
    try {
      const res = await fetch("/api/vulnerabilities/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vulnerability: selectedVuln, format }),
      });

      if (format === "markdown") {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ADQ_HackerOne_Report_${selectedVuln.cveId || "vuln"}.md`;
        a.click();
      } else {
        const data = await res.json();
        const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const a = document.createElement("a");
        a.href = jsonStr;
        a.download = `ADQ_Report_${selectedVuln.cveId || "vuln"}.json`;
        a.click();
      }
    } catch (err) {
      console.error("Export report failed", err);
    }
  };

  const filteredVulns = vulnerabilities.filter((v) => {
    const matchesSearch =
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.endpoint.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === "ALL" || v.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  const [project, setProject] = useState<any | null>(null);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
        const payload = await res.json();
        if (payload?.ok && payload.project) {
          setProject(payload.project);
        }
      } catch (e) {
        console.error("Failed to load project", e);
      }
    })();
  }, [projectId]);

  const summary = useMemo(
    () => ({
      findings: vulnerabilities.length,
      visible: filteredVulns.length,
      callbacks: oastCallbacks.length,
      stream: sseConnected ? "Active" : "Disconnected",
    }),
    [filteredVulns.length, oastCallbacks.length, sseConnected, vulnerabilities.length],
  );

  return (
    <DashboardShell area="dashboard">
      <ModuleFrame
        icon={Bug}
        eyebrow="Security Modules"
        title="Vulnerability Inbox & OAST"
        description="Không chỉ là danh sách findings. Đây là màn triage tập trung, nơi bạn xem bằng chứng HTTP, xuất report và đối chiếu callback OAST theo thời gian thực."
        stats={[
          { label: "Findings", value: String(summary.findings), variant: "danger" },
          { label: "Visible", value: String(summary.visible), variant: "default" },
          { label: "OAST callbacks", value: String(summary.callbacks), variant: "warning" },
          { label: "Stream", value: summary.stream, variant: sseConnected ? "success" : "warning" },
        ]}
        links={project ? [
          { href: `/dashboard/projects/${project.id}`, label: `Mở project: ${project.domain}` },
          { href: "/dashboard/results", label: "Mở Results & Reports" },
          { href: "/graph", label: "Mở Knowledge Graph" },
        ] : [
          { href: "/dashboard/results", label: "Mở Results & Reports" },
          { href: "/ctem", label: "Kiểm tra CTEM Matrix" },
          { href: "/graph", label: "Mở Knowledge Graph" },
        ]}
      >
        {project ? (
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--foreground-muted)]">Project</p>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">{project.domain}</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border px-3 py-2 text-sm">
                <p className="text-xs text-[var(--foreground-muted)]">Risk Score</p>
                <div className="mt-1 text-xl font-semibold text-[var(--foreground)]">{project.projectDetail?.riskScore ?? 0}</div>
              </div>
              <div className="rounded-2xl border px-3 py-2 text-sm">
                <p className="text-xs text-[var(--foreground-muted)]">Last Scan</p>
                <div className="mt-1 text-sm text-[var(--foreground)]">{project.projectDetail?.lastScanAt ? new Date(project.projectDetail.lastScanAt).toLocaleString() : 'N/A'}</div>
              </div>
            </div>
          </div>
        ) : null}
        {liveOastPing ? (
          <div className="rounded-3xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            OAST pingback mới: [{liveOastPing.method}] {liveOastPing.path} từ {liveOastPing.remoteIp}
          </div>
        ) : null}

        <ModuleSection title="Inbox modes" description="Chuyển nhanh giữa triage lỗ hổng và callback OAST.">
          <div className="flex flex-wrap gap-3">
            <Button variant={activeTab === "triage" ? "default" : "secondary"} onClick={() => setActiveTab("triage")}>
              <ShieldAlert className="h-4 w-4" />
              Triage ({vulnerabilities.length})
            </Button>
            <Button variant={activeTab === "oast" ? "default" : "secondary"} onClick={() => setActiveTab("oast")}>
              <Radio className="h-4 w-4" />
              OAST ({oastCallbacks.length})
            </Button>
          </div>
        </ModuleSection>

        {activeTab === "triage" ? (
          <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
            <ModuleSection title="Finding list" description="Tìm nhanh theo host, endpoint và severity.">
              <div className="space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                  <Input
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo host, endpoint hoặc title..."
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((severity) => (
                    <Button
                      key={severity}
                      size="sm"
                      variant={severityFilter === severity ? "default" : "secondary"}
                      onClick={() => setSeverityFilter(severity)}
                    >
                      {severity}
                    </Button>
                  ))}
                </div>

                <div className="space-y-3">
                  {filteredVulns.map((vuln) => (
                    <button
                      key={vuln.id}
                      type="button"
                      onClick={() => setSelectedVuln(vuln)}
                      className={`w-full rounded-3xl border p-4 text-left transition ${
                        selectedVuln?.id === vuln.id
                          ? "border-rose-500/30 bg-rose-500/10"
                          : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Badge variant={vuln.severity === "CRITICAL" ? "danger" : vuln.severity === "HIGH" ? "warning" : "default"}>
                          {vuln.severity} · {vuln.cvss}
                        </Badge>
                        <span className="text-xs text-slate-500">{vuln.cveId}</span>
                      </div>
                      <p className="font-medium text-slate-100">{vuln.title}</p>
                      <p className="mt-2 text-sm text-slate-400">{vuln.host}</p>
                    </button>
                  ))}

                  {filteredVulns.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-400">
                      Không có findings khớp bộ lọc.
                    </div>
                  ) : null}
                </div>
              </div>
            </ModuleSection>

            <ModuleSection title="Evidence panel" description="Chi tiết kỹ thuật, raw request/response và export báo cáo.">
              {selectedVuln ? (
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant={selectedVuln.severity === "CRITICAL" ? "danger" : selectedVuln.severity === "HIGH" ? "warning" : "default"}>
                          {selectedVuln.severity}
                        </Badge>
                        <Badge variant="muted">{selectedVuln.cveId}</Badge>
                        <Badge variant="muted">{selectedVuln.source}</Badge>
                      </div>
                      <h3 className="text-xl font-semibold text-slate-50">{selectedVuln.title}</h3>
                      <p className="mt-2 text-sm text-slate-400">
                        {selectedVuln.host} · {selectedVuln.endpoint} · {formatDateTime(selectedVuln.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => exportReport("markdown")}>
                        <Download className="h-4 w-4" />
                        Export MD
                      </Button>
                      <Button variant="secondary" onClick={() => exportReport("json")}>
                        <FileText className="h-4 w-4" />
                        Export JSON
                      </Button>
                    </div>
                  </div>

                  <EvidenceBlock
                    title="Raw HTTP Request"
                    tone="emerald"
                    copied={copiedField === "req"}
                    onCopy={() => handleCopy(selectedVuln.rawRequest, "req")}
                    content={selectedVuln.rawRequest}
                  />

                  <EvidenceBlock
                    title="Raw HTTP Response"
                    tone="blue"
                    copied={copiedField === "res"}
                    onCopy={() => handleCopy(selectedVuln.rawResponse, "res")}
                    content={selectedVuln.rawResponse}
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-400">
                  Chọn một finding ở cột trái để xem bằng chứng.
                </div>
              )}
            </ModuleSection>
          </div>
        ) : (
          <ModuleSection title="Out-of-band callback feed" description="Theo dõi pingback OAST để xác nhận blind SSRF/RCE và các kiểm thử out-of-band.">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={sseConnected ? "success" : "warning"}>{sseConnected ? "Live stream active" : "Disconnected"}</Badge>
                <span className="text-sm text-slate-400">False positive rate mục tiêu: gần như 0% khi có callback hợp lệ.</span>
              </div>
            </div>
            <div className="space-y-3">
              {oastCallbacks.map((callback) => (
                <div key={callback.id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-slate-100">{callback.path}</p>
                      <p className="text-sm text-slate-400">{formatDateTime(callback.timestamp)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="default">{callback.method}</Badge>
                      <Badge variant="warning">{callback.remoteIp}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400">{callback.userAgent}</p>
                </div>
              ))}
            </div>
          </ModuleSection>
        )}
      </ModuleFrame>
    </DashboardShell>
  );
}

function EvidenceBlock({
  title,
  content,
  onCopy,
  copied,
  tone,
}: {
  title: string;
  content: string;
  onCopy: () => void;
  copied: boolean;
  tone: "emerald" | "blue";
}) {
  const textTone = tone === "emerald" ? "text-emerald-300" : "text-blue-300";
  const iconTone = tone === "emerald" ? "text-emerald-300" : "text-blue-300";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className={`h-4 w-4 ${iconTone}`} />
          <p className="text-sm font-medium text-slate-100">{title}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Đã sao chép" : "Sao chép"}
        </Button>
      </div>
      <pre className={`overflow-x-auto rounded-3xl border border-slate-800 bg-slate-950/90 p-4 text-xs ${textTone}`}>{content}</pre>
    </div>
  );
}
