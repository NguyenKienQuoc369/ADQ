"use client";

import React, { Suspense, useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Flame,
  Globe,
  LoaderCircle,
  ShieldCheck,
  Zap,
  Save,
  BookmarkCheck,
  PlusCircle,
  Terminal,
  Activity,
  Sliders,
  Code2,
  Crosshair,
  RefreshCw,
  Search,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { getEntitlements } from "@/lib/entitlements";
import {
  getProjectById,
  saveProjectDetail,
  detectWaf,
  discoverEndpoints,
  streamStressTest,
} from "@/lib/api";

interface DiscoveredEndpoint {
  id: string;
  path: string;
  method: "GET" | "POST" | "PUT";
  impactScore: number;
  description: string;
}

interface StressMetrics {
  totalRequests: number;
  actualRps: number;
  status200: number;
  status403WafBlocked: number;
  status429RateLimited: number;
  status500Crashed: number;
  p95LatencyMs: string | number;
  targetHealth: number;
  targetTemp: number;
}

function cleanBaseUrl(raw: string): string {
  let cleaned = (raw || "").trim();
  if (!cleaned) return "";
  cleaned = cleaned.replace(/-[a-f0-9]{6}$/i, "");
  cleaned = cleaned.replace(/\/-[a-f0-9]{6}/gi, "");
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned.replace(/\/+$/, "");
}

function getRandomSpoofedIp(): string {
  const octets = [
    [14, 232, Math.floor(Math.random() * 254) + 1, Math.floor(Math.random() * 254) + 1],
    [113, 161, Math.floor(Math.random() * 254) + 1, Math.floor(Math.random() * 254) + 1],
    [42, 112, Math.floor(Math.random() * 254) + 1, Math.floor(Math.random() * 254) + 1],
    [171, 244, Math.floor(Math.random() * 254) + 1, Math.floor(Math.random() * 254) + 1],
    [103, 145, Math.floor(Math.random() * 254) + 1, Math.floor(Math.random() * 254) + 1],
  ];
  return octets[Math.floor(Math.random() * octets.length)].join(".");
}

function generateWafBypassTemplate(wafType: string): string {
  const upper = (wafType || "").toUpperCase();
  if (upper.includes("CLOUDFLARE")) {
    return JSON.stringify({
      "CF-Connecting-IP": "127.0.0.1",
      "X-Forwarded-For": "1.1.1.1, 127.0.0.1",
      "X-Real-IP": "127.0.0.1",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Cache-Control": "no-cache",
    }, null, 2);
  }
  if (upper.includes("AWS") || upper.includes("CLOUDFRONT")) {
    return JSON.stringify({
      "X-Forwarded-For": "10.0.0.1",
      "X-Originating-IP": "127.0.0.1",
      "User-Agent": "Amazon CloudFront Evaluator / 2.0",
      "Cache-Control": "max-age=0",
    }, null, 2);
  }
  return JSON.stringify({
    "X-Forwarded-For": "127.0.0.1",
    "X-Real-IP": "127.0.0.1",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Cache-Control": "no-cache",
  }, null, 2);
}

function StressTestContent() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const userTier = user?.packageTier || "FREE";
  const entitlements = getEntitlements(userTier);
  const isFreeTier = entitlements.stressDailyLimit === 0;

  const [projectName, setProjectName] = useState("");
  const [baseTarget, setBaseTarget] = useState("");
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("");

  // Cấu hình tải
  const [totalRequestsInput, setTotalRequestsInput] = useState<number>(30000);
  const [durationInput, setDurationInput] = useState<number>(15);
  const [concurrencyVUs, setConcurrencyVUs] = useState<number>(100);

  // WAF & Bypass Code
  const [isDetectingWaf, setIsDetectingWaf] = useState(false);
  const [wafName, setWafName] = useState<string | null>(null);
  const [wafDetected, setWafDetected] = useState<boolean>(false);
  const [bypassCode, setBypassCode] = useState<string>(generateWafBypassTemplate("CLOUDFLARE"));

  // Ref lưu tỷ lệ thành công tức thời
  const passRatioRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);

  // Danh sách Endpoints
  const [isScanningEndpoints, setIsScanningEndpoints] = useState(false);
  const [discoveredEndpoints, setDiscoveredEndpoints] = useState<DiscoveredEndpoint[]>([]);

  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);

  const [metrics, setMetrics] = useState<StressMetrics>({
    totalRequests: 0,
    actualRps: 0,
    status200: 0,
    status403WafBlocked: 0,
    status429RateLimited: 0,
    status500Crashed: 0,
    p95LatencyMs: "0ms",
    targetHealth: 100,
    targetTemp: 38,
  });

  const [logs, setLogs] = useState<string[]>([
    `[ADQ-SOC] Hệ thống Stress Test Engine đã kết nối SOC Cluster.`,
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const calculatedRps = useMemo(() => {
    if (durationInput <= 0) return 0;
    return Math.round(totalRequestsInput / durationInput);
  }, [totalRequestsInput, durationInput]);

  const targetFullUrl = useMemo(() => {
    const clean = cleanBaseUrl(baseTarget);
    if (!clean) return "";
    let endpoint = (selectedEndpoint || "").trim();
    if (endpoint && !endpoint.startsWith("/")) {
      endpoint = `/${endpoint}`;
    }
    return `${clean}${endpoint}`;
  }, [baseTarget, selectedEndpoint]);

  useEffect(() => {
    if (!projectId) return;

    getProjectById(projectId)
      .then((p) => {
        if (!p) return;
        setProjectName(p.name || "");
        const rawDomain = p.projectDetail?.summary?.domain || p.domain || "";
        const clean = cleanBaseUrl(rawDomain);
        if (clean) setBaseTarget(clean);

        const summary = (p.projectDetail?.summary as Record<string, any>) || {};
        if (summary.stressTest) {
          const st = summary.stressTest;
          if (st.metrics) setMetrics(st.metrics);
          if (st.wafName) {
            setWafName(st.wafName);
            setWafDetected(st.wafDetected ?? true);
            passRatioRef.current = st.wafDetected ? 0 : 1;
          }
          if (st.baseTarget) setBaseTarget(cleanBaseUrl(st.baseTarget));
          if (st.selectedEndpoint) setSelectedEndpoint(st.selectedEndpoint);
          if (st.totalRequestsInput) setTotalRequestsInput(st.totalRequestsInput);
          if (st.durationInput) setDurationInput(st.durationInput);
          if (st.concurrencyVUs) setConcurrencyVUs(st.concurrencyVUs);
          if (st.bypassCode) setBypassCode(st.bypassCode);
          if (st.discoveredEndpoints) setDiscoveredEndpoints(st.discoveredEndpoints);
        }
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const appendLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // 1. QUÉT ENDPOINTS THẬT TỪ BACKEND
  const handleScanEndpoints = async () => {
    const clean = cleanBaseUrl(baseTarget);
    if (!clean) {
      alert("Vui lòng nhập tên miền hoặc URL mục tiêu.");
      return;
    }
    setIsScanningEndpoints(true);
    appendLog(`[CRAWLER] Đang trích xuất cấu trúc endpoint thực tế từ ${clean}...`);

    try {
      const res = await discoverEndpoints(clean);
      const rawEndpoints = res?.endpoints || (res as any)?.paths || (res as any)?.urls || [];

      if (Array.isArray(rawEndpoints) && rawEndpoints.length > 0) {
        const parsedList: DiscoveredEndpoint[] = rawEndpoints.map((epStr: string, idx: number) => {
          let pathOnly = epStr.trim();
          try {
            if (pathOnly.startsWith("http://") || pathOnly.startsWith("https://")) {
              const u = new URL(pathOnly);
              pathOnly = u.pathname + u.search;
            }
          } catch {}

          if (!pathOnly.startsWith("/")) pathOnly = `/${pathOnly}`;
          const isPost = pathOnly.includes("login") || pathOnly.includes("auth") || pathOnly.includes("checkout") || pathOnly.includes("pay");
          const isSearch = pathOnly.includes("search") || pathOnly.includes("filter") || pathOnly.includes("query");

          return {
            id: `ep-real-${idx + 1}`,
            path: pathOnly,
            method: isPost ? "POST" : "GET",
            impactScore: isPost ? 96 : isSearch ? 88 : Math.max(30, 80 - idx * 5),
            description: isPost
              ? "Endpoint xác thực DB (Tắc nghẽn CPU & Row Locking)"
              : isSearch
              ? "Truy vấn dữ liệu Full-Text Search (Tắc nghẽn Disk I/O)"
              : "Endpoint API dữ liệu thời gian thực (Bypass CDN Cache)",
          };
        });

        setDiscoveredEndpoints(parsedList);
        setSelectedEndpoint(parsedList[0].path);
        appendLog(`[THÀNH CÔNG] Đã phát hiện ${parsedList.length} endpoints thực tế. Đã chọn: ${parsedList[0].path}`);
      } else {
        appendLog(`[CRAWLER NOTICE] Không phát hiện thêm endpoint động từ ${clean}. Thiết lập Root Path ("/").`);
        setDiscoveredEndpoints([
          {
            id: "ep-root",
            path: "/",
            method: "GET",
            impactScore: 60,
            description: "Root Target Endpoint (Trang chủ hoặc API Gateway)",
          },
        ]);
        setSelectedEndpoint("/");
      }
    } catch (e: any) {
      appendLog(`[LỖI CRAWLER] ${e?.message || "Không thể kết nối crawler backend"}`);
    } finally {
      setIsScanningEndpoints(false);
    }
  };

  // 2. NHẬN DIỆN WAF THẬT TỪ BACKEND
  const handleDetectWaf = async () => {
    const clean = cleanBaseUrl(baseTarget);
    if (!clean) {
      alert("Vui lòng nhập tên miền mục tiêu.");
      return;
    }
    setIsDetectingWaf(true);
    appendLog(`[WAF ENGINE] Đang gửi signature probes tới ${clean} để phân tích WAF thực tế...`);

    try {
      const res = await detectWaf(clean);
      if (res && res.waf_detected) {
        const detectedName = res.waf_name || "Cloudflare WAF / Bot Management";
        setWafDetected(true);
        setWafName(detectedName);
        passRatioRef.current = 0; // CÓ WAF -> KHÓA CỨNG 100% TIA ĐỎ
        const generatedCode = generateWafBypassTemplate(detectedName);
        setBypassCode(generatedCode);
        appendLog(`[WAF PHÁT HIỆN] ${detectedName}. Đã kích hoạt khiên chặn (100% Red Beams).`);
      } else {
        setWafDetected(false);
        setWafName("Không phát hiện WAF (Trực tiếp Máy chủ Gốc)");
        passRatioRef.current = 1.0; // KHÔNG WAF -> 100% TIA XANH
        setBypassCode(generateWafBypassTemplate("STANDARD"));
        appendLog(`[WAF THÔNG BÁO] Không phát hiện hệ thống tường lửa WAF bảo vệ.`);
      }
    } catch (e: any) {
      appendLog(`[WAF LỖI] ${e?.message || "Không thể phân tích WAF"}`);
    } finally {
      setIsDetectingWaf(false);
    }
  };

  // 3. CANVAS CYBER BATTLE MAP: NGUỒN TIA TỪ TÂM ADQ CLUSTER + KHIÊN TRÒN WAF
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const setupCanvasSize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.parentElement?.getBoundingClientRect() || { width: 900, height: 380 };
      canvas.width = rect.width * dpr;
      canvas.height = 380 * dpr;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      return { width: rect.width, height: 380 };
    };

    let { width, height } = setupCanvasSize();

    const handleResize = () => {
      const dims = setupCanvasSize();
      width = dims.width;
      height = dims.height;
    };
    window.addEventListener("resize", handleResize);

    interface ParticlePoint {
      x: number;
      y: number;
    }

    interface Packet {
      id: number;
      ip: string;
      startX: number;
      startY: number;
      controlX: number;
      controlY: number;
      targetX: number;
      targetY: number;
      progress: number;
      speed: number;
      isBypassed: boolean;
      history: ParticlePoint[];
      isDead: boolean;
    }

    interface Spark {
      x: number;
      y: number;
      vx: number;
      vy: number;
      alpha: number;
      size: number;
      color: string;
      life: number;
    }

    interface Shockwave {
      x: number;
      y: number;
      radius: number;
      maxRadius: number;
      color: string;
      alpha: number;
    }

    let packets: Packet[] = [];
    let sparks: Spark[] = [];
    let shockwaves: Shockwave[] = [];

    let packetCounter = 0;
    let targetShakeIntensity = 0;
    let shieldEnergyFlash = 0;
    let radarAngle = 0;
    let frameTick = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      frameTick++;

      const clusterX = 90;
      const clusterY = height * 0.5;
      const targetX = width - 110;
      const targetY = height * 0.5;
      const shieldRadius = 65;

      // 1. VẼ GRID NHẸ
      ctx.save();
      ctx.strokeStyle = "rgba(14, 165, 233, 0.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 36) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();

      radarAngle += 0.03;

      // 2. VẼ TRẠM ADQ MASTER CLUSTER
      ctx.save();
      const clusterPulse = (Math.sin(radarAngle * 2.5) + 1) * 0.5;

      ctx.strokeStyle = isRunningRef.current ? "rgba(6, 182, 212, 0.6)" : "rgba(100, 116, 139, 0.2)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(clusterX, clusterY, 32 + clusterPulse * 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = isRunningRef.current ? "#083344" : "#0f172a";
      ctx.strokeStyle = isRunningRef.current ? "#06b6d4" : "#334155";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(clusterX - 26, clusterY - 26, 52, 52, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isRunningRef.current ? "#22d3ee" : "#475569";
      ctx.beginPath();
      ctx.arc(clusterX, clusterY, 7 + clusterPulse * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(clusterX, clusterY, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.fillText("ADQ CLUSTER", clusterX - 28, clusterY + 42);
      ctx.restore();

      // 3. SINH TIA BẮN TỪ TÂM (clusterX, clusterY)
      if (isRunningRef.current && frameTick % 3 === 0 && packets.length < 14) {
        const startX = clusterX;
        const startY = clusterY;

        const isBypassed = Math.random() < passRatioRef.current;

        const angleToTarget = Math.atan2(targetY - startY, targetX - startX);
        const endX = isBypassed ? targetX : targetX - Math.cos(angleToTarget) * shieldRadius;
        const endY = isBypassed ? targetY + (Math.random() - 0.5) * 16 : targetY - Math.sin(angleToTarget) * shieldRadius;

        const midX = (startX + endX) * 0.5;
        const midY = (startY + endY) * 0.5 + (Math.random() - 0.5) * 60;

        packets.push({
          id: packetCounter++,
          ip: getRandomSpoofedIp(),
          startX,
          startY,
          controlX: midX,
          controlY: midY,
          targetX: endX,
          targetY: endY,
          progress: 0,
          speed: Math.random() * 0.032 + 0.026,
          isBypassed,
          history: [],
          isDead: false,
        });
      }

      // 4. CẬP NHẬT VÀ VẼ TIA LASER
      packets.forEach((p) => {
        p.progress += p.speed;

        const t = Math.min(1, p.progress);
        const currX = (1 - t) * (1 - t) * p.startX + 2 * (1 - t) * t * p.controlX + t * t * p.targetX;
        const currY = (1 - t) * (1 - t) * p.startY + 2 * (1 - t) * t * p.controlY + t * t * p.targetY;

        p.history.push({ x: currX, y: currY });
        if (p.history.length > 5) p.history.shift();

        // XỬ LÝ VA CHẠM
        if (p.progress >= 1 && !p.isDead) {
          p.isDead = true;

          if (!p.isBypassed) {
            shieldEnergyFlash = 1.0;
            if (shockwaves.length < 4) {
              shockwaves.push({
                x: p.targetX,
                y: p.targetY,
                radius: 4,
                maxRadius: 22,
                color: "#ef4444",
                alpha: 1.0,
              });
            }

            if (sparks.length < 18) {
              for (let k = 0; k < 5; k++) {
                const angle = Math.atan2(p.startY - p.targetY, p.startX - p.targetX) + (Math.random() - 0.5) * 1.2;
                const spd = Math.random() * 3 + 1.5;
                sparks.push({
                  x: p.targetX,
                  y: p.targetY,
                  vx: Math.cos(angle) * spd,
                  vy: Math.sin(angle) * spd,
                  alpha: 1.0,
                  size: Math.random() * 1.5 + 1,
                  color: "#ff3b5c",
                  life: 1.0,
                });
              }
            }
          } else {
            targetShakeIntensity = 6;
            if (shockwaves.length < 4) {
              shockwaves.push({
                x: targetX,
                y: targetY,
                radius: 6,
                maxRadius: 32,
                color: "#10b981",
                alpha: 1.0,
              });
            }

            if (sparks.length < 18) {
              for (let k = 0; k < 6; k++) {
                const angle = Math.random() * Math.PI * 2;
                const spd = Math.random() * 4 + 2;
                sparks.push({
                  x: targetX,
                  y: targetY,
                  vx: Math.cos(angle) * spd,
                  vy: Math.sin(angle) * spd,
                  alpha: 1.0,
                  size: Math.random() * 2 + 1,
                  color: "#00ffcc",
                  life: 1.0,
                });
              }
            }
          }
        }

        if (p.history.length > 1 && !p.isDead) {
          ctx.save();
          const beamColor = p.isBypassed ? "#10b981" : "#ef4444";
          ctx.strokeStyle = beamColor;
          ctx.lineWidth = p.isBypassed ? 2 : 1.8;

          ctx.beginPath();
          ctx.moveTo(p.history[0].x, p.history[0].y);
          for (let h = 1; h < p.history.length; h++) {
            ctx.lineTo(p.history[h].x, p.history[h].y);
          }
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(currX, currY, 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = p.isBypassed ? "rgba(167, 243, 208, 0.85)" : "rgba(254, 202, 202, 0.85)";
          ctx.font = "8px monospace";
          ctx.fillText(p.ip, currX - 16, currY - 6);
          ctx.restore();
        }
      });

      packets = packets.filter((p) => !p.isDead);

      // 5. CẬP NHẬT TIA LỬA
      sparks.forEach((sp) => {
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vx *= 0.92;
        sp.vy *= 0.92;
        sp.life -= 0.06;
        sp.alpha = Math.max(0, sp.life);

        ctx.save();
        ctx.fillStyle = sp.color;
        ctx.globalAlpha = sp.alpha;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      sparks = sparks.filter((sp) => sp.life > 0);

      // 6. CẬP NHẬT SÓNG XUNG KÍCH
      shockwaves.forEach((sw) => {
        sw.radius += 2;
        sw.alpha -= 0.07;

        ctx.save();
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = Math.max(0, sw.alpha);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
      shockwaves = shockwaves.filter((sw) => sw.alpha > 0);

      // 7. VẼ KHIÊN TRÒN WAF
      ctx.save();
      const isShieldActive = wafDetected || isRunningRef.current;
      const baseShieldColor = shieldEnergyFlash > 0 ? "#ef4444" : "#00f0ff";

      ctx.strokeStyle = baseShieldColor;
      ctx.fillStyle = shieldEnergyFlash > 0 ? "rgba(239, 68, 68, 0.12)" : "rgba(0, 240, 255, 0.05)";
      ctx.lineWidth = shieldEnergyFlash > 0 ? 2.5 : 1.5;

      ctx.beginPath();
      ctx.arc(targetX, targetY, shieldRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (isShieldActive) {
        ctx.strokeStyle = shieldEnergyFlash > 0 ? "rgba(239, 68, 68, 0.5)" : "rgba(56, 189, 248, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(targetX, targetY, shieldRadius + 5, radarAngle, radarAngle + Math.PI * 0.6);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(targetX, targetY, shieldRadius + 5, radarAngle + Math.PI, radarAngle + Math.PI * 1.6);
        ctx.stroke();
      }

      if (shieldEnergyFlash > 0) shieldEnergyFlash -= 0.08;

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 9px monospace";
      ctx.fillText("WAF CIRCULAR SHIELD", targetX - 48, targetY - shieldRadius - 10);
      ctx.restore();

      // 8. VẼ MÁY CHỦ ĐÍCH
      const shakeX = targetShakeIntensity > 0 ? (Math.random() - 0.5) * targetShakeIntensity : 0;
      const shakeY = targetShakeIntensity > 0 ? (Math.random() - 0.5) * targetShakeIntensity : 0;
      if (targetShakeIntensity > 0) targetShakeIntensity -= 0.5;

      const sx = targetX + shakeX;
      const sy = targetY + shakeY;

      ctx.save();
      ctx.fillStyle = "#0f172a";
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(sx - 24, sy - 30, 48, 60, 6);
      ctx.fill();
      ctx.stroke();

      for (let b = 0; b < 3; b++) {
        const by = sy - 20 + b * 16;
        ctx.fillStyle = "#1e293b";
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(sx - 18, by, 36, 11, 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = b === 0 ? "#10b981" : "#38bdf8";
        ctx.beginPath();
        ctx.arc(sx - 12, by + 5.5, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.fillText("TARGET CORE", sx - 28, sy + 44);
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [wafDetected]);

  // 4. THỰC THI BẮN TẢI ĐỒNG BỘ 100% VỚI STREAM BACKEND
  const executeStressTest = async () => {
    if (!targetFullUrl) return;
    setIsRunning(true);
    isRunningRef.current = true;
    const startTs = Date.now();
    const targetTotal = Number(totalRequestsInput || 30000);
    const durSeconds = Number(durationInput || 15);
    const rps = Math.round(targetTotal / durSeconds);

    passRatioRef.current = 0;

    setMetrics({
      totalRequests: 0,
      actualRps: rps,
      status200: 0,
      status403WafBlocked: 0,
      status429RateLimited: 0,
      status500Crashed: 0,
      p95LatencyMs: "0ms",
      targetHealth: 100,
      targetTemp: 38,
    });

    appendLog(`[BẮT ĐẦU TẢI L7] Mục tiêu: ${targetFullUrl}`);
    appendLog(`Thông số: Tổng ${targetTotal.toLocaleString()} reqs trong ${durSeconds}s -> Tốc độ: ${rps} RPS | VUs: ${concurrencyVUs}`);

    try {
      let parsedHeaders: Record<string, string> = {};
      try {
        parsedHeaders = JSON.parse(bypassCode);
      } catch {
        parsedHeaders = { "X-Forwarded-For": "127.0.0.1" };
      }

      const payload = {
        target_url: targetFullUrl,
        target_requests: targetTotal,
        duration: `${durSeconds}s`,
        bypass_code: bypassCode || "",
        waf_type: wafName || "standard",
        custom_headers: parsedHeaders,
      };

      appendLog(`[ADQ CLUSTER] Đang stream trực tiếp tiến độ thực tế từ Worker Threads...`);

      let latestMetrics: StressMetrics = {
        totalRequests: 0,
        actualRps: 0,
        status200: 0,
        status403WafBlocked: 0,
        status429RateLimited: 0,
        status500Crashed: 0,
        p95LatencyMs: "0ms",
        targetHealth: 100,
        targetTemp: 38,
      };

      // ĐỌC VÀ CẬP NHẬT TRỰC TIẾP TỪNG GÓI TIN STREAM TỪ BACKEND
      await streamStressTest(payload, (chunk: any) => {
        const raw = chunk?.metrics || chunk || {};

        const curTotal = Number(raw.total_requests || 0);
        const curRps = Number(raw.rps || 0);
        const s200 = Number(raw.status_200 || 0);
        const s403 = Number(raw.status_403_waf_blocked || 0);
        const s429 = Number(raw.status_429_rate_limited || 0);
        const s500 = Number(raw.status_500_crashed || 0);
        const p95 = String(raw.p95_latency || "0ms");

        // Cập nhật tỷ lệ tia laser tức thời từ dữ liệu stream thật
        const totalResp = s200 + s403 + s429 + s500;
        if (totalResp > 0) {
          passRatioRef.current = s200 / totalResp;
        }

        const health = Math.max(10, Math.floor(100 - (s200 / Math.max(1, curTotal || targetTotal)) * 85));
        const temp = Math.min(99, Math.floor(38 + (s200 / Math.max(1, curTotal || targetTotal)) * 60));

        latestMetrics = {
          totalRequests: curTotal,
          actualRps: curRps,
          status200: s200,
          status403WafBlocked: s403,
          status429RateLimited: s429,
          status500Crashed: s500,
          p95LatencyMs: p95,
          targetHealth: health,
          targetTemp: temp,
        };

        // ĐỒNG BỘ 100% CÁC THẺ METRICS THEO THỜI GIAN THỰC
        setMetrics(latestMetrics);
      });

      // GHI NHẬN LOG KẾT QUẢ CUỐI CÙNG BẰNG CHÍNH XÁC SỐ LIỆU ĐÃ STREAM
      appendLog(`[HOÀN TẤT] Tổng ${latestMetrics.totalRequests.toLocaleString()} requests kết thúc trong ${((Date.now() - startTs) / 1000).toFixed(1)}s.`);
      appendLog(`[KẾT QUẢ THẬT] 200 OK: ${latestMetrics.status200.toLocaleString()} | 403 Blocked: ${latestMetrics.status403WafBlocked.toLocaleString()} | 429 Limit: ${latestMetrics.status429RateLimited.toLocaleString()} | 500 Crash: ${latestMetrics.status500Crashed.toLocaleString()} | P95: ${latestMetrics.p95LatencyMs}`);

      if (projectId) {
        saveProjectDetail(projectId, {
          stressTest: {
            baseTarget,
            selectedEndpoint,
            totalRequestsInput: targetTotal,
            durationInput: durSeconds,
            concurrencyVUs,
            bypassCode,
            wafName,
            wafDetected,
            metrics: latestMetrics,
            discoveredEndpoints,
            logs: [...logs, `[HOÀN TẤT] Đã bắn ${latestMetrics.totalRequests.toLocaleString()} requests.`].slice(-50),
            updatedAt: new Date().toISOString(),
          },
        }).catch(() => {});
      }
    } catch (e: any) {
      appendLog(`[LỖI THỰC THI] ${e?.message || "Kiểm thử thất bại"}`);
    } finally {
      setIsRunning(false);
      isRunningRef.current = false;
    }
  };

  const handleSaveSession = async () => {
    if (!projectId) {
      alert("Vui lòng gắn một Project ID để lưu phiên này.");
      return;
    }
    setIsSaving(true);
    try {
      await saveProjectDetail(projectId, {
        stressTest: {
          baseTarget,
          selectedEndpoint,
          totalRequestsInput,
          durationInput,
          concurrencyVUs,
          bypassCode,
          wafName,
          wafDetected,
          metrics,
          discoveredEndpoints,
          logs: logs.slice(-50),
          updatedAt: new Date().toISOString(),
        },
      });
      setIsSavedSuccess(true);
      setTimeout(() => setIsSavedSuccess(false), 3000);
    } catch {
      alert("Không tìm thấy Project này trong CSDL. Vui lòng tạo dự án mới ở Dashboard.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isFreeTier) {
    return (
      <DashboardShell area="dashboard">
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-amber-500/20 bg-slate-950/80 p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
              <Flame className="h-7 w-7 text-amber-400" />
            </div>

            <Badge className="mb-4 border border-amber-500/30 bg-amber-950/40 text-amber-300">
              TÍNH NĂNG DÀNH CHO GÓI PRO / PRO MAX
            </Badge>

            <h1 className="text-2xl font-bold text-white">
              Stress Test L7 chưa khả dụng trên gói FREE
            </h1>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Gói FREE không bao gồm Stress Test, kiểm tra WAF hoặc bypass validation.
              Nâng cấp lên PRO để sử dụng 1 lượt mỗi ngày, hoặc PRO MAX để sử dụng
              tối đa 10 lượt mỗi ngày.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-left">
                <p className="text-xs font-semibold text-cyan-300">PRO</p>
                <p className="mt-1 text-sm font-bold text-white">1 lượt Stress Test / ngày</p>
                <p className="mt-1 text-xs text-slate-500">
                  Bao gồm endpoint discovery, WAF detection và load testing.
                </p>
              </div>

              <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-4 text-left">
                <p className="text-xs font-semibold text-purple-300">PRO MAX</p>
                <p className="mt-1 text-sm font-bold text-white">10 lượt Stress Test / ngày</p>
                <p className="mt-1 text-xs text-slate-500">
                  Hạn mức cao hơn cho kiểm thử chuyên sâu.
                </p>
              </div>
            </div>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                onClick={() => router.push("/dashboard/billing")}
                className="bg-amber-500 text-slate-950 hover:bg-amber-400"
              >
                Nâng cấp gói PRO
              </Button>

              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
                className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              >
                Quay lại Dashboard
              </Button>
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 text-slate-100 font-sans">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <Flame className="h-5 w-5 text-amber-500" /> Hệ Thống Stress Test L7 & Bypass WAF
              </h1>
              {projectId && (
                <Badge className="text-[10px] font-mono border border-amber-500/30 text-amber-400 bg-amber-950/40" suppressHydrationWarning>
                  DỰ ÁN: {projectName || projectId}
                </Badge>
              )}
              <Badge className="text-[10px] font-mono border border-cyan-500/30 text-cyan-400 bg-cyan-950/40" suppressHydrationWarning>
                GÓI: {userTier}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Stream trực tiếp tiến độ bắn tải từ cụm Backend Cluster, tự động đồng bộ kết quả thực tế
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="h-8 text-xs border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60"
              disabled={isSaving || isRunning}
              onClick={handleSaveSession}
              size="sm"
              variant="outline"
            >
              {isSaving ? <LoaderCircle className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : isSavedSuccess ? <BookmarkCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              {isSavedSuccess ? "Đã Lưu Phiên" : "Lưu Kết Quả"}
            </Button>
            <Button onClick={() => router.push("/dashboard/projects")} size="sm" variant="outline" className="h-8 text-xs border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800">
              <PlusCircle className="h-3.5 w-3.5 mr-1.5 text-cyan-400" /> Phiên Mới
            </Button>
          </div>
        </div>

        {/* 1. MỤC TIÊU & SCAN ENDPOINTS */}
        <Card className="border border-white/[0.08] bg-slate-950/80 shadow-xl">
          <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Globe className="h-4 w-4 text-cyan-400" /> 1. Mục Tiêu & Rà Quét Điểm Nghẽn (Endpoints)
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleDetectWaf} disabled={isDetectingWaf || !baseTarget.trim()} className="h-7 text-[11px] border-amber-500/40 bg-amber-950/30 text-amber-300 hover:bg-amber-900/50">
                {isDetectingWaf ? <LoaderCircle className="h-3 w-3 animate-spin mr-1" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
                Quét WAF
              </Button>
              <Button size="sm" onClick={handleScanEndpoints} disabled={isScanningEndpoints || !baseTarget.trim()} className="h-7 text-[11px] bg-cyan-600 hover:bg-cyan-500 text-white">
                {isScanningEndpoints ? <LoaderCircle className="h-3 w-3 animate-spin mr-1" /> : <Search className="h-3 w-3 mr-1" />}
                Quét Endpoints
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  onChange={(e) => setBaseTarget(e.target.value)}
                  value={baseTarget}
                  placeholder="Tên miền mục tiêu (vd: https://quoc-bank-v8-0.vercel.app)"
                  disabled={isRunning}
                  className="pl-9 bg-slate-900/90 border-slate-800 text-slate-100 placeholder:text-slate-600 text-xs sm:text-sm h-10 rounded-xl"
                />
              </div>
              <div className="sm:w-1/2 relative">
                <Crosshair className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400" />
                <Input
                  onChange={(e) => setSelectedEndpoint(e.target.value)}
                  value={selectedEndpoint}
                  placeholder="Endpoint (vd: /api/v1/auth/login)"
                  disabled={isRunning}
                  className="pl-9 bg-slate-900/90 border-slate-800 text-amber-300 font-mono text-xs sm:text-sm h-10 rounded-xl"
                />
              </div>
            </div>

            {discoveredEndpoints.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-cyan-400" /> Chọn Endpoint mục tiêu (Xếp hạng theo độ tổn thương máy chủ):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {discoveredEndpoints.map((ep) => {
                    const isSelected = selectedEndpoint === ep.path;
                    return (
                      <div
                        key={ep.id}
                        onClick={() => setSelectedEndpoint(ep.path)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? "bg-amber-950/40 border-amber-500 ring-1 ring-amber-500/50"
                            : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <Badge className="text-[9px] font-mono px-1.5 py-0" variant={ep.method === "POST" ? "danger" : "default"}>
                              {ep.method}
                            </Badge>
                            <span className="font-mono text-xs font-bold text-slate-200 truncate">{ep.path}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{ep.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-mono font-bold ${ep.impactScore > 85 ? "text-rose-400" : ep.impactScore > 60 ? "text-amber-400" : "text-slate-400"}`}>
                            {ep.impactScore}% Điểm Nghẽn
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. CẤU HÌNH TOÁN HỌC & WAF BYPASS CODE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border border-white/[0.08] bg-slate-950/80 shadow-xl">
            <CardHeader className="pb-3 border-b border-slate-800">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-amber-400" /> 2. Cấu Hình Tải Toán Học (Total Reqs / Duration = RPS)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Tổng Số Request Cần Bắn:</label>
                  <Input
                    type="number"
                    value={totalRequestsInput}
                    onChange={(e) => setTotalRequestsInput(Number(e.target.value))}
                    disabled={isRunning}
                    className="bg-slate-900 border-slate-800 text-white font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Thời Gian Duy Trì (Giây):</label>
                  <Input
                    type="number"
                    value={durationInput}
                    onChange={(e) => setDurationInput(Number(e.target.value))}
                    disabled={isRunning}
                    className="bg-slate-900 border-slate-800 text-white font-mono text-sm"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-mono">Tốc Độ Bắn Tải (RPS)</p>
                  <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">{calculatedRps.toLocaleString()} <span className="text-xs text-slate-500 font-normal">req/s</span></p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-mono">Luồng Mô Phỏng (VUs)</p>
                  <p className="text-xl font-bold text-cyan-400 font-mono mt-0.5">{concurrencyVUs} <span className="text-xs text-slate-500 font-normal">VUs</span></p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Điều chỉnh số Máy Ảo Đồng Thời (VUs):</span>
                  <span className="font-mono text-cyan-400">{concurrencyVUs} VUs</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max={mounted ? (isFreeTier ? 50 : 1000) : 1000}
                  step="10"
                  value={concurrencyVUs}
                  onChange={(e) => setConcurrencyVUs(Number(e.target.value))}
                  disabled={isRunning}
                  suppressHydrationWarning
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/[0.08] bg-slate-950/80 shadow-xl">
            <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Code2 className="h-4 w-4 text-emerald-400" /> 3. WAF Signature & Bypass Headers Code
              </CardTitle>
              <Badge className="text-[10px] font-mono" variant={wafDetected ? "danger" : "muted"}>
                {wafName || "Chưa quét WAF"}
              </Badge>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 flex justify-between">
                  <span>Custom Evasion Headers / Code:</span>
                  <span className="text-emerald-400 font-mono text-[10px]">JSON Format</span>
                </label>
                <textarea
                  value={bypassCode}
                  onChange={(e) => setBypassCode(e.target.value)}
                  disabled={isRunning}
                  rows={6}
                  className="w-full rounded-xl bg-slate-900/90 border border-slate-800 p-3 font-mono text-xs text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 3. BẢN ĐỒ CHIẾN TRƯỜNG ADQ MASTER CLUSTER vs TARGET CIRCULAR SHIELD */}
        <Card className="border border-cyan-500/20 bg-slate-950 shadow-2xl overflow-hidden">
          <CardHeader className="py-3 px-4 border-b border-slate-800 flex flex-row items-center justify-between bg-slate-950/90">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400 animate-pulse" /> ADQ Master Cluster vs Target Circular Shield
            </CardTitle>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" /> Tia Xanh: Vượt WAF / Đâm trúng Core
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_#ef4444]" /> Tia Đỏ: Bị Khiên WAF Chặn (403 Block)
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0 relative bg-[#020617]">
            <canvas ref={canvasRef} className="w-full h-96 block" />

            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-md hidden sm:flex items-center gap-3 text-xs font-mono">
                <span className="text-slate-400">Target HP: <strong className="text-rose-400">{metrics.targetHealth}%</strong></span>
                <span className="text-slate-400">Temp: <strong className="text-amber-400">{metrics.targetTemp}°C</strong></span>
              </div>
              <Button
                onClick={executeStressTest}
                disabled={isRunning || !targetFullUrl}
                className="h-11 px-7 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-xl shadow-amber-950/80 cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <LoaderCircle className="h-4 w-4 mr-2 animate-spin" /> Đang Phóng Chùm Tải...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" /> Khởi Động Đòn Bắn Tải
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 4 THẺ METRICS ĐO LƯỜNG NHANH CẬP NHẬT TRỰC TIẾP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border border-white/[0.08] bg-slate-950/60 p-3.5">
            <p className="text-[11px] text-slate-400">Tổng Request Đã Bắn</p>
            <p className="text-xl font-bold text-white font-mono mt-1">
              {metrics.totalRequests.toLocaleString()}
            </p>
          </Card>
          <Card className="border border-white/[0.08] bg-slate-950/60 p-3.5">
            <p className="text-[11px] text-slate-400">Vượt WAF Thành Công (200 OK)</p>
            <p className="text-xl font-bold text-emerald-400 font-mono mt-1">
              {metrics.status200.toLocaleString()}
            </p>
          </Card>
          <Card className="border border-white/[0.08] bg-slate-950/60 p-3.5">
            <p className="text-[11px] text-slate-400">Tường Lửa Chặn (HTTP 403)</p>
            <p className="text-xl font-bold text-rose-400 font-mono mt-1">
              {metrics.status403WafBlocked.toLocaleString()}
            </p>
          </Card>
          <Card className="border border-white/[0.08] bg-slate-950/60 p-3.5">
            <p className="text-[11px] text-slate-400">Độ Trễ P95 (Latency)</p>
            <p className="text-xl font-bold text-amber-400 font-mono mt-1">
              {metrics.p95LatencyMs}
            </p>
          </Card>
        </div>

        {/* Live Terminal Logs */}
        <Card className="border border-white/[0.08] bg-slate-950 shadow-2xl">
          <CardHeader className="py-2.5 px-4 border-b border-slate-800/80 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-amber-400" /> Live Stress Engine Output
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLogs([`[ADQ-SOC] Đã làm mới nhật ký kiểm thử.`])}
              className="h-6 text-[10px] text-slate-400 hover:text-white px-2"
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Xóa Log
            </Button>
          </CardHeader>
          <CardContent className="p-3">
            <div
              ref={logContainerRef}
              className="h-36 overflow-y-auto font-mono text-xs text-slate-300 space-y-1 rounded-lg bg-black/70 p-3 border border-slate-900"
            >
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`leading-relaxed ${
                    log.includes("[WAF PHÁT HIỆN]") || log.includes("[LỖI")
                      ? "text-rose-400"
                      : log.includes("[HOÀN TẤT]") || log.includes("[THÀNH CÔNG]")
                      ? "text-emerald-400"
                      : log.includes("[KẾT QUẢ THẬT]") || log.includes("[BẮT ĐẦU") || log.includes("[ADQ CLUSTER]")
                      ? "text-amber-300"
                      : "text-slate-300"
                  }`}
                >
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

export default function StressTestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#020617]" />}>
      <StressTestContent />
    </Suspense>
  );
}
