"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Folder,
  Shield,
  Zap,
  History,
  LayoutDashboard,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { getProjectById, getProjects, getTargetVerificationStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ProjectWorkspaceShellProps {
  children: React.ReactNode;
  activeTab?: "overview" | "scan" | "stress" | "history";
  targetUrlOverride?: string;
  isVerifiedOverride?: boolean;
}

export function ProjectWorkspaceShell({
  children,
  activeTab,
  targetUrlOverride,
  isVerifiedOverride,
}: ProjectWorkspaceShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams?.get("projectId") || null;

  // Extract projectId from path if pathname is /dashboard/projects/[id]
  const pathProjectId = pathname.startsWith("/dashboard/projects/")
    ? pathname.replace("/dashboard/projects/", "").split("/")[0]
    : null;

  const currentProjectId = queryProjectId || pathProjectId;

  const [project, setProject] = useState<any | null>(null);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState<boolean>(isVerifiedOverride ?? false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  // Load project details
  useEffect(() => {
    let active = true;

    if (!currentProjectId) {
      // If no project specified in URL, load all projects and try to select the first one
      getProjects()
        .then((projects) => {
          if (!active) return;
          setAllProjects(projects || []);
          if (projects && projects.length > 0) {
            const first = projects[0];
            setProject(first);
            const rawTarget =
              first.projectDetail?.summary?.domain || first.domain || "";
            if (rawTarget) {
              getTargetVerificationStatus(rawTarget).then((statusRes) => {
                if (active) setIsVerified(statusRes.ok && statusRes.verified);
              });
            }
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return;
    }

    Promise.all([getProjectById(currentProjectId), getProjects()])
      .then(([projRes, allRes]) => {
        if (!active) return;
        setProject(projRes);
        setAllProjects(allRes || []);

        const rawTarget =
          targetUrlOverride ||
          projRes?.projectDetail?.summary?.domain ||
          projRes?.domain ||
          "";

        if (rawTarget) {
          getTargetVerificationStatus(rawTarget).then((statusRes) => {
            if (active) {
              setIsVerified(statusRes.ok && statusRes.verified);
            }
          });
        }
      })
      .catch((err) => {
        console.warn("Failed to load project workspace details:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentProjectId, targetUrlOverride]);

  const targetDomain =
    targetUrlOverride ||
    project?.projectDetail?.summary?.domain ||
    project?.domain ||
    "";

  const projectName = project?.projectDetail?.title || project?.name || "Project";
  const verifiedState = isVerifiedOverride !== undefined ? isVerifiedOverride : isVerified;

  // Determine current active tab
  const currentTab =
    activeTab ||
    (pathname.includes("/scan")
      ? "scan"
      : pathname.includes("/stress-test")
      ? "stress"
      : pathname.includes("/history") || pathname.includes("/results")
      ? "history"
      : "overview");

  return (
    <DashboardShell area="dashboard">
      <div className="flex flex-col space-y-5 w-full">
        {/* Project Header Bar */}
        <div className="rounded-lg border border-[#222222] bg-[#000000] p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left: Project Selector & Info */}
            <div className="flex items-start sm:items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowProjectPicker(!showProjectPicker)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#262626] bg-[#0a0a0a] hover:bg-[#141414] text-white transition text-xs font-semibold cursor-pointer group shadow-sm"
                >
                  <Folder className="h-3.5 w-3.5 text-neutral-400 group-hover:text-white" />
                  <span className="max-w-[180px] truncate">{projectName}</span>
                  <ChevronDown className="h-3 w-3 text-neutral-500" />
                </button>

                {/* Dropdown switch project */}
                {showProjectPicker && (
                  <div className="absolute top-full left-0 mt-1.5 w-64 rounded-md border border-[#262626] bg-[#0a0a0a] p-1 shadow-2xl z-50">
                    <p className="px-2.5 py-1 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                      Chuyển đổi Project
                    </p>
                    <div className="max-h-56 overflow-y-auto space-y-0.5">
                      {allProjects.map((p) => {
                        const isCurrent = p.id === currentProjectId;
                        const pName = p.projectDetail?.title || p.name || p.domain;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setShowProjectPicker(false);
                              router.push(
                                currentTab === "overview"
                                  ? `/dashboard/projects/${p.id}`
                                  : currentTab === "scan"
                                  ? `/scan?projectId=${p.id}`
                                  : currentTab === "stress"
                                  ? `/stress-test?projectId=${p.id}`
                                  : `/dashboard/projects/${p.id}/history`
                              );
                            }}
                            className={cn(
                              "w-full text-left px-2.5 py-1.5 rounded text-xs transition flex items-center justify-between cursor-pointer",
                              isCurrent
                                ? "bg-white text-black font-semibold"
                                : "text-neutral-300 hover:bg-[#111111] hover:text-white"
                            )}
                          >
                            <span className="truncate">{pName}</span>
                            {isCurrent && <CheckCircle2 className="h-3.5 w-3.5 text-black shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-[#222222] mt-1 pt-1">
                      <Link
                        href="/dashboard"
                        onClick={() => setShowProjectPicker(false)}
                        className="block w-full text-center px-2 py-1 text-[11px] text-neutral-400 hover:text-white transition"
                      >
                        + Tạo hoặc quản lý Projects
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Target & Verification state */}
              {targetDomain && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono text-neutral-300 bg-[#0a0a0a] px-2 py-1 rounded border border-[#222222] flex items-center gap-1.5">
                    <span>Target:</span>
                    <strong className="text-white">{targetDomain}</strong>
                  </span>

                  {verifiedState ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-2 py-0.5 rounded font-semibold">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Đã xác minh quyền sở hữu
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-950/30 border border-amber-500/30 px-2 py-0.5 rounded font-semibold">
                      <AlertCircle className="h-3 w-3 text-amber-400" /> Chưa xác minh
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right: Quick link back to projects list */}
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition px-2 py-1 rounded hover:bg-[#111111]"
              >
                <ArrowLeft className="h-3 w-3" /> Danh sách Dự án
              </Link>
            </div>
          </div>

          {/* Project Navigation Tabs */}
          <div className="border-t border-[#222222] mt-4 pt-3 flex flex-wrap items-center gap-1">
            <Link
              href={currentProjectId ? `/dashboard/projects/${currentProjectId}` : "/dashboard"}
              className={cn(
                "h-8 px-3 text-xs font-medium rounded-md flex items-center gap-1.5 transition select-none cursor-pointer",
                currentTab === "overview"
                  ? "active-tool-tab bg-white text-black font-semibold shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-[#111111]"
              )}
            >
              <LayoutDashboard className={cn("h-3.5 w-3.5", currentTab === "overview" ? "text-black stroke-black" : "text-neutral-400")} /> <span>Tổng quan</span>
            </Link>

            <Link
              href={currentProjectId ? `/scan?projectId=${currentProjectId}` : "/scan"}
              className={cn(
                "h-8 px-3 text-xs font-medium rounded-md flex items-center gap-1.5 transition select-none cursor-pointer",
                currentTab === "scan"
                  ? "active-tool-tab bg-white text-black font-semibold shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-[#111111]"
              )}
            >
              <Shield className={cn("h-3.5 w-3.5", currentTab === "scan" ? "text-black stroke-black" : "text-neutral-400")} /> <span>Scan</span>
            </Link>

            <Link
              href={currentProjectId ? `/stress-test?projectId=${currentProjectId}` : "/stress-test"}
              className={cn(
                "h-8 px-3 text-xs font-medium rounded-md flex items-center gap-1.5 transition select-none cursor-pointer",
                currentTab === "stress"
                  ? "active-tool-tab bg-white text-black font-semibold shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-[#111111]"
              )}
            >
              <Zap className={cn("h-3.5 w-3.5", currentTab === "stress" ? "text-black stroke-black" : "text-neutral-400")} /> <span>Stress Test</span>
            </Link>

            <Link
              href={currentProjectId ? `/dashboard/projects/${currentProjectId}/history` : "/reports"}
              className={cn(
                "h-8 px-3 text-xs font-medium rounded-md flex items-center gap-1.5 transition select-none cursor-pointer",
                currentTab === "history"
                  ? "active-tool-tab bg-white text-black font-semibold shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-[#111111]"
              )}
            >
              <History className={cn("h-3.5 w-3.5", currentTab === "history" ? "text-black stroke-black" : "text-neutral-400")} /> <span>Lịch sử</span>
            </Link>
          </div>
        </div>

        {/* Child Tool Content */}
        <div className="w-full">{children}</div>
      </div>
    </DashboardShell>
  );
}
