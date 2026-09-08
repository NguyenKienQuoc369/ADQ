"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Globe,
  Lock,
  Play,
  Plus,
  Shield,
  Smartphone,
  Trash2,
  X,
  Zap,
  Search,
  Folder,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardOverview, getProjects, createProject, deleteProject } from "@/lib/api";
import { cn } from "@/lib/utils";

export function OverviewClient() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectStep, setNewProjectStep] = useState<"setup" | "module">("setup");
  const [createProjectError, setCreateProjectError] = useState("");
  const [newProjectDraft, setNewProjectDraft] = useState({
    name: "",
    projectInfo: "",
    domain: "",
  });

  const [projectToDelete, setProjectToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const stats = useMemo(() => {
    if (!projects) return { totalProjects: 0, totalVulns: 0, criticalCount: 0, activeCompleted: 0 };
    let totalVulns = 0;
    let criticalCount = 0;
    let activeCompleted = 0;

    projects.forEach((p) => {
      const detail = p.projectDetail || {};
      const summary = detail.summary || {};
      const crit = Number(summary.critical || 0);
      const high = Number(summary.high || 0);
      const med = Number(summary.medium || 0);
      const low = Number(summary.low || 0);
      const total = summary.totalVulns ? Number(summary.totalVulns) : crit + high + med + low;

      criticalCount += crit;
      totalVulns += total;
      if (detail.status === "COMPLETED" || (p.scans && p.scans.length > 0)) {
        activeCompleted += 1;
      }
    });

    return {
      totalProjects: projects.length,
      totalVulns,
      criticalCount,
      activeCompleted,
    };
  }, [projects]);

  useEffect(() => {
    let active = true;

    Promise.all([getDashboardOverview(), getProjects()])
      .then(([_, projectsRes]) => {
        if (!active) return;
        setProjects(projectsRes || []);
      })
      .catch((err) => {
        console.error("Dashboard load error:", err);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleDeleteProject = async () => {
    if (!projectToDelete?.id) return;
    setDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      setProjects((prev) => (prev ? prev.filter((item) => item.id !== projectToDelete.id) : prev));
      setProjectToDelete(null);
    } catch {
      alert("Không thể xóa phiên làm việc.");
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateNewProject = async (module: "scan" | "apk-audit" | "stress-test") => {
    const rawTarget = newProjectDraft.domain.trim();
    const projectName = newProjectDraft.name.trim().replace(/\\s+/g, " ");

    if (!projectName) {
      setCreateProjectError("Vui lòng nhập tên dự án.");
      setNewProjectStep("setup");
      return;
    }

    if (!rawTarget) {
      setCreateProjectError("Vui lòng nhập Target Domain / URL / IP.");
      setNewProjectStep("setup");
      return;
    }

    // Chặn nhanh ở frontend. API vẫn kiểm tra lại để không thể bypass.
    const duplicateLocal = (projects || []).some((project) => {
      const existingName = String(
        project.name || project.projectDetail?.title || ""
      )
        .trim()
        .replace(/\\s+/g, " ")
        .toLocaleLowerCase("vi");

      return existingName === projectName.toLocaleLowerCase("vi");
    });

    if (duplicateLocal) {
      setCreateProjectError(`Tên dự án "${projectName}" đã tồn tại.`);
      setNewProjectStep("setup");
      return;
    }

    const formattedDomain = /^https?:\/\//i.test(rawTarget)
      ? rawTarget
      : `https://${rawTarget}`;

    const payload = {
      name: projectName,
      domain: formattedDomain,
      description: newProjectDraft.projectInfo.trim(),
      module,
    };

    setCreateProjectError("");

    try {
      const project = await createProject(payload);

      setProjects((prev) => {
        if (!prev) return prev;
        return [
          {
            ...project,
            name: project.name || projectName,
            description: project.description || payload.description,
            module,
          },
          ...prev,
        ];
      });

      setShowNewProject(false);
      setNewProjectStep("setup");
      setCreateProjectError("");
      setNewProjectDraft({ name: "", projectInfo: "", domain: "" });

      const targetRoute =
        module === "scan"
          ? "/scan"
          : module === "apk-audit"
            ? "/apk-audit"
            : "/stress-test";

      router.push(`${targetRoute}?projectId=${encodeURIComponent(project.id)}`);
    } catch (err: any) {
      console.error(err);

      const message =
        err?.message ||
        "Không thể tạo dự án. Vui lòng kiểm tra lại thông tin.";

      setCreateProjectError(message);
      setNewProjectStep("setup");
    }
  };

  const openProjectSession = (p: any) => {
    const mod = p.module || p.projectDetail?.module || "scan";
    const route = mod === "apk-audit" ? "/apk-audit" : mod === "stress-test" ? "/stress-test" : "/scan";
    router.push(`${route}?projectId=${encodeURIComponent(p.id)}`);
  };

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    if (!searchTerm.trim()) return projects;
    const term = searchTerm.toLowerCase();
    return projects.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.domain && p.domain.toLowerCase().includes(term)) ||
        (p.id && p.id.toLowerCase().includes(term))
    );
  }, [projects, searchTerm]);

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 text-[#ededed] font-sans">
        {/* Header & Controls Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-[#1f1f1f]">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Dự Án & Mục Tiêu
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Danh sách các target an ninh đang được giám sát, rà soát lỗ hổng và lưu trữ báo cáo.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
              <Input
                placeholder="Tìm kiếm dự án, target..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-56 sm:w-64 h-9 pl-9 border-[#222222] bg-[#000000] hover:border-[#333333] focus:border-white focus:ring-0 text-xs text-white placeholder:text-neutral-500 rounded-md transition"
              />
            </div>
            <Button
              onClick={() => {
                setCreateProjectError("");
                setShowNewProject(true);
              }}
              className="h-9 px-3.5 bg-white hover:bg-neutral-200 text-black font-medium text-xs rounded-md transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-98 shrink-0"
            >
              <Plus className="h-4 w-4" /> Tạo dự án mới
            </Button>
          </div>
        </div>

        {/* 4 Minimalist Telemetry Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-lg border border-[#222222] bg-[#000000] p-4 hover:border-[#333333] transition">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">Tổng Mục Tiêu</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">{stats.totalProjects}</span>
              <span className="text-[11px] text-neutral-500 font-mono">targets</span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">Đang quản lý</p>
          </div>

          <div className="rounded-lg border border-[#222222] bg-[#000000] p-4 hover:border-[#333333] transition">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">Lỗ Hổng Critical</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={cn("text-2xl font-bold font-mono", stats.criticalCount > 0 ? "text-rose-500" : "text-white")}>
                {stats.criticalCount}
              </span>
              <span className="text-[11px] text-neutral-500 font-mono">cần vá</span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">Mức độ nghiêm trọng</p>
          </div>

          <div className="rounded-lg border border-[#222222] bg-[#000000] p-4 hover:border-[#333333] transition">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">Tổng Lỗ Hổng</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">{stats.totalVulns}</span>
              <span className="text-[11px] text-neutral-500 font-mono">ghi nhận</span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">DAST, OWASP & Secrets</p>
          </div>

          <div className="rounded-lg border border-[#222222] bg-[#000000] p-4 hover:border-[#333333] transition">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">Đã Hoàn Tất Rà Soát</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-emerald-400">{stats.activeCompleted}</span>
              <span className="text-[11px] text-neutral-500 font-mono">phiên</span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">Sẵn sàng bằng chứng PoC</p>
          </div>
        </div>

        {/* Pilot Advisory Notice */}
        <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] px-4 py-3 text-xs text-neutral-400 flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="px-1.5 py-0.5 rounded border border-neutral-700 bg-neutral-800 text-[10px] font-mono text-neutral-300 font-semibold">
              PILOT
            </span>
            <p className="text-xs text-neutral-400 leading-normal">
              ADQ đang được triển khai thử nghiệm pilot. Hệ thống và API được tối ưu liên tục; vui lòng kiểm tra kết quả trước khi đưa vào môi trường thực tế.
            </p>
          </div>
        </div>

        {/* Project Cards Grid (Vercel Clean Grid) */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-lg bg-[#0a0a0a] border border-[#222222]" />
            ))
          ) : filteredProjects.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-[#222222] bg-[#0a0a0a] p-12 text-center">
              <Shield className="mx-auto h-10 w-10 text-neutral-600" />
              <h3 className="mt-3 text-sm font-semibold text-neutral-300">Chưa có dự án nào</h3>
              <p className="mt-1 text-xs text-neutral-500 max-w-sm mx-auto">
                Tạo phiên làm việc đầu tiên để quét bảo mật Web DAST, kiểm toán APK hoặc kiểm thử L7.
              </p>
              <Button
                onClick={() => setShowNewProject(true)}
                className="mt-4 h-8 px-3.5 bg-white hover:bg-neutral-200 text-black font-medium text-xs rounded-md transition"
              >
                Tạo dự án mới
              </Button>
            </div>
          ) : (
            filteredProjects.map((p: any) => {
              const detail = p.projectDetail || {};
              const summary = detail.summary || {};
              const moduleType = p.module || detail.module || "scan";
              const isCompleted = detail.status === "COMPLETED" || (p.scans && p.scans.length > 0);

              return (
                <div
                  key={p.id}
                  className="group relative flex flex-col justify-between rounded-lg border border-[#222222] bg-[#000000] hover:border-neutral-600 transition-colors p-5 min-h-[195px]"
                >
                  <div>
                    {/* Header: Title & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3
                          onClick={() => openProjectSession(p)}
                          className="font-semibold text-sm text-white hover:underline cursor-pointer truncate"
                        >
                          {p.name || p.domain || p.id}
                        </h3>
                        <a
                          href={p.domain?.startsWith("http") ? p.domain : `https://${p.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white font-mono transition-colors truncate max-w-full"
                        >
                          <span>{p.domain?.replace(/^https?:\/\//, "") || "Chưa gắn domain"}</span>
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      </div>

                      {/* Status indicator */}
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#222222] bg-[#111111] text-[10px] font-mono text-neutral-300 shrink-0">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            isCompleted
                              ? "bg-emerald-500 shadow-[0_0_6px_#10b981]"
                              : "bg-cyan-400 shadow-[0_0_6px_#22d3ee]"
                          )}
                        />
                        <span>{isCompleted ? "Hoàn tất" : "Đang chờ"}</span>
                      </span>
                    </div>

                    {/* Clean Vercel-style Metric Chips */}
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-mono">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded border",
                          (summary.critical ?? 0) > 0
                            ? "border-rose-500/40 bg-rose-950/20 text-rose-400 font-semibold"
                            : "border-[#222222] bg-[#111111] text-neutral-400"
                        )}
                      >
                        Critical: {summary.critical ?? 0}
                      </span>
                      <span className="px-2 py-0.5 rounded border border-[#222222] bg-[#111111] text-neutral-400">
                        Lỗ hổng:{" "}
                        {summary.totalVulns ??
                          (summary.critical ?? 0) + (summary.high ?? 0) + (summary.medium ?? 0)}
                      </span>
                      <span className="px-2 py-0.5 rounded border border-[#222222] bg-[#111111] text-neutral-500 uppercase">
                        {moduleType}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Row: Timestamp & Actions */}
                  <div className="mt-5 pt-3.5 border-t border-[#1f1f1f] flex items-center justify-between text-xs">
                    <span className="text-[11px] text-neutral-500 font-mono">
                      {detail.lastScanAt
                        ? `Cập nhật ${new Date(detail.lastScanAt).toLocaleDateString("vi-VN")}`
                        : "Mới tạo"}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setProjectToDelete(p)}
                        className="h-7 w-7 rounded-md border border-[#222222] text-neutral-500 hover:text-rose-400 hover:border-neutral-700 hover:bg-neutral-900 flex items-center justify-center transition cursor-pointer"
                        title="Xóa dự án"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openProjectSession(p)}
                        className="h-7 px-3 rounded-md bg-white hover:bg-neutral-200 text-black font-medium text-xs flex items-center gap-1 transition cursor-pointer shadow-sm active:scale-98"
                      >
                        <span>Vào phiên</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal xác nhận xóa phiên (Vercel Dark Dialog) */}
        {projectToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setProjectToDelete(null)}
            />
            <div className="relative z-10 w-full max-w-md rounded-xl border border-[#262626] bg-[#0a0a0a] p-6 shadow-2xl">
              <h3 className="text-base font-semibold text-white">Xóa phiên làm việc?</h3>
              <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
                Toàn bộ kết quả quét, lỗ hổng và lịch sử hội thoại AI của dự án{" "}
                <span className="font-semibold text-white">
                  {projectToDelete.name || projectToDelete.domain || projectToDelete.id}
                </span>{" "}
                sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <Button
                  variant="outline"
                  onClick={() => setProjectToDelete(null)}
                  disabled={deleting}
                  className="rounded-md border-[#333333] text-neutral-300 hover:bg-neutral-900 h-8 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleDeleteProject}
                  disabled={deleting}
                  className="rounded-md bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs h-8"
                >
                  {deleting ? "Đang xóa..." : "Xác nhận xóa"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Tạo Phiên Làm Việc Mới (Vercel Style Dialog) */}
        {showNewProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowNewProject(false)}
            />
            <div className="relative z-10 w-full max-w-xl rounded-xl border border-[#262626] bg-[#0a0a0a] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#222222] pb-3.5">
                <h3 className="text-sm font-semibold text-white">
                  {newProjectStep === "setup"
                    ? "Bước 1: Thiết lập Target Mục Tiêu"
                    : "Bước 2: Chọn Module Kiểm Thử"}
                </h3>
                <button
                  onClick={() => setShowNewProject(false)}
                  className="rounded p-1 text-neutral-500 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {newProjectStep === "setup" ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 font-mono">
                      Target Domain / URL / IP *
                    </label>
                    <Input
                      value={newProjectDraft.domain}
                      onChange={(e) => {
                        setCreateProjectError("");
                        setNewProjectDraft((prev) => ({ ...prev, domain: e.target.value }));
                      }}
                      placeholder="https://example.com hoặc api.domain.vn"
                      className="mt-1.5 h-9 border-[#333333] bg-[#000000] focus:border-white focus:ring-0 text-xs text-white placeholder:text-neutral-600 rounded-md"
                    />
                    <p className="mt-1 text-[11px] text-neutral-500">
                      Target này sẽ được gắn cố định với phiên làm việc để theo dõi lịch sử và AI Copilot phân tích.
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 font-mono">
                      Tên dự án *
                    </label>
                    <Input
                      value={newProjectDraft.name}
                      onChange={(e) => {
                        setCreateProjectError("");
                        setNewProjectDraft((prev) => ({ ...prev, name: e.target.value }));
                      }}
                      placeholder="Ví dụ: Kiểm thử Web Portal Quý 3"
                      className="mt-1.5 h-9 border-[#333333] bg-[#000000] focus:border-white focus:ring-0 text-xs text-white placeholder:text-neutral-600 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 font-mono">
                      Mô tả / Ghi chú
                    </label>
                    <Input
                      value={newProjectDraft.projectInfo}
                      onChange={(e) => {
                        setCreateProjectError("");
                        setNewProjectDraft((prev) => ({ ...prev, projectInfo: e.target.value }));
                      }}
                      placeholder="Phạm vi kiểm thử, ghi chú nội bộ..."
                      className="mt-1.5 h-9 border-[#333333] bg-[#000000] focus:border-white focus:ring-0 text-xs text-white placeholder:text-neutral-600 rounded-md"
                    />
                  </div>

                  {createProjectError ? (
                    <div className="rounded-md border border-rose-500/40 bg-rose-950/20 px-3 py-2 text-xs text-rose-400 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{createProjectError}</span>
                    </div>
                  ) : null}

                  <div className="flex justify-end gap-2 pt-4 border-t border-[#222222]">
                    <Button
                      variant="outline"
                      onClick={() => setShowNewProject(false)}
                      className="rounded-md border-[#333333] text-neutral-300 hover:bg-neutral-900 h-8 text-xs"
                    >
                      Hủy
                    </Button>
                    <Button
                      onClick={() => setNewProjectStep("module")}
                      disabled={!newProjectDraft.domain.trim() || !newProjectDraft.name.trim()}
                      className="rounded-md bg-white hover:bg-neutral-200 text-black font-medium text-xs h-8 shadow-sm cursor-pointer"
                    >
                      Tiếp tục chọn module →
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {/* Module 1 */}
                    <div
                      onClick={() => handleCreateNewProject("scan")}
                      className="cursor-pointer rounded-lg border border-[#222222] bg-[#000000] p-4 hover:border-neutral-500 transition group"
                    >
                      <Shield className="h-5 w-5 text-white mb-2" />
                      <h4 className="font-semibold text-xs text-white">Web DAST Scan</h4>
                      <p className="mt-1 text-[11px] text-neutral-500 leading-relaxed">
                        Recon, Nuclei DAST, OWASP Top 10 và Secrets leak.
                      </p>
                    </div>

                    {/* Module 2 */}
                    <div
                      onClick={() => handleCreateNewProject("apk-audit")}
                      className="cursor-pointer rounded-lg border border-[#222222] bg-[#000000] p-4 hover:border-neutral-500 transition group"
                    >
                      <Smartphone className="h-5 w-5 text-white mb-2" />
                      <h4 className="font-semibold text-xs text-white">APK Audit</h4>
                      <p className="mt-1 text-[11px] text-neutral-500 leading-relaxed">
                        Dò mã độc, Manifest Android và API keys trong file APK.
                      </p>
                    </div>

                    {/* Module 3 */}
                    <div
                      onClick={() => handleCreateNewProject("stress-test")}
                      className="cursor-pointer rounded-lg border border-[#222222] bg-[#000000] p-4 hover:border-neutral-500 transition group"
                    >
                      <Zap className="h-5 w-5 text-white mb-2" />
                      <h4 className="font-semibold text-xs text-white">Stress Test</h4>
                      <p className="mt-1 text-[11px] text-neutral-500 leading-relaxed">
                        Kiểm thử chịu tải L7, đo ngưỡng Rate Limit và WAF.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4 border-t border-[#222222]">
                    <Button
                      variant="ghost"
                      onClick={() => setNewProjectStep("setup")}
                      className="rounded-md text-neutral-400 hover:text-white h-8 text-xs"
                    >
                      ← Quay lại
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowNewProject(false)}
                      className="rounded-md border-[#333333] text-neutral-300 h-8 text-xs"
                    >
                      Đóng
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
