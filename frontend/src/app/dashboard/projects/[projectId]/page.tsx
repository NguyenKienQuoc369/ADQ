"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { deleteProject, getProjectById, saveProjectDetail } from "@/lib/api";

export default function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string>("");
  const [project, setProject] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const resolved = await params;
      if (!active) return;
      setProjectId(resolved.projectId);
      const projectData = await getProjectById(resolved.projectId);
      setProject(projectData);
      setDetail(projectData?.projectDetail ?? null);
      setLoading(false);
    })().catch(() => setLoading(false));

    return () => { active = false; };
  }, [params]);

  const updateSummary = async () => {
    if (!projectId) return;
    const payload = {
      title: detail?.title ?? project?.projectDetail?.title ?? project?.domain ?? "Project",
      description: detail?.description ?? `Project detail for ${project?.domain ?? "target"}`,
      module: detail?.module ?? "dashboard",
      status: detail?.status ?? "ACTIVE",
      riskScore: detail?.riskScore ?? 78,
      summary: detail?.summary ?? {
        subdomains: 12,
        liveHosts: 8,
        crawledUrls: 540,
        openPorts: 24,
        critical: 3,
        high: 7,
        medium: 15,
      },
      lastScanAt: detail?.lastScanAt ?? new Date().toISOString(),
    };

    const result = await saveProjectDetail(projectId, payload);
    setDetail(result);
  };

  const handleDelete = async () => {
    if (!projectId) return;
    const confirmed = window.confirm("Bạn có chắc muốn xóa dự án này khỏi database?");
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteProject(projectId);
      router.push("/dashboard");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <DashboardShell area="dashboard"><div className="p-6 text-sm text-zinc-500">Loading project details...</div></DashboardShell>;
  }

  if (!project) {
    return <DashboardShell area="dashboard"><div className="p-6 text-sm text-red-500">Project not found.</div></DashboardShell>;
  }

  const summary = detail?.summary ?? {
    subdomains: 0,
    liveHosts: 0,
    crawledUrls: 0,
    openPorts: 0,
    critical: 0,
    high: 0,
    medium: 0,
  };

  const displayTitle = detail?.title ?? project?.projectDetail?.title ?? project.domain;
  const displayDomain = project.domain ?? "";

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 text-[var(--foreground)]">
        <div className="rounded-[24px] border border-[color:var(--line)] bg-[color:var(--background-elevated)] p-4 md:p-6">
          <div className="mb-6 flex flex-col gap-4 border-b border-[color:var(--line)] pb-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 text-xl font-bold tracking-[-0.06em] text-cyan-200">
                {displayTitle?.slice(0, 2).toLowerCase() || "aa"}
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--foreground-muted)]">Security assets</div>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-[var(--foreground)] md:text-4xl">
                  {displayTitle}
                </h2>
                <p className="mt-1 text-sm text-[var(--foreground-muted)]">{displayDomain}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={updateSummary}
                className="h-11 rounded-xl border border-[color:var(--line)] bg-[color:var(--background-muted)] text-[var(--foreground)] hover:bg-[color:var(--background)]"
              >
                Lưu/tải chi tiết
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                className="h-11 rounded-xl border border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15"
              >
                {deleting ? "Đang xóa..." : "Xóa dự án"}
              </Button>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.65fr_0.95fr]">
            <div className="space-y-6">
              <Card className="border border-[color:var(--line)] bg-[color:var(--background)] shadow-none">
                <CardHeader className="pb-4">
                  <CardTitle className="text-[2rem] font-semibold tracking-[-0.06em] text-[var(--foreground)]">Summary</CardTitle>
                  <CardDescription className="text-base text-[var(--foreground-muted)]">Thông tin tổng quan dự án</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: "Subdomains", value: summary.subdomains },
                      { label: "Live hosts", value: summary.liveHosts },
                      { label: "Crawled URLs", value: summary.crawledUrls },
                      { label: "Open ports", value: summary.openPorts },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-elevated)] p-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.04)]">
                        <div className="text-sm text-[var(--foreground-muted)]">{item.label}</div>
                        <div className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-[color:var(--line)] bg-[color:var(--background)] shadow-none">
                <CardHeader className="pb-4">
                  <CardTitle className="text-[2rem] font-semibold tracking-[-0.06em] text-[var(--foreground)]">Vulnerability</CardTitle>
                  <CardDescription className="text-base text-[var(--foreground-muted)]">Thông tin mức độ rủi ro</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "Critical", value: summary.critical, color: "#f87171", width: `${Math.min(summary.critical * 18, 100)}%` },
                    { label: "High", value: summary.high, color: "#fbbf24", width: `${Math.min(summary.high * 14, 100)}%` },
                    { label: "Medium", value: summary.medium, color: "#60a5fa", width: `${Math.min(summary.medium * 10, 100)}%` },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="mb-2 flex items-center justify-between text-base font-medium text-[var(--foreground)]">
                        <span>{item.label}</span>
                        <span style={{ color: item.color }}>{item.value}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[color:var(--background-elevated)]">
                        <div className="h-full rounded-full" style={{ width: item.width, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border border-[color:var(--line)] bg-[color:var(--background)] shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-[2rem] font-semibold tracking-[-0.06em] text-[var(--foreground)]">Project metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-base text-[var(--foreground)]">
                  <div className="flex items-center justify-between gap-4"><span className="text-[var(--foreground-muted)]">Status</span><span className="font-medium uppercase text-[var(--foreground)]">{detail?.status ?? "ACTIVE"}</span></div>
                  <div className="flex items-center justify-between gap-4"><span className="text-[var(--foreground-muted)]">Module</span><span className="font-medium text-[var(--foreground)]">{detail?.module ?? "dashboard"}</span></div>
                  <div className="flex items-center justify-between gap-4"><span className="text-[var(--foreground-muted)]">Risk score</span><span className="font-medium text-[var(--foreground)]">{detail?.riskScore ?? 78}</span></div>
                  <div className="flex items-center justify-between gap-4"><span className="text-[var(--foreground-muted)]">Last scan</span><span className="font-medium text-[var(--foreground)]">{detail?.lastScanAt ? new Date(detail.lastScanAt).toLocaleString() : "Not available"}</span></div>
                </CardContent>
              </Card>

              <Card className="border border-[color:var(--line)] bg-[color:var(--background)] shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-[2rem] font-semibold tracking-[-0.06em] text-[var(--foreground)]">Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-3 pl-5 text-base leading-7 text-[var(--foreground)]">
                    <li>Enable rate limiting on public endpoints.</li>
                    <li>Patch critical authentication and input validation flaws.</li>
                    <li>Rotate exposed secrets and restrict origin access.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
