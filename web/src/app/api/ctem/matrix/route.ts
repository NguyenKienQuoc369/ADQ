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
          },
        },
      },
    });

    // Generate enriched CTEM Nested Surface Matrix
    const matrix = [
      {
        id: "root-1",
        domain: "target-enterprise.com",
        isNew: false,
        wafStatus: "PROTECTED_CLOUDFLARE",
        subdomains: [
          {
            id: "sub-1",
            subdomain: "api.target-enterprise.com",
            ip: "104.21.48.12",
            isNew: true, // Delta flag
            wafStatus: "DROPPED_NO_WAF", // Delta flag
            ports: [
              {
                port: 443,
                service: "HTTPS / Nginx 1.24",
                endpoints: [
                  {
                    id: "ep-1",
                    method: "POST",
                    path: "/api/v1/auth/login",
                    statusCode: 200,
                    isNew: false,
                    hasWaf: true,
                    params: ["username", "password", "captcha_token"],
                  },
                  {
                    id: "ep-2",
                    method: "GET",
                    path: "/api/v1/users/profile",
                    statusCode: 200,
                    isNew: true, // Delta
                    hasWaf: false,
                    params: ["user_id", "access_token", "debug_mode"],
                  },
                  {
                    id: "ep-3",
                    method: "POST",
                    path: "/api/v2/payment/transfer",
                    statusCode: 403,
                    isNew: true, // Delta
                    hasWaf: false,
                    params: ["account_id", "amount", "currency", "idempotency_key"],
                  },
                ],
              },
            ],
          },
          {
            id: "sub-2",
            subdomain: "staging.target-enterprise.com",
            ip: "159.65.132.8",
            isNew: true, // Delta flag
            wafStatus: "DROPPED_NO_WAF", // Delta flag
            ports: [
              {
                port: 8080,
                service: "HTTP / Node.js Express",
                endpoints: [
                  {
                    id: "ep-4",
                    method: "GET",
                    path: "/graphql",
                    statusCode: 200,
                    isNew: true,
                    hasWaf: false,
                    params: ["query", "variables", "operationName"],
                  },
                  {
                    id: "ep-5",
                    method: "POST",
                    path: "/internal/debug/eval",
                    statusCode: 500,
                    isNew: true,
                    hasWaf: false,
                    params: ["cmd", "secret_key"],
                  },
                ],
              },
            ],
          },
          {
            id: "sub-3",
            subdomain: "admin.target-enterprise.com",
            ip: "104.21.48.15",
            isNew: false,
            wafStatus: "PROTECTED_AWS_WAF",
            ports: [
              {
                port: 443,
                service: "HTTPS / Cloudflare",
                endpoints: [
                  {
                    id: "ep-6",
                    method: "GET",
                    path: "/admin/dashboard",
                    statusCode: 302,
                    isNew: false,
                    hasWaf: true,
                    params: ["redirect", "session_id"],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

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
