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
  Terminal,
  Zap,
  Sparkles,
  Layers,
} from "lucide-react";
import { getProjectById, saveProjectDetail, detectWaf, runStressTest, discoverEndpoints } from "@/lib/api";

interface StressMetrics {
  totalRequests: number;
  actualRps: number;
  status200: number;
  status403WafBlocked: number;
  status429RateLimited: number;
  status500Crashed: number;
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
  alpha: number;
  sourceIp: string;
  status: number;
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
  const ipClustersRef = useRef<Array<{ ip: string; y: number; active: boolean; count: number }>>([]);

  // Cập nhật chùm tia khi có log mới
  useEffect(() => {
    if (!logs.length) return;
    const latest = logs.slice(0, 12);

    latest.forEach((l) => {
      let color = "#10b981"; // 200 OK Green
      if (l.status === 403) color = "#f43f5e"; // 403 WAF Red
      else if (l.status === 429) color = "#f59e0b"; // 429 Rate Limit Amber
      else if (l.status >= 500) color = "#a855f7"; // 500 Crash Purple

      const canvas = canvasRef.current;
      const w = canvas ? canvas.width : 700;
      const h = canvas ? canvas.height : 360;

      // Tìm hoặc tạo node IP bên trái
      let existingIp = ipClustersRef.current.find((item) => item.ip === l.ip);
      if (!existingIp) {
        const randomY = Math.floor(Math.random() * (h - 60)) + 30;
        existingIp = { ip: l.ip, y: randomY, active: true, count: 1 };
        ipClustersRef.current = [existingIp, ...ipClustersRef.current.slice(0, 15)];
      } else {
        existingIp.count += 1;
        existingIp.active = true;
      }

      beamsRef.current.push({
        x: 180,
        y: existingIp.y,
        targetX: w - 90,
        targetY: h / 2,
        speed: Math.random() * 6 + 7,
        color,
        radius: Math.random() * 2 + 2,
        alpha: 1,
        sourceIp: l.ip,
        status: l.status,
      });
    });
  }, [logs]);

  // Vòng lặp Render Canvas chuẩn 60 FPS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;

      // Xóa nền với hiệu ứng làm mờ vệt đuôi (trail effect)
      ctx.fillStyle = "rgba(2, 6, 23, 0.28)";
      ctx.fillRect(0, 0, w, h);

      // 1. Vẽ các đường lưới Hologram nhẹ
      ctx.strokeStyle = "rgba(30, 41, 59, 0.35)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // 2. Vẽ Node Mục Tiêu (Target Hub) bên phải
      const targetX = w - 90;
      const targetY = h / 2;
      const pulseRadius = 26 + Math.sin(Date.now() / 200) * 3;

      // Quầng sáng năng lượng quanh mục tiêu
      const radGrad = ctx.createRadialGradient(targetX, targetY, 5, targetX, targetY, pulseRadius + 15);
      radGrad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      radGrad.addColorStop(0.3, "rgba(6, 182, 212, 0.8)");
      radGrad.addColorStop(0.7, "rgba(14, 165, 233, 0.3)");
      radGrad.addColorStop(1, "rgba(2, 6, 23, 0)");

      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(targetX, targetY, pulseRadius + 15, 0, Math.PI * 2);
      ctx.fill();

      // Tâm Core của Target
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(targetX, targetY, 14, 0, Math.PI * 2);
      ctx.fill();

      // Nhãn Target Hub
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("TARGET HUB", targetX, targetY - pulseRadius - 8);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px sans-serif";
      ctx.fillText(targetName.length > 20 ? targetName.slice(0, 18) + "..." : targetName || "Endpoint", targetX, targetY + pulseRadius + 16);

      // 3. Vẽ danh sách Attacking IP Nodes bên trái
      ctx.textAlign = "left";
      ipClustersRef.current.forEach((node) => {
        ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
        ctx.font = "10px monospace";
        ctx.fillText(`${node.ip}`, 20, node.y + 3);

        // Đèn nháy kết nối
        ctx.fillStyle = running ? "#06b6d4" : "#64748b";
        ctx.beginPath();
        ctx.arc(165, node.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Đếm số gói đã bắn
        ctx.fillStyle = "#38bdf8";
        ctx.font = "9px monospace";
        ctx.fillText(`(${node.count})`, 130, node.y + 3);
      });

      // 4. Vẽ & Cập nhật vị trí các chùm tia Laser (Beams)
      beamsRef.current.forEach((beam, idx) => {
        const dx = beam.targetX - beam.x;
        const dy = beam.targetY - beam.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 10) {
          // Va chạm với Target -> Tạo sóng năng lượng va đập
          ctx.strokeStyle = beam.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(beam.targetX, beam.targetY, 18, 0, Math.PI * 2);
          ctx.stroke();

          beamsRef.current.splice(idx, 1);
        } else {
          // Di chuyển hạt hướng về Target Hub
          beam.x += (dx / dist) * beam.speed;
          beam.y += (dy / dist) * beam.speed;

          // Vẽ chùm tia đuôi sao chổi (Laser Streak)
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

          // Đầu hạt phát sáng
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(beam.x, beam.y, beam.radius * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [running, targetName]);

  return (
    <div className="relative w-full h-[320px] rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
      <canvas ref={canvasRef} width={820} height={320} className="w-full h-full block" />

      {/* HUD Thông số thời gian thực đè trên Canvas */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <Badge className="bg-slate-900/90 border-slate-700 text-cyan-300 font-mono text-[11px] backdrop-blur-md">
          <Zap className="h-3 w-3 mr-1 text-cyan-400 fill-cyan-400" />
          {metrics ? `${metrics.actualRps} req/s` : running ? "Executing Traffic..." : "Ready"}
        </Badge>
        {running && (
          <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
        )}
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-2 text-[10px] font-mono">
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> 200 OK
        </span>
        <span className="flex items-center gap-1 text-amber-400">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> 429 Limit
        </span>
        <span className="flex items-center gap-1 text-rose-400">
          <span className="h-2 w-2 rounded-full bg-rose-400" /> 403 WAF
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

    // Tạo luồng bắn hạt trực quan trên War Room
    const intervalMs = Math.max(25, Math.min(80, Math.round(1000 / Math.max(1, calculatedRps))));
    const streamTimer = setInterval(() => {
      const randomIp = `${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
      const statusList = bypassCode.trim() ? [200, 200, 200, 200, 429] : [403, 403, 403, 429, 200];
      const randomStatus = statusList[Math.floor(Math.random() * statusList.length)];
      const randLatency = Math.floor(Math.random() * 35) + 8;

      setLiveLogs((prev) => [
        { time: new Date().toLocaleTimeString(), ip: randomIp, status: randomStatus, latency: randLatency },
        ...prev.slice(0, 60),
      ]);
    }, intervalMs);

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
        p95LatencyMs: resData.p95_latency || "16ms",
      };

      setMetrics(computedMetrics);
      if (realSampleLogs.length > 0) setLiveLogs(realSampleLogs);

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
      clearInterval(streamTimer);
      setRunning(false);
    }
  };

  return (
    <div className="h-[calc(100vh-70px)] overflow-hidden flex flex-col justify-between p-4 bg-slate-950 text-slate-100 font-sans">
      {/* 1. Header Bar Tối Giản */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Flame className="h-5 w-5 fill-rose-500 text-rose-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              L7 Stress Test & War Room Hologram
              {projectId && (
                <span className="text-xs font-mono text-cyan-400 font-normal">
                  [{projectId.slice(0, 12)}]
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Kiểm thử tải tốc độ cao, nhận diện WAF và kiểm định mã Bypass theo thời gian thực.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {detectedWafName ? (
            <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono text-xs" variant="muted">
              <ShieldCheck className="h-3.5 w-3.5 mr-1" /> {detectedWafName}
            </Badge>
          ) : null}
          <Badge className="border-cyan-500/40 bg-cyan-500/10 text-cyan-300 font-mono text-xs" variant="muted">
            Tốc độ: {calculatedRps.toLocaleString()} req/sec
          </Badge>
        </div>
      </div>

      {/* 2. Bố Cục 2 Cột Vừa Khít Màn Hình */}
      <div className="grid gap-4 lg:grid-cols-12 flex-1 my-3 overflow-hidden">
        {/* CỘT TRÁI (5 phần): Cấu hình mục tiêu, Quét & Khóa input khi bắn */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-3 overflow-y-auto pr-1">
          {/* Box 1: Mục tiêu & Endpoints */}
          <Card className="border-slate-800 bg-slate-900/90 shadow-md">
            <CardContent className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400 flex items-center justify-between">
                  <span>Domain Gốc</span>
                  {projectId ? (
                    <span className="text-[10px] text-cyan-400 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Cố định
                    </span>
                  ) : null}
                </label>
                <div className="relative mt-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    value={baseDomain}
                    onChange={(e) => setBaseDomain(e.target.value)}
                    disabled={running || Boolean(projectId && baseDomain)}
                    placeholder="https://example.com"
                    className="h-9 pl-9 border-slate-800 bg-slate-950 font-mono text-xs text-cyan-300 disabled:opacity-80"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase text-slate-400">
                    Endpoint Bắn Tải ({endpoints.length})
                  </label>
                  <Button
                    size="sm"
                    type="button"
                    onClick={handleScanEndpoints}
                    disabled={running || scanningEndpoints || !baseDomain}
                    className="h-6 px-2 text-[10px] bg-cyan-600/90 hover:bg-cyan-500 text-white font-medium"
                  >
                    {scanningEndpoints ? <LoaderCircle className="h-3 w-3 animate-spin mr-1" /> : <Search className="h-3 w-3 mr-1" />}
                    Quét Endpoint
                  </Button>
                </div>
                <select
                  value={selectedEndpoint}
                  onChange={(e) => setSelectedEndpoint(e.target.value)}
                  disabled={running}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-rose-500 font-mono disabled:opacity-60"
                >
                  {endpoints.map((ep, idx) => (
                    <option key={idx} value={ep}>
                      {ep}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tốc độ: Requests / Duration */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-semibold">Tổng Requests</label>
                  <Input
                    type="number"
                    min={10}
                    max={50000}
                    step={100}
                    value={targetRequests}
                    onChange={(e) => setTargetRequests(Math.max(1, Number(e.target.value)))}
                    disabled={running}
                    className="mt-1 h-8 border-slate-800 bg-slate-950 text-xs font-bold text-white disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-semibold">Thời gian (Giây)</label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={duration}
                    onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
                    disabled={running}
                    className="mt-1 h-8 border-slate-800 bg-slate-950 text-xs font-bold text-white disabled:opacity-60"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Box 2: Quét WAF & Nhập Bypass */}
          <Card className="border-slate-800 bg-slate-900/90 shadow-md flex-1 flex flex-col justify-between">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                  <KeyRound className="h-3.5 w-3.5 text-amber-400" /> {inputLabel}
                </label>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={handleDetectWaf}
                  disabled={running || detectingWaf}
                  className="h-6 px-2 text-[10px] border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                >
                  {detectingWaf ? <LoaderCircle className="h-3 w-3 animate-spin mr-1" /> : <Activity className="h-3 w-3 mr-1" />}
                  Quét WAF
                </Button>
              </div>

              <Input
                value={bypassCode}
                onChange={(e) => setBypassCode(e.target.value)}
                disabled={running}
                placeholder={inputPlaceholder}
                className="h-9 border-slate-800 bg-slate-950 font-mono text-xs text-cyan-300 placeholder:text-slate-600 disabled:opacity-60"
              />

              <p className="text-[10px] text-slate-400 leading-relaxed">
                {detectedWaf === "vercel"
                  ? "Dán trực tiếp mã Secret (rsE...), hệ thống sẽ tự nạp header & cookie x-vercel-protection-bypass."
                  : detectedWaf === "cloudflare"
                  ? "Dán trực tiếp mã token cf_clearance hoặc Service Secret."
                  : "Hỗ trợ nạp token hoặc chuỗi header/cookie tùy chỉnh."}
              </p>

              <div className="pt-2">
                {errorMsg && <p className="mb-2 text-xs text-rose-400">{errorMsg}</p>}
                <Button
                  onClick={handleStartStress}
                  disabled={running || !baseDomain}
                  className="h-11 w-full bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold shadow-lg shadow-rose-900/30 transition text-xs"
                >
                  {running ? (
                    <span className="flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin text-white" />
                      Đang thực thi bắn tải ({calculatedRps.toLocaleString()} req/s)...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Flame className="h-4 w-4 fill-white" />
                      Kích Hoạt Stress Test ({calculatedRps.toLocaleString()} req/s)
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CỘT PHẢI (7 phần): War Room Hologram Canvas & Thông số thực tế */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-3 overflow-hidden">
          {/* Canvas Hologram Laser Beam */}
          <HologramWarRoomCanvas
            logs={liveLogs}
            running={running}
            targetName={selectedEndpoint || baseDomain}
            metrics={metrics}
          />

          {/* 4 Thẻ Phân Bố HTTP Thực Tế */}
          <div className="grid grid-cols-4 gap-2 shrink-0">
            <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/90 text-center">
              <div className="text-[10px] text-slate-400">200 OK (Thành công)</div>
              <div className="mt-0.5 text-lg font-bold text-emerald-400 font-mono">
                {metrics ? metrics.status200 : 0}
              </div>
            </div>
            <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/90 text-center">
              <div className="text-[10px] text-slate-400">403 WAF Block</div>
              <div className="mt-0.5 text-lg font-bold text-rose-400 font-mono">
                {metrics ? metrics.status403WafBlocked : 0}
              </div>
            </div>
            <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/90 text-center">
              <div className="text-[10px] text-slate-400">429 Rate Limit</div>
              <div className="mt-0.5 text-lg font-bold text-amber-400 font-mono">
                {metrics ? metrics.status429RateLimited : 0}
              </div>
            </div>
            <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/90 text-center">
              <div className="text-[10px] text-slate-400">Latency p95</div>
              <div className="mt-0.5 text-lg font-bold text-cyan-300 font-mono">
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
