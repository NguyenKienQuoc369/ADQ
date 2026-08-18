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
          </div>
        </div>

        {/* placeholders removed */}
        
        {/* Priority list, current status, and recent activity removed per request */}
        {projectToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]" onClick={() => setProjectToDelete(null)} />
            <div className="relative z-[70] w-full max-w-xl rounded-[28px] border border-[color:var(--line)] bg-[color:var(--background-elevated)] p-6 shadow-[0_25px_80px_rgba(2,6,23,0.9)]">
              <div className="flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/10 text-rose-400 shadow-[0_0_25px_rgba(251,113,133,0.15)]">
                  <AlertTriangle className="h-7 w-7" />
                </div>
              </div>

              <div className="mt-5 text-center">
                <h3 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">Xóa dự án?</h3>
                <p className="mt-3 text-base leading-7 text-[var(--foreground-muted)]">
                  Bạn đang xóa dự án <span className="font-semibold text-[var(--foreground)]">{projectToDelete.name ?? projectToDelete.domain ?? projectToDelete.id}</span>.
                  <span className="mt-1 block">Hành động này sẽ xoá dữ liệu dự án khỏi database và không thể hoàn tác.</span>
                </p>
              </div>

              <div className="mt-7 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setProjectToDelete(null)}
                  disabled={deleting}
                  className="h-12 min-w-[120px] rounded-xl border border-[color:var(--line)] bg-[color:var(--background-muted)] text-[var(--foreground)] hover:bg-[color:var(--background-elevated)]"
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleDeleteProject}
                  disabled={deleting}
                  className="h-12 min-w-[170px] rounded-xl border border-rose-400/30 bg-rose-500/15 text-rose-300 shadow-[0_0_20px_rgba(251,113,133,0.12)] hover:bg-rose-500/20"
                >
                  {deleting ? "Đang xóa..." : "Xác nhận xóa"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {showNewProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowNewProject(false)} />
            <div className="relative z-50 w-full max-w-5xl rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-elevated)] p-6 text-[var(--foreground)] shadow-[0_20px_60px_rgba(2,6,23,0.8)]">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold tracking-[-0.04em] text-[var(--foreground)]">{newProjectStep === "setup" ? "Project setup" : "Select Project Type"}</h3>
                  <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                    {newProjectStep === "setup"
                      ? "Điền thông tin dự án trước, sau đó chọn module phù hợp để bắt đầu."
                      : "Choose a scanning module to initiate your security assessment."}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                  onClick={() => {
                    setShowNewProject(false);
                    setNewProjectStep("setup");
                    setNewProjectDraft({ name: "", projectInfo: "", password: "", domain: "" });
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {newProjectStep === "setup" ? (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="space-y-4 md:col-span-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Project name</label>
                      <Input
                        value={newProjectDraft.name}
                        onChange={(e) => setNewProjectDraft((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Stress Test Project"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Project info</label>
                      <Input
                        value={newProjectDraft.projectInfo}
                        onChange={(e) => setNewProjectDraft((prev) => ({ ...prev, projectInfo: e.target.value }))}
                        placeholder="Mô tả ngắn gọn về dự án, mục đích hoặc hợp đồng kiểm thử..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Domain / Target</label>
                    <Input
                      value={newProjectDraft.domain}
                      onChange={(e) => setNewProjectDraft((prev) => ({ ...prev, domain: e.target.value }))}
                      placeholder="app.example.com"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Project password (optional)</label>
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

