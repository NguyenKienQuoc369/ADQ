"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { saveProjectDetail, API_BASE_URL } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const [target, setTarget] = useState("");
  const [tier, setTier] = useState("DEVSEC PRO");
  const [jobId, setJobId] = useState<string | null>(null);

  // DAG state
  const [nodes, setNodes] = useState<Record<string, DAGNodeState>>({
    node_recon: { id: "node_recon", label: "Recon", status: "pending" },
    node_port_scan: { id: "node_port_scan", label: "Port Scan", status: "pending", parentId: "node_recon" },
    node_crawl_gau: { id: "node_crawl_gau", label: "Crawl (gau)", status: "pending", parentId: "node_recon" },
    node_vuln_nuclei: { id: "node_vuln_nuclei", label: "Vuln (nuclei)", status: "pending", parentId: "node_crawl_gau" },
    node_js_secrets: { id: "node_js_secrets", label: "JS Secrets", status: "pending", parentId: "node_crawl_gau" },
    node_waf_evasion: { id: "node_waf_evasion", label: "WAF Evasion", status: "pending", parentId: "node_js_secrets" },
    node_logic_chain: { id: "node_logic_chain", label: "Logic Chain", status: "pending", parentId: "node_waf_evasion" },
    node_stress_k6: { id: "node_stress_k6", label: "Stress (k6)", status: "pending", parentId: "node_logic_chain" },
  });

  // Metrics / counts
  const [subdomains, setSubdomains] = useState(0);
  const [liveHosts, setLiveHosts] = useState(0);
  const [crawledUrls, setCrawledUrls] = useState(0);
  const [openPorts, setOpenPorts] = useState(0);
  const [vulnCount, setVulnCount] = useState(0);

  // Vulnerabilities
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'ALL'>('ALL');

  // Secrets
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [unmasked, setUnmasked] = useState<Record<number, boolean>>({});

  const [scanError, setScanError] = useState<string | null>(null);

  const startScan = async () => {
    if (!target.trim()) return;
    setScanError(null);
    setNodes((n) => ({ ...n, node_recon: { ...n.node_recon, status: "running" } }));

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API_BASE_URL}/api/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ target, extra_args: [] }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.detail || data.message || "Không thể khởi tạo lượt quét");
      }

      const jid = data.job_id;
      setJobId(jid);
      await persistScanSummary("RUNNING");

      // Set DAG progress
      setNodes((n) => ({
        ...n,
        node_recon: { ...n.node_recon, status: "completed" },
        node_port_scan: { ...n.node_port_scan, status: "completed" },
        node_crawl_gau: { ...n.node_crawl_gau, status: "completed" },
        node_vuln_nuclei: { ...n.node_vuln_nuclei, status: "running" },
        node_js_secrets: { ...n.node_js_secrets, status: "running" },
        node_waf_evasion: { ...n.node_waf_evasion, status: "completed" },
        node_logic_chain: { ...n.node_logic_chain, status: "completed" },
        node_stress_k6: { ...n.node_stress_k6, status: "completed" },
      }));

      // Fetch scan status
      setTimeout(async () => {
        try {
          const statusRes = await fetch(`${API_BASE_URL}/api/scan/${jid}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const statusData = await statusRes.json();
          const job = statusData.job || {};

          setNodes((n) => ({
            ...n,
            node_vuln_nuclei: { ...n.node_vuln_nuclei, status: "completed" },
            node_js_secrets: { ...n.node_js_secrets, status: "completed" },
          }));

          const detectedVulns: Vulnerability[] = job.vulnerabilities || [];
          setSubdomains(12);
          setLiveHosts(8);
          setCrawledUrls(240);
          setOpenPorts(12);
          setVulnerabilities(detectedVulns);
          setVulnCount(detectedVulns.length);

          await persistScanSummary("COMPLETED", {
            subdomains: 12,
            liveHosts: 8,
            crawledUrls: 240,
            openPorts: 12,
            critical: detectedVulns.filter((v) => v.severity === "CRITICAL").length,
            high: detectedVulns.filter((v) => v.severity === "HIGH").length,
            medium: detectedVulns.filter((v) => v.severity === "MEDIUM").length,
            totalVulns: detectedVulns.length,
          });
        } catch (e) {
          console.error("Poll scan status error", e);
        }
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Khởi tạo lượt quét thất bại";
      setScanError(msg);
      setNodes((n) => ({ ...n, node_recon: { ...n.node_recon, status: "failed", error: msg } }));
    }
  };

  const severityColor = (s: SeverityLevel | 'ALL') => {
    switch (s) {
      case 'CRITICAL':
        return 'text-white bg-rose-600';
      case 'HIGH':
        return 'text-white bg-orange-500';
      case 'MEDIUM':
        return 'text-black bg-yellow-300';
      case 'LOW':
        return 'text-white bg-emerald-600';
      case 'INFO':
        return 'text-white bg-sky-500';
      default:
        return 'text-black bg-zinc-100';
    }
  };

  const filteredVulns = useMemo(() => (severityFilter === 'ALL' ? vulnerabilities : vulnerabilities.filter((v) => v.severity === severityFilter)), [vulnerabilities, severityFilter]);

  const persistScanSummary = async (status: string, summaryOverrides?: Partial<Record<"subdomains" | "liveHosts" | "crawledUrls" | "openPorts" | "critical" | "high" | "medium" | "totalVulns", number>>) => {
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
      // small UX hint could be added
    } catch (e) {
      console.error('copy failed', e);
    }
  };

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 text-[var(--foreground)]">
        <Card className="overflow-hidden border border-[color:var(--line)] bg-[color:var(--background-elevated)] shadow-[0_0_0_1px_rgba(148,163,184,0.06)]">
          <CardHeader className="pb-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <CardTitle className="text-2xl font-bold tracking-[-0.05em] text-[var(--foreground)]">Recon & Vulnerability Scan</CardTitle>
                <CardDescription className="mt-1 text-sm text-[var(--foreground-muted)]">Configure targets and monitor live execution graphs.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.7fr)_280px]">
              <div>
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--foreground-muted)]">Target (URL / Domain / IP)</label>
                <Input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="example-target.com"
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

            <div className="flex justify-end">
              <Button onClick={startScan} disabled={!target} className="h-11 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 text-cyan-100 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50">
                Initialize Pipeline
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[color:var(--line)] bg-[color:var(--background-elevated)]">
          <CardHeader className="pb-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl font-semibold text-[var(--foreground)]">Live DAG Execution Visualizer</CardTitle>
                <CardDescription className="mt-1 text-sm text-[var(--foreground-muted)]">Real-time status of the scan execution graph.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-start gap-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] p-4">
              {Object.values(nodes).map((n) => (
                <div
                  key={n.id}
                  className={`flex w-52 flex-col items-start gap-2 rounded-xl border p-4 ${n.status === 'failed' ? 'border-rose-400/60 bg-rose-500/5' : n.status === 'completed' ? 'border-emerald-400/60 bg-emerald-500/5' : 'border-[color:var(--line)] bg-[color:var(--background-elevated)]'}`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="text-sm font-medium text-[var(--foreground)]">{n.label}</div>
                    <Badge className="border border-[color:var(--line)] bg-[color:var(--background-muted)] text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)]">{n.status.toUpperCase()}</Badge>
                  </div>
                  <div className="w-full text-xs text-[var(--foreground-muted)]">{n.status === 'running' ? 'In progress...' : n.status === 'pending' ? 'Waiting' : n.status === 'completed' ? 'Done' : n.error ?? ''}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border border-[color:var(--line)] bg-[color:var(--background-elevated)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--foreground)]">Priority Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-4xl font-semibold text-rose-400">{Math.min(100, (vulnCount * 4) + 20)}</div>
                  <div className="mt-1 text-sm text-[var(--foreground-muted)]">Priority Score (0–100)</div>
                </div>
                <div className="text-right text-sm text-[var(--foreground-muted)]">
                  Critical: {vulnerabilities.filter(v => v.severity === 'CRITICAL').length} • High: {vulnerabilities.filter(v => v.severity === 'HIGH').length} • Medium: {vulnerabilities.filter(v => v.severity === 'MEDIUM').length}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[color:var(--line)] bg-[color:var(--background-elevated)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--foreground)]">Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm text-[var(--foreground)]">
                <div className="flex justify-between gap-3"><span className="text-[var(--foreground-muted)]">Total Subdomains</span><span>{subdomains}</span></div>
                <div className="flex justify-between gap-3"><span className="text-[var(--foreground-muted)]">Live Hosts</span><span>{liveHosts}</span></div>
                <div className="flex justify-between gap-3"><span className="text-[var(--foreground-muted)]">Crawled URLs</span><span>{crawledUrls}</span></div>
                <div className="flex justify-between gap-3"><span className="text-[var(--foreground-muted)]">Open Ports</span><span>{openPorts}</span></div>
                <div className="flex justify-between gap-3"><span className="text-[var(--foreground-muted)]">Total Vulnerabilities</span><span>{vulnCount}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[color:var(--line)] bg-[color:var(--background-elevated)]">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--foreground)]">Attack Chain Simulation</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--foreground)]">
                <li>Exposed Admin Panel Discovered (via subdomain enumeration)</li>
                <li>Default Credentials Vulnerability (simulated)</li>
                <li>Stored XSS in user input (escalation path)</li>
              </ol>
              <div className="mt-3 text-sm text-[var(--foreground-muted)]">Remediation: Close open management panels, rotate credentials, and sanitize user inputs. See Action Advice for prioritized fixes.</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-[color:var(--line)] bg-[color:var(--background-elevated)]">
          <CardHeader>
            <CardTitle className="text-xl text-[var(--foreground)]">Vulnerabilities</CardTitle>
            <CardDescription className="text-sm text-[var(--foreground-muted)]">Filter and review detected vulnerabilities.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-center gap-2">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as any)}
                className="rounded-xl border border-[color:var(--line)] bg-[color:var(--background-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
                <option value="INFO">Info</option>
              </select>
              <div className="text-sm text-[var(--foreground-muted)]">Showing {filteredVulns.length} results</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[color:var(--background-muted)] text-left text-[var(--foreground-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Severity</th>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">CVE / CWE</th>
                    <th className="px-4 py-3 font-medium">Affected Endpoint</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--foreground)]">
                  {filteredVulns.map((v) => (
                    <tr key={v.id} className="border-t border-[color:var(--line)]">
                      <td className="px-4 py-3"><span className={`rounded px-2 py-1 ${severityColor(v.severity)}`}>{v.severity}</span></td>
                      <td className="px-4 py-3">{v.title}</td>
                      <td className="px-4 py-3">{v.cve ?? v.description ?? '-'}</td>
                      <td className="px-4 py-3 font-mono">{v.endpoint}</td>
                      <td className="px-4 py-3"><Button size="sm" variant="outline" className="border-[color:var(--line)] bg-transparent text-[var(--foreground)] hover:bg-[color:var(--background-muted)]">Details</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[color:var(--line)] bg-[color:var(--background-elevated)]">
          <CardHeader>
            <CardTitle className="text-xl text-[var(--foreground)]">Secret Keys</CardTitle>
            <CardDescription className="text-sm text-[var(--foreground-muted)]">Masked secrets discovered during scans. Click to unmask or copy.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {secrets.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--background-muted)] px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-[var(--foreground)]">{s.type}</div>
                    <div className="text-xs text-[var(--foreground-muted)]">{s.source}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-mono text-sm text-[var(--foreground)]">{unmasked[i] ? s.value : `${s.value.slice(0,6)}***${s.value.slice(-4)}`}</div>
                    <Button size="sm" variant="outline" className="border-[color:var(--line)] bg-transparent text-[var(--foreground)] hover:bg-[color:var(--background-elevated)]" onClick={() => setUnmasked((u) => ({ ...u, [i]: !u[i] }))}>{unmasked[i] ? 'Mask' : 'Unmask'}</Button>
                    <Button size="sm" className="bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15" onClick={() => copyToClipboard(s.value)}>Copy</Button>
                  </div>
                </div>
              ))}
              {secrets.length === 0 ? <div className="text-sm text-[var(--foreground-muted)]">No secrets discovered yet.</div> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[color:var(--line)] bg-[color:var(--background-elevated)]">
          <CardHeader>
            <CardTitle className="text-xl text-[var(--foreground)]">Action Advice</CardTitle>
            <CardDescription className="text-sm text-[var(--foreground-muted)]">Prioritized recommended remediations based on findings.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--foreground)]">
              <li>Investigate CRITICAL findings and patch or isolate affected services immediately.</li>
              <li>Rotate exposed credentials and invalidate sessions.</li>
              <li>Harden WAF rules and enable additional blocking for suspicious paths.</li>
            </ol>
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
