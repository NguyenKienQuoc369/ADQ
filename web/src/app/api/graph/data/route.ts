import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fromNode = url.searchParams.get("from");
  const toNode = url.searchParams.get("to");

  const graphData = {
    nodes: [
      { id: "domain:target-enterprise.com", label: "target-enterprise.com", type: "DOMAIN", risk: 95 },
      { id: "domain:api.target-enterprise.com", label: "api.target-enterprise.com", type: "DOMAIN", risk: 85 },
      { id: "domain:staging.target-enterprise.com", label: "staging.target-enterprise.com", type: "DOMAIN", risk: 90 },
      { id: "endpoint:https://api.target-enterprise.com/api/v1/users/profile", label: "/api/v1/users/profile", type: "API_ENDPOINT", risk: 70 },
      { id: "endpoint:https://staging.target-enterprise.com/internal/debug/eval", label: "/internal/debug/eval", type: "API_ENDPOINT", risk: 98 },
      { id: "param:user_id", label: "param: user_id", type: "PARAMETER", risk: 60 },
      { id: "secret:JWT_EXPOSED_KEY", label: "Secret: JWT_SECRET_KEY_PROD_2026", type: "SECRET", risk: 99 },
      { id: "vuln:CVE-2026-9912-RCE", label: "Vuln: RCE in Debug Eval", type: "VULNERABILITY", risk: 100 },
      { id: "vuln:IDOR-BOLA-USER-3312", label: "Vuln: BOLA Profile Account Takeover", type: "VULNERABILITY", risk: 88 }
    ],
    edges: [
      { source: "domain:target-enterprise.com", target: "domain:api.target-enterprise.com", type: "HOSTS" },
      { source: "domain:target-enterprise.com", target: "domain:staging.target-enterprise.com", type: "HOSTS" },
      { source: "domain:api.target-enterprise.com", target: "endpoint:https://api.target-enterprise.com/api/v1/users/profile", type: "EXPOSES" },
      { source: "domain:staging.target-enterprise.com", target: "endpoint:https://staging.target-enterprise.com/internal/debug/eval", type: "EXPOSES" },
      { source: "endpoint:https://api.target-enterprise.com/api/v1/users/profile", target: "param:user_id", type: "HAS_PARAMETER" },
      { source: "endpoint:https://staging.target-enterprise.com/internal/debug/eval", target: "secret:JWT_EXPOSED_KEY", type: "HAS_SECRET" },
      { source: "endpoint:https://staging.target-enterprise.com/internal/debug/eval", target: "vuln:CVE-2026-9912-RCE", type: "HAS_VULNERABILITY" },
      { source: "param:user_id", target: "vuln:IDOR-BOLA-USER-3312", type: "HAS_VULNERABILITY" }
    ],
    impactPath: fromNode && toNode ? [
      "secret:JWT_EXPOSED_KEY",
      "endpoint:https://staging.target-enterprise.com/internal/debug/eval",
      "domain:staging.target-enterprise.com",
      "domain:target-enterprise.com"
    ] : null,
    topologyRiskScore: 91
  };

  return NextResponse.json({ ok: true, data: graphData });
}
