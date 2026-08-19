"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Flame,
  Globe,
  KeyRound,
  LoaderCircle,
  Lock,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  detectWaf,
  discoverEndpoints,
  getProjectById,
  runStressTest,
  saveProjectDetail,
} from "@/lib/api";

interface StressMetrics {
  totalRequests: number;
  actualRps: number;
  status200: number;
  status403WafBlocked: number;
  status429RateLimited: number;
  status500Crashed: number;
  otherStatus: number;
  p95LatencyMs: string | number;
}

interface LogEntry {
  time: string;
  ip: string;
  status: number;
  latency: number;
}

interface PreflightResult {
  ok?: boolean;
  status?: number;
  latency_ms?: number;
  final_url?: string;
  server?: string;
  request_id?: string;
  error?: string;
}

type RunPhase = "idle" | "executing" | "replaying" | "done" | "error";

type Beam = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  speed: number;
  color: string;
  blocked: boolean;
};

const statusColor = (status: number) => {
  if (status === 403) return "#fb7185";
  if (status === 429) return "#fbbf24";
  if (status >= 500 || status === 0) return "#c084fc";
  return "#34d399";
};

function WarRoom({
  logs,
  phase,
  targetName,
  metrics,
}: {
  logs: LogEntry[];
  phase: RunPhase;
  targetName: string;
  metrics: StressMetrics | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const beamsRef = useRef<Beam[]>([]);
  const nodesRef = useRef<Array<{ id: string; y: number }>>([]);
  const lastLogCountRef = useRef(0);

  useEffect(() => {
    if (logs.length <= lastLogCountRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newLogs = logs.slice(lastLogCountRef.current);
    lastLogCountRef.current = logs.length;
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 340;

    newLogs.slice(-24).forEach((log) => {
      let node = nodesRef.current.find((item) => item.id === log.ip);
      if (!node) {
        const usable = Math.max(120, h - 110);
        node = { id: log.ip, y: 72 + Math.random() * usable };
        nodesRef.current = [...nodesRef.current.slice(-9), node];
      }

      const blocked = log.status === 403 || log.status === 429;
      beamsRef.current.push({
        x: Math.max(120, w * 0.2),
        y: node.y,
        tx: blocked ? w * 0.77 : w * 0.88,
        ty: h * 0.55,
        speed: 8 + Math.random() * 4,
        color: statusColor(log.status),
        blocked,
      });
    });
  }, [logs]);

  useEffect(() => {
    if (phase === "idle") {
      lastLogCountRef.current = 0;
      beamsRef.current = [];
      nodesRef.current = [];
    }
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(320, rect.width);
      height = Math.max(230, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, "#020617");
      bg.addColorStop(0.55, "#07101f");
      bg.addColorStop(1, "#020617");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(51,65,85,.28)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += 38) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += 38) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const coreX = width * 0.88;
      const coreY = height * 0.55;
      const shieldX = width * 0.77;
      const pulse = 1 + Math.sin(Date.now() / 260) * 0.04;

      ctx.save();
      ctx.strokeStyle = "rgba(34,211,238,.8)";
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 20;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(shieldX, coreY, 54 * pulse, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.restore();

      const coreGradient = ctx.createRadialGradient(coreX, coreY, 2, coreX, coreY, 42);
      coreGradient.addColorStop(0, "rgba(255,255,255,.98)");
      coreGradient.addColorStop(0.18, "rgba(52,211,153,.95)");
      coreGradient.addColorStop(0.55, "rgba(34,211,238,.3)");
      coreGradient.addColorStop(1, "rgba(2,6,23,0)");
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(coreX, coreY, 42, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "600 10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#67e8f9";
      ctx.fillText("WAF", shieldX, coreY - 67);
      ctx.fillStyle = "#a7f3d0";
      ctx.fillText("TARGET", coreX, coreY + 55);

      ctx.textAlign = "left";
      nodesRef.current.forEach((node) => {
        ctx.fillStyle = "#64748b";
        ctx.font = "10px ui-monospace, monospace";
        ctx.fillText(node.id, 16, node.y + 3);
        ctx.fillStyle = phase === "executing" || phase === "replaying" ? "#22d3ee" : "#475569";
        ctx.beginPath();
        ctx.arc(Math.max(120, width * 0.2), node.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      beamsRef.current = beamsRef.current.filter((beam) => {
        const dx = beam.tx - beam.x;
        const dy = beam.ty - beam.y;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        if (distance < 12) return false;

        const oldX = beam.x;
        const oldY = beam.y;
        beam.x += (dx / distance) * beam.speed;
        beam.y += (dy / distance) * beam.speed;

        const trail = ctx.createLinearGradient(oldX, oldY, beam.x, beam.y);
        trail.addColorStop(0, "rgba(2,6,23,0)");
        trail.addColorStop(1, beam.color);
        ctx.strokeStyle = trail;
        ctx.lineWidth = beam.blocked ? 2.2 : 1.8;
        ctx.beginPath();
        ctx.moveTo(oldX, oldY);
        ctx.lineTo(beam.x, beam.y);
        ctx.stroke();
        return true;
      });

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationId);
    };
  }, [phase]);

  const phaseText =
    phase === "executing"
      ? "Running authorized load test"
      : phase === "replaying"
      ? "Replaying captured request telemetry"
      : phase === "done"
      ? "Run complete"
      : phase === "error"
      ? "Run stopped"
      : "War Room ready";

  return (
    <section className="relative min-h-[260px] h-[34vh] lg:h-full lg:min-h-0 overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-950 shadow-[0_18px_70px_rgba(0,0,0,.35)]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-2 p-3">
        <Badge className="border border-cyan-500/30 bg-slate-950/80 text-cyan-300 backdrop-blur-xl font-mono text-[10px]">
          <Zap className="mr-1 h-3 w-3" /> {metrics ? `${metrics.actualRps} req/s` : phaseText}
        </Badge>
        <Badge className="max-w-[70%] truncate border border-slate-700 bg-slate-950/80 text-slate-300 backdrop-blur-xl font-mono text-[10px]">
          {targetName || "No target selected"}
        </Badge>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-slate-800/80 bg-slate-950/70 px-3 py-2 text-[9px] font-mono backdrop-blur-md">
        <span className="text-emerald-300">● 2xx/3xx accepted</span>
        <span className="text-rose-300">● 403 denied</span>
        <span className="text-amber-300">● 429 rate limited</span>
        <span className="text-purple-300">● 5xx/network error</span>
      </div>
    </section>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: React.ReactNode; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5 text-center shadow-sm">
      <div className="text-[9px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-base font-bold ${tone}`}>{value}</div>
    </div>
  );
}

function StressTestContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [baseDomain, setBaseDomain] = useState("");
  const [endpoints, setEndpoints] = useState<string[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState("");
  const [scanningEndpoints, setScanningEndpoints] = useState(false);
  const [targetRequests, setTargetRequests] = useState(2000);
  const [duration, setDuration] = useState(5);

  const [detectingWaf, setDetectingWaf] = useState(false);
  const [detectedWaf, setDetectedWaf] = useState("standard");
  const [detectedWafName, setDetectedWafName] = useState<string | null>(null);
  const [inputLabel, setInputLabel] = useState("Authorized test credential");
  const [inputPlaceholder, setInputPlaceholder] = useState("header.Authorization=Bearer ...");
  const [credentialHelp, setCredentialHelp] = useState("Use credentials configured for your own test environment.");
  const [bypassCode, setBypassCode] = useState("");

  const [phase, setPhase] = useState<RunPhase>("idle");
  const [metrics, setMetrics] = useState<StressMetrics | null>(null);
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const running = phase === "executing" || phase === "replaying";
  const calculatedRps = useMemo(
    () => Math.round(targetRequests / Math.max(1, duration)),
    [targetRequests, duration]
  );

  useEffect(() => {
    return () => {
      if (replayTimer.current) clearInterval(replayTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!projectId) return;
    getProjectById(projectId)
      .then((project) => {
        if (!project) return;
        const domain = project.domain || project.projectDetail?.title || "";
        if (domain) {
          setBaseDomain(domain);
          setSelectedEndpoint(domain);
          setEndpoints([domain]);
        }
      })
      .catch((error) => console.warn("Load project error:", error));
  }, [projectId]);

  const handleScanEndpoints = async () => {
    if (!baseDomain || running) return;
    setScanningEndpoints(true);
    setErrorMsg(null);
    try {
      const result = await discoverEndpoints(baseDomain);
      const found = Array.isArray(result?.endpoints) ? result.endpoints : [];
      setEndpoints(found.length ? found : [baseDomain]);
      setSelectedEndpoint(found[0] || baseDomain);
    } catch {
      setErrorMsg("Không thể quét endpoint. Kiểm tra URL và kết nối backend.");
    } finally {
      setScanningEndpoints(false);
    }
  };

  const handleDetectWaf = async () => {
    const target = selectedEndpoint || baseDomain;
    if (!target || running) return;
    setDetectingWaf(true);
    setErrorMsg(null);
    try {
      const result = await detectWaf(target);
      setDetectedWaf(result.detected_waf || "standard");
      setDetectedWafName(result.waf_name || "No WAF / Generic Server");
      setInputLabel(result.input_label || "Authorized test credential");
      setInputPlaceholder(result.input_placeholder || "header.Authorization=Bearer ...");
      setCredentialHelp(result.credential_help || "Use credentials configured for your own test environment.");
      setBypassCode("");
    } catch {
      setErrorMsg("Không thể kiểm tra WAF.");
    } finally {
      setDetectingWaf(false);
    }
  };

  const replayCapturedLogs = (logs: LogEntry[]) => {
    if (replayTimer.current) clearInterval(replayTimer.current);
    if (!logs.length) {
      setPhase("done");
      return;
    }
    setPhase("replaying");
    setLiveLogs([]);
    let index = 0;
    const batch = Math.max(1, Math.ceil(logs.length / 36));
    replayTimer.current = setInterval(() => {
      index = Math.min(logs.length, index + batch);
      setLiveLogs(logs.slice(0, index));
      if (index >= logs.length) {
        if (replayTimer.current) clearInterval(replayTimer.current);
        replayTimer.current = null;
        setPhase("done");
      }
    }, 70);
  };

  const handleStartStress = async () => {
    const finalUrl = selectedEndpoint || baseDomain;
    if (!finalUrl || running) return;

    setErrorMsg(null);
    setProfileMessage(null);
    setPreflight(null);
    setMetrics(null);
    setLiveLogs([]);
    setPhase("executing");

    const payload = {
      target_url: finalUrl,
      target_requests: Math.min(50000, Math.max(1, targetRequests)),
      duration: `${Math.min(120, Math.max(1, duration))}s`,
      bypass_code: bypassCode.trim(),
      waf_type: detectedWaf,
    };

    try {
      const response = await runStressTest(payload);
      const result = response?.result || response || {};
      const raw = result.metrics || {};
      const capturedLogs: LogEntry[] = Array.isArray(result.sample_logs) ? result.sample_logs : [];

      const computedMetrics: StressMetrics = {
        totalRequests: raw.total_requests ?? 0,
        actualRps: raw.rps ?? 0,
        status200: raw.status_200 ?? 0,
        status403WafBlocked: raw.status_403_waf_blocked ?? 0,
        status429RateLimited: raw.status_429_rate_limited ?? 0,
        status500Crashed: raw.status_500_crashed ?? 0,
        otherStatus: raw.other_status ?? 0,
        p95LatencyMs: raw.p95_latency ?? "0ms",
      };

      setMetrics(computedMetrics);
      setPreflight(result.preflight || null);
      setProfileMessage(result.profile?.message || null);

      if (!result.ok) {
        setErrorMsg(result.profile?.message || `Preflight failed with HTTP ${result.preflight?.status || "unknown"}.`);
        setPhase("error");
        return;
      }

      replayCapturedLogs(capturedLogs);

      if (projectId) {
        await saveProjectDetail(projectId, {
          title: baseDomain,
          module: "stress-test",
          findings: {
            stressMetrics: computedMetrics,
            testedEndpoint: finalUrl,
            wafName: detectedWafName,
            preflight: result.preflight || null,
          },
        });
      }
    } catch (error: any) {
      setErrorMsg(error?.message || "Kiểm thử tải thất bại.");
      setPhase("error");
    }
  };

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-slate-950 text-slate-100 lg:h-[calc(100dvh-4rem)] lg:overflow-hidden">
      <div className="mx-auto flex min-h-full w-full max-w-[1800px] flex-col gap-3 p-3 sm:p-4 lg:h-full lg:p-4">
        <header className="flex shrink-0 flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 px-3 py-3 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400">
              <Flame className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold tracking-tight text-white sm:text-base">L7 Stress Test · War Room</h1>
              <p className="truncate text-[10px] text-slate-500">Authorized load testing with WAF-aware access profiles</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {detectedWafName && (
              <Badge className="border border-amber-500/30 bg-amber-500/10 text-amber-300 font-mono text-[10px]">
                <ShieldCheck className="mr-1 h-3 w-3" /> {detectedWafName}
              </Badge>
            )}
            <Badge className="border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 font-mono text-[10px]">
              {calculatedRps.toLocaleString()} req/s target
            </Badge>
          </div>
        </header>

        <div className="grid flex-1 gap-3 lg:min-h-0 lg:grid-cols-[minmax(310px,380px)_minmax(0,1fr)]">
          <aside className="flex flex-col gap-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <Card className="border-slate-800 bg-slate-900/80">
              <CardContent className="space-y-3 p-4">
                <div>
                  <label className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <span>Target domain</span>
                    {projectId && <span className="flex items-center gap-1 text-cyan-400"><Lock className="h-3 w-3" /> Project</span>}
                  </label>
                  <div className="relative mt-1.5">
                    <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      value={baseDomain}
                      onChange={(event) => setBaseDomain(event.target.value)}
                      disabled={running || Boolean(projectId && baseDomain)}
                      placeholder="https://example.com"
                      className="h-10 border-slate-800 bg-slate-950 pl-9 font-mono text-xs text-cyan-200"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Endpoint ({endpoints.length})</label>
                    <Button
                      size="sm"
                      type="button"
                      onClick={handleScanEndpoints}
                      disabled={running || scanningEndpoints || !baseDomain}
                      className="h-7 bg-cyan-600 px-2.5 text-[10px] hover:bg-cyan-500"
                    >
                      {scanningEndpoints ? <LoaderCircle className="mr-1 h-3 w-3 animate-spin" /> : <Search className="mr-1 h-3 w-3" />}
                      Discover
                    </Button>
                  </div>
                  <select
                    value={selectedEndpoint}
                    onChange={(event) => setSelectedEndpoint(event.target.value)}
                    disabled={running}
                    className="mt-1.5 h-10 w-full rounded-md border border-slate-800 bg-slate-950 px-3 font-mono text-xs text-slate-200 outline-none focus:border-cyan-600"
                  >
                    {(endpoints.length ? endpoints : baseDomain ? [baseDomain] : []).map((endpoint) => (
                      <option key={endpoint} value={endpoint}>{endpoint}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-semibold uppercase text-slate-500">Requests</label>
                    <Input
                      type="number"
                      min={1}
                      max={50000}
                      value={targetRequests}
                      onChange={(event) => setTargetRequests(Math.max(1, Number(event.target.value) || 1))}
                      disabled={running}
                      className="mt-1 h-9 border-slate-800 bg-slate-950 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold uppercase text-slate-500">Seconds</label>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={duration}
                      onChange={(event) => setDuration(Math.max(1, Number(event.target.value) || 1))}
                      disabled={running}
                      className="mt-1 h-9 border-slate-800 bg-slate-950 font-mono text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/80 lg:flex-1">
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex min-w-0 items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <KeyRound className="h-3.5 w-3.5 shrink-0 text-amber-400" /> {inputLabel}
                  </label>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={handleDetectWaf}
                    disabled={running || detectingWaf || !(selectedEndpoint || baseDomain)}
                    className="h-7 shrink-0 border-amber-500/30 px-2 text-[10px] text-amber-300 hover:bg-amber-500/10"
                  >
                    {detectingWaf ? <LoaderCircle className="mr-1 h-3 w-3 animate-spin" /> : <Activity className="mr-1 h-3 w-3" />}
                    Detect WAF
                  </Button>
                </div>

                <Input
                  value={bypassCode}
                  onChange={(event) => setBypassCode(event.target.value)}
                  disabled={running}
                  placeholder={inputPlaceholder}
                  className="h-10 border-slate-800 bg-slate-950 font-mono text-xs text-cyan-200 placeholder:text-slate-600"
                />

                <p className="text-[10px] leading-relaxed text-slate-500">{credentialHelp}</p>

                {(profileMessage || preflight) && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-[10px]">
                    {profileMessage && <p className="text-slate-300">{profileMessage}</p>}
                    {preflight && (
                      <div className="mt-2 flex flex-wrap gap-2 font-mono">
                        <span className={preflight.ok ? "text-emerald-400" : "text-rose-400"}>Preflight HTTP {preflight.status ?? 0}</span>
                        <span className="text-slate-500">{preflight.latency_ms ?? 0}ms</span>
                        {preflight.request_id && <span className="max-w-full truncate text-cyan-500">ID: {preflight.request_id}</span>}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-auto space-y-2 pt-1">
                  {errorMsg && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] text-rose-300">{errorMsg}</div>}
                  <Button
                    onClick={handleStartStress}
                    disabled={running || !(selectedEndpoint || baseDomain)}
                    className="h-11 w-full bg-gradient-to-r from-rose-600 to-orange-600 text-xs font-bold text-white shadow-lg shadow-rose-950/30 hover:from-rose-500 hover:to-orange-500"
                  >
                    {running ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Flame className="mr-2 h-4 w-4" />}
                    {phase === "executing" ? "Executing authorized test..." : phase === "replaying" ? "Rendering telemetry..." : `Start Stress Test · ${calculatedRps.toLocaleString()} req/s`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>

          <main className="grid gap-3 lg:min-h-0 lg:grid-rows-[minmax(0,1fr)_auto]">
            <WarRoom logs={liveLogs} phase={phase} targetName={selectedEndpoint || baseDomain} metrics={metrics} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              <MetricCard label="Total" value={metrics?.totalRequests ?? 0} tone="text-slate-100" />
              <MetricCard label="2xx/3xx" value={metrics?.status200 ?? 0} tone="text-emerald-400" />
              <MetricCard label="403" value={metrics?.status403WafBlocked ?? 0} tone="text-rose-400" />
              <MetricCard label="429" value={metrics?.status429RateLimited ?? 0} tone="text-amber-400" />
              <MetricCard label="5xx / Net" value={metrics?.status500Crashed ?? 0} tone="text-purple-400" />
              <MetricCard label="p95" value={metrics?.p95LatencyMs ?? "-"} tone="text-cyan-300" />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function StressTestPage() {
  return (
    <DashboardShell area="dashboard">
      <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-slate-500">Loading stress-test workspace...</div>}>
        <StressTestContent />
      </Suspense>
    </DashboardShell>
  );
}
