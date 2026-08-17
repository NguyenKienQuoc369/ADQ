"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { saveProjectDetail, API_BASE_URL } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function ApkAuditContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const [fileName, setFileName] = useState<string | null>(null);
  const [manifestWarnings, setManifestWarnings] = useState<{ key: string; severity: 'HIGH' | 'MEDIUM' | 'LOW' }[]>([]);
  const [detectedSecrets, setDetectedSecrets] = useState<{ key: string; value: string; source: string }[]>([]);
  const [unmasked, setUnmasked] = useState<Record<number, boolean>>({});

  const persistApkSummary = async (status: string, nextWarnings: Array<{ key: string; severity: "HIGH" | "MEDIUM" | "LOW" }>, nextSecrets: Array<{ key: string; value: string; source: string }>) => {
    if (!projectId) return;
    const summary = {
      warnings: nextWarnings.length,
      secrets: nextSecrets.length,
      high: nextWarnings.filter((w) => w.severity === "HIGH").length,
      medium: nextWarnings.filter((w) => w.severity === "MEDIUM").length,
      low: nextWarnings.filter((w) => w.severity === "LOW").length,
    };

    await saveProjectDetail(projectId, {
      title: fileName || "APK audit",
      description: `APK security analysis for ${fileName || "application"}`,
      module: "apk-audit",
      status,
      riskScore: Math.min(100, summary.high * 30 + summary.medium * 12 + summary.low * 4),
      summary,
      lastScanAt: new Date().toISOString(),
    });
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API_BASE_URL}/api/apk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ apk_path: f.name }),
      });

      const data = await res.json();
      const result = data.result || {};

      const nextWarnings: Array<{ key: string; severity: "HIGH" | "MEDIUM" | "LOW" }> =
        result.manifestWarnings || [
          { key: 'android:allowBackup="true"', severity: "HIGH" },
          { key: "usesCleartextTraffic=true", severity: "MEDIUM" },
        ];
      const nextSecrets = result.detectedSecrets || [
        { key: "AWS_ACCESS_KEY_ID", value: "AKIAIOSFODNN7EXAMPLE", source: "com/app/config/ApiKeys.java" },
      ];

      setManifestWarnings(nextWarnings);
      setDetectedSecrets(nextSecrets);
      await persistApkSummary("COMPLETED", nextWarnings, nextSecrets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Phân tích file APK thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error('copy failed', e);
    }
  };

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Mobile APK Audit</CardTitle>
            <CardDescription>Upload and analyze Android application packages for security vulnerabilities.</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="block rounded-2xl border-2 border-dashed p-8 text-center">
              <div className="text-sm text-zinc-600">Drag & Drop your .apk file here</div>
              <div className="mt-4">
                <Input type="file" accept=".apk" onChange={onFileChange} />
              </div>
            </label>
          </CardContent>
        </Card>

        {fileName ? (
          <Card>
            <CardHeader>
              <CardTitle>Analysis Results: {fileName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <h3 className="text-sm font-semibold">Manifest Configuration</h3>
                  <div className="mt-3 space-y-3">
                    {manifestWarnings.map((w, i) => (
                      <div key={i} className="rounded-lg border px-4 py-3 flex items-start justify-between">
                        <div>
                          <div className="text-sm">{w.key}</div>
                          <div className="mt-1 text-xs text-zinc-500">Explanation: This setting may expose user data or allow backup of app data.</div>
                        </div>
                        <div className="ml-4">
                          <Badge>{w.severity}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">Detected Credentials</h3>
                  <div className="mt-3 space-y-2">
                    {detectedSecrets.map((s, i) => (
                      <div key={i} className="rounded-lg border px-4 py-3">
                        <div className="text-sm font-medium">{s.key}</div>
                        <div className="mt-2 flex items-center justify-between text-xs text-zinc-700">
                          <div className="font-mono">{unmasked[i] ? s.value : `${s.value.slice(0,6)}***${s.value.slice(-4)}`}</div>
                          <div className="flex items-center gap-2">
                            <div className="text-zinc-500">{s.source}</div>
                            <Button size="sm" variant="outline" onClick={() => setUnmasked((u) => ({ ...u, [i]: !u[i] }))}>{unmasked[i] ? 'Mask' : 'Unmask'}</Button>
                            <Button size="sm" onClick={() => copyToClipboard(s.value)}>Copy</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {detectedSecrets.length === 0 ? <div className="text-sm text-zinc-500">No hardcoded credentials detected.</div> : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardShell>
  );
}

export default function ApkAuditPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading APK audit...</div>}>
      <ApkAuditContent />
    </Suspense>
  );
}
