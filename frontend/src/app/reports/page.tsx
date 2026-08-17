"use client";

import React, { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ReportsPage() {
  const [jobs, setJobs] = useState<{ id: string; target: string; createdAt: string }[]>([]);

  useEffect(() => {
    // placeholder: fetch recent jobs
    setJobs([
      { id: "scan_abcd123", target: "example.com", createdAt: new Date().toISOString() },
      { id: "scan_zxy987", target: "api.example.com", createdAt: new Date().toISOString() },
    ]);
  }, []);

  const exportJson = (id: string) => {
    // placeholder: fetch and trigger download
    const sample = { jobId: id, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = (id: string) => {
    // Simple printable HTML report - user can Save as PDF from print dialog
    const sample = { jobId: id, exportedAt: new Date().toISOString(), summary: { vulns: 25, critical: 3, high: 7 } };
    const html = `
      <html>
        <head>
          <title>Report ${id}</title>
          <style>body{font-family: Arial, Helvetica, sans-serif;padding:24px} h1{color:#0f172a}</style>
        </head>
        <body>
          <h1>Scan Report: ${id}</h1>
          <p>Target: ${sample.summary ? sample.summary : ''}</p>
          <pre>${JSON.stringify(sample, null, 2)}</pre>
        </body>
      </html>
    `;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      // Let user print/save as PDF
    } else {
      alert('Unable to open report window.');
    }
  };

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>History & Reports</CardTitle>
            <CardDescription>Recent scan and stress test jobs. Export reports as PDF / JSON.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobs.map((j) => (
                <div key={j.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <div className="font-semibold">{j.target}</div>
                    <div className="text-sm text-zinc-500">Job ID: <span className="font-mono">{j.id}</span> • {new Date(j.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => exportJson(j.id)}>Export JSON</Button>
                    <Button size="sm" variant="outline" onClick={() => exportPdf(j.id)}>Export PDF</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
