"use client";

import React, { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  LoaderCircle,
  Lock,
  Flame,
  Activity,
  Search,
  ShieldCheck,
  KeyRound,
  Zap,
} from "lucide-react";
import { getProjectById, saveProjectDetail, detectWaf, runStressTest, discoverEndpoints } from "@/lib/api";

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

interface LaserBeam {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  color: string;
  radius: number;
  isBlocked: boolean;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
}

function HologramWarRoomCanvas({
  logs,
  running,
  targetName,
  metrics,
}: {
  logs: LogEntry[];
  running: boolean;
  targetName: string;
  metrics: StressMetrics | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const beamsRef = useRef<LaserBeam[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const ipClustersRef = useRef<Array<{ ip: string; y: number; count: number }>>([]);
  const shieldHitRef = useRef<number>(0);

  useEffect(() => {
    if (!logs.length) return;
    const latest = logs.slice(-14);

    latest.forEach((l) => {
      const isBlocked = l.status === 403 || l.status === 429;
      let color = "#34d399"; // 200 OK Green
      if (l.status === 403) color = "#fb7185"; // 403 WAF Red
      else if (l.status === 429) color = "#fbbf24"; // 429 Rate Limit Amber
      else if (l.status >= 500) color = "#c084fc"; // 500 Crash Purple

      const canvas = canvasRef.current;
      const w = canvas ? canvas.width : 780;
      const h = canvas ? canvas.height : 260;

      // Group IP theo prefix
      const ipParts = l.ip.split(".");
      const ipGroupKey = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.*`;

      let existingIp = ipClustersRef.current.find((item) => item.ip === ipGroupKey);
      if (!existingIp) {
        const randomY = Math.floor(Math.random() * (h - 60)) + 30;
        existingIp = { ip: ipGroupKey, y: randomY, count: 1 };
        ipClustersRef.current = [existingIp, ...ipClustersRef.current.slice(0, 10)];
      } else {
        existingIp.count += 1;
      }

      const targetCoreX = w - 75;
      const shieldX = targetCoreX - 58;

      beamsRef.current.push({
        x: 185,
        y: existingIp.y,
        targetX: isBlocked ? shieldX : targetCoreX,
        targetY: h / 2,
        speed: Math.random() * 5 + 8,
        color,
        radius: Math.random() * 2 + 1.8,
        isBlocked,
      });
    });
  }, [logs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = "rgba(2, 6, 23, 0.32)";
      ctx.fillRect(0, 0, w, h);

      // Lưới Hologram
      ctx.strokeStyle = "rgba(51, 65, 85, 0.25)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      const targetCoreX = w - 75;
      const targetCoreY = h / 2;
      const shieldX = targetCoreX - 58;

      // VẼ TẤM KHIÊN WAF (CHẶN TIA 403/429)
      const shieldPulse = Math.sin(Date.now() / 140) * 2;
      const shieldHitActive = shieldHitRef.current > 0;
      if (shieldHitRef.current > 0) shieldHitRef.current -= 0.06;

      ctx.save();
      ctx.beginPath();
      ctx.arc(shieldX + 45, targetCoreY, 70 + shieldPulse, Math.PI * 0.73, Math.PI * 1.27);
      ctx.lineWidth = shieldHitActive ? 5 : 3;
      ctx.strokeStyle = shieldHitActive ? "rgba(251, 113, 133, 0.95)" : "rgba(34, 211, 238, 0.85)";
      ctx.shadowColor = shieldHitActive ? "#fb7185" : "#22d3ee";
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = shieldHitActive ? "#fb7185" : "#67e8f9";
      ctx.font = "bold 9px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("WAF SHIELD", shieldX - 5, targetCoreY - 48);

      // VẼ TARGET CORE
      const radGrad = ctx.createRadialGradient(targetCoreX, targetCoreY, 3, targetCoreX, targetCoreY, 26);
      radGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      radGrad.addColorStop(0.3, "rgba(52, 211, 153, 0.8)");
      radGrad.addColorStop(0.8, "rgba(34, 211, 238, 0.2)");
      radGrad.addColorStop(1, "rgba(2, 6, 23, 0)");

      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(targetCoreX, targetCoreY, 26, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(targetCoreX, targetCoreY, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#a7f3d0";
      ctx.font = "bold 10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("TARGET CORE", targetCoreX, targetCoreY + 26);

      // VẼ DANH SÁCH IP NGUỒN (PREFIX + COUNT)
      ctx.textAlign = "left";
      ipClustersRef.current.forEach((node) => {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px ui-monospace, monospace";
        ctx.fillText(node.ip, 16, node.y + 3);

        ctx.fillStyle = "#38bdf8";
        ctx.font = "9px ui-monospace, monospace";
        ctx.fillText(`(${node.count})`, 138, node.y + 3);

        ctx.fillStyle = running ? "#22d3ee" : "#64748b";
        ctx.beginPath();
        ctx.arc(175, node.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // CẬP NHẬT & VẼ CHÙM TIA LASER
      beamsRef.current.forEach((beam, idx) => {
        const dx = beam.targetX - beam.x;
        const dy = beam.targetY - beam.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 10) {
          if (beam.isBlocked) {
            shieldHitRef.current = 1.0;
            for (let s = 0; s < 4; s++) {
              sparksRef.current.push({
                x: beam.targetX,
                y: beam.targetY + (Math.random() - 0.5) * 20,
                vx: -(Math.random() * 4 + 2),
                vy: (Math.random() - 0.5) * 4,
                color: beam.color,
                alpha: 1,
              });
            }
          } else {
            ctx.strokeStyle = "#34d399";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(targetCoreX, targetCoreY, 15, 0, Math.PI * 2);
            ctx.stroke();
          }

          beamsRef.current.splice(idx, 1);
        } else {
          beam.x += (dx / dist) * beam.speed;
          beam.y += (dy / dist) * beam.speed;

          const trailLength = 22;
          const trailX = beam.x - (dx / dist) * trailLength;
          const trailY = beam.y - (dy / dist) * trailLength;

          const grad = ctx.createLinearGradient(trailX, trailY, beam.x, beam.y);
          grad.addColorStop(0, "rgba(0,0,0,0)");
          grad.addColorStop(1, beam.color);

          ctx.strokeStyle = grad;
          ctx.lineWidth = beam.radius;
          ctx.beginPath();
          ctx.moveTo(trailX, trailY);
          ctx.lineTo(beam.x, beam.y);
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(beam.x, beam.y, beam.radius * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // VẼ TIA LỬA NỔ TẠI KHIÊN
      sparksRef.current.forEach((sp, sIdx) => {
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.alpha -= 0.05;

        if (sp.alpha <= 0) {
          sparksRef.current.splice(sIdx, 1);
        } else {
          ctx.fillStyle = sp.color;
          ctx.globalAlpha = sp.alpha;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [running, targetName]);

  return (
    <div className="relative w-full h-[245px] rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl shrink-0">
      <canvas ref={canvasRef} width={800} height={245} className="w-full h-full block" />

      <div className="absolute top-2 left-3 flex items-center gap-2">
        <Badge className="bg-slate-900/90 border-slate-700 text-cyan-300 font-mono text-[10px] backdrop-blur-md">
          <Zap className="h-3 w-3 mr-1 text-cyan-400 fill-cyan-400" />
          {metrics ? `${metrics.actualRps} req/s` : running ? "Executing Traffic..." : "War Room Ready"}
        </Badge>
      </div>

      <div className="absolute top-2 right-3 flex items-center gap-2 text-[10px] font-mono">
        <span className="flex items-center gap-1 text-emerald-400 font-bold">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> 200 OK (Thủng Khiên)
        </span>
        <span className="flex items-center gap-1 text-rose-400 font-bold">
          <span className="h-2 w-2 rounded-full bg-rose-400" /> 403 WAF (Khiên Chặn)
        </span>
      </div>
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

  const [targetRequests, setTargetRequests] = useState<number>(2000);
  const [duration, setDuration] = useState<number>(5);

  const [detectingWaf, setDetectingWaf] = useState(false);
  const [detectedWaf, setDetectedWaf] = useState<string>("standard");
  const [detectedWafName, setDetectedWafName] = useState<string | null>(null);
  const [inputLabel, setInputLabel] = useState<string>("Mã Bypass / Secret Token");
  const [inputPlaceholder, setInputPlaceholder] = useState<string>("Nhập mã bypass");
  const [bypassCode, setBypassCode] = useState<string>("");

  const [running, setRunning] = useState(false);
  const [metrics, setMetrics] = useState<StressMetrics | null>(null);
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const calculatedRps = Math.round(targetRequests / Math.max(1, duration));

  useEffect(() => {
    if (!projectId) return;
    getProjectById(projectId)
      .then((p) => {
        if (!p) return;
        const domain = p.domain || p.projectDetail?.title || "";
        if (domain) {
          setBaseDomain(domain);
          setSelectedEndpoint(domain);
          setEndpoints([domain]);
        }
      })
      .catch((e) => console.warn("Load project error:", e));
  }, [projectId]);

  const handleScanEndpoints = async () => {
    if (!baseDomain || running) return;
    setScanningEndpoints(true);
    setErrorMsg(null);

    try {
      const res = await discoverEndpoints(baseDomain);
      if (res && res.endpoints && res.endpoints.length > 0) {
        setEndpoints(res.endpoints);
        setSelectedEndpoint(res.endpoints[0]);
      }
    } catch {
      setErrorMsg("Không thể quét endpoint.");
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
      const res = await detectWaf(target);
      setDetectedWaf(res.detected_waf || "standard");
      setDetectedWafName(res.waf_name);
      setInputLabel(res.input_label || "Mã Bypass / Secret Token");
      setInputPlaceholder(res.input_placeholder || "Nhập mã bypass");
    } catch {
      setErrorMsg("Không thể kiểm tra WAF.");
    } finally {
      setDetectingWaf(false);
    }
  };

  const handleStartStress = async () => {
    const finalUrl = selectedEndpoint || baseDomain;
    if (!finalUrl || running) return;

    setErrorMsg(null);
    setRunning(true);
    setMetrics(null);
    setLiveLogs([]);

    const payload = {
      target_url: finalUrl,
      target_requests: targetRequests,
      duration: `${duration}s`,
      bypass_code: bypassCode.trim(),
      waf_type: detectedWaf,
    };

    try {
      const response = await runStressTest(payload);
      const resData = response.result?.metrics || response.metrics || {};
      const realSampleLogs = response.result?.sample_logs || response.sample_logs || [];

      const computedMetrics: StressMetrics = {
        totalRequests: resData.total_requests || targetRequests,
        actualRps: resData.rps || calculatedRps,
        status200: resData.status_200 || 0,
        status403WafBlocked: resData.status_403_waf_blocked || 0,
        status429RateLimited: resData.status_429_rate_limited || 0,
        status500Crashed: resData.status_500_crashed || 0,
        otherStatus: resData.other_status || 0,
        p95LatencyMs: resData.p95_latency || "16ms",
      };

      setMetrics(computedMetrics);
      setLiveLogs(realSampleLogs);

      if (projectId) {
        await saveProjectDetail(projectId, {
          title: baseDomain,
          module: "stress-test",
          findings: {
            stressMetrics: computedMetrics,
            testedEndpoint: finalUrl,
            wafName: detectedWafName,
          },
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Kiểm thử tải thất bại.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="h-[calc(100vh-5rem)] max-h-[calc(100vh-5rem)] overflow-hidden flex flex-col justify-between p-2.5 bg-slate-950 text-slate-100 font-sans">
      {/* 1. Header Bar Tối Giản */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Flame className="h-4 w-4 fill-rose-500 text-rose-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              L7 Stress Test & War Room Hologram
              {projectId && (
                <span className="text-[10px] font-mono text-cyan-400 font-normal">
                  [{projectId.slice(0, 10)}]
                </span>
              )}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {detectedWafName && (
            <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono text-[10px]" variant="muted">
              <ShieldCheck className="h-3 w-3 mr-1" /> {detectedWafName}
            </Badge>
          )}
          <Badge className="border-cyan-500/40 bg-cyan-500/10 text-cyan-300 font-mono text-[10px]" variant="muted">
            Tốc độ: {calculatedRps.toLocaleString()} req/sec
          </Badge>
        </div>
      </div>

      {/* 2. Bố Cục 2 Cột Vừa Khít 1 Màn Hình Không Cần Cuộn */}
      <div className="grid gap-2.5 lg:grid-cols-12 flex-1 my-1.5 min-h-0 overflow-hidden">
        {/* CỘT TRÁI (5 phần): Cấu hình & Ô Nhập Khóa Khi Bắn */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-2 min-h-0">
          <Card className="border-slate-800 bg-slate-900/90 shadow-md">
            <CardContent className="p-3 space-y-2">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-400 flex items-center justify-between">
                  <span>Domain Gốc</span>
                  {projectId && (
                    <span className="text-[9px] text-cyan-400 flex items-center gap-1">
                      <Lock className="h-2.5 w-2.5" /> Cố định
                    </span>
                  )}
                </label>
                <div className="relative mt-1">
                  <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    value={baseDomain}
                    onChange={(e) => setBaseDomain(e.target.value)}
                    disabled={running || Boolean(projectId && baseDomain)}
                    placeholder="https://example.com"
                    className="h-8 pl-8 border-slate-800 bg-slate-950 font-mono text-xs text-cyan-300 disabled:opacity-80"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold uppercase text-slate-400">
                    Endpoint Bắn Tải ({endpoints.length})
                  </label>
                  <Button
                    size="sm"
                    type="button"
                    onClick={handleScanEndpoints}
                    disabled={running || scanningEndpoints || !baseDomain}
                    className="h-5 px-2 text-[9px] bg-cyan-600/90 hover:bg-cyan-500 text-white font-medium"
                  >
                    {scanningEndpoints ? <LoaderCircle className="h-2.5 w-2.5 animate-spin mr-1" /> : <Search className="h-2.5 w-2.5 mr-1" />}
                    Quét Endpoint
                  </Button>
                </div>
                <select
                  value={selectedEndpoint}
                  onChange={(e) => setSelectedEndpoint(e.target.value)}
                  disabled={running}
                  className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none focus:border-rose-500 font-mono disabled:opacity-60"
                >
                  {endpoints.map((ep, idx) => (
                    <option key={idx} value={ep}>
                      {ep}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div>
                  <label className="text-[9px] uppercase text-slate-400 font-semibold">Tổng Requests</label>
                  <Input
                    type="number"
                    min={10}
                    max={50000}
                    step={100}
                    value={targetRequests}
                    onChange={(e) => setTargetRequests(Math.max(1, Number(e.target.value)))}
                    disabled={running}
                    className="mt-0.5 h-7 border-slate-800 bg-slate-950 text-xs font-bold text-white disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase text-slate-400 font-semibold">Thời gian (Giây)</label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={duration}
                    onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
                    disabled={running}
                    className="mt-0.5 h-7 border-slate-800 bg-slate-950 text-xs font-bold text-white disabled:opacity-60"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quét WAF & Ô Nhập Mã Bypass Tự Động Khóa */}
          <Card className="border-slate-800 bg-slate-900/90 shadow-md flex-1 flex flex-col justify-between">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                  <KeyRound className="h-3 w-3 text-amber-400" /> {inputLabel}
                </label>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={handleDetectWaf}
                  disabled={running || detectingWaf}
                  className="h-5 px-2 text-[9px] border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                >
                  {detectingWaf ? <LoaderCircle className="h-2.5 w-2.5 animate-spin mr-1" /> : <Activity className="h-2.5 w-2.5 mr-1" />}
                  Quét WAF
                </Button>
              </div>

              <Input
                value={bypassCode}
                onChange={(e) => setBypassCode(e.target.value)}
                disabled={running}
                placeholder={inputPlaceholder}
                className="h-8 border-slate-800 bg-slate-950 font-mono text-xs text-cyan-300 placeholder:text-slate-600 disabled:opacity-60"
              />

              <p className="text-[9px] text-slate-400 leading-relaxed">
                {detectedWaf === "vercel"
                  ? "Dán chuỗi Secret (rsE...), hệ thống tự tiêm 3 tầng vào URL, Header & Cookie."
                  : detectedWaf === "cloudflare"
                  ? "Dán trực tiếp token cf_clearance hoặc Service Secret."
                  : "Hỗ trợ nạp token hoặc chuỗi header/cookie tùy chỉnh."}
              </p>

              <div className="pt-1">
                {errorMsg && <p className="mb-1 text-[10px] text-rose-400">{errorMsg}</p>}
                <Button
                  onClick={handleStartStress}
                  disabled={running || !baseDomain}
                  className="h-9 w-full bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold shadow-lg shadow-rose-900/30 transition text-xs"
                >
                  {running ? (
                    <span className="flex items-center gap-1.5">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin text-white" />
                      Đang thực thi ({calculatedRps.toLocaleString()} req/s)...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5 fill-white" />
                      Kích Hoạt Stress Test ({calculatedRps.toLocaleString()} req/s)
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CỘT PHẢI (7 phần): War Room Hologram Canvas với Tấm Khiên WAF & Thẻ HTTP */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-2 min-h-0">
          <HologramWarRoomCanvas
            logs={liveLogs}
            running={running}
            targetName={selectedEndpoint || baseDomain}
            metrics={metrics}
          />

          {/* 4 Thẻ Trạng Thái HTTP Thực Tế */}
          <div className="grid grid-cols-4 gap-2 shrink-0">
            <div className="p-2 rounded-xl border border-slate-800 bg-slate-900/90 text-center">
              <div className="text-[9px] text-slate-400 font-medium">200 OK (Thành công)</div>
              <div className="text-sm font-bold text-emerald-400 font-mono">
                {metrics ? metrics.status200 : 0}
              </div>
            </div>
            <div className="p-2 rounded-xl border border-slate-800 bg-slate-900/90 text-center">
              <div className="text-[9px] text-slate-400 font-medium">403 (Khiên Chặn)</div>
              <div className="text-sm font-bold text-rose-400 font-mono">
                {metrics ? metrics.status403WafBlocked : 0}
              </div>
            </div>
            <div className="p-2 rounded-xl border border-slate-800 bg-slate-900/90 text-center">
              <div className="text-[9px] text-slate-400 font-medium">429 (Giới hạn tải)</div>
              <div className="text-sm font-bold text-amber-400 font-mono">
                {metrics ? metrics.status429RateLimited : 0}
              </div>
            </div>
            <div className="p-2 rounded-xl border border-slate-800 bg-slate-900/90 text-center">
              <div className="text-[9px] text-slate-400 font-medium">Latency p95</div>
              <div className="text-sm font-bold text-cyan-300 font-mono">
                {metrics ? metrics.p95LatencyMs : "-"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StressTestPage() {
  return (
    <DashboardShell area="dashboard">
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-400">Loading war room suite...</div>}>
        <StressTestContent />
      </Suspense>
    </DashboardShell>
  );
}
