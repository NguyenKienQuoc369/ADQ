import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const prisma = getPrismaClient();

  const [targetsCount, scansCount, vulnerabilitiesCount, liveHostsCount] = await Promise.all([
    prisma.target.count(),
    prisma.scanJob.count(),
    prisma.vulnerability.count(),
    prisma.liveHost.count(),
  ]);

  // compute admin-only stats if user is admin
  const rawRole =
    data.user.user_metadata?.role ??
    (data.user.app_metadata as any)?.role ??
    (data.user as any).raw_user_meta_data?.role ??
    (data.user as any).raw_app_meta_data?.role;
  const isAdmin = String(rawRole ?? "").toUpperCase().trim() === "ADMIN";

  let adminStats: any = null;
  if (isAdmin) {
    const [totalUsers, runningScans, totalScansCount] = await Promise.all([
      prisma.adminUser.count(),
      prisma.scanJob.count({ where: { status: "RUNNING" } }),
      prisma.scanJob.count(),
    ]);
    adminStats = {
      cpuUsage: 0,
      ramUsage: 0,
      backendNodes: Number(process.env.BACKEND_NODE_COUNT ?? 1),
      totalUsers,
      totalScans: totalScansCount,
      runningScans,
    };
  }

  return NextResponse.json({
    ok: true,
    overview: {
      metrics: {
        totalTargets: { label: "Target đã quét", value: targetsCount, change: "Đang theo dõi" },
        totalVulnerabilities: { label: "Tổng lỗ hổng", value: vulnerabilitiesCount, change: "Đang theo dõi" },
        totalAssets: { label: "Assets phát hiện", value: liveHostsCount, change: "Đang theo dõi" },
        subdomains: { label: "Lượt quét", value: scansCount, change: "Đang theo dõi" },
      },
      vulnerabilityTrend: [],
      techStackDistribution: [],
      riskPriorityTable: [],
      realtime: {
        activeScans: await prisma.scanJob.count({ where: { status: "RUNNING" } }),
        queueDepth: await prisma.scanJob.count({ where: { status: "QUEUED" } }),
        successRate: 100,
        lastUpdatedAt: new Date().toISOString(),
      },
      recentActivity: [],
    },
    adminStats,
  });
}

