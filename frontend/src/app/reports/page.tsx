"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Download, Shield, LoaderCircle, ArrowRight, ExternalLink } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { getScanResults, ScanResult } from "@/lib/api";

export default function ReportsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getScanResults()
      .then((res) => {
        if (!active) return;
        setJobs(res);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Không thể tải danh sách phiên rà quét.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const exportJson = (scan: ScanResult) => {
    const blob = new Blob([JSON.stringify(scan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scan.target || scan.id}-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = (scan: ScanResult) => {
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Báo Cáo An Ninh - ${scan.target}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; color: #09090b; background: #fff; line-height: 1.6; }
            h1 { font-size: 22px; border-bottom: 2px solid #09090b; padding-bottom: 8px; margin-bottom: 16px; }
            .meta { font-size: 12px; color: #64748b; margin-bottom: 24px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: #f1f5f9; border: 1px solid #cbd5e1; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
            th { background: #f8fafc; font-weight: 600; }
          </style>
        </head>
        <body>
          <h1>Báo Cáo Rà Quét An Ninh & Kiểm Thử Hạ Tầng</h1>
          <div class="meta">
            <strong>Mục tiêu:</strong> ${scan.target} &bull; 
            <strong>Mã phiên:</strong> ${scan.id} &bull; 
            <strong>Trạng thái:</strong> ${scan.status} &bull; 
            <strong>Thời gian:</strong> ${new Date(scan.startedAt).toLocaleString("vi-VN")}
          </div>
          <h2>Tổng Hợp Lỗ Hổng (${scan.vulnerabilities?.length || 0})</h2>
          ${
            scan.vulnerabilities && scan.vulnerabilities.length > 0
              ? `<table>
                  <thead>
                    <tr><th>Mức độ</th><th>Lỗ hổng</th><th>Endpoint</th><th>Mô tả</th></tr>
                  </thead>
                  <tbody>
                    ${scan.vulnerabilities
                      .map(
                        (v) =>
                          `<tr><td><span class="badge">${v.severity}</span></td><td>${v.title}</td><td>${v.endpoint || "-"}</td><td>${v.description || "-"}</td></tr>`
                      )
                      .join("")}
                  </tbody>
                </table>`
              : `<p>Không phát hiện lỗ hổng an ninh nào trong phiên này.</p>`
          }
          <h2 style="margin-top: 24px">Tài Sản Sống & Subdomains (${scan.liveSubdomains?.length || 0})</h2>
          ${
            scan.liveSubdomains && scan.liveSubdomains.length > 0
              ? `<ul>${scan.liveSubdomains.map((h) => `<li><strong>${h.host}</strong> (${h.tech || "HTTP"})</li>`).join("")}</ul>`
              : `<p>Không có subdomain bổ sung nào được ghi nhận.</p>`
          }
        </body>
      </html>
    `;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => {
        w.print();
      }, 300);
    }
  };

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 font-sans text-[#ededed]">
        <div className="rounded-lg border border-[#222222] bg-[#000000] p-6">
          <div className="border-b border-[#222222] pb-4 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-white">Lịch Sử & Báo Cáo Xuất Bản</h1>
              <p className="text-xs text-neutral-400 mt-1">
                Lịch sử rà quét thực tế từ hạ tầng ADQ Security. Hỗ trợ trích xuất báo cáo JSON và in/lưu PDF.
              </p>
            </div>

            <Link href="/scan">
              <Button className="h-8 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm transition active:scale-[0.99] cursor-pointer">
                <Shield className="h-3.5 w-3.5 mr-1.5" /> Tạo Phiên Quét Mới
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400 gap-3">
              <LoaderCircle className="h-6 w-6 animate-spin text-white" />
              <p className="text-xs font-mono">Đang tải lịch sử phiên quét...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-md bg-rose-950/20 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#222222] bg-[#0a0a0a] mb-3">
                <FileText className="h-6 w-6 text-neutral-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Chưa có phiên rà quét nào</h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                Khi bạn khởi chạy các phiên rà quét DAST hoặc kiểm thử tải trên hệ thống, toàn bộ lịch sử và báo cáo phân tích sẽ tự động được lưu trữ tại đây.
              </p>
              <Link href="/scan" className="mt-4">
                <Button className="h-8 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm">
                  Bắt đầu phiên quét đầu tiên
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {jobs.map((j) => (
                <div
                  key={j.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md border border-[#222222] bg-[#0a0a0a] p-4 hover:border-neutral-700 transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{j.target}</span>
                      <span className="border border-neutral-700 bg-neutral-800 text-[10px] font-mono text-neutral-300 px-2 py-0.5 rounded-full">
                        {j.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono mt-1 flex flex-wrap items-center gap-3">
                      <span>ID: <span className="text-neutral-400">{j.id}</span></span>
                      <span>•</span>
                      <span>Bắt đầu: {new Date(j.startedAt).toLocaleString("vi-VN")}</span>
                      <span>•</span>
                      <span>{j.vulnerabilities?.length || 0} lỗ hổng</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => exportJson(j)}
                      className="h-7 text-xs border border-[#333333] bg-[#111111] hover:bg-neutral-800 text-white rounded-md cursor-pointer"
                    >
                      <Download className="h-3 w-3 mr-1" /> JSON
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportPdf(j)}
                      className="h-7 text-xs border border-[#333333] bg-[#111111] hover:bg-neutral-800 text-white rounded-md cursor-pointer"
                    >
                      <Download className="h-3 w-3 mr-1" /> PDF / In
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => router.push(`/dashboard/results`)}
                      className="h-7 text-xs bg-white hover:bg-neutral-200 text-black font-semibold rounded-md cursor-pointer"
                    >
                      Chi tiết <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

