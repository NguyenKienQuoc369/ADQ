"use client";

import { useState, useEffect } from "react";
import { 
  Bug, 
  Radio, 
  Download, 
  FileText, 
  ShieldAlert, 
  Search, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  ChevronRight,
  Terminal,
  Copy,
  Check
} from "lucide-react";

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

  // Vulnerability Triage State
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // OAST Callback State
  const [oastCallbacks, setOastCallbacks] = useState<OastCallback[]>([]);
  const [liveOastPing, setLiveOastPing] = useState<OastCallback | null>(null);
  const [sseConnected, setSseConnected] = useState(false);

  // Fetch Vulnerabilities
  const fetchVulns = async () => {
    try {
      const res = await fetch("/api/vulnerabilities");
      const data = await res.json();
      if (data.ok && data.vulnerabilities) {
        setVulnerabilities(data.vulnerabilities);
        if (data.vulnerabilities.length > 0 && !selectedVuln) {
          setSelectedVuln(data.vulnerabilities[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch vulnerabilities", err);
    }
  };

  useEffect(() => {
    fetchVulns();

    // Connect to Live OAST SSE Stream
    const eventSource = new EventSource("/api/oast/stream/sse");

    eventSource.onopen = () => {
      setSseConnected(true);
    };

    eventSource.onmessage = (event) => {
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
      setSseConnected(false);
      eventSource.close();
    };

    return () => {
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

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6 font-sans">
      {/* Header Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
            <Bug className="h-6 w-6 text-red-500" />
            Vulnerability Triage & OAST Inbox
          </h1>
          <p className="text-sm text-zinc-400 font-mono mt-1">
            Master-Detail vulnerability review with raw HTTP evidence and live Out-of-Band pingbacks.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 font-mono text-xs bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("triage")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === "triage"
                ? "bg-zinc-800 text-white font-bold border border-zinc-700 shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ShieldAlert className="h-4 w-4 text-red-400" />
            Vulnerability Triage ({vulnerabilities.length})
          </button>

          <button
            onClick={() => setActiveTab("oast")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === "oast"
                ? "bg-zinc-800 text-white font-bold border border-zinc-700 shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Radio className="h-4 w-4 text-blue-400 animate-pulse" />
            OAST Stream Inbox ({oastCallbacks.length})
          </button>
        </div>
      </div>

      {/* Live OAST Flash Ping Toast */}
      {liveOastPing && (
        <div className="bg-blue-950/90 border border-blue-600 text-blue-200 px-4 py-3 rounded-xl font-mono text-xs flex items-center justify-between shadow-2xl animate-bounce">
          <div className="flex items-center gap-2.5">
            <Radio className="h-4 w-4 text-blue-400 animate-ping" />
            <span className="font-bold text-white">LIVE OAST PINGBACK DETECTED:</span>
            <span>[{liveOastPing.method}]</span>
            <span className="text-emerald-400 font-semibold">{liveOastPing.path}</span>
            <span className="text-amber-400">from {liveOastPing.remoteIp}</span>
          </div>
          <span className="text-[10px] bg-blue-900 px-2 py-0.5 rounded text-blue-300">Port 8888 Real-Time Stream</span>
        </div>
      )}

      {activeTab === "triage" ? (
        /* Master-Detail Split View (Left 30%, Right 70%) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
          {/* Left Column: Master Vulnerability List (4 cols / ~30%) */}
          <div className="lg:col-span-4 bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 shadow-xl flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              {/* Search & Severity Filter */}
              <div className="relative font-mono text-xs">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search vulnerabilities / host..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center gap-1 font-mono text-[10px] overflow-x-auto pb-1">
                {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2.5 py-1 rounded font-bold transition ${
                      severityFilter === sev
                        ? "bg-red-950 text-red-300 border border-red-800"
                        : "bg-zinc-950 text-zinc-500 hover:text-zinc-300 border border-zinc-800"
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>

              {/* List */}
              <div className="divide-y divide-zinc-800/80 max-h-[500px] overflow-y-auto space-y-1">
                {filteredVulns.map((v) => {
                  const isSelected = selectedVuln?.id === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVuln(v)}
                      className={`cursor-pointer p-3 rounded-lg border transition font-mono ${
                        isSelected
                          ? "bg-red-950/40 border-red-700/80 text-white shadow-lg"
                          : "bg-zinc-950/60 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800/60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            v.severity === "CRITICAL"
                              ? "bg-red-950 text-red-400 border border-red-800"
                              : "bg-amber-950 text-amber-400 border border-amber-800"
                          }`}
                        >
                          {v.severity} ({v.cvss})
                        </span>
                        <span className="text-[10px] text-zinc-500">{v.cveId}</span>
                      </div>

                      <div className="text-xs font-semibold leading-snug line-clamp-2">{v.title}</div>
                      <div className="text-[10px] text-zinc-500 mt-1 truncate">{v.host}</div>
                    </div>
                  );
                })}

                {filteredVulns.length === 0 && (
                  <div className="py-8 text-center text-zinc-500 font-mono text-xs">
                    No vulnerabilities match search filters.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Detail Panel (8 cols / ~70%) */}
          <div className="lg:col-span-8 bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-6">
            {selectedVuln ? (
              <div className="space-y-6">
                {/* Vulnerability Title Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-4 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="bg-red-950 text-red-400 border border-red-800 text-xs font-mono font-bold px-2 py-0.5 rounded">
                        {selectedVuln.severity} - CVSS {selectedVuln.cvss}
                      </span>
                      <span className="text-xs font-mono text-zinc-400">{selectedVuln.cveId}</span>
                      <span className="text-xs font-mono text-zinc-500">[{selectedVuln.source}]</span>
                    </div>
                    <h2 className="text-lg font-bold font-mono text-white">{selectedVuln.title}</h2>
                    <p className="text-xs font-mono text-zinc-400 mt-1">
                      Target Host: <span className="text-white font-semibold">{selectedVuln.host}</span> | Endpoint:{" "}
                      <span className="text-amber-400 font-semibold">{selectedVuln.endpoint}</span>
                    </p>
                  </div>

                  {/* Export Buttons */}
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <button
                      onClick={() => exportReport("markdown")}
                      className="bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 transition shadow"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export HackerOne MD
                    </button>
                    <button
                      onClick={() => exportReport("json")}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2 rounded-lg flex items-center gap-1.5 transition border border-zinc-700"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Export JSON
                    </button>
                  </div>
                </div>

                {/* OAST Correlation Alert if present */}
                {selectedVuln.oastCorrelation && (
                  <div className="bg-blue-950/50 border border-blue-800 text-blue-200 p-3.5 rounded-lg font-mono text-xs flex items-center gap-2.5">
                    <Radio className="h-4 w-4 text-blue-400 animate-pulse shrink-0" />
                    <div>
                      <span className="font-bold">OAST Out-of-Band Pingback Confirmed:</span>{" "}
                      {selectedVuln.oastCorrelation}
                    </div>
                  </div>
                )}

                {/* Raw HTTP Request Block */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-zinc-300 flex items-center gap-1.5">
                      <Terminal className="h-4 w-4 text-amber-400" />
                      Raw HTTP Request Evidence
                    </span>
                    <button
                      onClick={() => handleCopy(selectedVuln.rawRequest, "req")}
                      className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedField === "req" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedField === "req" ? "Copied!" : "Copy Request"}
                    </button>
                  </div>
                  <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-emerald-400 overflow-x-auto shadow-inner">
                    {selectedVuln.rawRequest}
                  </pre>
                </div>

                {/* Raw HTTP Response Block */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-zinc-300 flex items-center gap-1.5">
                      <Terminal className="h-4 w-4 text-blue-400" />
                      Raw HTTP Response Evidence
                    </span>
                    <button
                      onClick={() => handleCopy(selectedVuln.rawResponse, "res")}
                      className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedField === "res" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedField === "res" ? "Copied!" : "Copy Response"}
                    </button>
                  </div>
                  <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-blue-300 overflow-x-auto shadow-inner">
                    {selectedVuln.rawResponse}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-zinc-500 font-mono text-xs">
                Select a vulnerability from the left list to review HTTP evidence.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* OAST Callback Stream Tab */
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Radio className="h-5 w-5 text-blue-400 animate-pulse" />
              Live Out-of-Band (OAST) Pingback Feed (Listener Port 8888)
            </h2>
            <span className="bg-blue-950 border border-blue-800 text-blue-300 px-2.5 py-1 rounded text-[11px]">
              0% False Positive Verification
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950">
            <table className="w-full text-left">
              <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Victim Remote IP</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">OAST Correlation Path</th>
                  <th className="px-4 py-3">User-Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-zinc-300">
                {oastCallbacks.map((cb) => (
                  <tr key={cb.id} className="hover:bg-zinc-900/50 transition">
                    <td className="px-4 py-3 text-zinc-400">{new Date(cb.timestamp).toLocaleString("vi-VN")}</td>
                    <td className="px-4 py-3 font-bold text-amber-400">{cb.remoteIp}</td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-950 text-blue-400 border border-blue-800 px-2 py-0.5 rounded text-[10px] font-bold">
                        {cb.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">{cb.path}</td>
                    <td className="px-4 py-3 text-zinc-500 text-[11px] truncate max-w-[200px]">{cb.userAgent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
