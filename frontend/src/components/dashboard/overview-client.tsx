"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Lock, useRouter } from "next/navigation";
import { AlertTriangle, Globe, Lock, Play, Plus, Shield, Smartphone, Trash2, X, Zap } from "lucide-react";

import { Lock, DashboardShell } from "@/components/dashboard-shell";
import { Lock, Badge } from "@/components/ui/badge";
import { Lock, Button } from "@/components/ui/button";
import { Lock, Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardOverview, getProjects, createProject, deleteProject } from "@/lib/api";

export function OverviewClient() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectStep, setNewProjectStep] = useState<"setup" | "module">("setup");
  const [newProjectDraft, setNewProjectDraft] = useState({
    name: "",
    projectInfo: "",
    domain: "",
  });

  const [projectToDelete, setProjectToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    const formattedDomain = /^https?:\/\//i.test(rawTarget) ? rawTarget : `https://${rawTarget}`;

    const payload = {
      name: newProjectDraft.name.trim() || newProjectDraft.domain.trim(),
      domain: formattedDomain,
      description: newProjectDraft.projectInfo.trim(),
      module,
    };

    try {
      const project = await createProject(payload);
      setShowNewProject(false);
      setNewProjectStep("setup");
      setNewProjectDraft({ name: "", projectInfo: "", domain: "" });

      const targetRoute = module === "scan" ? "/scan" : module === "apk-audit" ? "/apk-audit" : "/stress-test";
      router.push(`${targetRoute}?projectId=${encodeURIComponent(project.id)}`);
    } catch (err) {
      console.error(err);
      alert("Không thể tạo phiên quét mới.");
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
      <div className="space-y-6 text-slate-100 font-sans">
        {/* Header bar */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Quản lý Phiên Quét & Dự Án</h2>
            <p className="text-sm text-slate-400">
              Mỗi phiên quét gắn liền với một Target cố định, lưu trữ vĩnh viễn lỗ hổng và toàn bộ lịch sử chat với AI.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Tìm kiếm phiên quét, domain, target..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-72 md:w-96 border-slate-800 bg-slate-950 text-white placeholder:text-slate-500"
            />
            <Button
              onClick={() => setShowNewProject(true)}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-cyan-900/30"
            >
              <Plus className="h-4 w-4" /> Tạo phiên mới
            </Button>
          </div>
        </div>

        {/* Danh sách phiên làm việc */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl bg-slate-900/80" />)
          ) : filteredProjects.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-12 text-center">
              <Shield className="mx-auto h-12 w-12 text-slate-600" />
              <h3 className="mt-3 text-lg font-semibold text-slate-300">Chưa có phiên làm việc nào</h3>
              <p className="mt-1 text-sm text-slate-500">
                Bấm nút "Tạo phiên mới" để bắt đầu quét bảo mật web, kiểm toán APK hoặc kiểm thử chịu tải.
              </p>
              <Button onClick={() => setShowNewProject(true)} className="mt-5 bg-cyan-600 hover:bg-cyan-500 text-white">
                Bắt đầu phiên đầu tiên
              </Button>
            </div>
          ) : (
            filteredProjects.map((p: any) => {
              const detail = p.projectDetail || {};
              const summary = detail.summary || {};
              const moduleType = p.module || detail.module || "scan";

              return (
                <Card
                  key={p.id}
                  className="group relative overflow-hidden border border-slate-800 bg-slate-900/90 shadow-md hover:border-cyan-500/50 transition duration-200"
                >
                  <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            {moduleType === "apk-audit" ? (
                              <Smartphone className="h-5 w-5" />
                            ) : moduleType === "stress-test" ? (
                              <Zap className="h-5 w-5 text-rose-400" />
                            ) : (
                              <Shield className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-white line-clamp-1">{p.name || p.domain || p.id}</p>
                            <p className="text-xs font-mono text-cyan-400/90 line-clamp-1">{p.domain || "Chưa gắn target"}</p>
                          </div>
                        </div>

                        <Badge
                          variant="muted"
                          className="border-slate-700 bg-slate-950 text-[10px] uppercase font-mono tracking-wider text-slate-400"
                        >
                          {moduleType}
                        </Badge>
                      </div>

                      {/* Chỉ số tóm tắt */}
                      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-950/80 p-2.5 text-center border border-slate-800/80">
                        <div>
                          <div className="text-[10px] text-slate-500">Critical</div>
                          <div className="text-sm font-bold text-rose-400">{summary.critical ?? 0}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">Lỗ hổng</div>
                          <div className="text-sm font-bold text-amber-400">
                            {summary.totalVulns ?? (summary.critical ?? 0) + (summary.high ?? 0) + (summary.medium ?? 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">Trạng thái</div>
                          <div className="text-xs font-bold text-emerald-400 mt-0.5">
                            {detail.status === "COMPLETED" ? "Đã quét" : "Đang chờ"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <span className="text-[11px] text-slate-500">
                        {detail.lastScanAt ? new Date(detail.lastScanAt).toLocaleDateString("vi-VN") : "Mới tạo"}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setProjectToDelete(p)}
                          className="h-8 border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-950/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openProjectSession(p)}
                          className="h-8 bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <Play className="h-3 w-3 fill-white" /> Tiếp tục phiên
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Modal xác nhận xóa phiên */}
        {projectToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setProjectToDelete(null)} />
            <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mx-auto">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-center text-lg font-bold text-white">Xóa phiên làm việc này?</h3>
              <p className="mt-2 text-center text-xs text-slate-400">
                Toàn bộ kết quả quét, lỗ hổng và lịch sử hội thoại AI của phiên{" "}
                <span className="font-semibold text-slate-200">
                  {projectToDelete.name || projectToDelete.domain || projectToDelete.id}
                </span>{" "}
                sẽ bị xóa vĩnh viễn.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setProjectToDelete(null)} disabled={deleting}>
                  Hủy
                </Button>
                <Button onClick={handleDeleteProject} disabled={deleting} className="bg-rose-600 hover:bg-rose-500 text-white">
                  {deleting ? "Đang xóa..." : "Xác nhận xóa"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Tạo Phiên Làm Việc Mới */}
        {showNewProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowNewProject(false)} />
            <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white">
                  {newProjectStep === "setup" ? "Bước 1: Thiết lập Target cố định cho phiên" : "Bước 2: Chọn module kiểm thử"}
                </h3>
                <button
                  onClick={() => setShowNewProject(false)}
                  className="rounded-lg p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {newProjectStep === "setup" ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-400 flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5 text-cyan-400" /> Target Domain / URL / IP (Bắt buộc)
                    </label>
                    <Input
                      value={newProjectDraft.domain}
                      onChange={(e) => setNewProjectDraft((prev) => ({ ...prev, domain: e.target.value }))}
                      placeholder="https://findproject.vercel.app hoặc example.com"
                      className="mt-1.5 border-slate-800 bg-slate-950 text-white placeholder:text-slate-600"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Mục tiêu này sẽ được gắn cố định với phiên quét để đảm bảo dữ liệu và AI phân tích đồng nhất.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-400">Tên phiên quét (Tùy chọn)</label>
                    <Input
                      value={newProjectDraft.name}
                      onChange={(e) => setNewProjectDraft((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="VD: Kiểm thử Web Portal Quý 3"
                      className="mt-1.5 border-slate-800 bg-slate-950 text-white placeholder:text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-400">Mô tả / Ghi chú</label>
                    <Input
                      value={newProjectDraft.projectInfo}
                      onChange={(e) => setNewProjectDraft((prev) => ({ ...prev, projectInfo: e.target.value }))}
                      placeholder="Phạm vi kiểm thử, ghi chú..."
                      className="mt-1.5 border-slate-800 bg-slate-950 text-white placeholder:text-slate-600"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                    <Button variant="outline" onClick={() => setShowNewProject(false)}>
                      Hủy
                    </Button>
                    <Button
                      onClick={() => setNewProjectStep("module")}
                      disabled={!newProjectDraft.domain.trim()}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
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
                      className="cursor-pointer rounded-xl border border-slate-800 bg-slate-950/80 p-4 hover:border-cyan-500 hover:bg-cyan-950/20 transition group"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 group-hover:scale-105 transition">
                        <Shield className="h-5 w-5" />
                      </div>
                      <h4 className="mt-3 font-bold text-sm text-white">Web & Network Scan</h4>
                      <p className="mt-1 text-xs text-slate-400">
                        Recon, quét lỗ hổng Nuclei, trích xuất Secrets và AI tư vấn khắc phục.
                      </p>
                    </div>

                    {/* Module 2 */}
                    <div
                      onClick={() => handleCreateNewProject("apk-audit")}
                      className="cursor-pointer rounded-xl border border-slate-800 bg-slate-950/80 p-4 hover:border-emerald-500 hover:bg-emerald-950/20 transition group"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 group-hover:scale-105 transition">
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <h4 className="mt-3 font-bold text-sm text-white">Mobile APK Audit</h4>
                      <p className="mt-1 text-xs text-slate-400">
                        Dò mã độc, bóc tách Manifest Android và tìm API keys lộ lọt trong APK.
                      </p>
                    </div>

                    {/* Module 3 */}
                    <div
                      onClick={() => handleCreateNewProject("stress-test")}
                      className="cursor-pointer rounded-xl border border-slate-800 bg-slate-950/80 p-4 hover:border-rose-500 hover:bg-rose-950/20 transition group"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 group-hover:scale-105 transition">
                        <Zap className="h-5 w-5" />
                      </div>
                      <h4 className="mt-3 font-bold text-sm text-white">L7 Stress Test</h4>
                      <p className="mt-1 text-xs text-slate-400">
                        Kiểm thử khả năng chịu tải, phân tích Rate Limit và đánh giá cấu hình WAF.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4 border-t border-slate-800">
                    <Button variant="ghost" onClick={() => setNewProjectStep("setup")}>
                      ← Quay lại
                    </Button>
                    <Button variant="outline" onClick={() => setShowNewProject(false)}>
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
