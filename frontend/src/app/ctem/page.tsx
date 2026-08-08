"use client";

import { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  ChevronRight, 
  ChevronDown, 
  Globe, 
  Server, 
  Code, 
  Filter, 
  Zap, 
  CheckCircle2, 
  AlertTriangle,
  Lock,
  Unlock,
  CornerDownRight
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

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
  const { t } = useLanguage();
  const [matrix, setMatrix] = useState<RootDomainNode[]>([]);
  const [loading, setLoading] = useState(true);

  // Delta Filter States
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [showDroppedWAF, setShowDroppedWAF] = useState(false);

  // Tree Accordion State
  const [expandedRoots, setExpandedRoots] = useState<Record<string, boolean>>({ "root-1": true });
  const [expandedSubs, setExpandedSub] = useState<Record<string, boolean>>({ "sub-1": true, "sub-2": true });

  // Fuzzer Dispatch Feedback
  const [fuzzingFeedback, setFuzzingFeedback] = useState<string | null>(null);

  const fetchMatrix = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ctem/matrix?showNewOnly=${showNewOnly}&showDroppedWAF=${showDroppedWAF}`);
      const data = await res.json();
      if (data.ok) {
        setMatrix(data.matrix);
      }
    } catch (err) {
      console.error("Failed to load CTEM matrix", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, [showNewOnly, showDroppedWAF]);

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
        setFuzzingFeedback(`Queued [${ep.method}] ${ep.path} for Deep Logic Fuzzing! Task ID: ${data.taskId}`);
        setTimeout(() => setFuzzingFeedback(null), 5000);
      }
    } catch (err: any) {
      setFuzzingFeedback(`Failed to dispatch fuzz task: ${err.message}`);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-amber-500" />
            {t("ctem.title")}
          </h1>
          <p className="text-sm text-zinc-400 font-mono mt-1">
            {t("ctem.subtitle")}
          </p>
        </div>

        {/* Delta Filter Toggles */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setShowNewOnly((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition ${
              showNewOnly
                ? "bg-amber-950 border-amber-600 text-amber-300 font-bold"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            [{t("ctem.filterNewOnly")}]
          </button>

          <button
            onClick={() => setShowDroppedWAF((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition ${
              showDroppedWAF
                ? "bg-red-950 border-red-600 text-red-300 font-bold"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            <Unlock className="h-3.5 w-3.5 text-red-400" />
            [{t("ctem.filterDroppedWaf")}]
          </button>
        </div>
      </div>

      {/* Fuzz Feedback Toast */}
      {fuzzingFeedback && (
        <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-300 px-4 py-2.5 rounded-lg font-mono text-xs flex items-center gap-2 shadow-lg animate-fade-in">
          <Zap className="h-4 w-4 text-emerald-400 fill-emerald-400" />
          <span>{fuzzingFeedback}</span>
        </div>
      )}

      {/* Nested Tree Table */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl font-mono text-xs">
        <div className="bg-zinc-950 px-4 py-3 border-b border-zinc-800 text-zinc-400 flex items-center justify-between">
          <span>Asset Tree Hierarchy (Root -&gt; Subdomains -&gt; Services -&gt; Endpoints)</span>
          <span>Quick Actions</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-zinc-500 font-mono">Loading Attack Surface Matrix...</div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {matrix.map((root) => {
              const isRootOpen = expandedRoots[root.id];
              return (
                <div key={root.id} className="bg-zinc-950/40">
                  {/* Level 1: Root Domain */}
                  <div
                    onClick={() => toggleRoot(root.id)}
                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/40 cursor-pointer transition select-none"
                  >
                    <div className="flex items-center gap-2.5 font-bold text-sm text-white">
                      {isRootOpen ? (
                        <ChevronDown className="h-4 w-4 text-zinc-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-zinc-400" />
                      )}
                      <Globe className="h-4 w-4 text-blue-400" />
                      <span>{root.domain}</span>
                      <span className="bg-blue-950 text-blue-400 border border-blue-800 text-[10px] px-2 py-0.5 rounded font-normal">
                        Root Domain
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-zinc-400">
                        {root.subdomains.length} Subdomain(s) Attached
                      </span>
                    </div>
                  </div>

                  {/* Level 2: Subdomains */}
                  {isRootOpen && (
                    <div className="pl-6 border-l-2 border-zinc-800 my-1 space-y-1">
                      {root.subdomains.map((sub) => {
                        const isSubOpen = expandedSubs[sub.id];
                        const isWafDropped = sub.wafStatus === "DROPPED_NO_WAF";
                        return (
                          <div key={sub.id} className="rounded-lg bg-zinc-900/60 border border-zinc-800/80 mb-2 overflow-hidden">
                            <div
                              onClick={() => toggleSub(sub.id)}
                              className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-800/60 cursor-pointer transition select-none"
                            >
                              <div className="flex items-center gap-2 text-zinc-200">
                                {isSubOpen ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                                )}
                                <Server className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="font-semibold">{sub.subdomain}</span>
                                <span className="text-zinc-500 text-[10px]">({sub.ip})</span>

                                {/* Delta Flags */}
                                {sub.isNew && (
                                  <span className="bg-amber-950 text-amber-400 border border-amber-800 text-[9px] px-1.5 py-0.2 rounded font-bold">
                                    NEW
                                  </span>
                                )}

                                {isWafDropped ? (
                                  <span className="bg-red-950 text-red-400 border border-red-800 text-[9px] px-1.5 py-0.2 rounded font-bold flex items-center gap-1">
                                    <Unlock className="h-2.5 w-2.5" />
                                    DROPPED WAF
                                  </span>
                                ) : (
                                  <span className="bg-zinc-800 text-zinc-400 text-[9px] px-1.5 py-0.2 rounded flex items-center gap-1">
                                    <Lock className="h-2.5 w-2.5" />
                                    WAF ACTIVE
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Level 3: Ports & Services */}
                            {isSubOpen && (
                              <div className="p-3 space-y-3 bg-zinc-950/60">
                                {sub.ports.map((portSvc) => (
                                  <div key={portSvc.port} className="space-y-2">
                                    <div className="text-[11px] text-zinc-400 flex items-center gap-2 font-mono">
                                      <CornerDownRight className="h-3 w-3 text-zinc-600" />
                                      <span className="font-bold text-amber-400">Port {portSvc.port}</span>
                                      <span className="text-zinc-500">[{portSvc.service}]</span>
                                    </div>

                                    {/* Level 4: Endpoints */}
                                    <div className="space-y-1.5 pl-5">
                                      {portSvc.endpoints.map((ep) => (
                                        <div
                                          key={ep.id}
                                          className="flex items-center justify-between p-2 rounded bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition"
                                        >
                                          <div className="flex items-center gap-2.5">
                                            <span
                                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                ep.method === "POST"
                                                  ? "bg-blue-950 text-blue-400 border border-blue-800"
                                                  : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                              }`}
                                            >
                                              {ep.method}
                                            </span>
                                            <span className="font-mono font-medium text-white">{ep.path}</span>
                                            <span className="text-zinc-500 text-[10px]">{ep.statusCode}</span>

                                            {/* Parameters tag */}
                                            {ep.params.length > 0 && (
                                              <span className="text-zinc-400 text-[10px] bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 flex items-center gap-1">
                                                <Code className="h-3 w-3 text-amber-400" />
                                                params: {ep.params.join(", ")}
                                              </span>
                                            )}
                                          </div>

                                          {/* Quick Action: Send to Fuzzer */}
                                          <button
                                            onClick={() => sendToFuzzer(ep, sub.subdomain)}
                                            className="bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 text-[11px] font-mono px-2.5 py-1 rounded flex items-center gap-1.5 transition shadow"
                                          >
                                            <Zap className="h-3 w-3 text-red-400 fill-red-400" />
                                            [Send to Fuzzer]
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
