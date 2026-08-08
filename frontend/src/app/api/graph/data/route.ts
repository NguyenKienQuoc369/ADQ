import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fromNode = url.searchParams.get("from");
  const toNode = url.searchParams.get("to");

  try {
    const prisma = getPrismaClient();
    const targets = await prisma.target.findMany({
      include: {
        scanJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            liveHosts: true,
            vulnerabilities: true,
          },
        },
      },
    });

    const nodes: Array<{ id: string; label: string; type: string; risk: number }> = [];
    const edges: Array<{ source: string; target: string; type: string }> = [];

    let maxRisk = 0;

    targets.forEach((t) => {
      const targetNodeId = `domain:${t.domain}`;
      nodes.push({ id: targetNodeId, label: t.domain, type: "DOMAIN", risk: 20 });

      const latestJob = t.scanJobs[0];
      if (!latestJob) return;

      latestJob.liveHosts.forEach((lh) => {
        const hostNodeId = `endpoint:${lh.url || t.domain}`;
        nodes.push({ id: hostNodeId, label: lh.url || t.domain, type: "API_ENDPOINT", risk: 40 });
        edges.push({ source: targetNodeId, target: hostNodeId, type: "EXPOSES" });
      });

      latestJob.vulnerabilities.forEach((v) => {
        const vulnRisk = v.severity === "CRITICAL" ? 100 : v.severity === "HIGH" ? 85 : 50;
        if (vulnRisk > maxRisk) maxRisk = vulnRisk;

        const vulnNodeId = `vuln:${v.id}-${v.templateId || "vulnerability"}`;
        nodes.push({
          id: vulnNodeId,
          label: `${v.templateId || "Vuln"} (${v.severity || "MEDIUM"})`,
          type: "VULNERABILITY",
          risk: vulnRisk,
        });

        const targetHost = `endpoint:${v.host || t.domain}`;
        edges.push({ source: targetHost, target: vulnNodeId, type: "HAS_VULNERABILITY" });
      });
    });

    const graphData = {
      nodes,
      edges,
      impactPath: fromNode && toNode && nodes.length > 0 ? nodes.map((n) => n.id).slice(0, 4) : null,
      topologyRiskScore: maxRisk || 0,
    };

    return NextResponse.json({ ok: true, data: graphData });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
