"use client";

import { useState, useEffect } from "react";
import { 
  Terminal, 
  Send, 
  Upload, 
  Layers, 
  Cpu, 
  Activity, 
  CheckSquare, 
  Square,
  AlertCircle,
  RefreshCw,
  Zap,
  Play
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface WorkerNode {
  workerId: string;
  capability: string;
  profile: string;
  currentTask: string;
  status: string;
  cpuUsage: string;
  ramUsage: string;
  lastHeartbeat: string;
}

export default function C2CommandCenter() {
  const { t } = useLanguage();
  // Form State
  const [bulkTargets, setBulkTargets] = useState("target-enterprise.com\nstaging.target-enterprise.com");
  const [profiles, setProfiles] = useState({
    recon_infra: true,
    web_mapping: true,
    dast_active: false,
    deep_logic: false,
  });
  const [capability, setCapability] = useState("all-nodes");
  const [priority, setPriority] = useState(10);
  
  // Dispatch Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);

  // Grid Monitor State
  const [workers, setWorkers] = useState<WorkerNode[]>([]);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);

  useEffect(() => {
    // Connect to Server-Sent Events (SSE) Stream
    setIsLoadingWorkers(true);
    const eventSource = new EventSource("/api/grid/workers/stream");

    eventSource.onopen = () => {
      setSseConnected(true);
      setIsLoadingWorkers(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.ok && parsed.workers) {
          setWorkers(parsed.workers);
        }
      } catch (e) {
        console.error("Error parsing SSE grid stream", e);
      }
    };

    eventSource.onerror = () => {
      setSseConnected(false);
      setIsLoadingWorkers(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const fetchWorkersManual = async () => {
    setIsLoadingWorkers(true);
    try {
      const res = await fetch("/api/grid/workers");
      const data = await res.json();
      if (data.ok) {
        setWorkers(data.workers);
      }
    } catch (err) {
      console.error("Failed to fetch grid workers", err);
    } finally {
      setIsLoadingWorkers(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setBulkTargets((prev) => (prev ? `${prev}\n${text}` : text));
      };
      reader.readAsText(file);
    }
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setDispatchResult(null);

    const targetList = bulkTargets
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const activeProfiles = Object.entries(profiles)
      .filter(([_, active]) => active)
      .map(([key]) => key);

    try {
      const res = await fetch("/api/c2/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targets: targetList,
          profiles: activeProfiles,
          capability,
          priority,
        }),
      });

      const data = await res.json();
      setDispatchResult(data);
      fetchWorkersManual();
    } catch (err: any) {
      setDispatchResult({ ok: false, error: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProfile = (key: keyof typeof profiles) => {
    setProfiles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
            <Terminal className="h-6 w-6 text-red-500" />
            {t("c2.title")}
          </h1>
          <p className="text-sm text-zinc-400 font-mono mt-1">
            {t("c2.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchWorkersManual}
            className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-mono text-xs px-3 py-2 rounded-md transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingWorkers ? "animate-spin text-red-400" : ""}`} />
            {t("c2.refresh")}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-blue-800/60 bg-blue-950/20 p-4">
        <h2 className="text-sm font-mono font-semibold text-blue-300 mb-2">{t("guide.title")}</h2>
        <ul className="text-xs text-zinc-300 space-y-1 list-disc pl-4">
          <li>{t("guide.step1")}</li>
          <li>{t("guide.step2")}</li>
          <li>{t("guide.step3")}</li>
          <li>{t("guide.step4")}</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Task Dispatcher Form (5 cols) */}
        <div className="lg:col-span-5 bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h2 className="text-base font-bold font-mono text-zinc-100 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              Target Ingestion & Dispatcher
            </h2>
            <span className="text-[11px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
              BULK READY
            </span>
          </div>

          <form onSubmit={handleDispatch} className="space-y-5">
            {/* Bulk Input / File Upload */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono font-medium text-zinc-300">
                  Target Scope (Domains / IPs - 1 per line):
                </label>
                <label className="cursor-pointer text-[11px] font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  <Upload className="h-3 w-3" />
                  Upload .txt
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <textarea
                value={bulkTargets}
                onChange={(e) => setBulkTargets(e.target.value)}
                rows={5}
                placeholder="target1.com&#10;target2.com&#10;sub.target3.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-red-500 transition"
                required
              />
            </div>

            {/* Scan Profile Selection (Checkboxes) */}
            <div>
              <label className="text-xs font-mono font-medium text-zinc-300 mb-2.5 block">
                Select Scan Profiles:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    key: "recon_infra",
                    title: "Recon Infra",
                    desc: "Subdomains, DNS, Ports [Low Noise]",
                  },
                  {
                    key: "web_mapping",
                    title: "Web Mapping",
                    desc: "HTTP, Deep JS, Tech Stack [Light]",
                  },
                  {
                    key: "dast_active",
                    title: "Active DAST",
                    desc: "Nuclei CVEs, FFuf Fuzzing [Active]",
                  },
                  {
                    key: "deep_logic",
                    title: "Deep Logic & OAST",
                    desc: "Race, IDOR, OAST Testing [Complex]",
                  },
                ].map((item) => {
                  const isChecked = profiles[item.key as keyof typeof profiles];
                  return (
                    <div
                      key={item.key}
                      onClick={() => toggleProfile(item.key as keyof typeof profiles)}
                      className={`cursor-pointer rounded-lg border p-2.5 transition flex items-start gap-2.5 ${
                        isChecked
                          ? "bg-red-950/30 border-red-700/60 text-white"
                          : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <div className="mt-0.5">
                        {isChecked ? (
                          <CheckSquare className="h-4 w-4 text-red-500" />
                        ) : (
                          <Square className="h-4 w-4 text-zinc-600" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-mono font-semibold">{item.title}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{item.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Worker Capability Dropdown */}
            <div>
              <label className="text-xs font-mono font-medium text-zinc-300 mb-2 block">
                Worker Capability Allocation:
              </label>
              <select
                value={capability}
                onChange={(e) => setCapability(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 font-mono text-xs text-zinc-200 focus:outline-none focus:border-red-500"
              >
                <option value="all-nodes">All Available Nodes (Balanced Dispatch)</option>
                <option value="elite-clean-ip">Elite IP Cluster Only (Proxy / Clean IPs)</option>
                <option value="light-fast">Light Nodes Only (Recon / Subdomains)</option>
                <option value="residential-proxy">Stealth Residential Proxy Pool</option>
              </select>
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Dispatching to Master Grid...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-white" />
                  Launch Enterprise Scan
                </>
              )}
            </button>
          </form>

          {/* Dispatch Feedback */}
          {dispatchResult && (
            <div
              className={`rounded-lg border p-3 font-mono text-xs ${
                dispatchResult.ok
                  ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                  : "bg-red-950/40 border-red-800 text-red-300"
              }`}
            >
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                {dispatchResult.ok ? "Scan Dispatched Successfully" : "Dispatch Failed"}
              </div>
              <p className="mt-1 text-[11px] opacity-90">{dispatchResult.message || dispatchResult.error}</p>
            </div>
          )}
        </div>

        {/* Right Column: Grid Monitor Table (7 cols) */}
        <div className="lg:col-span-7 bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-base font-bold font-mono text-zinc-100 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-emerald-400" />
                Real-Time Worker Grid Monitor
              </h2>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                Heartbeat stream from Master Grid broker & node capabilities
              </p>
            </div>
            <span className={`flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-full border ${
              sseConnected
                ? "text-emerald-400 bg-emerald-950/60 border-emerald-800/80"
                : "text-amber-400 bg-amber-950/60 border-amber-800/80"
            }`}>
              <span className={`h-2 w-2 rounded-full ${sseConnected ? "bg-emerald-400 animate-ping" : "bg-amber-400"}`} />
              {sseConnected ? "SSE Stream Active (2s)" : "Polling Fallback"}
            </span>
          </div>

          {/* Worker Table */}
          <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-3.5 py-3">Worker Node</th>
                  <th className="px-3.5 py-3">Capability</th>
                  <th className="px-3.5 py-3">Current Task</th>
                  <th className="px-3.5 py-3">Status</th>
                  <th className="px-3.5 py-3">RAM/CPU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-300">
                {workers.map((w) => {
                  const isWorking = w.status === "WORKING";
                  return (
                    <tr key={w.workerId} className="hover:bg-zinc-900/50 transition">
                      <td className="px-3.5 py-3 font-semibold text-white flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${isWorking ? "bg-amber-400" : "bg-emerald-400"}`} />
                        {w.workerId}
                      </td>
                      <td className="px-3.5 py-3">
                        <span className="bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded border border-zinc-800 text-[10px]">
                          {w.capability}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 max-w-[200px] truncate text-zinc-400" title={w.currentTask}>
                        {w.currentTask}
                      </td>
                      <td className="px-3.5 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isWorking
                              ? "bg-amber-950 text-amber-400 border border-amber-800"
                              : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          }`}
                        >
                          {w.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-zinc-400 text-[11px]">
                        {w.ramUsage} / {w.cpuUsage}
                      </td>
                    </tr>
                  );
                })}

                {workers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                      No active workers registered on grid.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
