"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, FileJson, FileText, Globe, KeyRound, LoaderCircle, LockKeyholeOpen, ShieldAlert, Sparkles } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { decodeBase64Value, exportReport, getScanResults } from "@/lib/api";
import { formatDateTime, getSeverityColor } from "@/lib/utils";

type ExportFormat = "json" | "html" | "markdown";

export function ResultsClient() {
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
    user?.packageTier === "FREE" ? ["markdown"] : ["json", "html", "markdown"];

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
            <CardTitle>Đọc kết quả theo cách đơn giản</CardTitle>
            <CardDescription>
              Chọn một lượt quét ở cột bên trái. Sau đó nhìn vào phần tóm tắt, danh sách cảnh báo và tải báo cáo nếu cần gửi cho người khác.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>Danh sách lượt quét</CardTitle>
              <CardDescription>Đây là nơi bạn chọn lần kiểm tra muốn xem lại.</CardDescription>
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
                          <Badge variant="muted">{scan.enabledTools.length} bước kiểm tra</Badge>
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
                      <SummaryBox label="Tên miền phụ đang hoạt động" value={String(selectedScan.liveSubdomains.length)} icon={Globe} />
                      <SummaryBox label="Cổng đang mở" value={String(selectedScan.portScan.length)} icon={ShieldAlert} />
                      <SummaryBox label="Cảnh báo đã tìm thấy" value={String(selectedScan.vulnerabilities.length)} icon={AlertTriangle} />
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
                <CardDescription>Phần này cho biết hệ thống đang thấy những địa chỉ nào còn mở và có thể truy cập được.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {selectedScan.liveSubdomains.map((item) => (
                    <div key={item.host} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-100">{item.host}</p>
                          <p className="text-sm text-slate-400">{item.ip}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={item.status === "LIVE" ? "success" : "warning"}>
                            {item.status === "LIVE" ? "Đang hoạt động" : item.status}
                          </Badge>
                          <Badge variant="muted">{item.tech}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="mb-3 text-sm font-medium text-slate-100">Các cổng đang mở</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {selectedScan.portScan.map((item) => (
                      <div key={`${item.port}-${item.service}`} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-100">{item.port}</span>
                          <Badge variant="warning">{item.service}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">{item.exposure}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="mb-3 text-sm font-medium text-slate-100">Các đường dẫn đã ghi nhận</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedScan.urlHistory.map((url) => (
                      <span key={url} className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                        {url}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Chuỗi dữ liệu nhạy cảm đáng chú ý</CardTitle>
                  <CardDescription>Đây là nơi hệ thống đánh dấu các khóa, token hoặc dữ liệu có vẻ quan trọng để bạn xem lại.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedScan.secretsHunter.length ? (
                    selectedScan.secretsHunter.map((item) => (
                      <div key={item.id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <KeyRound className="h-4 w-4 text-cyan-300" />
                              <p className="font-medium text-slate-100">{item.type}</p>
                            </div>
                            <p className="mt-2 break-all font-mono text-xs text-slate-300">{item.value}</p>
                          </div>
                          <Badge variant={item.encoded ? "warning" : "success"}>{item.confidence}%</Badge>
                        </div>
                        <p className="text-sm text-slate-400">Nguồn: {item.source}</p>
                        {item.encoded ? (
                          <div className="mt-3">
                            <Button variant="secondary" size="sm" onClick={() => setDecodedMap((prev) => ({ ...prev, [item.id]: decodeBase64Value(item.value) }))}>
                              <LockKeyholeOpen className="h-4 w-4" />
                              Giải mã nhanh Base64
                            </Button>
                            {decodedMap[item.id] ? (
                              <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                                {decodedMap[item.id]}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
                      Gói hiện tại hoặc phiên scan này chưa phát hiện secret nào đáng chú ý.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cảnh báo và gợi ý xử lý</CardTitle>
                  <CardDescription>Đọc phần này nếu bạn muốn biết vấn đề nằm ở đâu và nên trao đổi gì với đội kỹ thuật.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedScan.vulnerabilities.map((item) => {
                    const advice = selectedScan.actionAdvice.find((entry) => entry.vulnerabilityId === item.id);

                    return (
                      <div key={item.id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-medium text-slate-100">{item.title}</p>
                            <p className="mt-1 text-sm text-slate-400">
                              {item.asset} · {item.endpoint}
                            </p>
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-xs ${getSeverityColor(item.severity)}`}>
                            {item.severity} · CVSS {item.cvss}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-slate-300">{item.description}</p>
                        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-300">
                            <Sparkles className="h-4 w-4" />
                            Nên làm gì tiếp theo
                          </p>
                          <p className="text-sm text-slate-400">{advice?.rootCause ?? item.impact}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(advice?.remediation ?? [item.impact]).map((step) => (
                              <span key={step} className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                                {step}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
  if (status === "COMPLETED") return "Đã xong";
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
