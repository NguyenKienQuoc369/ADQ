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
  Play,
  Flame,
  Shield,
  Bot,
  Code,
  FileCode,
  CheckCircle2,
  XCircle,
  AlertTriangle
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
  
  // Interactive CLI Terminal Mode State
  const [activeTab, setActiveTab] = useState<"cli" | "c2">("cli");
  const [cliLogs, setCliLogs] = useState<string[]>([
    " [ ADQ CORE - SECURITY ORCHESTRATOR ]",
    "==================================================",
    " Node: Worker-Elite | Status: ONLINE | AI: READY | Telegram Feed: ACTIVE",
    "",
    "--- STRESS TEST & RATE LIMIT MODULE (High-Throughput Native Engine) ---",
    "[*] Terminal Live Command Center Initialized.",
    "[+] Target Loaded: https://target-bank.com",
    "[+] SaaS Tier: DEVSEC PRO (ADQ Security Copilot 0.1)",
  ]);
  const [cliInput, setCliInput] = useState("");
  const [isExecCli, setIsExecCli] = useState(false);
  const [stressMetricRps, setStressMetricRps] = useState(140.9);
  const [stressReqsCount, setStressMetricReqsCount] = useState(30921);

  // Form State
  const [bulkTargets, setBulkTargets] = useState("");
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

  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliInput.trim()) return;

    const cmd = cliInput.trim();
    setCliLogs((prev) => [...prev, `root@adq-core:~# ${cmd}`]);
    setCliInput("");
    setIsExecCli(true);

    setTimeout(() => {
      if (cmd === "1" || cmd.toLowerCase().includes("scan")) {
        setCliLogs((prev) => [
          ...prev,
          "[+] Kích hoạt Chiến dịch Rà quét Surface & Deep Logic...",
          "🎯 Target: https://target-bank.com",
          "🔄 Executing Node: Surface Recon (Worker-Light)...",
          "✅ Found 14 subdomains, 6 live hosts.",
          "🚨 CRITICAL VULN FOUND: JWT Hardcoded Secret Key (/api/v1/auth/token)",
          "🚨 HIGH VULN FOUND: IDOR Unauthorized Parameter Mutation (/api/user?id=1002)",
          "📊 [BÁO CÁO TELEGRAM] Priority Score: 88/100 (CRITICAL RISK)",
        ]);
      } else if (cmd === "3" || cmd.toLowerCase().includes("stress")) {
        setCliLogs((prev) => [
          ...prev,
          "[+] 🔥 STRESS TEST & RATE LIMIT MODULE ENGAGED",
          "🎯 Target: https://target-bank.com/api/v1/transfer",
          "⚡ Throughput: 1,030.0 req/sec | HTTP 200 OK: 30,921 | WAF 403: 0",
          "🛡️ Rate Limit Bypass: Lách hoàn toàn Rate Limit & WAF (Tỷ lệ 200 OK: 100.0%)",
        ]);
        setStressMetricReqsCount((prev) => prev + 5000);
      } else if (cmd.toLowerCase().includes("copilot") || cmd.toLowerCase().includes("ai")) {
        setCliLogs((prev) => [
          ...prev,
          "🤖 ADQ Security Copilot: 'Tôi là ADQ Security Copilot - Trí tuệ Nhân tạo Tự chủ chuyên sâu về Pentesting & DevSecOps.'",
          "💡 Recommendation: Xoay vòng ngay Secret Key JWT và đóng cổng 5432 PostgreSQL.",
        ]);
      } else {
        setCliLogs((prev) => [
          ...prev,
          `[!] Lệnh '${cmd}' đã được chuyển tới Master Grid Node (Job ID: job_cli_${Math.floor(Math.random() * 8999 + 1000)}).`,
        ]);
      }
      setIsExecCli(false);
    }, 600);
  };

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
      {/* Header Banner & Terminal View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
            <Terminal className="h-6 w-6 text-red-500" />
            ADQ Security Operations & C2 Command Center
          </h1>
          <p className="text-sm text-zinc-400 font-mono mt-1">
            Giao diện điều khiển TUI/Terminal & SaaS C2 Grid Node Operations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-zinc-900 border border-zinc-800 p-1 font-mono text-xs">
            <button
              onClick={() => setActiveTab("cli")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition ${
                activeTab === "cli"
                  ? "bg-red-950 text-red-400 border border-red-800 font-bold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              Interactive TUI Terminal
            </button>
            <button
              onClick={() => setActiveTab("c2")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition ${
                activeTab === "c2"
                  ? "bg-zinc-800 text-white font-bold border border-zinc-700"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              SaaS C2 Dispatcher & Grid
            </button>
          </div>

          <button
            onClick={fetchWorkersManual}
            className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-mono text-xs px-3 py-2 rounded-md transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingWorkers ? "animate-spin text-red-400" : ""}`} />
            {t("c2.refresh")}
          </button>
        </div>
      </div>

      {activeTab === "cli" ? (
        /* ========================================================================= */
        /* INTERACTIVE TERMINAL / TUI COMMAND CENTER VIEW                           */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Top TUI Live War Room Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
            <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-4 space-y-1">
              <span className="text-zinc-400 block">Node Status</span>
              <span className="text-base font-bold text-red-400 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"></span>
                Worker-Elite ONLINE
              </span>
              <p className="text-[10px] text-zinc-500">Capability: DAST + Logic Evasion</p>
            </div>

            <div className="rounded-xl border border-cyan-900/60 bg-cyan-950/20 p-4 space-y-1">
              <span className="text-zinc-400 block">AI Intelligence Engine</span>
              <span className="text-base font-bold text-cyan-400 flex items-center gap-1.5">
                <Bot className="h-4 w-4" />
                ADQ Security Copilot 0.5
              </span>
              <p className="text-[10px] text-zinc-500">Fintech Ultimate Tier Queue Active</p>
            </div>

            <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 space-y-1">
              <span className="text-zinc-400 block">Live Stress Throughput</span>
              <span className="text-base font-bold text-amber-400 flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-amber-500" />
                1,030.0 req/s
              </span>
              <p className="text-[10px] text-zinc-500">{stressReqsCount.toLocaleString()} Total HTTP Requests</p>
            </div>

            <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4 space-y-1">
              <span className="text-zinc-400 block">WAF Evasion Success</span>
              <span className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
                <Shield className="h-4 w-4" />
                100.0% Bypass
              </span>
              <p className="text-[10px] text-zinc-500">0 Requests Blocked (403: 0, 429: 0)</p>
            </div>
          </div>

          {/* Interactive Rich Terminal Console Screen */}
          <div className="rounded-xl border border-zinc-800 bg-black shadow-2xl overflow-hidden font-mono text-xs">
            {/* Terminal Window Header */}
            <div className="flex items-center justify-between bg-zinc-900 px-4 py-2.5 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500/80"></div>
                <div className="h-3 w-3 rounded-full bg-yellow-500/80"></div>
                <div className="h-3 w-3 rounded-full bg-green-500/80"></div>
                <span className="ml-2 text-zinc-400 text-[11px]">root@adq-core:~ (adq_cli.py TUI Emulation)</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                <span>[1] Recon & Scan</span>
                <span>[2] APK Audit</span>
                <span>[3] Stress Test</span>
                <span>[4] View Reports</span>
              </div>
            </div>

            {/* Terminal Screen Body */}
            <div className="p-5 space-y-2 h-[420px] overflow-y-auto bg-black text-zinc-200">
              {cliLogs.map((log, idx) => (
                <div key={idx} className="leading-relaxed">
                  {log.startsWith("root@adq-core:~#") ? (
                    <span className="text-yellow-400 font-bold">{log}</span>
                  ) : log.includes("CRITICAL") || log.includes("🚨") ? (
                    <span className="text-red-400 font-semibold">{log}</span>
                  ) : log.includes("HIGH") ? (
                    <span className="text-amber-400 font-semibold">{log}</span>
                  ) : log.includes("✅") || log.includes("SUCCESS") ? (
                    <span className="text-emerald-400">{log}</span>
                  ) : log.includes("🤖 ADQ") ? (
                    <span className="text-cyan-300 font-medium">{log}</span>
                  ) : (
                    <span className="text-zinc-300">{log}</span>
                  )}
                </div>
              ))}
              {isExecCli && (
                <div className="text-cyan-400 animate-pulse flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Master Grid Node đang xử lý lệnh...</span>
                </div>
              )}
            </div>

            {/* Terminal Input Prompt */}
            <form onSubmit={handleCliSubmit} className="flex items-center bg-zinc-950 px-4 py-3 border-t border-zinc-800 gap-3">
              <span className="text-emerald-400 font-bold">root@adq-core:~#</span>
              <input
                type="text"
                value={cliInput}
                onChange={(e) => setCliInput(e.target.value)}
                placeholder="Nhập 1 (Scan), 2 (APK Audit), 3 (Stress Test), hoặc hỏi ADQ Copilot..."
                className="flex-1 bg-transparent text-zinc-100 outline-none text-xs font-mono"
              />
              <button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-mono font-semibold transition flex items-center gap-1.5"
              >
                <Send className="h-3 w-3" />
                Execute
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* STANDARD SAAS C2 DISPATCHER & GRID MONITOR VIEW                          */
        /* ========================================================================= */
        <div>
          <div className="rounded-xl border border-blue-800/60 bg-blue-950/20 p-4 mb-8">
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
                  {t("c2.targetIngestion")}
                </h2>
                <span className="text-[11px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                  {t("c2.bulkReady")}
                </span>
              </div>

          <form onSubmit={handleDispatch} className="space-y-5">
            {/* Bulk Input / File Upload */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono font-medium text-zinc-300">
                  {t("c2.scopeLabel")}
                </label>
                <label className="cursor-pointer text-[11px] font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  <Upload className="h-3 w-3" />
                  {t("c2.uploadTxt")}
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
                {t("c2.selectProfiles")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    key: "recon_infra",
                    title: t("c2.profile.recon"),
                    desc: t("c2.profile.reconDesc"),
                  },
                  {
                    key: "web_mapping",
                    title: t("c2.profile.web"),
                    desc: t("c2.profile.webDesc"),
                  },
                  {
                    key: "dast_active",
                    title: t("c2.profile.dast"),
                    desc: t("c2.profile.dastDesc"),
                  },
                  {
                    key: "deep_logic",
                    title: t("c2.profile.logic"),
                    desc: t("c2.profile.logicDesc"),
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
                {t("c2.nodeCapability")}
              </label>
              <select
                value={capability}
                onChange={(e) => setCapability(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 font-mono text-xs text-zinc-200 focus:outline-none focus:border-red-500"
              >
                <option value="all-nodes">{t("c2.cap.all")}</option>
                <option value="light-fast">{t("c2.cap.light")}</option>
                <option value="elite-clean-ip">{t("c2.cap.elite")}</option>
              </select>
            </div>

            {/* Priority Slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-mono font-medium text-zinc-300">
                  {t("c2.priority")}
                </label>
                <span className="text-xs font-mono text-amber-400 font-bold">{priority}</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value))}
                className="w-full accent-red-500"
              />
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
                  {t("c2.dispatching")}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-white" />
                  {t("c2.launchBtn")}
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
      )}
    </div>
  );
}
