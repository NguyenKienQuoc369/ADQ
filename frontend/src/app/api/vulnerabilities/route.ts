import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";

export async function GET() {
  try {
    const prisma = getPrismaClient();
    const dbVulns = await prisma.vulnerability.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        scanJob: true,
      },
    });

    const vulnerabilities = dbVulns.map((v) => {
      let rawReq = "";
      let rawRes = "";
      if (v.raw) {
        try {
          const parsed = JSON.parse(v.raw);
          rawReq = parsed.rawRequest || parsed.request || v.raw;
          rawRes = parsed.rawResponse || parsed.response || "";
        } catch {
          rawReq = v.raw;
        }
      }

      return {
        id: v.id,
        title: v.templateId || `${v.severity || "MEDIUM"} Vulnerability on ${v.host || v.scanJob?.targetDomain || "Target"}`,
        cveId: v.templateId || "CVE-UNKNOWN",
        severity: (v.severity || "MEDIUM").toUpperCase(),
        cvss: v.severity === "CRITICAL" ? 9.5 : v.severity === "HIGH" ? 8.0 : v.severity === "MEDIUM" ? 5.5 : 3.0,
        host: v.host || v.scanJob?.targetDomain || "Unknown Host",
        endpoint: v.endpoint || "/",
        source: v.source || "ADQ Engine",
        rawRequest: rawReq,
        rawResponse: rawRes,
        oastCorrelation: null,
        createdAt: v.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      ok: true,
      count: vulnerabilities.length,
      vulnerabilities,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
