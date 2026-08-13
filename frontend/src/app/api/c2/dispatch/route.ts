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

      let liveScanResult = null;

      // Trigger Python Backend Engine if BACKEND_API_URL or local API server is active
      const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      try {
        const scanRes = await fetch(`${backendUrl}/api/scan/real`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target: domain,
            no_telegram: false,
            disable_telegram: false,
            logic_scan: profiles?.includes("deep_logic") || false,
          }),
        });
        const scanJson = await scanRes.json();
        if (scanJson.ok && scanJson.scan) {
          liveScanResult = scanJson.scan;
        }
      } catch (err) {
        console.warn(`[Dispatch] Backend API connection warning for ${cleanDomain}:`, err);
      }

      // Create ScanJob in Prisma
      const scanJob = await prisma.scanJob.create({
        data: {
          scanId,
          targetDomain: targetRecord.domain,
          status: "COMPLETED",
          startedAt: new Date(),
          priorityScore: liveScanResult?.priority_score || priority || 10,
        },
      });

      createdJobs.push({
        scanId: scanJob.scanId,
        targetDomain: scanJob.targetDomain,
        profiles: profiles || ["recon_infra", "web_mapping"],
        capability: capability || "all-nodes",
        status: "COMPLETED",
        scanResult: liveScanResult,
      });
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
