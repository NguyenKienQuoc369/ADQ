import { NextResponse } from "next/server";

export async function GET() {
  const callbacks = [
    {
      id: "cb_001",
      timestamp: new Date().toISOString(),
      remoteIp: "52.14.88.102",
      method: "GET",
      path: "/callback/uuid_ssrf_9912",
      userAgent: "Python-urllib/3.11",
      headers: {
        Host: "oast.adq-sec.internal:8888",
        "X-AWS-Ec2-Instance-Id": "i-098812abf892",
      },
    },
    {
      id: "cb_002",
      timestamp: new Date(Date.now() - 150000).toISOString(),
      remoteIp: "34.201.12.99",
      method: "POST",
      path: "/dns/uuid_oast_rce_33",
      userAgent: "Go-http-client/1.1",
      headers: {
        Host: "oast.adq-sec.internal:8888",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  ];

  return NextResponse.json({ ok: true, callbacks });
}
