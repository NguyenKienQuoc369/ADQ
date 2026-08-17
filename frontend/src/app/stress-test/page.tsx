"use client";

import React, { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface WafBypassConfig {
  platform: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
}

interface StressStreamLog {
  time: string;
  ip: string;
  method: string;
  path: string;
  status: number;
  latency: number;
}

interface StressMetrics {
  totalRequests: number;
  actualRps: number;
  status200: number;
  status403WafBlocked: number;
  status429RateLimited: number;
  status500Crashed: number;
  p95LatencyMs: number;
}

export default function StressTestPage() {
  const [targetUrl, setTargetUrl] = useState("");
  const [rps, setRps] = useState<number>(100);
  const [duration, setDuration] = useState<number>(30);
  const [running, setRunning] = useState(false);

  const [bypassConfig, setBypassConfig] = useState<WafBypassConfig>({ platform: 'standard', headers: {}, cookies: {} });

  const [metrics, setMetrics] = useState<StressMetrics | null>(null);
  const [logs, setLogs] = useState<StressStreamLog[]>([]);

  useEffect(() => {
    let interval: number | undefined;
    if (running) {
      // simulate streaming updates every 100ms
      interval = window.setInterval(() => {
        setMetrics((m) => {
          const actual = (m?.actualRps ?? rps * 0.9) + Math.round((Math.random() - 0.5) * rps * 0.05);
          return {
            totalRequests: (m?.totalRequests ?? 0) + Math.round(actual / 10),
            actualRps: Math.max(0, Math.round(actual)),
            status200:  Math.round(((m?.status200 ?? 70) + Math.random()*2)),
            status403WafBlocked: Math.round(((m?.status403WafBlocked ?? 10) + Math.random()*1)),
            status429RateLimited: Math.round(((m?.status429RateLimited ?? 15) + Math.random()*1)),
            status500Crashed: Math.round(((m?.status500Crashed ?? 5) + Math.random()*1)),
            p95LatencyMs: Math.round(100 + Math.random() * 400),
          };
        });

        setLogs((l) => {
          const newLog: StressStreamLog = {
            time: new Date().toISOString(),
            ip: `203.0.113.${Math.floor(Math.random() * 255)}`,
            method: Math.random() > 0.5 ? 'GET' : 'POST',
            path: '/api/test',
            status: [200,200,200,403,429,500][Math.floor(Math.random()*6)],
            latency: Math.round(20 + Math.random() * 600),
          };
          const next = [newLog, ...l].slice(0, 200);
          return next;
        });
      }, 100);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [running, rps]);

  const start = async () => {
    if (!targetUrl) return;
    setRunning(true);
    // Placeholder: POST /api/v1/stress/start with payload { targetUrl, targetRequests: rps, durationSec: duration, bypassConfig }
    setMetrics({ totalRequests: 0, actualRps: 0, status200: 0, status403WafBlocked: 0, status429RateLimited: 0, status500Crashed: 0, p95LatencyMs: 0 });

    // stop after duration seconds
    setTimeout(() => setRunning(false), duration * 1000);
  };

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>L7 Stress Test & Rate Limit</CardTitle>
            <CardDescription>Simulate high-volume traffic to validate WAF rules and backend resilience.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-1 space-y-3">
                <label className="block text-sm">Target URL Endpoint</label>
                <Input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://api.example.com/endpoint" className="mt-2" />

                <label className="block text-sm mt-2">Target Requests per Second (RPS)</label>
                <input type="range" min={100} max={10000} value={rps} onChange={(e) => setRps(Number(e.target.value))} className="mt-2 w-full" />
                <div className="text-sm text-zinc-600">{rps} RPS</div>

                <label className="block text-sm mt-2">Duration (seconds)</label>
                <input type="range" min={5} max={600} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-2 w-full" />
                <div className="text-sm text-zinc-600">{duration} seconds</div>

                <div className="mt-3">
                  <Button onClick={start} disabled={!targetUrl || running}>{running ? 'Running...' : 'Initiate Attack Simulation'}</Button>
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-medium">WAF Bypass Configuration</h4>
                  <div className="mt-2 text-xs text-zinc-600">Provide platform-specific headers or select an existing profile.</div>
                  <div className="mt-3 space-y-2">
                    <select className="w-full rounded border px-3 py-1 text-sm" value={bypassConfig.platform} onChange={(e)=>setBypassConfig({...bypassConfig, platform: e.target.value})}>
                      <option value="standard">Standard (no bypass)</option>
                      <option value="cloudflare">Cloudflare - CF-Access</option>
                      <option value="vercel">Vercel - x-vercel-protection-bypass</option>
                      <option value="awswaf">AWS WAF - x-api-key</option>
                    </select>
                    {/* Simple form inputs for header examples */}
                    <div className="text-xs text-zinc-500">Example headers: CF-Access-Client-Id, cf_clearance, x-vercel-protection-bypass, x-api-key</div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Live War Room</CardTitle>
                    <CardDescription>Real-time metrics and rolling request stream (SSE/WebSocket in production)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded border p-3">
                        <div className="text-sm text-zinc-500">Current Throughput (RPS)</div>
                        <div className="text-3xl font-semibold">{metrics ? metrics.actualRps.toLocaleString() : '-'}</div>
                      </div>

                      <div className="rounded border p-3">
                        <div className="text-sm text-zinc-500">Latency p95 (ms)</div>
                        <div className="text-3xl font-semibold">{metrics ? metrics.p95LatencyMs : '-'}</div>
                      </div>

                      <div className="rounded border p-3 col-span-2">
                        <div className="text-sm text-zinc-500">HTTP Status distribution</div>
                        <div className="mt-2 text-sm grid grid-cols-4 gap-2">
                          <div>200 OK: {metrics ? metrics.status200 + '%' : ' -'}</div>
                          <div>403 WAF Blocked: {metrics ? metrics.status403WafBlocked + '%' : ' -'}</div>
                          <div>429 Rate Limited: {metrics ? metrics.status429RateLimited + '%' : ' -'}</div>
                          <div>500 Server Error: {metrics ? metrics.status500Crashed + '%' : ' -'}</div>
                        </div>
                      </div>

                      <div className="col-span-2">
                        <div className="text-sm text-zinc-500 mb-2">Rolling Request Log</div>
                        <div className="max-h-60 overflow-auto rounded border bg-white">
                          <table className="min-w-full text-sm">
                            <thead className="bg-zinc-100 text-left">
                              <tr>
                                <th className="px-2 py-2">Time</th>
                                <th className="px-2 py-2">Spoofed IP</th>
                                <th className="px-2 py-2">Endpoint</th>
                                <th className="px-2 py-2">Status</th>
                                <th className="px-2 py-2">Latency</th>
                              </tr>
                            </thead>
                            <tbody>
                              {logs.map((l, idx) => (
                                <tr key={idx} className="border-t">
                                  <td className="px-2 py-2 text-xs">{new Date(l.time).toLocaleTimeString()}</td>
                                  <td className="px-2 py-2 text-xs">{l.ip}</td>
                                  <td className="px-2 py-2 text-xs font-mono">{l.path}</td>
                                  <td className={`px-2 py-2 text-xs ${l.status >=500 ? 'text-rose-600' : l.status===403 ? 'text-orange-500' : ''}`}>{l.status}</td>
                                  <td className="px-2 py-2 text-xs">{l.latency}ms</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
