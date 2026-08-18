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
      <div className="space-y-6 bg-[#edf3f7] p-2 md:p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-4xl font-black tracking-[-0.06em] text-[#101828]">{displayTitle}</h2>
            <p className="mt-1 text-base text-[#475467]">{displayDomain}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={updateSummary}
              className="h-11 rounded-xl border border-[#d0d5dd] bg-[#111827] text-white hover:bg-[#1f2937]"
            >
              Lưu/tải chi tiết
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="h-11 rounded-xl border border-rose-300/40 bg-[#f7d5db] text-[#b42318] hover:bg-[#f9c7cf]"
            >
              {deleting ? "Đang xóa..." : "Xóa dự án"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
          <div className="space-y-6">
            <Card className="border border-[#1f2d3d] bg-[#1f2d3d] shadow-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-[2rem] font-bold tracking-[-0.05em] text-white">Summary</CardTitle>
                <CardDescription className="text-base text-slate-300">Thông tin tổng quan dự án</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Subdomains", value: summary.subdomains },
                    { label: "Live hosts", value: summary.liveHosts },
                    { label: "Crawled URLs", value: summary.crawledUrls },
                    { label: "Open ports", value: summary.openPorts },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-600/60 bg-[#f8fafc] p-4 text-[#111827] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)]">
                      <div className="text-sm text-[#475467]">{item.label}</div>
                      <div className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[#0f172a]">{item.value}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-[#1f2d3d] bg-[#1f2d3d] shadow-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-[2rem] font-bold tracking-[-0.05em] text-white">Vulnerability</CardTitle>
                <CardDescription className="text-base text-slate-300">Thông tin mức độ rủi ro</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Critical", value: summary.critical, color: "#f43f5e", width: `${Math.min(summary.critical * 18, 100)}%` },
                  { label: "High", value: summary.high, color: "#f97316", width: `${Math.min(summary.high * 14, 100)}%` },
                  { label: "Medium", value: summary.medium, color: "#facc15", width: `${Math.min(summary.medium * 10, 100)}%` },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between text-base font-medium text-white/90">
                      <span>{item.label}</span>
                      <span style={{ color: item.color }}>{item.value}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-700/80">
                      <div className="h-full rounded-full" style={{ width: item.width, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border border-[#1f2d3d] bg-[#1f2d3d] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-[2rem] font-bold tracking-[-0.05em] text-white">Project metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-base text-slate-100">
                <div className="flex items-center justify-between gap-4"><span className="text-slate-300">Status</span><span className="font-medium uppercase text-white">{detail?.status ?? "ACTIVE"}</span></div>
                <div className="flex items-center justify-between gap-4"><span className="text-slate-300">Module</span><span className="font-medium text-white">{detail?.module ?? "dashboard"}</span></div>
                <div className="flex items-center justify-between gap-4"><span className="text-slate-300">Risk score</span><span className="font-medium text-white">{detail?.riskScore ?? 78}</span></div>
                <div className="flex items-center justify-between gap-4"><span className="text-slate-300">Last scan</span><span className="font-medium text-white">{detail?.lastScanAt ? new Date(detail.lastScanAt).toLocaleString() : "Not available"}</span></div>
              </CardContent>
            </Card>

            <Card className="border border-[#1f2d3d] bg-[#1f2d3d] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-[2rem] font-bold tracking-[-0.05em] text-white">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-3 pl-5 text-base leading-7 text-slate-200">
                  <li>Enable rate limiting on public endpoints.</li>
                  <li>Patch critical authentication and input validation flaws.</li>
                  <li>Rotate exposed secrets and restrict origin access.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
