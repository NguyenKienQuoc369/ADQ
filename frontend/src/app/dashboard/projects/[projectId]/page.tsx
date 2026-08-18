"use client";
"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { LoaderCircle } from "lucide-react";
import { getProjectById } from "@/lib/api";

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params?.projectId ?? "").trim();

  useEffect(() => {
    if (!projectId) {
      router.replace("/dashboard");
      return;
    }

    let cancelled = false;

    const loadProject = async () => {
      try {
        const data = await getProjectById(projectId);

        if (cancelled) return;

        const mod = data?.module ?? data?.projectDetail?.module ?? "scan";
        const route =
          mod === "apk-audit"
            ? "/apk-audit"
            : mod === "stress-test"
              ? "/stress-test"
              : "/scan";

        router.replace(
          `${route}?projectId=${encodeURIComponent(projectId)}`
        );
      } catch (error) {
        console.error("Failed to load project:", error);

        if (!cancelled) {
          router.replace("/dashboard");
        }
      }
    };

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, [projectId, router]);

  return (
    <DashboardShell area="dashboard">
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-cyan-400" />
        <p className="text-sm text-slate-400">
          Đang nạp toàn bộ phiên làm việc và lịch sử phân tích...
        </p>
      </div>
    </DashboardShell>
  );
}
