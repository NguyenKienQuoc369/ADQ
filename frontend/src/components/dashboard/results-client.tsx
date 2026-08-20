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
  const { user } = useAuth();
  const [data, setData] = useState<Awaited<ReturnType<typeof getScanResults>>>([]);
  const [selectedScanId, setSelectedScanId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [decodedMap, setDecodedMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    getScanResults()
      .then((response) => {
        if (!active) return;
        setData(response);
        setSelectedScanId(response[0]?.id ?? "");
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Không thể tải kết quả scan.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

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
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Báo cáo & Kết quả chi tiết</CardTitle>
                <CardDescription>
                  Xem phân tích chi tiết lỗ hổng, danh mục tài sản và hành động gợi ý tự động từ AI.
                </CardDescription>
              </div>
              {selectedScan ? (
                <Button
                  onClick={() => router.push(`/copilot?jobId=${selectedScan.id}&target=${encodeURIComponent(selectedScan.target)}`)}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  <Bot className="mr-2 h-4 w-4" /> Hỏi Copilot về phiên này
                </Button>
              ) : null}
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>Danh sách lượt quét</CardTitle>
              <CardDescription>Chọn phiên quét đã thực hiện để xem phân tích.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)
              ) : data.length ? (
                <>
                  <Select value={selectedScanId} onChange={(event) => setSelectedScanId(event.target.value)}>
                    {data.map((scan) => (
                      <option key={scan.id} value={scan.id}>
                        {scan.target} · {translateStatus(scan.status)}
                      </option>
                    ))}
                  </Select>

                  <div className="space-y-3">
                    {data.map((scan) => (
                      <button
                        key={scan.id}
                        type="button"
                        onClick={() => setSelectedScanId(scan.id)}
                        className={`w-full rounded-3xl border p-4 text-left transition ${
                          selectedScan?.id === scan.id
                            ? "border-cyan-500/25 bg-cyan-500/10"
                            : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900"
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-100">{scan.target}</p>
                            <p className="text-sm text-slate-400">{formatDateTime(scan.startedAt)}</p>
                          </div>
                          <Badge variant={scan.status === "RUNNING" ? "success" : scan.status === "QUEUED" ? "warning" : "default"}>
                            {translateStatus(scan.status)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="muted">{scan.planUsed.replace("_", " ")}</Badge>
                          <Badge variant="muted">{scan.liveSubdomains.length} host live</Badge>
                          <Badge variant="muted">{scan.vulnerabilities.length} cảnh báo</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
                  Chưa có phiên quét nào trong workspace.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tải báo cáo</CardTitle>
              <CardDescription>Chọn định dạng phù hợp để lưu lại hoặc gửi cho đội kỹ thuật.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {selectedScan ? (
                <>
                  <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-slate-50">{selectedScan.target}</p>
                        <p className="text-sm text-slate-400">Mã lượt quét: {selectedScan.id}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="success">{translateStatus(selectedScan.status)}</Badge>
                        <p className="mt-2 text-xs text-slate-500">Bắt đầu lúc {formatDateTime(selectedScan.startedAt)}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <SummaryBox label="Tên miền phụ hoạt động" value={String(selectedScan.liveSubdomains.length)} icon={Globe} />
                      <SummaryBox label="Cổng đang mở" value={String(selectedScan.portScan.length)} icon={ShieldAlert} />
                      <SummaryBox label="Cảnh báo phát hiện" value={String(selectedScan.vulnerabilities.length)} icon={AlertTriangle} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {availableFormats.map((format) => (
                      <Button key={format} variant={format === "markdown" ? "secondary" : "default"} disabled={Boolean(exporting)} onClick={() => handleExport(format)}>
                        {exporting === format ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : format === "json" ? (
                          <FileJson className="h-4 w-4" />
                        ) : format === "html" ? (
                          <Download className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        {format === "json" ? "JSON" : format === "html" ? "HTML" : "Markdown"}
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                <Skeleton className="h-64 rounded-3xl" />
              )}

              {error ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {selectedScan ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Website và dịch vụ đang hoạt động</CardTitle>
                <CardDescription>Danh sách subdomains và cổng dịch vụ đã phát hiện.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {selectedScan.liveSubdomains.map((item, idx) => (
                    <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-100">{typeof item === 'string' ? item : item.host}</p>
                          <p className="text-sm text-slate-400">{typeof item === 'string' ? 'Active' : item.ip}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="success">Đang hoạt động</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                  {selectedScan.liveSubdomains.length === 0 ? (
                    <div className="text-sm text-slate-400">Không có subdomain live nào.</div>
                  ) : null}
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="mb-3 text-sm font-medium text-slate-100">Các cổng đang mở</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {selectedScan.portScan.map((item: any, idx) => (
                      <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-100">{typeof item === 'object' ? item.port : item}</span>
                          <Badge variant="warning">{typeof item === 'object' ? item.service : 'Open'}</Badge>
                        </div>
                      </div>
                    ))}
                    {selectedScan.portScan.length === 0 ? <div className="text-xs text-slate-500">Chưa ghi nhận cổng mở.</div> : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              {/* Action Advice Box */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-400" /> AI Action Advice & Khuyến nghị
                  </CardTitle>
                  <CardDescription>Đánh giá nguyên nhân gốc rễ và hành động khắc phục.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedScan.actionAdvice && selectedScan.actionAdvice.length > 0 ? (
                    selectedScan.actionAdvice.map((advice, idx) => (
                      <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                        <p className="text-sm text-slate-200">{advice.rootCause}</p>
                      </div>
                    ))
                  ) : selectedScan.rawActionAdvice ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300 whitespace-pre-wrap">
                      {selectedScan.rawActionAdvice}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400">Không có khuyến nghị cho phiên này.</div>
                  )}
                </CardContent>
              </Card>

              {/* Vulnerabilities Box */}
              <Card>
                <CardHeader>
                  <CardTitle>Cảnh báo lỗ hổng</CardTitle>
                  <CardDescription>Danh sách phát hiện từ Nuclei engine.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedScan.vulnerabilities.map((item, idx) => (
                    <div key={idx} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-medium text-slate-100">{item.title}</p>
                        <Badge variant="danger">{item.severity || "MEDIUM"}</Badge>
                      </div>
                      <p className="text-xs text-slate-400">{item.endpoint}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/copilot?vuln=${encodeURIComponent(item.title)}&endpoint=${encodeURIComponent(item.endpoint)}`)}
                        className="mt-3 border-cyan-500/40 text-cyan-300"
                      >
                        Sinh mã vá One-Click
                      </Button>
                    </div>
                  ))}
                  {selectedScan.vulnerabilities.length === 0 ? (
                    <div className="text-sm text-slate-400">Không tìm thấy lỗ hổng trực tiếp.</div>
                  ) : null}
                </CardContent>
              </Card>
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
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10">
        <Icon className="h-4 w-4 text-cyan-300" />
      </div>
      <p className="text-2xl font-semibold text-slate-50">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
  );
}
