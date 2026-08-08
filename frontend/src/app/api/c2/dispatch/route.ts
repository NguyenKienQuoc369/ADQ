import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const prisma = getPrismaClient();
    const body = await req.json();
    const { targets, profiles, capability, priority, extraParams } = body;

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json({ ok: false, error: "No targets provided" }, { status: 400 });
    }

    const createdJobs = [];

    for (const domain of targets) {
      const cleanDomain = domain.trim().replace(/^https?:\/\//, "").split("/")[0];
      if (!cleanDomain) continue;

      // Upsert Target in Prisma
      const targetRecord = await prisma.target.upsert({
        where: { domain: cleanDomain },
        update: { updatedAt: new Date() },
        create: { domain: cleanDomain },
      });

      const scanId = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Create ScanJob in Prisma
      const scanJob = await prisma.scanJob.create({
        data: {
          scanId,
          targetDomain: targetRecord.domain,
          status: "RUNNING",
          startedAt: new Date(),
          priorityScore: priority || 10,
        },
      });

      createdJobs.push({
        scanId: scanJob.scanId,
        targetDomain: scanJob.targetDomain,
        profiles: profiles || ["recon_infra", "web_mapping"],
        capability: capability || "all-nodes",
        status: "QUEUED",
      });

      // Trigger Python Backend Engine if BACKEND_API_URL or local API server is active
      const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      try {
        await fetch(`${backendUrl}/api/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target: cleanDomain,
            no_telegram: true,
            logic_scan: profiles?.includes("deep_logic") || false,
          }),
        });
      } catch (err) {
        console.warn(`[Dispatch] Backend API connection warning for ${cleanDomain}:`, err);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Dispatched ${createdJobs.length} target(s) to Master Grid`,
      jobs: createdJobs,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
