import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const dbVulns = await prisma.vulnerability.findMany({
      orderBy: { createdAt: "desc" },
    });

    const mockVulns = [
      {
        id: 101,
        title: "Pre-Auth Remote Code Execution (RCE) in Debug Eval Endpoint",
        cveId: "CVE-2026-9912",
        severity: "CRITICAL",
        cvss: 9.8,
        host: "staging.target-enterprise.com",
        endpoint: "/internal/debug/eval",
        source: "Nuclei / Deep Logic",
        rawRequest: `POST /internal/debug/eval HTTP/1.1
Host: staging.target-enterprise.com
User-Agent: ADQ-Enterprise-Scanner/2.0
Content-Type: application/json
X-Forwarded-For: 203.0.113.19

{
  "cmd": "id",
  "secret_key": "JWT_SECRET_KEY_PROD_2026"
}`,
        rawResponse: `HTTP/1.1 200 OK
Server: Node.js Express/4.18
Content-Type: application/json; charset=utf-8
Content-Length: 142
Connection: keep-alive

{
  "status": "success",
  "executed": true,
  "output": "uid=0(root) gid=0(root) groups=0(root)",
  "host": "ip-10-0-12-88.ec2.internal"
}`,
        oastCorrelation: "OAST-8888-PINGBACK-CONFIRMED",
        createdAt: new Date().toISOString(),
      },
      {
        id: 102,
        title: "Cross-Tenant BOLA / IDOR Account Takeover",
        cveId: "CWE-639",
        severity: "HIGH",
        cvss: 8.5,
        host: "api.target-enterprise.com",
        endpoint: "/api/v1/users/profile?user_id=10029",
        source: "ADQ IDOR Scanner",
        rawRequest: `GET /api/v1/users/profile?user_id=10029 HTTP/1.1
Host: api.target-enterprise.com
Authorization: Bearer user_a_token_abc123
User-Agent: ADQ-Evasion-Engine/1.1
Accept: application/json`,
        rawResponse: `HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 320

{
  "user_id": 10029,
  "email": "ceo@target-enterprise.com",
  "role": "SUPER_ADMIN",
  "ssn": "XXX-XX-8912",
  "mfa_enabled": false,
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}`,
        oastCorrelation: null,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 103,
        title: "Blind SSRF via Image Metadata Webhook Parser",
        cveId: "CWE-918",
        severity: "HIGH",
        cvss: 8.1,
        host: "api.target-enterprise.com",
        endpoint: "/api/v1/avatar/upload_url",
        source: "ADQ OAST Interaction Server",
        rawRequest: `POST /api/v1/avatar/upload_url HTTP/1.1
Host: api.target-enterprise.com
Content-Type: application/json

{
  "image_url": "http://oast-adq-8888.internal/callback/uuid_ssrf_9912"
}`,
        rawResponse: `HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "processing",
  "job_id": "img_parse_8812"
}`,
        oastCorrelation: "http://oast-adq-8888.internal/callback/uuid_ssrf_9912 - HTTP GET Received from 52.14.88.102 (AWS)",
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 104,
        title: "Race Condition Double Spending in Payment Transfer",
        cveId: "CWE-362",
        severity: "HIGH",
        cvss: 7.8,
        host: "api.target-enterprise.com",
        endpoint: "/api/v2/payment/transfer",
        source: "ADQ Race Condition Engine",
        rawRequest: `POST /api/v2/payment/transfer HTTP/1.1
Host: api.target-enterprise.com
Authorization: Bearer user_a_token_abc123
Content-Type: application/json

{
  "account_id": "acc_8812",
  "amount": 1000,
  "currency": "USD"
}`,
        rawResponse: `HTTP/1.1 200 OK (5 Concurrent Requests Executed Simultaneously)
Balance updated: -$5,000 (Original Balance: $1,000)`,
        oastCorrelation: null,
        createdAt: new Date(Date.now() - 10800000).toISOString(),
      }
    ];

    return NextResponse.json({
      ok: true,
      count: mockVulns.length,
      vulnerabilities: mockVulns,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
