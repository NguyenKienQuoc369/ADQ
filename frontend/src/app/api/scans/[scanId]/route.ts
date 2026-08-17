import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const prisma = getPrismaClient();

  const job = await prisma.scanJob.findUnique({
    where: { scanId },
    include: {
      liveHosts: { orderBy: { createdAt: "desc" }, take: 200 },
      vulnerabilities: { orderBy: { createdAt: "desc" }, take: 500 },
    },
  });

  if (!job) {
    return NextResponse.json({ ok: false, error: "Không tìm thấy scan." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    scan: {
      id: job.scanId,
      target: job.targetDomain,
      status: job.status,
      planUsed: "PRO",
      startedAt: (job.startedAt ?? job.createdAt).toISOString(),
      liveSubdomains: job.liveHosts
        .map((host) => ({
          host: host.url ?? job.targetDomain,
          ip: "",
          status: "LIVE",
          tech: host.tech ?? "Unknown",
        }))
        .slice(0, 40),
      portScan: [],
      urlHistory: [],
      secretsHunter: [],
      vulnerabilities: job.vulnerabilities.map((v) => ({
        id: String(v.id),
        title: v.templateId || v.source,
        severity: (v.severity ?? "LOW").toUpperCase(),
        cvss: 0,
        endpoint: v.endpoint ?? "",
        asset: v.host ?? job.targetDomain,
        description: v.matched ?? "",
        exploitability: 0,
        impact: v.raw ?? "",
      })),
      actionAdvice: [],
      enabledTools: ["Subfinder", "DNSX", "Naabu", "Katana", "GAU", "Nuclei"],
      autoThrottle: true,
      telegram: { enabled: false },
    },
  });
}

