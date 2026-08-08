import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const showNewOnly = url.searchParams.get("showNewOnly") === "true";
  const showDroppedWAF = url.searchParams.get("showDroppedWAF") === "true";

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

    const matrix = targets.map((t, idx) => {
      const latestJob = t.scanJobs[0];
      const liveHosts = latestJob?.liveHosts || [];

      const subdomains = liveHosts.map((lh, subIdx) => {
        let parsedUrl: URL | null = null;
        try {
          parsedUrl = new URL(lh.url || `http://${lh.title || t.domain}`);
        } catch {
          // ignore
        }

        const subDomainName = parsedUrl ? parsedUrl.hostname : lh.url || t.domain;
        const portNumber = parsedUrl?.port ? parseInt(parsedUrl.port) : parsedUrl?.protocol === "https:" ? 443 : 80;
        const serviceName = lh.title ? `${parsedUrl?.protocol?.toUpperCase() || "HTTP"} / ${lh.title}` : "HTTP Service";

        return {
          id: `sub-${t.id}-${subIdx}`,
          subdomain: subDomainName,
          ip: "DYNAMIC_RESOLVED",
          isNew: true,
          wafStatus: lh.title?.toLowerCase().includes("cloudflare") ? "PROTECTED_CLOUDFLARE" : "DROPPED_NO_WAF",
          ports: [
            {
              port: portNumber,
              service: serviceName,
              endpoints: [
                {
                  id: `ep-${lh.id}`,
                  method: lh.method || "GET",
                  path: parsedUrl ? parsedUrl.pathname : "/",
                  statusCode: lh.statusCode || 200,
                  isNew: true,
                  hasWaf: false,
                  params: [],
                },
              ],
            },
          ],
        };
      });

      return {
        id: `root-${t.id}`,
        domain: t.domain,
        isNew: false,
        wafStatus: "MONITORED",
        subdomains,
      };
    });

    // Filter matrix according to delta toggles
    let filteredMatrix = matrix.map((root) => ({
      ...root,
      subdomains: root.subdomains.filter((sub) => {
        if (showNewOnly && !sub.isNew) return false;
        if (showDroppedWAF && sub.wafStatus !== "DROPPED_NO_WAF") return false;
        return true;
      }),
    }));

    return NextResponse.json({
      ok: true,
      totalRoots: filteredMatrix.length,
      matrix: filteredMatrix,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
