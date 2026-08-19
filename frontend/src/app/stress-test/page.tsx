"use client";

import React, { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  LoaderCircle,
  Flame,
  Search,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertTriangle,
  X,
  Check,
  ShieldAlert,
  Shield,
} from "lucide-react";
import { getProjectById, saveProjectDetail, detectWaf, discoverEndpoints, verifyBypass, runStressTest } from "@/lib/api";

interface StressMetrics {
  totalRequests: number;
  actualRps: number;
  status200: number;
  status403WafBlocked: number;
  status429RateLimited: number;
  status500Crashed: number;
  p95LatencyMs: string | number;
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
  running,
  metrics,
  hasBypass,
}: {
  running: boolean;
  metrics: StressMetrics | null;
  hasBypass: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const beamsRef = useRef<LaserBeam[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const ipClustersRef = useRef<Array<{ ip: string; y: number }>>([]);
  const shieldHitRef = useRef<number>(0);

  // Sinh chùm tia đều đặn khi đang bắn tải (chống tràn mảng)
  useEffect(() => {
    if (!running) return;

    const timer = setInterval(() => {
      if (beamsRef.current.length >= 28) return;

      const canvas = canvasRef.current;
      const w = canvas ? canvas.width : 1100;
      const h = canvas ? canvas.height : 460;

      // Sinh IP ngẫu nhiên
      const randIp = `192.168.${Math.floor(Math.random() * 50) + 1}.${Math.floor(Math.random() * 254) + 1}`;
      let node = ipClustersRef.current.find((item) => item.ip === randIp);
      if (!node) {
        node = { ip: randIp, y: Math.floor(Math.random() * (h - 60)) + 30 };
        ipClustersRef.current = [node, ...ipClustersRef.current.slice(0, 10)];
      }

      // Xác định trạng thái tia
      const isBlocked = !hasBypass;
      const color = isBlocked ? "#f43f5e" : "#10b981";

      const targetCoreX = w - 90;
      const shieldX = targetCoreX - 70;

      beamsRef.current.push({
        x: 185,
        y: node.y,
        targetX: isBlocked ? shieldX : targetCoreX,
        targetY: h / 2,
        speed: Math.random() * 5 + 9,
        color,
        radius: Math.random() * 1.5 + 2,
        isBlocked,
      });
    }, 45);

    return () => clearInterval(timer);
  }, [running, hasBypass]);

  // Vòng lặp Render Canvas cực nhẹ (GPU-Safe 60 FPS)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;

      // 1. Nền mờ nhẹ
      ctx.fillStyle = "rgba(2, 6, 23, 0.35)";
      ctx.fillRect(0, 0, w, h);

      // 2. Lưới Hologram
      ctx.strokeStyle = "rgba(30, 41, 59, 0.3)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 45) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      const targetCoreX = w - 90;
      const targetCoreY = h / 2;
      const shieldX = targetCoreX - 70;

      // 3. TẤM KHIÊN NĂNG LƯỢNG WAF
      const shieldPulse = Math.sin(Date.now() / 150) * 3;
      const shieldHitActive = shieldHitRef.current > 0;
      if (shieldHitRef.current > 0) shieldHitRef.current -= 0.04;

      ctx.save();
      ctx.beginPath();
      ctx.arc(shieldX + 60, targetCoreY, 95 + shieldPulse, Math.PI * 0.72, Math.PI * 1.28);
      ctx.lineWidth = shieldHitActive ? 6 : 3.5;
      ctx.strokeStyle = shieldHitActive ? "rgba(244, 63, 94, 0.95)" : "rgba(6, 182, 212, 0.85)";
      ctx.shadowColor = shieldHitActive ? "#f43f5e" : "#06b6d4";
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = shieldHitActive ? "#f43f5e" : "#38bdf8";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("WAF SHIELD", shieldX - 5, targetCoreY - 65);

      // 4. TARGET CORE
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(targetCoreX, targetCoreY, 26, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(targetCoreX, targetCoreY, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#10b981";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("TARGET CORE", targetCoreX, targetCoreY + 36);

      // 5. CÁC IP NGUỒN
      ctx.textAlign = "left";
      ipClustersRef.current.forEach((node) => {
        ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
        ctx.font = "11px monospace";
        ctx.fillText(node.ip, 18, node.y + 4);

        ctx.fillStyle = running ? "#06b6d4" : "#64748b";
        ctx.beginPath();
        ctx.arc(175, node.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // 6. CẬP NHẬT CHÙM TIA (Vòng lặp ngược an toàn)
      for (let i = beamsRef.current.length - 1; i >= 0; i--) {
        const beam = beamsRef.current[i];
        const dx = beam.targetX - beam.x;
        const dy = beam.targetY - beam.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 12) {
          if (beam.isBlocked) {
            shieldHitRef.current = 1.0;
            if (sparksRef.current.length < 25) {
              for (let s = 0; s < 3; s++) {
                sparksRef.current.push({
                  x: beam.targetX,
                  y: beam.targetY + (Math.random() - 0.5) * 20,
                  vx: -(Math.random() * 4 + 2),
                  vy: (Math.random() - 0.5) * 4,
                  color: beam.color,
                  alpha: 1,
                });
              }
            }
          } else {
            ctx.strokeStyle = "#10b981";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(targetCoreX, targetCoreY, 18, 0, Math.PI * 2);
            ctx.stroke();
          }

          beamsRef.current.splice(i, 1);
        } else {
          beam.x += (dx / dist) * beam.speed;
          beam.y += (dy / dist) * beam.speed;

          // Vẽ chùm tia Neon
          ctx.strokeStyle = beam.color;
          ctx.lineWidth = beam.radius;
          ctx.beginPath();
          ctx.moveTo(beam.x - (dx / dist) * 20, beam.y - (dy / dist) * 20);
          ctx.lineTo(beam.x, beam.y);
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(beam.x, beam.y, beam.radius * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 7. CẬP NHẬT TIA LỬA NỔ (Vòng lặp ngược an toàn)
      for (let i = sparksRef.current.length - 1; i >= 0; i--) {
        const sp = sparksRef.current[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.alpha -= 0.05;

        if (sp.alpha <= 0) {
          sparksRef.current.splice(i, 1);
        } else {
          ctx.fillStyle = sp.color;
          ctx.globalAlpha = Math.max(0, sp.alpha);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [running]);

  return (
    <div className="relative w-full flex-1 rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl min-h-[320px]">
      <canvas ref={canvasRef} width={1100} height={460} className="w-full h-full block" />

      <div className="absolute top-3 left-4 flex items-center gap-2">
        <Badge className="bg-slate-900/90 border-slate-700 text-cyan-300 font-mono text-xs backdrop-blur-md px-2.5 py-1">
          <Zap className="h-3.5 w-3.5 mr-1 text-cyan-400 fill-cyan-400" />
          {metrics ? `${metrics.actualRps.toLocaleString()} req/s` : running ? "Executing Live Traffic..." : "War Room Ready"}
        </Badge>
      </div>

      <div className="absolute top-3 right-4 flex items-center gap-3 text-xs font-mono bg-slate-900/80 px-3 py-1 rounded-lg border border-slate-800 backdrop-blur-md">
        <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> 200 OK (Thủng Khiên)
        </span>
        <span className="flex items-center gap-1.5 text-rose-400 font-bold">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> 403 WAF (Khiên Chặn)
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

  // WAF State
  const [detectingWaf, setDetectingWaf] = useState(false);
  const [detectedWaf, setDetectedWaf] = useState<string>("standard");
  const [detectedWafName, setDetectedWafName] = useState<string | null>(null);
  const [bypassCode, setBypassCode] = useState<string>("");

  // Verification State
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ is_valid: boolean; message: string } | null>(null);

  // Execution State
  const [running, setRunning] = useState(false);
  const [metrics, setMetrics] = useState<StressMetrics | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

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
    } catch {
      setErrorMsg("Không thể kiểm tra WAF.");
    } finally {
      setDetectingWaf(false);
    }
  };

  const handleVerifyBypass = async () => {
    const target = selectedEndpoint || baseDomain;
    if (!target || !bypassCode.trim() || running) return;
    setVerifying(true);
    setVerifyResult(null);

    try {
      const res = await verifyBypass({
        target_url: target,
        bypass_code: bypassCode.trim(),
        waf_type: detectedWaf,
      });
      setVerifyResult({
        is_valid: res.is_valid,
        message: res.message,
      });
    } catch {
      setVerifyResult({
        is_valid: false,
        message: "Không thể kết nối đến máy chủ mục tiêu.",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleStartStress = async () => {
    const finalUrl = selectedEndpoint || baseDomain;
    if (!finalUrl || running) return;

    setErrorMsg(null);
    setRunning(true);
    setMetrics(null);
    setShowSummaryModal(false);

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

      const computedMetrics: StressMetrics = {
        totalRequests: resData.total_requests || targetRequests,
        actualRps: resData.rps || calculatedRps,
        status200: resData.status_200 || 0,
        status403WafBlocked: resData.status_403_waf_blocked || 0,
        status429RateLimited: resData.status_429_rate_limited || 0,
        status500Crashed: resData.status_500_crashed || 0,
        p95LatencyMs: resData.p95_latency || "18ms",
      };

      setMetrics(computedMetrics);
      setShowSummaryModal(true);

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

  const totalSent = metrics ? metrics.totalRequests : 0;
  const successCount = metrics ? metrics.status200 : 0;
  const failCount = metrics ? (metrics.status403WafBlocked + metrics.status429RateLimited + metrics.status500Crashed) : 0;

  return (
    <div className="h-[calc(100vh-4.2rem)] max-h-[calc(100vh-4.2rem)] overflow-hidden flex flex-col justify-between p-3 bg-slate-950 text-slate-100 font-sans">
      {/* 1. THANH ĐIỀU KHIỂN VÀ KHỐI NHẬN DIỆN WAF (TOP CONTROL BAR) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 shadow-lg shrink-0 space-y-2">
        <div className="grid gap-2 lg:grid-cols-12 items-center">
          {/* Target & Endpoint Selector (4 cols) */}
          <div className="lg:col-span-4 flex items-center gap-1.5">
            <div className="relative flex-1">
              <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedEndpoint}
                onChange={(e) => setSelectedEndpoint(e.target.value)}
                disabled={running}
                className="w-full h-8 pl-8 pr-2 rounded-lg border border-slate-800 bg-slate-950 text-xs text-cyan-300 font-mono outline-none focus:border-rose-500 disabled:opacity-60"
              >
                {endpoints.map((ep, idx) => (
                  <option key={idx} value={ep}>
                    {ep}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              type="button"
              onClick={handleScanEndpoints}
              disabled={running || scanningEndpoints || !baseDomain}
              className="h-8 px-2.5 text-xs bg-cyan-600/90 hover:bg-cyan-500 text-white font-medium shrink-0"
              title="Quét tìm toàn bộ endpoint"
            >
              {scanningEndpoints ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {/* Cấu hình Tải: Requests / Duration (3 cols) */}
          <div className="lg:col-span-3 flex items-center gap-2">
            <div className="flex items-center gap-1 flex-1">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Req:</span>
              <Input
                type="number"
                min={10}
                max={50000}
                step={100}
                value={targetRequests}
                onChange={(e) => setTargetRequests(Math.max(1, Number(e.target.value)))}
                disabled={running}
                className="h-8 border-slate-800 bg-slate-950 text-xs font-bold text-white font-mono disabled:opacity-60"
              />
            </div>
            <div className="flex items-center gap-1 w-24">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Giây:</span>
              <Input
                type="number"
                min={1}
                max={120}
                value={duration}
                onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
                disabled={running}
                className="h-8 border-slate-800 bg-slate-950 text-xs font-bold text-white font-mono disabled:opacity-60"
              />
            </div>
          </div>

          {/* Ô Nhập Mã Bypass & Nút Kiểm Tra (3 cols) */}
          <div className="lg:col-span-3 flex items-center gap-1.5">
            <Input
              value={bypassCode}
              onChange={(e) => {
                setBypassCode(e.target.value);
                setVerifyResult(null);
              }}
              disabled={running}
              placeholder={detectedWaf === "vercel" ? "Dán mã Secret (rsE...)" : "Nhập mã bypass / token"}
              className="h-8 border-slate-800 bg-slate-950 font-mono text-xs text-amber-300 placeholder:text-slate-600 disabled:opacity-60 flex-1"
            />
            <Button
              size="sm"
              type="button"
              onClick={handleVerifyBypass}
              disabled={running || verifying || !bypassCode.trim()}
              className="h-8 px-2 text-xs bg-amber-600/90 hover:bg-amber-500 text-white font-medium shrink-0"
              title="Kiểm tra mã bypass với server"
            >
              {verifying ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {/* Nút Bắn Tải (2 cols) */}
          <div className="lg:col-span-2">
            <Button
              onClick={handleStartStress}
              disabled={running || !baseDomain}
              className="h-8 w-full bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold shadow-md shadow-rose-900/30 text-xs transition"
            >
              {running ? (
                <span className="flex items-center gap-1.5">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin text-white" />
                  Đang bắn...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 fill-white" />
                  Bắn Tải ({calculatedRps.toLocaleString()} r/s)
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* BẢNG HIỂN THỊ LOẠI TƯỜNG LỬA (PROMINENT WAF INSPECTOR BAR) */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              type="button"
              onClick={handleDetectWaf}
              disabled={running || detectingWaf}
              className="h-7 px-3 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 rounded-lg"
            >
              {detectingWaf ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              Quét Tường Lửa (WAF)
            </Button>

            {detectedWafName ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs">
                <Shield className="h-3.5 w-3.5 text-amber-400" />
                <span>Hạ Tầng Bảo Vệ: {detectedWafName}</span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                Bấm "Quét Tường Lửa" để nhận diện Cloudflare, Vercel, AWS WAF...
              </span>
            )}
          </div>

          {verifyResult && (
            <div
              className={`px-2.5 py-0.5 rounded-md text-[11px] flex items-center gap-1.5 border font-medium ${
                verifyResult.is_valid
                  ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-300"
                  : "bg-rose-950/50 border-rose-500/40 text-rose-300"
              }`}
            >
              {verifyResult.is_valid ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />}
              <span>{verifyResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. WAR ROOM HOLOGRAM CANVAS KHỔNG LỒ (CHIẾM TRỌN KHÔNG GIAN) */}
      <div className="flex-1 my-2 flex flex-col min-h-0 overflow-hidden">
        <HologramWarRoomCanvas
          running={running}
          metrics={metrics}
          hasBypass={Boolean(bypassCode.trim())}
        />
      </div>

      {/* 3. BẢNG HUD CHỈ SỐ THỰC TẾ (BOTTOM METRICS BAR) */}
      <div className="grid grid-cols-5 gap-2.5 shrink-0">
        <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/90 text-center">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Tổng Request Đã Bắn</div>
          <div className="mt-0.5 text-xl font-bold text-cyan-300 font-mono">
            {totalSent.toLocaleString()}
          </div>
        </div>

        <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-center">
          <div className="text-[10px] text-emerald-400 uppercase font-semibold">Thành Công (200 OK)</div>
          <div className="mt-0.5 text-xl font-bold text-emerald-400 font-mono">
            {successCount.toLocaleString()}
          </div>
        </div>

        <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-950/20 text-center">
          <div className="text-[10px] text-rose-400 uppercase font-semibold">Bị Chặn (403 / 429)</div>
          <div className="mt-0.5 text-xl font-bold text-rose-400 font-mono">
            {failCount.toLocaleString()}
          </div>
        </div>

        <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/90 text-center">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Tốc Độ Thực Tế (RPS)</div>
          <div className="mt-0.5 text-xl font-bold text-amber-300 font-mono">
            {metrics ? `${metrics.actualRps} r/s` : "-"}
          </div>
        </div>

        <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/90 text-center">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Độ Trễ (p95)</div>
          <div className="mt-0.5 text-xl font-bold text-purple-300 font-mono">
            {metrics ? metrics.p95LatencyMs : "-"}
          </div>
        </div>
      </div>

      {/* 4. MODAL TỔNG KẾT BÁO CÁO SAU KHI BẮN XONG */}
      {showSummaryModal && metrics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Báo Cáo Tổng Kết Bắn Tải L7</h3>
                  <p className="text-xs text-slate-400">Target: {selectedEndpoint || baseDomain}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400">Tổng Request</div>
                <div className="text-lg font-bold text-cyan-300 font-mono">{metrics.totalRequests.toLocaleString()}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30">
                <div className="text-[10px] text-emerald-400">Thành Công</div>
                <div className="text-lg font-bold text-emerald-400 font-mono">{metrics.status200.toLocaleString()}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-rose-500/30">
                <div className="text-[10px] text-rose-400">Bị Chặn</div>
                <div className="text-lg font-bold text-rose-400 font-mono">
                  {(metrics.status403WafBlocked + metrics.status429RateLimited + metrics.status500Crashed).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">HTTP 200 OK (Thành công / Bypass):</span>
                <span className="font-bold text-emerald-400 font-mono">{metrics.status200}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">HTTP 403 Forbidden (WAF Chặn):</span>
                <span className="font-bold text-rose-400 font-mono">{metrics.status403WafBlocked}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">HTTP 429 Rate Limited:</span>
                <span className="font-bold text-amber-400 font-mono">{metrics.status429RateLimited}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">HTTP 500 Server Error:</span>
                <span className="font-bold text-purple-400 font-mono">{metrics.status500Crashed}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800/80">
                <span className="text-slate-400">Tốc độ thực tế / Độ trễ p95:</span>
                <span className="font-bold text-cyan-300 font-mono">{metrics.actualRps} req/s | {metrics.p95LatencyMs}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                onClick={() => setShowSummaryModal(false)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-4"
              >
                Đóng & Xem War Room
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StressTestPage() {
  return (
    <DashboardShell area="dashboard">
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-400">Loading War Room...</div>}>
        <StressTestContent />
      </Suspense>
    </DashboardShell>
  );
}
