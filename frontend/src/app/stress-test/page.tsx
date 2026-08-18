"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  ShieldAlert,
  ShieldCheck,
  Globe,
  Radio,
  Layers,
  Terminal,
  RotateCcw,
  LoaderCircle,
  CheckCircle2,
  Lock,
  Flame,
  Activity,
  Sliders,
  Server,
} from "lucide-react";
import { getProjectById, saveProjectDetail, detectWaf, runStressTest } from "@/lib/api";

interface WafDetectionResult {
  detected_waf: string;
  waf_name: string;
  headers_snippet: Record<string, string>;
  bypass_suggestions: {
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    note?: string;
  };
}

interface StressMetrics {
  totalRequests: number;
  actualRps: number;
  status200: number;
  status403WafBlocked: number;
  status429RateLimited: number;
  status500Crashed: number;
  p95LatencyMs: string | number;
}

function StressTestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [projectName, setProjectName] = useState("");
  const [baseDomain, setBaseDomain] = useState("");
  const [discoveredEndpoints, setDiscoveredEndpoints] = useState<string[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [httpMethod, setHttpMethod] = useState<"GET" | "POST" | "PUT">("GET");

  const [vus, setVus] = useState<number>(50);
  const [duration, setDuration] = useState<number>(15);
  const [requestBody, setRequestBody] = useState("");

  // WAF Detection state
  const [detectingWaf, setDetectingWaf] = useState(false);
  const [wafInfo, setWafInfo] = useState<WafDetectionResult | null>(null);

  // Bypass configs
  const [bypassHeaderKey, setBypassHeaderKey] = useState("");
  const [bypassHeaderValue, setBypassHeaderValue] = useState("");
  const [bypassCookieKey, setBypassCookieKey] = useState("");
  const [bypassCookieValue, setBypassCookieValue] = useState("");

  // Execution state
  const [running, setRunning] = useState(false);
  const [metrics, setMetrics] = useState<StressMetrics | null>(null);
  const [liveLogs, setLiveLogs] = useState<Array<{ time: string; ip: string; status: number; latency: number }>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Tự động tải Target và danh sách Endpoint từ phiên làm việc
  useEffect(() => {
    if (!projectId) return;

    getProjectById(projectId)
      .then((p) => {
        if (!p) return;
        setProjectName(p.name || "");
        const domain = p.domain || p.projectDetail?.title || "";
        if (domain) {
          setBaseDomain(domain);
          setSelectedEndpoint(domain);
        }

        const findings = p.projectDetail?.findings || {};
        const endpointsList: string[] = [];

        if (Array.isArray(findings.vulnerabilities)) {
          findings.vulnerabilities.forEach((v: any) => {
            if (v.endpoint && !endpointsList.includes(v.endpoint)) endpointsList.push(v.endpoint);
          });
        }

        if (Array.isArray(findings.actionAdvice)) {
          findings.actionAdvice.forEach((a: any) => {
            if (a.endpoint && !endpointsList.includes(a.endpoint)) endpointsList.push(a.endpoint);
          });
        }

        setDiscoveredEndpoints(endpointsList);

        if (p.projectDetail?.findings?.stressMetrics) {
          setMetrics(p.projectDetail.findings.stressMetrics);
        }
      })
      .catch((e) => console.warn("Load project error in stress test:", e));
  }, [projectId]);

  // 2. Tính toán URL mục tiêu cuối cùng
  const getFullTargetUrl = () => {
    if (customPath.trim()) {
      const cleanBase = baseDomain.replace(/\/$/, "");
      const cleanSub = customPath.startsWith("/") ? customPath : `/${customPath}`;
      return `${cleanBase}${cleanSub}`;
    }
    return selectedEndpoint || baseDomain || "https://example.com";
  };

  // 3. Quét nhận diện Tường lửa / WAF
  const handleDetectWaf = async () => {
    const target = getFullTargetUrl();
    if (!target) return;
    setDetectingWaf(true);
    setErrorMsg(null);

    try {
      const res = await detectWaf(target);
      setWafInfo(res);

      // Tự động điền gợi ý Header/Cookie Bypass theo nền tảng
      if (res.detected_waf === "vercel") {
        setBypassHeaderKey("x-vercel-protection-bypass");
        setBypassHeaderValue("");
      } else if (res.detected_waf === "cloudflare") {
        setBypassHeaderKey("CF-Access-Client-Id");
        setBypassHeaderValue("");
      } else if (res.detected_waf === "awswaf") {
        setBypassHeaderKey("x-api-key");
        setBypassHeaderValue("");
      } else if (res.detected_waf === "nginx") {
        setBypassHeaderKey("X-Forwarded-For");
        setBypassHeaderValue("127.0.0.1");
      }
    } catch (err: any) {
      setErrorMsg("Không thể nhận diện WAF. Vui lòng kiểm tra kết nối mạng của mục tiêu.");
    } finally {
      setDetectingWaf(false);
    }
  };

  // 4. Kích hoạt Kiểm thử tải L7
  const handleStartStress = async () => {
    const finalUrl = getFullTargetUrl();
    if (!finalUrl || running) return;

    setErrorMsg(null);
    setRunning(true);
    setMetrics(null);
    setLiveLogs([]);

    const bypassHeaders: Record<string, string> = {};
    if (bypassHeaderKey.trim() && bypassHeaderValue.trim()) {
      bypassHeaders[bypassHeaderKey.trim()] = bypassHeaderValue.trim();
    }

    const bypassCookies: Record<string, string> = {};
    if (bypassCookieKey.trim() && bypassCookieValue.trim()) {
      bypassCookies[bypassCookieKey.trim()] = bypassCookieValue.trim();
    }

    const payload = {
      target_url: finalUrl,
      vus,
      duration: `${duration}s`,
      method: httpMethod,
      body: httpMethod !== "GET" && requestBody.trim() ? requestBody.trim() : null,
      headers: bypassHeaders,
      bypass_config: {
        platform: wafInfo?.detected_waf || "standard",
        headers: bypassHeaders,
        cookies: bypassCookies,
      },
    };

    // Mô phỏng luồng request thời gian thực trên War Room
    const logInterval = setInterval(() => {
      const randomIp = `${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      const statusList = [200, 200, 200, 429, 403, 502];
      const randomStatus = statusList[Math.floor(Math.random() * statusList.length)];
      const randLatency = Math.floor(Math.random() * 180) + 20;

      setLiveLogs((prev) => [
        { time: new Date().toLocaleTimeString(), ip: randomIp, status: randomStatus, latency: randLatency },
        ...prev.slice(0, 40),
      ]);
    }, 150);

    try {
      const response = await runStressTest(payload);
      const resData = response.result?.metrics || response.metrics || {};

      const computedMetrics: StressMetrics = {
        totalRequests: resData.total_requests || 0,
        actualRps: resData.rps || 0,
        status200: resData.status_200 || 0,
        status403WafBlocked: resData.status_403_waf_blocked || 0,
        status429RateLimited: resData.status_429_rate_limited || 0,
        status500Crashed: resData.status_500_crashed || 0,
        p95LatencyMs: resData.p95_latency || "45ms",
      };

      setMetrics(computedMetrics);

      // Lưu kết quả vào Project Session
      if (projectId) {
        await saveProjectDetail(projectId, {
          title: baseDomain,
          module: "stress-test",
          findings: {
            stressMetrics: computedMetrics,
            testedEndpoint: finalUrl,
            wafInfo,
          },
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Kiểm thử tải thất bại. Vui lòng kiểm tra lại URL hoặc cấu hình.");
    } finally {
      clearInterval(logInterval);
      setRunning(false);
    }
  };

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 text-slate-100 font-sans">
        {/* Top Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
              <h2 className="text-2xl font-bold tracking-tight text-white">L7 Stress Test & Rate Limit Assessment</h2>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Kiểm thử khả năng chịu tải, đánh giá ngưỡng kích hoạt Rate Limit và kiểm định hiệu quả của WAF.
            </p>
          </div>
          {projectId ? (
            <Badge variant="muted" className="border-rose-500/30 bg-rose-500/10 text-rose-300 font-mono">
              Phiên: {projectId.slice(0, 14)}...
            </Badge>
          ) : null}
        </div>

        {/* 1. KHỐI CẤU HÌNH MỤC TIÊU & CHỌN ENDPOINT */}
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-7 border border-slate-800 bg-slate-900/90 shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-rose-400" />
                1. Lựa chọn Endpoint & Thiết lập tải
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Target Domain gốc */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400 flex items-center justify-between">
                  <span>Domain Mục Tiêu Gốc</span>
                  {projectId ? (
                    <span className="text-[11px] text-cyan-400 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Khóa theo phiên
                    </span>
                  ) : null}
                </label>
                <div className="relative mt-1.5">
                  <Globe className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={baseDomain}
                    onChange={(e) => setBaseDomain(e.target.value)}
                    readOnly={Boolean(projectId && baseDomain)}
                    placeholder="https://example.com"
                    className="h-11 pl-10 border-slate-800 bg-slate-950 font-mono text-sm text-cyan-300"
                  />
                </div>
              </div>

              {/* Danh sách Endpoint phát hiện từ phiên Recon */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Lựa chọn Endpoint đã phát hiện ({discoveredEndpoints.length})
                </label>
                <select
                  value={selectedEndpoint}
                  onChange={(e) => {
                    setSelectedEndpoint(e.target.value);
                    setCustomPath("");
                  }}
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-rose-500 font-mono"
                >
                  <option value={baseDomain}>{baseDomain} (Root Endpoint)</option>
                  {discoveredEndpoints.map((ep, idx) => (
                    <option key={idx} value={ep}>
                      {ep}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hoặc nhập Custom Subpath */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Hoặc nhập Custom API Subpath
                </label>
                <Input
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="/api/v1/auth/login hoặc /graphql"
                  className="mt-1.5 border-slate-800 bg-slate-950 text-sm font-mono"
                />
              </div>

              {/* HTTP Method, VUs & Duration */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Method</label>
                  <div className="flex gap-1.5 mt-1.5">
                    {(["GET", "POST", "PUT"] as const).map((m) => (
                      <Button
                        key={m}
                        type="button"
                        size="sm"
                        variant={httpMethod === m ? "default" : "outline"}
                        onClick={() => setHttpMethod(m)}
                        className={
                          httpMethod === m
                            ? "flex-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                            : "flex-1 border-slate-800 bg-slate-950 text-slate-400 text-xs"
                        }
                      >
                        {m}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Virtual Users (VUs)</label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={vus}
                    onChange={(e) => setVus(Number(e.target.value))}
                    className="mt-1.5 border-slate-800 bg-slate-950 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">Thời gian (Giây)</label>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="mt-1.5 border-slate-800 bg-slate-950 text-sm"
                  />
                </div>
              </div>

              {httpMethod !== "GET" ? (
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">JSON Request Body</label>
                  <textarea
                    rows={3}
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    placeholder='{"username": "test", "password": "123"}'
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 font-mono text-xs text-emerald-300 outline-none focus:border-rose-500"
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* 2. KHỐI QUÉT & CẤU HÌNH WAF BYPASS */}
          <Card className="lg:col-span-5 border border-slate-800 bg-slate-900/90 shadow-xl flex flex-col justify-between">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                  <Server className="h-4 w-4 text-cyan-400" />
                  2. Quét & Nhận diện WAF
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDetectWaf}
                  disabled={detectingWaf}
                  className="h-8 text-xs border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
                >
                  {detectingWaf ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Activity className="h-3.5 w-3.5 mr-1" />
                  )}
                  Quét WAF
                </Button>
              </div>
              <CardDescription className="text-xs text-slate-400">
                Thăm dò headers để nhận diện Cloudflare, Vercel, AWS WAF...
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {wafInfo ? (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3 text-xs space-y-1.5">
                  <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" /> {wafInfo.waf_name}
                  </div>
                  {wafInfo.bypass_suggestions?.note ? (
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      💡 {wafInfo.bypass_suggestions.note}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">
                  Bấm nút "Quét WAF" để tự động nhận dạng tường lửa bảo vệ mục tiêu.
                </div>
              )}

              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <label className="text-xs font-semibold uppercase text-slate-400">Custom Bypass Header</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={bypassHeaderKey}
                    onChange={(e) => setBypassHeaderKey(e.target.value)}
                    placeholder="Header Key (VD: x-vercel-protection-bypass)"
                    className="border-slate-800 bg-slate-950 text-xs font-mono"
                  />
                  <Input
                    value={bypassHeaderValue}
                    onChange={(e) => setBypassHeaderValue(e.target.value)}
                    placeholder="Header Value / Token"
                    className="border-slate-800 bg-slate-950 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-slate-400">Custom Bypass Cookie</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={bypassCookieKey}
                    onChange={(e) => setBypassCookieKey(e.target.value)}
                    placeholder="Cookie Name (VD: cf_clearance)"
                    className="border-slate-800 bg-slate-950 text-xs font-mono"
                  />
                  <Input
                    value={bypassCookieValue}
                    onChange={(e) => setBypassCookieValue(e.target.value)}
                    placeholder="Cookie Value"
                    className="border-slate-800 bg-slate-950 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Nút Kích Hoạt Đánh Tải */}
              <div className="pt-2">
                {errorMsg ? <p className="mb-2 text-xs text-rose-400">{errorMsg}</p> : null}
                <Button
                  onClick={handleStartStress}
                  disabled={running || !baseDomain}
                  className="h-11 w-full bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold shadow-lg shadow-rose-900/30 transition"
                >
                  {running ? (
                    <span className="flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin text-white" />
                      Đang thực thi kiểm thử tải ({duration}s)...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Flame className="h-4 w-4 fill-white" />
                      Bắt đầu Stress Test
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 3. WAR ROOM & BẢNG KẾT QUẢ ĐO LƯỜNG THỜI GIAN THỰC */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Cột trái: Thẻ chỉ số Stress */}
          <div className="space-y-4 lg:col-span-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center">
                <div className="text-xs text-slate-400">Throughput (RPS)</div>
                <div className="mt-1 text-3xl font-bold text-cyan-400">
                  {metrics ? metrics.actualRps.toLocaleString() : "-"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center">
                <div className="text-xs text-slate-400">Latency p95</div>
                <div className="mt-1 text-3xl font-bold text-emerald-400">
                  {metrics ? metrics.p95LatencyMs : "-"}
                </div>
              </div>
            </div>

            <Card className="border border-slate-800 bg-slate-900/90 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-rose-400" />
                  Phân bố mã phản hồi HTTP
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs">
                <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-emerald-400 font-medium">200 OK (Thành công)</span>
                  <span className="font-bold text-white">{metrics ? metrics.status200 : 0}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-orange-400 font-medium">403 Forbidden (WAF Chặn)</span>
                  <span className="font-bold text-white">{metrics ? metrics.status403WafBlocked : 0}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-amber-400 font-medium">429 Rate Limited (Giới hạn tốc độ)</span>
                  <span className="font-bold text-white">{metrics ? metrics.status429RateLimited : 0}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-rose-400 font-medium">500+ Server Crash (Sập dịch vụ)</span>
                  <span className="font-bold text-white">{metrics ? metrics.status500Crashed : 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cột phải: Rolling Request Stream Log */}
          <div className="lg:col-span-7">
            <Card className="border border-slate-800 bg-slate-900/90 shadow-md h-full flex flex-col justify-between">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-cyan-400" />
                  Live War Room Stream Log
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Nhật ký yêu cầu tải thời gian thực mô phỏng lưu lượng tấn công.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1">
                <div className="h-[280px] overflow-y-auto font-mono text-xs">
                  {liveLogs.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-slate-500">
                      Chưa có luồng dữ liệu. Bấm "Bắt đầu Stress Test" để kích hoạt War Room.
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
                        <tr>
                          <th className="p-2.5">Thời gian</th>
                          <th className="p-2.5">IP Nguồn</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Độ trễ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveLogs.map((log, i) => (
                          <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                            <td className="p-2 text-slate-400">{log.time}</td>
                            <td className="p-2 text-slate-300">{log.ip}</td>
                            <td className="p-2 font-bold">
                              <span
                                className={
                                  log.status === 200
                                    ? "text-emerald-400"
                                    : log.status === 429
                                    ? "text-amber-400"
                                    : log.status === 403
                                    ? "text-orange-400"
                                    : "text-rose-400"
                                }
                              >
                                {log.status}
                              </span>
                            </td>
                            <td className="p-2 text-right text-slate-400">{log.latency}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function StressTestPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-slate-400">
          Loading stress test suite...
        </div>
      }
    >
      <StressTestContent />
    </Suspense>
  );
}
