"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Filter,
  Globe,
  Server,
  ShieldAlert,
  Unlock,
  Zap,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModuleFrame, ModuleSection } from "@/components/workspace/module-frame";

interface Endpoint {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  isNew: boolean;
  hasWaf: boolean;
  params: string[];
}

interface PortService {
  port: number;
  service: string;
  endpoints: Endpoint[];
}

interface SubdomainNode {
  id: string;
  subdomain: string;
  ip: string;
  isNew: boolean;
  wafStatus: string;
  ports: PortService[];
}

interface RootDomainNode {
  id: string;
  domain: string;
  isNew: boolean;
  wafStatus: string;
  subdomains: SubdomainNode[];
}

export default function CTEMAttackSurfaceMatrix() {
  const [matrix, setMatrix] = useState<RootDomainNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [showDroppedWAF, setShowDroppedWAF] = useState(false);
  const [expandedRoots, setExpandedRoots] = useState<Record<string, boolean>>({ "root-1": true });
  const [expandedSubs, setExpandedSub] = useState<Record<string, boolean>>({ "sub-1": true, "sub-2": true });
  const [fuzzingFeedback, setFuzzingFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await fetch(`/api/ctem/matrix?showNewOnly=${showNewOnly}&showDroppedWAF=${showDroppedWAF}`);
        const data = await res.json();
        if (active && data.ok) {
          setMatrix(data.matrix);
        }
      } catch (err) {
        console.error("Failed to load CTEM matrix", err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [showNewOnly, showDroppedWAF]);

  const summary = useMemo(() => {
    const rootCount = matrix.length;
    const subdomains = matrix.flatMap((root) => root.subdomains);
    const ports = subdomains.flatMap((sub) => sub.ports);
    const endpoints = ports.flatMap((port) => port.endpoints);
    const droppedWaf = subdomains.filter((sub) => sub.wafStatus === "DROPPED_NO_WAF").length;

    return {
      rootCount,
      subdomainCount: subdomains.length,
      endpointCount: endpoints.length,
      droppedWaf,
    };
  }, [matrix]);

  const toggleRoot = (id: string) => {
    setExpandedRoots((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSub = (id: string) => {
    setExpandedSub((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const sendToFuzzer = async (ep: Endpoint, subdomain: string) => {
    const fullUrl = `https://${subdomain}${ep.path}`;
    try {
      const res = await fetch("/api/c2/fuzz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpointId: ep.id,
          url: fullUrl,
          method: ep.method,
          params: ep.params,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setFuzzingFeedback(`Đã đưa ${ep.method} ${ep.path} sang luồng deep logic fuzzing. Task ID: ${data.taskId}`);
        setTimeout(() => setFuzzingFeedback(null), 5000);
      }
    } catch (err) {
      setFuzzingFeedback(`Không thể dispatch fuzz task: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  return (
    <DashboardShell area="dashboard">
      <ModuleFrame
        icon={ShieldAlert}
        eyebrow="Security Modules"
        title="CTEM Attack Surface Matrix"
        description="Ma trận bề mặt tấn công dùng chung dữ liệu từ scan jobs. Tại đây bạn thấy delta tài sản, trạng thái WAF và có thể bắn nhanh endpoint sang deep logic fuzzing."
        stats={[
          { label: "Root domains", value: String(summary.rootCount), variant: "default" },
          { label: "Subdomains", value: String(summary.subdomainCount), variant: "success" },
          { label: "Endpoints", value: String(summary.endpointCount), variant: "muted" },
          { label: "Dropped WAF", value: String(summary.droppedWaf), variant: summary.droppedWaf ? "danger" : "success" },
        ]}
        links={[
          { href: "/c2", label: "Quay lại C2 Command Center" },
          { href: "/graph", label: "Mở Knowledge Graph" },
          { href: "/vulnerabilities", label: "Đi tới Vulnerability Inbox" },
        ]}
      >
        <ModuleSection title="Delta filters" description="Lọc nhanh tài sản mới hoặc subdomain vừa mất WAF để ưu tiên điều tra.">
          <div className="flex flex-wrap gap-3">
            <Button
              variant={showNewOnly ? "default" : "secondary"}
              onClick={() => {
                setLoading(true);
                setShowNewOnly((prev) => !prev);
              }}
            >
              <Filter className="h-4 w-4" />
              Chỉ hiện assets mới
            </Button>
            <Button
              variant={showDroppedWAF ? "destructive" : "secondary"}
              onClick={() => {
                setLoading(true);
                setShowDroppedWAF((prev) => !prev);
              }}
            >
              <Unlock className="h-4 w-4" />
              Chỉ hiện dropped WAF
            </Button>
            {fuzzingFeedback ? <Badge variant="success">{fuzzingFeedback}</Badge> : null}
          </div>
        </ModuleSection>

        <ModuleSection title="Attack surface hierarchy" description="Root domain → subdomain → service → endpoint, tất cả dùng chung một shell với quick action liên kết sang fuzzing.">
          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-400">
              Đang tải CTEM matrix...
            </div>
          ) : (
            <div className="space-y-4">
              {matrix.map((root) => {
                const isRootOpen = expandedRoots[root.id];
                return (
                  <div key={root.id} className="rounded-3xl border border-slate-800 bg-slate-900/70">
                    <button
                      type="button"
                      onClick={() => toggleRoot(root.id)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <div className="flex items-center gap-3">
                        {isRootOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10">
                          <Globe className="h-4 w-4 text-cyan-300" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-100">{root.domain}</p>
                          <p className="text-sm text-slate-400">{root.subdomains.length} subdomains đang được theo dõi</p>
                        </div>
                      </div>
                      <Badge variant="muted">Root Domain</Badge>
                    </button>

                    {isRootOpen ? (
                      <div className="space-y-3 border-t border-slate-800/70 px-5 py-4">
                        {root.subdomains.map((sub) => {
                          const isSubOpen = expandedSubs[sub.id];
                          const wafDropped = sub.wafStatus === "DROPPED_NO_WAF";

                          return (
                            <div key={sub.id} className="rounded-3xl border border-slate-800 bg-slate-950/70">
                              <button
                                type="button"
                                onClick={() => toggleSub(sub.id)}
                                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                              >
                                <div className="flex items-center gap-3">
                                  {isSubOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                  <Server className="h-4 w-4 text-emerald-300" />
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-medium text-slate-100">{sub.subdomain}</p>
                                      <span className="text-sm text-slate-500">{sub.ip}</span>
                                      {sub.isNew ? <Badge variant="warning">NEW</Badge> : null}
                                      <Badge variant={wafDropped ? "danger" : "muted"}>{wafDropped ? "Dropped WAF" : "WAF Active"}</Badge>
                                    </div>
                                  </div>
                                </div>
                              </button>

                              {isSubOpen ? (
                                <div className="space-y-4 border-t border-slate-800/70 px-4 py-4">
                                  {sub.ports.map((port) => (
                                    <div key={`${sub.id}-${port.port}`} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                      <div className="mb-3 flex items-center gap-2 text-sm text-slate-300">
                                        <CornerDownRight className="h-4 w-4 text-slate-500" />
                                        <span className="font-medium text-amber-300">Port {port.port}</span>
                                        <span className="text-slate-500">{port.service}</span>
                                      </div>
                                      <div className="space-y-3">
                                        {port.endpoints.map((ep) => (
                                          <div key={ep.id} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                                            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                              <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant={ep.method === "POST" ? "default" : "success"}>{ep.method}</Badge>
                                                <span className="font-mono text-sm text-slate-100">{ep.path}</span>
                                                <span className="text-sm text-slate-500">{ep.statusCode}</span>
                                                {ep.params.length ? <Badge variant="muted">{ep.params.join(", ")}</Badge> : null}
                                              </div>
                                              <Button size="sm" variant="secondary" onClick={() => sendToFuzzer(ep, sub.subdomain)}>
                                                <Zap className="h-4 w-4" />
                                                Send to Fuzzer
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </ModuleSection>
      </ModuleFrame>
    </DashboardShell>
  );
}
