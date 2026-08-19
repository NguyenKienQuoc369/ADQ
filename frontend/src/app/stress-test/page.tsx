"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

function StressTestContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [projectName, setProjectName] = useState("");
  const [baseDomain, setBaseDomain] = useState("");
  const [endpoints, setEndpoints] = useState<string[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState("");
  const [scanningEndpoints, setScanningEndpoints] = useState(false);

  // Tốc độ: Tổng request trong N giây
  const [targetRequests, setTargetRequests] = useState<number>(2000);
  const [duration, setDuration] = useState<number>(5);

  // WAF Detection state
  const [detectingWaf, setDetectingWaf] = useState(false);
  const [detectedWaf, setDetectedWaf] = useState<string>("standard");
  const [detectedWafName, setDetectedWafName] = useState<string | null>(null);
  const [inputLabel, setInputLabel] = useState<string>("Mã Bypass / Secret Token");
  const [inputPlaceholder, setInputPlaceholder] = useState<string>("Nhập mã bypass hoặc token xác thực");
  const [wafHint, setWafHint] = useState<string | null>(null);
  const [bypassCode, setBypassCode] = useState<string>("");

  // Execution state
  const [running, setRunning] = useState(false);
  const [metrics, setMetrics] = useState<StressMetrics | null>(null);
  const [liveLogs, setLiveLogs] = useState<Array<{ time: string; ip: string; status: number; latency: number }>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const calculatedRps = Math.round(targetRequests / Math.max(1, duration));

  // 1. Nạp dữ liệu từ Project Session
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
          setEndpoints([domain]);
        }
      })
      .catch((e) => console.warn("Load project error:", e));
  }, [projectId]);

  // 2. Quét Endpoint tự động của mục tiêu
  const handleScanEndpoints = async () => {
    if (!baseDomain) return;
    setScanningEndpoints(true);
    setErrorMsg(null);

    try {
      const res = await discoverEndpoints(baseDomain);
      if (res && res.endpoints && res.endpoints.length > 0) {
        setEndpoints(res.endpoints);
        setSelectedEndpoint(res.endpoints[0]);
      }
    } catch {
      setErrorMsg("Không thể quét endpoint mục tiêu.");
    } finally {
      setScanningEndpoints(false);
    }
  };

  // 3. Quét WAF & Tự Động Thích Ứng Ô Nhập Mã Bypass
  const handleDetectWaf = async () => {
    const target = selectedEndpoint || baseDomain;
    if (!target) return;
    setDetectingWaf(true);
    setErrorMsg(null);

    try {
      const res = await detectWaf(target);
      setDetectedWaf(res.detected_waf || "standard");
      setDetectedWafName(res.waf_name);
      setInputLabel(res.input_label || "Mã Bypass / Secret Token");
      setInputPlaceholder(res.input_placeholder || "Nhập mã bypass");
      setWafHint(res.hint);
    } catch {
      setErrorMsg("Không thể kiểm tra WAF của mục tiêu.");
    } finally {
      setDetectingWaf(false);
    }
  };

  // 4. Kích hoạt L7 Stress Test
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
        totalRequests: resData.total_requests || 0,
        actualRps: resData.rps || 0,
        status200: resData.status_200 || 0,
        status403WafBlocked: resData.status_403_waf_blocked || 0,
        status429RateLimited: resData.status_429_rate_limited || 0,
        status500Crashed: resData.status_500_crashed || 0,
        p95LatencyMs: resData.p95_latency || "0ms",
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
    <DashboardShell area="dashboard">
      <div className="space-y-6 text-slate-100 font-sans">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
              <h2 className="text-2xl font-bold tracking-tight text-white">L7 Stress Test & WAF Assessment</h2>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Kiểm thử tải chính xác theo số lượng request, đo lường phản hồi thực tế và kiểm tra hiệu quả mã Bypass.
            </p>
          </div>
          {projectId ? (
            <Badge variant="muted" className="border-rose-500/30 bg-rose-500/10 text-rose-300 font-mono">
              Phiên: {projectId.slice(0, 14)}...
            </Badge>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* 1. KHỐI QUÉT & CHỌN ENDPOINT */}
          <Card className="lg:col-span-7 border border-slate-800 bg-slate-900/90 shadow-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                  <Globe className="h-4 w-4 text-cyan-400" />
                  1. Mục tiêu & Quét Endpoint Tự Động
                </CardTitle>
                <Button
                  size="sm"
                  type="button"
                  onClick={handleScanEndpoints}
                  disabled={scanningEndpoints || !baseDomain}
                  className="h-8 bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {scanningEndpoints ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                  Quét Endpoint Mục Tiêu
                </Button>
              </div>
              <CardDescription className="text-xs text-slate-400">
                Tự động bóc tách các routes/endpoints trực tiếp từ website.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400 flex items-center justify-between">
                  <span>Domain Gốc</span>
                  {projectId ? (
                    <span className="text-[11px] text-cyan-400 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Cố định theo phiên
                    </span>
                  ) : null}
                </label>
                <Input
                  value={baseDomain}
                  onChange={(e) => setBaseDomain(e.target.value)}
                  readOnly={Boolean(projectId && baseDomain)}
                  placeholder="https://example.com"
                  className="mt-1.5 h-11 border-slate-800 bg-slate-950 font-mono text-sm text-cyan-300 read-only:bg-slate-950"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400 flex items-center justify-between">
                  <span>Chọn Endpoint Cần Đánh Tải ({endpoints.length})</span>
                  <span className="text-[11px] text-emerald-400">1-Click Select</span>
                </label>
                <select
                  value={selectedEndpoint}
                  onChange={(e) => setSelectedEndpoint(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-rose-500 font-mono"
                >
                  {endpoints.map((ep, idx) => (
                    <option key={idx} value={ep}>
                      {ep}
                    </option>
                  ))}
                </select>
              </div>

              {/* TÍNH TOÁN TỐC ĐỘ: REQUESTS / DURATION */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-slate-300">Tốc độ Bắn Tải Mục Tiêu</span>
                  <Badge className="border-rose-500/40 bg-rose-500/15 text-rose-300 font-mono text-xs font-bold" variant="muted">
                    {calculatedRps.toLocaleString()} req/sec
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Tổng số Requests</label>
                    <Input
                      type="number"
                      min={10}
                      max={50000}
                      step={100}
                      value={targetRequests}
                      onChange={(e) => setTargetRequests(Math.max(1, Number(e.target.value)))}
                      className="mt-1.5 h-10 border-slate-800 bg-slate-900 text-sm font-bold text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">Thời gian chạy (Giây)</label>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={duration}
                      onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
                      className="mt-1.5 h-10 border-slate-800 bg-slate-900 text-sm font-bold text-white"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. KHỐI WAF DETECTION & Ô NHẬP BYPASS TỰ ĐỘNG THÍCH ỨNG */}
          <Card className="lg:col-span-5 border border-slate-800 bg-slate-900/90 shadow-xl flex flex-col justify-between">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-amber-400" />
                  2. Quét & Điều Mã Bypass WAF
                </CardTitle>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={handleDetectWaf}
                  disabled={detectingWaf}
                  className="h-8 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
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
                Ô nhập mã Bypass sẽ tự thích ứng theo loại tường lửa đã phát hiện.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {detectedWafName ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs space-y-1">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" /> {detectedWafName}
                  </div>
                  {wafHint ? <p className="text-[11px] text-slate-300">{wafHint}</p> : null}
                </div>
              ) : null}

              {/* Ô NHẬP MÃ BYPASS THÍCH ỨNG TỰ ĐỘNG */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-slate-400 flex items-center justify-between">
                  <span>{inputLabel}</span>
                  <span className="text-[10px] text-cyan-400 uppercase font-mono">[{detectedWaf}]</span>
                </label>
                <Input
                  value={bypassCode}
                  onChange={(e) => setBypassCode(e.target.value)}
                  placeholder={inputPlaceholder}
                  className="h-11 border-slate-800 bg-slate-950 font-mono text-xs text-cyan-300 placeholder:text-slate-600"
                />
                <p className="text-[11px] text-slate-500">
                  {detectedWaf === "vercel"
                    ? "Chỉ cần dán mã secret (rsE...), hệ thống sẽ tự nạp header x-vercel-protection-bypass."
                    : detectedWaf === "cloudflare"
                    ? "Chỉ cần dán token cf_clearance hoặc Service Token."
                    : "Hỗ trợ nhập trực tiếp token, API key hoặc định dạng key: value."}
                </p>
              </div>

              {/* Nút Bắt Đầu Bắn Tải */}
              <div className="pt-2">
                {errorMsg ? <p className="mb-2 text-xs text-rose-400">{errorMsg}</p> : null}
                <Button
                  onClick={handleStartStress}
                  disabled={running || !baseDomain}
                  className="h-12 w-full bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold shadow-lg shadow-rose-900/30 transition text-sm"
                >
                  {running ? (
                    <span className="flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin text-white" />
                      Đang thực thi bắn tải ({targetRequests} reqs / {duration}s = {calculatedRps} req/s)...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Flame className="h-4 w-4 fill-white" />
                      Bắt đầu Stress Test ({calculatedRps.toLocaleString()} req/s)
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 3. BẢNG ĐO LƯỜNG & STREAM LOGS THỰC TẾ */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center">
                <div className="text-xs text-slate-400">Throughput Thực Tế</div>
                <div className="mt-1 text-3xl font-bold text-cyan-400 font-mono">
                  {metrics ? `${metrics.actualRps} req/s` : "-"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-center">
                <div className="text-xs text-slate-400">Latency p95</div>
                <div className="mt-1 text-3xl font-bold text-emerald-400 font-mono">
                  {metrics ? metrics.p95LatencyMs : "-"}
                </div>
              </div>
            </div>

            <Card className="border border-slate-800 bg-slate-900/90 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-rose-400" />
                  Mã phản hồi HTTP Thực tế từ Server
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs">
                <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-emerald-400 font-medium">200 OK (Thành công / Bypass hợp lệ)</span>
                  <span className="font-bold text-white font-mono">{metrics ? metrics.status200 : 0}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-orange-400 font-medium">403 Forbidden (WAF Chặn)</span>
                  <span className="font-bold text-white font-mono">{metrics ? metrics.status403WafBlocked : 0}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-amber-400 font-medium">429 Rate Limited (Bị chặn tốc độ)</span>
                  <span className="font-bold text-white font-mono">{metrics ? metrics.status429RateLimited : 0}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-rose-400 font-medium">500+ Server Crash (Sập dịch vụ)</span>
                  <span className="font-bold text-white font-mono">{metrics ? metrics.status500Crashed : 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-7">
            <Card className="border border-slate-800 bg-slate-900/90 shadow-md h-full flex flex-col justify-between">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-cyan-400" />
                  Live War Room Stream Log (Thực tế từ máy chủ)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1">
                <div className="h-[280px] overflow-y-auto font-mono text-xs">
                  {liveLogs.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-slate-500">
                      Chưa có dữ liệu. Bấm "Bắt đầu Stress Test" để ghi nhận phản hồi từ server.
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
                        <tr>
                          <th className="p-2.5">Thời gian</th>
                          <th className="p-2.5">IP Nguồn (X-Forwarded)</th>
                          <th className="p-2.5">Mã HTTP Thực</th>
                          <th className="p-2.5 text-right">Độ trễ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveLogs.map((log, i) => (
                          <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                            <td className="p-2 text-slate-400">{log.time}</td>
                            <td className="p-2 text-slate-300 font-mono">{log.ip}</td>
                            <td className="p-2 font-bold font-mono">
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
                            <td className="p-2 text-right text-slate-400 font-mono">{log.latency}ms</td>
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
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-400">Loading stress suite...</div>}>
      <StressTestContent />
    </Suspense>
  );
}
