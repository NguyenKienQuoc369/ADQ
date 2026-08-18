"use client";

import React, { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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

  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (!targetUrl) return;
    setError(null);
    setRunning(true);
    setMetrics({ totalRequests: 0, actualRps: 0, status200: 0, status403WafBlocked: 0, status429RateLimited: 0, status500Crashed: 0, p95LatencyMs: 0 });

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      await fetch(`${API_BASE_URL}/api/stress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          target_url: targetUrl,
          vus: Math.min(100, Math.max(1, Math.round(rps / 10))),
          duration: `${duration}s`,
          method: "GET",
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stress test failed");
    } finally {
      setTimeout(() => setRunning(false), duration * 1000);
    }
  };

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 text-[var(--foreground)]">
        <div className="rounded-[20px] border border-[color:var(--line)] bg-[color:var(--background-elevated)] p-5 shadow-[0_0_0_1px_rgba(148,163,184,0.04)] md:p-6">
          <div className="mb-6 border-b border-[color:var(--line)] pb-5">
            <h1 className="text-[clamp(1.8rem,2.4vw,2.5rem)] font-semibold tracking-[-0.06em] text-[var(--foreground)]">
              L7 Stress Test & Rate Limit
            </h1>
            <p className="mt-2 text-sm text-[var(--foreground-muted)]">
              Simulate high-volume traffic to validate WAF rules and backend resilience.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <div className="space-y-5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--background)]/40 p-4 md:p-5">
              <div>
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                  Target URL Endpoint
                </label>
                <Input
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://api.example.com/endpoint"
                  className="h-11 rounded-xl border-[color:var(--line)] bg-transparent text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]"
                />
              </div>

              <div>
                <label className="mb-3 block text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                  Target Requests per Second (RPS)
                </label>
                <input
                  type="range"
                  min={100}
                  max={10000}
                  value={rps}
                  onChange={(e) => setRps(Number(e.target.value))}
                  className="mt-2 w-full accent-cyan-400"
                />
                <div className="mt-2 text-sm text-[var(--foreground)]">{rps} RPS</div>
              </div>

              <div>
                <label className="mb-3 block text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                  Duration (seconds)
                </label>
                <input
                  type="range"
                  min={5}
                  max={600}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="mt-2 w-full accent-cyan-400"
                />
                <div className="mt-2 text-sm text-[var(--foreground)]">{duration} seconds</div>
              </div>

              <div>
                <Button
                  onClick={start}
                  disabled={!targetUrl || running}
                  className="h-11 w-full rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 text-sm font-medium text-cyan-100 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {running ? 'Running...' : 'Initiate Attack Simulation'}
                </Button>
              </div>

              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--background)]/35 p-4">
                <h4 className="text-sm font-semibold text-[var(--foreground)]">WAF Bypass Configuration</h4>
                <div className="mt-2 text-xs leading-5 text-[var(--foreground-muted)]">
                  Provide platform-specific headers or select an existing profile.
                </div>
                <div className="mt-4 space-y-3">
                  <select
                    className="w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--background-elevated)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none"
                    value={bypassConfig.platform}
                    onChange={(e) => setBypassConfig({ ...bypassConfig, platform: e.target.value })}
                  >
                    <option value="standard">Standard (no bypass)</option>
                    <option value="cloudflare">Cloudflare - CF-Access</option>
                    <option value="vercel">Vercel - x-vercel-protection-bypass</option>
                    <option value="awswaf">AWS WAF - x-api-key</option>
                  </select>
                  <div className="text-xs leading-5 text-[var(--foreground-muted)]">
                    Example headers: CF-Access-Client-Id, cf_clearance, x-vercel-protection-bypass, x-api-key
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--background)]/30 p-4 md:p-5">
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">Live War Room</h2>
                  <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                    Real-time metrics and rolling request stream (SSE/WebSocket in production)
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--background-elevated)] p-4">
                    <div className="text-sm text-[var(--foreground-muted)]">Current Throughput (RPS)</div>
                    <div className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                      {metrics ? metrics.actualRps.toLocaleString() : '-'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--background-elevated)] p-4">
                    <div className="text-sm text-[var(--foreground-muted)]">Latency p95 (ms)</div>
                    <div className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                      {metrics ? metrics.p95LatencyMs : '-'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-[color:var(--line)] bg-[color:var(--background-elevated)] p-4">
                  <div className="text-sm text-[var(--foreground-muted)]">HTTP Status distribution</div>
                  <div className="mt-3 grid gap-2 text-sm text-[var(--foreground)] sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--background-muted)] px-3 py-2">200 OK: {metrics ? `${metrics.status200}%` : ' -'}</div>
                    <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--background-muted)] px-3 py-2">403 WAF Blocked: {metrics ? `${metrics.status403WafBlocked}%` : ' -'}</div>
                    <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--background-muted)] px-3 py-2">429 Rate Limited: {metrics ? `${metrics.status429RateLimited}%` : ' -'}</div>
                    <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--background-muted)] px-3 py-2">500 Server Error: {metrics ? `${metrics.status500Crashed}%` : ' -'}</div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-3 text-sm text-[var(--foreground-muted)]">Rolling Request Log</div>
                  <div className="max-h-[320px] overflow-auto rounded-xl border border-[color:var(--line)] bg-[color:var(--background-elevated)]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[color:var(--background-muted)] text-left text-[var(--foreground-muted)]">
                        <tr>
                          <th className="px-3 py-2.5 font-medium">Time</th>
                          <th className="px-3 py-2.5 font-medium">Spoofed IP</th>
                          <th className="px-3 py-2.5 font-medium">Endpoint</th>
                          <th className="px-3 py-2.5 font-medium">Status</th>
                          <th className="px-3 py-2.5 font-medium">Latency</th>
                        </tr>
                      </thead>
                      <tbody className="text-[var(--foreground)]">
                        {logs.map((l, idx) => (
                          <tr key={idx} className="border-t border-[color:var(--line)]">
                            <td className="px-3 py-2 text-xs">{new Date(l.time).toLocaleTimeString()}</td>
                            <td className="px-3 py-2 text-xs">{l.ip}</td>
                            <td className="px-3 py-2 font-mono text-xs">{l.path}</td>
                            <td className={`px-3 py-2 text-xs ${l.status >= 500 ? 'text-rose-400' : l.status === 403 ? 'text-orange-400' : 'text-cyan-300'}`}>
                              {l.status}
                            </td>
                            <td className="px-3 py-2 text-xs">{l.latency}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
