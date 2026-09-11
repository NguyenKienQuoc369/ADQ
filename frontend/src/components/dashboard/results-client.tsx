"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, FileJson, FileText, Globe, KeyRound, LoaderCircle, LockKeyholeOpen, ShieldAlert, Sparkles, Bot } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { decodeBase64Value, exportReport, getScanResults } from "@/lib/api";
import { getEntitlements } from "@/lib/entitlements";
import { formatDateTime, getSeverityColor } from "@/lib/utils";

type ExportFormat = "json" | "html" | "markdown";

export function ResultsClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<Awaited<ReturnType<typeof getScanResults>>>([]);
  const [selectedScanId, setSelectedScanId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [decodedMap, setDecodedMap] = useState<Record<string, string>>({});

  const loadScans = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getScanResults();
      setData(response);
      setSelectedScanId((prev) => prev || response[0]?.id || "");
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Không thể tải kết quả scan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadScans();
  }, [authLoading, user]);

  const selectedScan = useMemo(() => data.find((item) => item.id === selectedScanId) ?? data[0] ?? null, [data, selectedScanId]);

  const availableFormats: ExportFormat[] =
    getEntitlements(user?.packageTier || "FREE").exportFormats;

  const downloadBlob = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (format: ExportFormat) => {
    if (!selectedScan) return;

    setExporting(format);
    try {
      const file = await exportReport(selectedScan.id, format);
      downloadBlob(file.filename, file.content, file.mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xuất báo cáo thất bại.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 font-sans text-[#ededed]">
        <div className="rounded-lg border border-[#222222] bg-[#000000] p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-white">Báo cáo & Kết quả chi tiết</h1>
              <p className="text-xs text-neutral-400 mt-1">
                Xem phân tích chi tiết lỗ hổng, danh mục tài sản và hành động gợi ý tự động từ AI.
              </p>
            </div>
            {selectedScan ? (
              <Button
                onClick={() => router.push(`/copilot?jobId=${selectedScan.id}&target=${encodeURIComponent(selectedScan.target)}`)}
                className="h-8 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm transition active:scale-[0.99] cursor-pointer"
              >
                <Bot className="mr-1.5 h-4 w-4" /> Hỏi Copilot về phiên này
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg border border-[#222222] bg-[#000000] p-6 space-y-4">
            <div className="border-b border-[#222222] pb-3">
              <h2 className="text-base font-semibold text-white">Danh sách lượt quét</h2>
              <p className="text-xs text-neutral-400 mt-0.5">Chọn phiên quét đã thực hiện để xem phân tích.</p>
            </div>

            {loading ? (
              Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-md bg-[#111111]" />)
            ) : error ? (
              <div className="rounded-md border border-rose-950/40 bg-rose-950/10 p-6 text-center space-y-3">
                <p className="text-xs text-rose-400 font-mono">{error}</p>
                <Button
                  onClick={loadScans}
                  variant="outline"
                  className="h-8 text-xs bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-700"
                >
                  Thử lại
                </Button>
              </div>
            ) : data.length ? (
              <>
                <Select
                  value={selectedScanId}
                  onChange={(event) => setSelectedScanId(event.target.value)}
                  className="h-9 bg-[#0a0a0a] border-[#333333] text-white text-xs rounded-md"
                >
                  {data.map((scan) => (
                    <option key={scan.id} value={scan.id}>
                      {scan.target} · {translateStatus(scan.status)}
                    </option>
                  ))}
                </Select>

                <div className="space-y-2.5">
                  {data.map((scan) => (
                    <button
                      key={scan.id}
                      type="button"
                      onClick={() => setSelectedScanId(scan.id)}
                      className={`w-full rounded-md border p-3.5 text-left transition cursor-pointer ${
                        selectedScan?.id === scan.id
                          ? "border-white bg-[#111111]"
                          : "border-[#222222] bg-[#0a0a0a] hover:border-neutral-700"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-white">{scan.target}</p>
                          <p className="text-[11px] text-neutral-500 font-mono mt-0.5">{formatDateTime(scan.startedAt)}</p>
                        </div>
                        <span className="border border-neutral-700 bg-neutral-800 text-white font-mono text-[10px] px-2 py-0.5 rounded-full">
                          {translateStatus(scan.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="border border-neutral-800 bg-neutral-900 text-neutral-400 font-mono text-[10px] px-2 py-0.5 rounded-full">
                          {scan.planUsed.replace("_", " ")}
                        </span>
                        <span className="border border-neutral-800 bg-neutral-900 text-neutral-400 font-mono text-[10px] px-2 py-0.5 rounded-full">
                          {scan.liveSubdomains.length} host live
                        </span>
                        <span className="border border-neutral-800 bg-neutral-900 text-neutral-400 font-mono text-[10px] px-2 py-0.5 rounded-full">
                          {scan.vulnerabilities.length} cảnh báo
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-6 text-xs text-neutral-500 font-mono text-center">
                Chưa có phiên quét nào trong workspace.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[#222222] bg-[#000000] p-6 space-y-5">
            <div className="border-b border-[#222222] pb-3">
              <h2 className="text-base font-semibold text-white">Tải báo cáo</h2>
              <p className="text-xs text-neutral-400 mt-0.5">Chọn định dạng phù hợp để lưu lại hoặc gửi cho đội kỹ thuật.</p>
            </div>

            {selectedScan ? (
              <>
                <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-white">{selectedScan.target}</p>
                      <p className="text-xs text-neutral-500 font-mono">ID: {selectedScan.id}</p>
                    </div>
                    <div className="text-right">
                      <span className="border border-neutral-700 bg-neutral-800 text-white font-mono text-[10px] px-2 py-0.5 rounded-full">
                        {translateStatus(selectedScan.status)}
                      </span>
                      <p className="mt-1 text-[11px] text-neutral-500 font-mono">{formatDateTime(selectedScan.startedAt)}</p>
                    </div>
                  </div>

                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
                    <SummaryBox label="Tên miền phụ" value={String(selectedScan.liveSubdomains.length)} icon={Globe} />
                    <SummaryBox label="Cổng đang mở" value={String(selectedScan.portScan.length)} icon={ShieldAlert} />
                    <SummaryBox label="Lỗ hổng" value={String(selectedScan.vulnerabilities.length)} icon={AlertTriangle} />
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-3">
                  {availableFormats.map((format) => (
                    <Button
                      key={format}
                      variant="outline"
                      disabled={Boolean(exporting)}
                      onClick={() => handleExport(format)}
                      className="h-8 border-[#333333] bg-[#111111] hover:bg-neutral-800 text-xs text-white rounded-md cursor-pointer"
                    >
                      {exporting === format ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : format === "json" ? (
                        <FileJson className="h-3.5 w-3.5 mr-1.5" />
                      ) : format === "html" ? (
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {format === "json" ? "Xuất JSON" : format === "html" ? "Xuất HTML" : "Xuất Markdown"}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <Skeleton className="h-48 rounded-lg bg-[#111111]" />
            )}

            {error ? (
              <div className="rounded-md border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-xs text-rose-300">{error}</div>
            ) : null}
          </div>
        </div>

        {selectedScan ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-lg border border-[#222222] bg-[#000000] p-6 space-y-4">
              <div className="border-b border-[#222222] pb-3">
                <h2 className="text-base font-semibold text-white">Dịch vụ & Host đang hoạt động</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Danh sách subdomains và cổng dịch vụ đã phát hiện.</p>
              </div>

              <div className="space-y-2">
                {selectedScan.liveSubdomains.map((item, idx) => (
                  <div key={idx} className="rounded-md border border-[#222222] bg-[#0a0a0a] p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-white">{typeof item === 'string' ? item : item.host}</p>
                      <p className="text-[11px] text-neutral-500 font-mono">{typeof item === 'string' ? 'Active' : item.ip}</p>
                    </div>
                    <span className="border border-neutral-700 bg-neutral-800 text-white font-mono text-[10px] px-2 py-0.5 rounded-full">
                      Live
                    </span>
                  </div>
                ))}
                {selectedScan.liveSubdomains.length === 0 ? (
                  <div className="text-xs text-neutral-500 font-mono">Không có subdomain live nào.</div>
                ) : null}
              </div>

              <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-3.5">
                <p className="mb-2 text-xs font-semibold text-white">Các cổng đang mở</p>
                <div className="grid gap-2 grid-cols-2">
                  {selectedScan.portScan.map((item: any, idx) => (
                    <div key={idx} className="rounded border border-[#222222] bg-[#000000] px-3 py-2 flex items-center justify-between">
                      <span className="text-xs font-mono text-white">{typeof item === 'object' ? item.port : item}</span>
                      <span className="text-[10px] font-mono text-neutral-400">{typeof item === 'object' ? item.service : 'Open'}</span>
                    </div>
                  ))}
                  {selectedScan.portScan.length === 0 ? <div className="text-xs text-neutral-500 font-mono">Chưa ghi nhận cổng mở.</div> : null}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Action Advice Box */}
              <div className="rounded-lg border border-[#222222] bg-[#000000] p-6 space-y-3">
                <div className="border-b border-[#222222] pb-3">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-white" /> Khuyến nghị từ AI
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Đánh giá nguyên nhân gốc rễ và hành động khắc phục.</p>
                </div>

                {selectedScan.actionAdvice && selectedScan.actionAdvice.length > 0 ? (
                  selectedScan.actionAdvice.map((advice, idx) => (
                    <div key={idx} className="rounded-md border border-[#222222] bg-[#0a0a0a] p-3">
                      <p className="text-xs text-neutral-300 leading-relaxed">{advice.rootCause}</p>
                    </div>
                  ))
                ) : selectedScan.rawActionAdvice ? (
                  <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-3 text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed">
                    {selectedScan.rawActionAdvice}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500 font-mono">Không có khuyến nghị cho phiên này.</div>
                )}
              </div>

              {/* Vulnerabilities Box */}
              <div className="rounded-lg border border-[#222222] bg-[#000000] p-6 space-y-3">
                <div className="border-b border-[#222222] pb-3">
                  <h2 className="text-base font-semibold text-white">Cảnh báo lỗ hổng</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Danh sách phát hiện từ Nuclei engine.</p>
                </div>

                <div className="space-y-2.5">
                  {selectedScan.vulnerabilities.map((item, idx) => (
                    <div key={idx} className="rounded-md border border-[#222222] bg-[#0a0a0a] p-3.5">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-xs font-semibold text-white">{item.title}</p>
                        <span className="border border-rose-500/40 bg-rose-950/30 text-rose-300 font-mono text-[10px] px-1.5 py-0.2 rounded">
                          {item.severity || "MEDIUM"}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 font-mono">{item.endpoint}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/copilot?vuln=${encodeURIComponent(item.title)}&endpoint=${encodeURIComponent(item.endpoint)}`)}
                        className="mt-2.5 h-7 text-[11px] border-[#333333] hover:bg-neutral-800 text-white rounded-md"
                      >
                        Sinh mã vá One-Click
                      </Button>
                    </div>
                  ))}
                  {selectedScan.vulnerabilities.length === 0 ? (
                    <div className="text-xs text-neutral-500 font-mono">Không tìm thấy lỗ hổng trực tiếp.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}

function translateStatus(status: string) {
  if (status === "RUNNING") return "Đang quét";
  if (status === "QUEUED") return "Đang chờ";
  if (status === "COMPLETED" || status === "DONE") return "Đã xong";
  return status;
}

function SummaryBox({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Globe;
}) {
  return (
    <div className="rounded-md border border-[#222222] bg-[#000000] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase font-mono text-neutral-500">{label}</span>
        <Icon className="h-3.5 w-3.5 text-neutral-400" />
      </div>
      <p className="text-xl font-bold font-mono text-white">{value}</p>
    </div>
  );
}
