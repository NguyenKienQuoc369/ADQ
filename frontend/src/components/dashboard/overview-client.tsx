"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Boxes, Globe, Target, Trash2, X } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardOverview, getScanResults, getProjects, createProject, deleteProject, type ScanResult } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";


export function OverviewClient() {
  const { user, updateUser } = useAuth();
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardOverview>> | null>(null);
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectStep, setNewProjectStep] = useState<"setup" | "module">("setup");
  const [newProjectDraft, setNewProjectDraft] = useState({
    name: "",
    projectInfo: "",
    password: "",
    domain: "",
  });
  const [projectToDelete, setProjectToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    let active = true;

    Promise.all([getDashboardOverview(), getScanResults()])
      .then(([overviewResponse, scanResponse]) => {
        if (!active) return;
        setData(overviewResponse);
        setScans(scanResponse);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Không thể tải dashboard.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo(() => {
    if (!data) return [];
    return [
      { icon: Target, title: data.metrics.totalTargets.label, value: data.metrics.totalTargets.value, change: data.metrics.totalTargets.change },
      { icon: AlertTriangle, title: data.metrics.totalVulnerabilities.label, value: data.metrics.totalVulnerabilities.value, change: data.metrics.totalVulnerabilities.change },
      { icon: Boxes, title: data.metrics.totalAssets.label, value: data.metrics.totalAssets.value, change: data.metrics.totalAssets.change },
      { icon: Globe, title: data.metrics.subdomains.label, value: data.metrics.subdomains.value, change: data.metrics.subdomains.change },
    ];
  }, [data]);

  const latestScan = scans[0] ?? null;

  const [projects, setProjects] = useState<any[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    getProjects().then((rows) => {
      if (!active) return;
      setProjects(rows);
    }).catch(() => setProjects([]));

    return () => { active = false };
  }, []);

  const projectList = loading ? [] : (projects ?? (scans.length ? scans : []));

  const projectSummary = useMemo(() => {
    const totals = (projects ?? []).reduce(
      (acc, project) => {
        const summary = project?.projectDetail?.summary ?? {};
        acc.critical += Number(summary.critical ?? 0);
        acc.high += Number(summary.high ?? 0);
        acc.medium += Number(summary.medium ?? 0);
        return acc;
      },
      { critical: 0, high: 0, medium: 0 },
    );

    return {
      ...totals,
      max: Math.max(totals.critical, totals.high, totals.medium, 1),
    };
  }, [projects]);

  const handleDeleteProject = async () => {
    if (!projectToDelete?.id) return;
    setDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      setProjects((prev) => (prev ? prev.filter((item) => item.id !== projectToDelete.id) : prev));
      setProjectToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateNewProject = async (module: "scan" | "apk-audit" | "stress-test") => {
    const payload = {
      name: newProjectDraft.name.trim() || "Unnamed Project",
      domain: newProjectDraft.domain.trim() || undefined,
      description: newProjectDraft.projectInfo.trim(),
      password: newProjectDraft.password.trim(),
      module,
    };

    try {
      const project = await createProject(payload);
      setShowNewProject(false);
      setNewProjectStep("setup");
      setNewProjectDraft({ name: "", projectInfo: "", password: "", domain: "" });
      router.push(`/${module === "scan" ? "scan" : module === "apk-audit" ? "apk-audit" : "stress-test"}?projectId=${encodeURIComponent(project.id || project.domain)}`);
    } catch (err) {
      console.error(err);
      alert("Không thể tạo project mới.");
    }
  };

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Quét bảo mật dự án</h2>
            <p className="text-sm text-[var(--foreground-muted)]">Quản lý và theo dõi các lỗ hổng bảo mật trong dự án của bạn.</p>
          </div>
          <div className="flex items-center gap-3">
            <Input placeholder="Tìm kiếm dự án, domain..." className="w-[480px]" />
            <Button variant="outline">Filter</Button>
            <Button onClick={() => setShowNewProject(true)}>New Project</Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projectList.length === 0 && loading
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
                : projectList.map((p: any) => (
                    <Card key={p.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 font-semibold">{(() => { const nm = (p.name ?? p.domain ?? p.id ?? ""); const seg = nm.split("_")[0] || nm; return ((seg && seg[0]) ? seg[0].toUpperCase() : "?"); })()}</div>
                                <div>
                                  <p className="font-medium line-clamp-1">{p.name ?? p.domain ?? p.id}</p>
                                  <p className="text-xs text-[var(--foreground-muted)]">{p.url ?? p.domain ?? ""}</p>
                                </div>
                              </div>
                              <div className="text-xs text-[var(--foreground-muted)]">{p.lastScan ?? "Chưa quét"}</div>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-rose-500">{p.critical ?? 0} Cr</span>
                                <span className="text-orange-500">{p.high ?? 0} Hi</span>
                                <span className="text-yellow-500">{p.medium ?? 0} Med</span>
                              </div>
                              <div>
                                {p.status === 'running' ? (
                                  <Badge variant="warning">Đang quét...</Badge>
                                ) : p.status === 'ok' ? (
                                  <Badge variant="success">Đã quét thành công</Badge>
                                ) : p.status === 'risk' ? (
                                  <Badge variant="danger">Phát hiện rủi ro</Badge>
                                ) : (
                                  <Badge variant="muted">Trạng thái</Badge>
                                )}
                              </div>
                            </div>

                            <div className="mt-4 flex items-center justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/projects/${encodeURIComponent(p.id)}`)}>
                                Xem chi tiết
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setProjectToDelete(p)}
                                className="gap-1.5"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Xóa
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
            </div>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-[2rem] font-bold tracking-[-0.04em] text-[#111827]">Tóm tắt lỗ hổng</CardTitle>
                <CardDescription className="text-base text-[#4b5563]">Chi tiết mức độ nghiêm trọng</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-base text-[#111827]">
                      Phát hiện <span className="font-semibold">{projectSummary.critical}</span> lỗ hổng nghiêm trọng
                    </p>

                    {[
                      { label: "Nghiêm trọng (Critical)", value: projectSummary.critical, color: "#f43f5e" },
                      { label: "Cao (High)", value: projectSummary.high, color: "#f97316" },
                      { label: "Trung bình (Medium)", value: projectSummary.medium, color: "#facc15" },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="mt-4 flex items-center justify-between text-sm text-[#111827]">
                          <span>{item.label}</span>
                          <span className="font-semibold" style={{ color: item.color }}>{item.value}</span>
                        </div>
                        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max((item.value / projectSummary.max) * 100, item.value > 0 ? 6 : 0)}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <Button size="sm" className="bg-[#d7edf6] text-[#0f172a] hover:bg-[#c9e8f5]">Khắc phục</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cảnh báo bảo mật mới nhất</CardTitle>
                <CardDescription>Nhận cảnh báo tự động</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-[var(--foreground-muted)]">Tự động theo dõi dự án của bạn để phát hiện lỗ hổng và nhận thông báo.</div>
                <div className="mt-3">
                  <Button variant="outline">Nâng cấp Pro</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* placeholders removed */}
        
        {/* Priority list, current status, and recent activity removed per request */}
        {projectToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={() => setProjectToDelete(null)} />
            <div className="relative z-[70] w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/10">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-slate-900">Xóa dự án?</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Bạn đang xóa dự án <span className="font-semibold text-slate-800">{projectToDelete.name ?? projectToDelete.domain ?? projectToDelete.id}</span>.
                    Hành động này sẽ xoá dữ liệu dự án khỏi database và không thể hoàn tác.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <Button variant="outline" onClick={() => setProjectToDelete(null)} disabled={deleting}>Hủy</Button>
                <Button variant="destructive" onClick={handleDeleteProject} disabled={deleting}>
                  {deleting ? "Đang xóa..." : "Xác nhận xóa"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {showNewProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowNewProject(false)} />
            <div className="relative z-50 w-full max-w-5xl rounded-2xl bg-[color:var(--background-elevated)] p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold tracking-[-0.04em] text-slate-900">{newProjectStep === "setup" ? "Project setup" : "Select Project Type"}</h3>
                  <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                    {newProjectStep === "setup"
                      ? "Điền thông tin dự án trước, sau đó chọn module phù hợp để bắt đầu."
                      : "Choose a scanning module to initiate your security assessment."}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => {
                  setShowNewProject(false);
                  setNewProjectStep("setup");
                  setNewProjectDraft({ name: "", projectInfo: "", password: "", domain: "" });
                }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {newProjectStep === "setup" ? (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="space-y-4 md:col-span-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Project name</label>
                      <Input
                        value={newProjectDraft.name}
                        onChange={(e) => setNewProjectDraft((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Stress Test Project"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Project info</label>
                      <Input
                        value={newProjectDraft.projectInfo}
                        onChange={(e) => setNewProjectDraft((prev) => ({ ...prev, projectInfo: e.target.value }))}
                        placeholder="Mô tả ngắn gọn về dự án, mục đích hoặc hợp đồng kiểm thử..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Domain / Target</label>
                    <Input
                      value={newProjectDraft.domain}
                      onChange={(e) => setNewProjectDraft((prev) => ({ ...prev, domain: e.target.value }))}
                      placeholder="app.example.com"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Project password (optional)</label>
                    <Input
                      type="password"
                      value={newProjectDraft.password}
                      onChange={(e) => setNewProjectDraft((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Nếu dự án yêu cầu mật khẩu truy cập"
                    />
                  </div>

                  <div className="md:col-span-2 flex justify-end">
                    <Button onClick={() => setNewProjectStep("module")} disabled={!newProjectDraft.name.trim()}>
                      Tiếp tục →
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-3">
                  <Card>
                    <CardContent className="flex flex-col gap-3">
                      <div className="h-10 w-10 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600">🔎</div>
                      <h4 className="font-semibold">Web & Network Scan</h4>
                      <p className="text-sm text-[var(--foreground-muted)]">Quét lỗ hổng, Recon và phân tích chuỗi tấn công toàn diện trên bề mặt mạng và ứng dụng web.</p>
                      <div className="mt-4">
                        <Button onClick={() => handleCreateNewProject("scan")}>Bắt đầu →</Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="flex flex-col gap-3">
                      <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">📱</div>
                      <h4 className="font-semibold">Mobile APK Audit</h4>
                      <p className="text-sm text-[var(--foreground-muted)]">Kiểm toán mã nguồn APK, phát hiện Hardcoded Secrets và phân tích cấu hình Manifest Android.</p>
                      <div className="mt-4">
                        <Button variant="outline" onClick={() => handleCreateNewProject("apk-audit")}>Bắt đầu →</Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="flex flex-col gap-3">
                      <div className="h-10 w-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">⚡</div>
                      <h4 className="font-semibold">L7 Stress Test</h4>
                      <p className="text-sm text-[var(--foreground-muted)]">Kiểm thử khả năng chịu tải, phân tích Rate Limit và đánh giá cấu hình WAF Bypass.</p>
                      <div className="mt-4">
                        <Button variant="destructive" onClick={() => handleCreateNewProject("stress-test")}>Bắt đầu →</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}

