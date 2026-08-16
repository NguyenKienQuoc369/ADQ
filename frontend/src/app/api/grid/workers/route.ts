import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";

export async function GET() {
  const now = new Date();
  try {
    const prisma = getPrismaClient();
    const activeJobs = await prisma.scanJob.findMany({
      where: { status: "RUNNING" },
      orderBy: { createdAt: "desc" },
    });

    const activeTarget = activeJobs[0]?.targetDomain;

    const workers = [
      {
        workerId: "worker-light-01",
        capability: "light-fast",
        profile: "recon_infra",
        currentTask: activeTarget ? `subfinder ${activeTarget}` : "IDLE (Listening for dispatch)",
        status: activeTarget ? "WORKING" : "IDLE",
        cpuUsage: activeTarget ? "18%" : "1%",
        ramUsage: "210MB",
        lastHeartbeat: new Date().toISOString(),
      },
      {
        workerId: "worker-light-02",
        capability: "light-fast",
        profile: "web_mapping",
        currentTask: activeTarget ? `httpx -u ${activeTarget}` : "IDLE (Listening for dispatch)",
        status: activeTarget ? "WORKING" : "IDLE",
        cpuUsage: activeTarget ? "24%" : "1%",
        ramUsage: "310MB",
        lastHeartbeat: new Date().toISOString(),
      },
      {
        workerId: "worker-elite-01",
        capability: "elite-clean-ip",
        profile: "dast_active",
        currentTask: activeTarget ? `nuclei -u https://${activeTarget}` : "IDLE (Listening for dispatch)",
        status: activeTarget ? "WORKING" : "IDLE",
        cpuUsage: activeTarget ? "55%" : "2%",
        ramUsage: "1.1GB",
        lastHeartbeat: new Date().toISOString(),
      },
      {
        workerId: "worker-stealth-01",
        capability: "residential-proxy",
        profile: "deep_logic",
        currentTask: activeTarget ? `OAST & Deep Logic Scan on ${activeTarget}` : "IDLE (Listening for dispatch)",
        status: activeTarget ? "WORKING" : "IDLE",
        cpuUsage: activeTarget ? "30%" : "1%",
        ramUsage: "180MB",
        lastHeartbeat: new Date().toISOString(),
      },
    ];

    return NextResponse.json({
      ok: true,
      timestamp: now.toISOString(),
      activeWorkersCount: activeJobs.length > 0 ? 4 : 0,
      workers,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể tải trạng thái worker." },
      { status: 500 },
    );
  }
}
