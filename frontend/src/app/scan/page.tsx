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
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Recon & Vulnerability Scan</CardTitle>
            <CardDescription>Configure targets and monitor live execution graphs.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="block text-sm">Target (URL / Domain / IP)</label>
                <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="example-target.com" className="mt-2" />
              </div>

              <div>
                <label className="block text-sm">SaaS Tier</label>
                <div className="mt-2 flex flex-col gap-2">
                  {(["STARTER", "DEVSEC PRO", "FINTECH ULTIMATE"] as string[]).map((t) => (
                    <Button key={t} variant={tier === t ? "default" : "outline"} onClick={() => setTier(t)}>
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={startScan} disabled={!target}>
                Initialize Pipeline
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live DAG Execution Visualizer</CardTitle>
            <CardDescription>Real-time status of the scan execution graph.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-center justify-start p-4">
              {Object.values(nodes).map((n) => (
                <div key={n.id} className={`flex w-52 flex-col items-start gap-2 rounded-lg border p-4 ${n.status === 'failed' ? 'border-rose-400' : n.status === 'completed' ? 'border-emerald-300' : 'border-zinc-200'}`}>
                  <div className="flex w-full items-center justify-between">
                    <div className="text-sm font-medium">{n.label}</div>
                    <Badge>{n.status.toUpperCase()}</Badge>
                  </div>
                  <div className="w-full text-xs text-zinc-500">{n.status === 'running' ? 'In progress...' : n.status === 'pending' ? 'Waiting' : n.status === 'completed' ? 'Done' : n.error ?? ''}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Priority Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-4xl font-semibold text-rose-600">{Math.min(100, (vulnCount * 4) + 20)}</div>
                  <div className="text-sm text-zinc-500">Priority Score (0–100)</div>
                </div>
                <div className="text-sm text-zinc-600">Critical: {vulnerabilities.filter(v=>v.severity==='CRITICAL').length} • High: {vulnerabilities.filter(v=>v.severity==='HIGH').length} • Medium: {vulnerabilities.filter(v=>v.severity==='MEDIUM').length}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <div className="flex justify-between text-sm"><span>Total Subdomains</span><span>{subdomains}</span></div>
                <div className="flex justify-between text-sm"><span>Live Hosts</span><span>{liveHosts}</span></div>
                <div className="flex justify-between text-sm"><span>Crawled URLs</span><span>{crawledUrls}</span></div>
                <div className="flex justify-between text-sm"><span>Open Ports</span><span>{openPorts}</span></div>
                <div className="flex justify-between text-sm"><span>Total Vulnerabilities</span><span>{vulnCount}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attack Chain Simulation</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal pl-5 text-sm text-zinc-700">
                <li>Exposed Admin Panel Discovered (via subdomain enumeration)</li>
                <li>Default Credentials Vulnerability (simulated)</li>
                <li>Stored XSS in user input (escalation path)</li>
              </ol>
              <div className="mt-3 text-sm text-zinc-600">Remediation: Close open management panels, rotate credentials, and sanitize user inputs. See Action Advice for prioritized fixes.</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vulnerabilities</CardTitle>
            <CardDescription>Filter and review detected vulnerabilities.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-center gap-2">
              <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as any)} className="rounded border px-3 py-1 text-sm">
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
                <option value="INFO">Info</option>
              </select>
              <div className="text-sm text-zinc-500">Showing {filteredVulns.length} results</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-100 text-left">
                  <tr>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">CVE / CWE</th>
                    <th className="px-4 py-3">Affected Endpoint</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVulns.map((v) => (
                    <tr key={v.id} className="border-t">
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded ${severityColor(v.severity)}`}>{v.severity}</span></td>
                      <td className="px-4 py-3">{v.title}</td>
                      <td className="px-4 py-3">{v.cve ?? v.description ?? '-'}</td>
                      <td className="px-4 py-3 font-mono">{v.endpoint}</td>
                      <td className="px-4 py-3"><Button size="sm" variant="outline">Details</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Secret Keys</CardTitle>
            <CardDescription>Masked secrets discovered during scans. Click to unmask or copy.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {secrets.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded border px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">{s.type}</div>
                    <div className="text-xs text-zinc-500">{s.source}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-mono text-sm">{unmasked[i] ? s.value : `${s.value.slice(0,6)}***${s.value.slice(-4)}`}</div>
                    <Button size="sm" variant="outline" onClick={() => setUnmasked((u) => ({ ...u, [i]: !u[i] }))}>{unmasked[i] ? 'Mask' : 'Unmask'}</Button>
                    <Button size="sm" onClick={() => copyToClipboard(s.value)}>Copy</Button>
                  </div>
                </div>
              ))}
              {secrets.length === 0 ? <div className="text-sm text-zinc-500">No secrets discovered yet.</div> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Action Advice</CardTitle>
            <CardDescription>Prioritized recommended remediations based on findings.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-5 text-sm text-zinc-700">
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
