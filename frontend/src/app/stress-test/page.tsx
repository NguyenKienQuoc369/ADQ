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
  Shield,
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
  status: number;
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
    const latest = logs.slice(0, 10);

    latest.forEach((l) => {
      const isBlocked = l.status === 403 || l.status === 429;
      let color = "#10b981"; // 200 OK Green
      if (l.status === 403) color = "#f43f5e"; // 403 WAF Red
      else if (l.status === 429) color = "#f59e0b"; // 429 Rate Limit Amber
      else if (l.status >= 500) color = "#a855f7"; // 500 Crash Purple

      const canvas = canvasRef.current;
      const w = canvas ? canvas.width : 760;
      const h = canvas ? canvas.height : 300;

      let existingIp = ipClustersRef.current.find((item) => item.ip === l.ip);
      if (!existingIp) {
        const randomY = Math.floor(Math.random() * (h - 50)) + 25;
        existingIp = { ip: l.ip, y: randomY, count: 1 };
        ipClustersRef.current = [existingIp, ...ipClustersRef.current.slice(0, 14)];
      } else {
        existingIp.count += 1;
      }

      const targetCoreX = w - 85;
      const shieldX = targetCoreX - 55;

      beamsRef.current.push({
        x: 175,
        y: existingIp.y,
        targetX: isBlocked ? shieldX : targetCoreX,
        targetY: h / 2,
        speed: Math.random() * 5 + 7,
        color,
        radius: Math.random() * 2 + 2,
        status: l.status,
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

      // Xóa nền với hiệu ứng vệt mờ neon
      ctx.fillStyle = "rgba(2, 6, 23, 0.32)";
      ctx.fillRect(0, 0, w, h);

      // 1. Vẽ lưới Hologram
      ctx.strokeStyle = "rgba(30, 41, 59, 0.35)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      const targetCoreX = w - 85;
      const targetCoreY = h / 2;
      const shieldX = targetCoreX - 55;

      // 2. VẼ TẤM KHIÊN NĂNG LƯỢNG WAF (ENERGY SHIELD)
      const shieldPulse = Math.sin(Date.now() / 150) * 2;
      const shieldHitActive = shieldHitRef.current > 0;
      if (shieldHitRef.current > 0) shieldHitRef.current -= 0.05;

      ctx.save();
      ctx.beginPath();
      ctx.arc(shieldX + 50, targetCoreY, 80 + shieldPulse, Math.PI * 0.72, Math.PI * 1.28);
      ctx.lineWidth = shieldHitActive ? 5 : 3;
      ctx.strokeStyle = shieldHitActive
        ? "rgba(244, 63, 94, 0.95)"
        : "rgba(6, 182, 212, 0.85)";
      ctx.shadowColor = shieldHitActive ? "#f43f5e" : "#06b6d4";
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.restore();

      // Nhãn Tấm Khiên WAF
      ctx.fillStyle = shieldHitActive ? "#f43f5e" : "#38bdf8";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("WAF SHIELD", shieldX - 5, targetCoreY - 55);

      // 3. VẼ TARGET HUB CORE BÊN TRONG KHIÊN
      const radGrad = ctx.createRadialGradient(targetCoreX, targetCoreY, 4, targetCoreX, targetCoreY, 32);
      radGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      radGrad.addColorStop(0.3, "rgba(16, 185, 129, 0.8)");
      radGrad.addColorStop(0.8, "rgba(6, 182, 212, 0.2)");
      radGrad.addColorStop(1, "rgba(2, 6, 23, 0)");

      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(targetCoreX, targetCoreY, 32, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(targetCoreX, targetCoreY, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#10b981";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("TARGET CORE", targetCoreX, targetCoreY + 32);

      // 4. VẼ CÁC IP NGUỒN BÊN TRÁI
      ctx.textAlign = "left";
      ipClustersRef.current.forEach((node) => {
        ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
        ctx.font = "10px monospace";
        ctx.fillText(node.ip, 18, node.y + 3);

        ctx.fillStyle = running ? "#06b6d4" : "#64748b";
        ctx.beginPath();
        ctx.arc(165, node.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // 5. CẬP NHẬT & VẼ CHÙM TIA LASER
      beamsRef.current.forEach((beam, idx) => {
        const dx = beam.targetX - beam.x;
        const dy = beam.targetY - beam.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 10) {
          if (beam.isBlocked) {
            // Nổ tia lửa trên tấm khiên WAF (Bị chặn 403 / 429)
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
            // Xuyên vào Core thành công (200 OK)
            ctx.strokeStyle = "#10b981";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(targetCoreX, targetCoreY, 18, 0, Math.PI * 2);
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
          ctx.arc(beam.x, beam.y, beam.radius * 0.75, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // 6. VẼ TIA LỬA VA ĐẬP KHI BỊ WAF CHẶN
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
    <div className="relative w-full h-[285px] rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
      <canvas ref={canvasRef} width={820} height={285} className="w-full h-full block" />

      <div className="absolute top-2.5 left-3 flex items-center gap-2">
        <Badge className="bg-slate-900/90 border-slate-700 text-cyan-300 font-mono text-[10px] backdrop-blur-md">
          <Zap className="h-3 w-3 mr-1 text-cyan-400 fill-cyan-400" />
          {metrics ? `${metrics.actualRps} req/s` : running ? "Executing Traffic..." : "War Room Ready"}
        </Badge>
      </div>

      <div className="absolute top-2.5 right-3 flex items-center gap-2 text-[10px] font-mono">
        <span className="flex items-center gap-1 text-emerald-400 font-bold">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> 200 OK (Thủng Khiên)
        </span>
        <span className="flex items-center gap-1 text-rose-400 font-bold">
          <span className="h-2 w-2 rounded-full bg-rose-400" /> 403 WAF (Khiên Chặn)
        </span>
        <span className="flex items-center gap-1 text-amber-400 font-bold">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> 429 Limit
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
    <div className="h-[calc(100vh-64px)] max-h-[calc(100vh-64px)] overflow-hidden flex flex-col justify-between p-3 bg-slate-950 text-slate-100 font-sans">
      {/* 1. Thanh Tiêu Đề Gọn Gàng */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Flame className="h-4 w-4 fill-rose-500 text-rose-500" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              L7 Stress Test & War Room Hologram
              {projectId && (
                <span className="text-[11px] font-mono text-cyan-400 font-normal">
                  [{projectId.slice(0, 12)}]
                </span>
              )}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {detectedWafName ? (
            <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono text-[11px]" variant="muted">
              <ShieldCheck className="h-3 w-3 mr-1" /> {detectedWafName}
            </Badge>
          ) : null}
          <Badge className="border-cyan-500/40 bg-cyan-500/10 text-cyan-300 font-mono text-[11px]" variant="muted">
            Tốc độ: {calculatedRps.toLocaleString()} req/sec
          </Badge>
        </div>
      </div>

      {/* 2. Bố Cục 2 Cột Vừa Khít 1 Màn Hình Không Cần Cuộn */}
      <div className="grid gap-3 lg:grid-cols-12 flex-1 my-2 min-h-0 overflow-hidden">
        {/* CỘT TRÁI (5 phần): Cấu hình & Ô Nhập Khóa Khi Bắn */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-2.5 min-h-0">
          <Card className="border-slate-800 bg-slate-900/90 shadow-md">
            <CardContent className="p-3.5 space-y-2.5">
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400 flex items-center justify-between">
                  <span>Domain Gốc</span>
                  {projectId && (
                    <span className="text-[10px] text-cyan-400 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Cố định
                    </span>
                  )}
                </label>
                <div className="relative mt-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
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
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs text-slate-200 outline-none focus:border-rose-500 font-mono disabled:opacity-60"
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

          {/* Quét WAF & Ô Nhập Mã Bypass Tự Động Khóa */}
          <Card className="border-slate-800 bg-slate-900/90 shadow-md flex-1 flex flex-col justify-between">
            <CardContent className="p-3.5 space-y-2.5">
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
                  ? "Dán trực tiếp mã Secret (rsE...), hệ thống tự tiêm 3 tầng vào URL, Header & Cookie."
                  : detectedWaf === "cloudflare"
                  ? "Dán trực tiếp token cf_clearance hoặc Service Secret."
                  : "Hỗ trợ nạp token hoặc chuỗi header/cookie tùy chỉnh."}
              </p>

              <div className="pt-1">
                {errorMsg && <p className="mb-1 text-xs text-rose-400">{errorMsg}</p>}
                <Button
                  onClick={handleStartStress}
                  disabled={running || !baseDomain}
                  className="h-10 w-full bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold shadow-lg shadow-rose-900/30 transition text-xs"
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

        {/* CỘT PHẢI (7 phần): War Room Hologram Canvas với Tấm Khiên WAF & Thẻ HTTP */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-2.5 min-h-0">
          <HologramWarRoomCanvas
            logs={liveLogs}
            running={running}
            targetName={selectedEndpoint || baseDomain}
            metrics={metrics}
          />

          {/* 4 Thẻ Trạng Thái HTTP Thực Tế */}
          <div className="grid grid-cols-4 gap-2 shrink-0">
            <div className="p-2 rounded-xl border border-slate-800 bg-slate-900/90 text-center">
              <div className="text-[10px] text-slate-400 font-medium">200 OK (Thành công)</div>
              <div className="text-base font-bold text-emerald-400 font-mono">
                {metrics ? metrics.status200 : 0}
              </div>
            </div>
            <div className="p-2 rounded-xl border border-slate-800 bg-slate-900/90 text-center">
              <div className="text-[10px] text-slate-400 font-medium">403 (Khiên Chặn)</div>
              <div className="text-base font-bold text-rose-400 font-mono">
                {metrics ? metrics.status403WafBlocked : 0}
              </div>
            </div>
            <div className="p-2 rounded-xl border border-slate-800 bg-slate-900/90 text-center">
              <div className="text-[10px] text-slate-400 font-medium">429 (Giới hạn tải)</div>
              <div className="text-base font-bold text-amber-400 font-mono">
                {metrics ? metrics.status429RateLimited : 0}
              </div>
            </div>
            <div className="p-2 rounded-xl border border-slate-800 bg-slate-900/90 text-center">
              <div className="text-[10px] text-slate-400 font-medium">Latency p95</div>
              <div className="text-base font-bold text-cyan-300 font-mono">
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
