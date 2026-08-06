import { NextResponse } from "next/server";

export async function GET() {
  const now = new Date();
  const workers = [
    {
      workerId: "worker-light-01",
      capability: "light-fast",
      profile: "recon_infra",
      currentTask: "subfinder target-enterprise.com",
      status: "WORKING",
      cpuUsage: "14%",
      ramUsage: "210MB",
      lastHeartbeat: new Date(now.getTime() - 2000).toISOString(),
    },
    {
      workerId: "worker-light-02",
      capability: "light-fast",
      profile: "web_mapping",
      currentTask: "httpx --title --status-code",
      status: "WORKING",
      cpuUsage: "28%",
      ramUsage: "340MB",
      lastHeartbeat: new Date(now.getTime() - 1500).toISOString(),
    },
    {
      workerId: "worker-elite-01",
      capability: "elite-clean-ip",
      profile: "dast_active",
      currentTask: "nuclei -t cves/2026/ -u https://api.target.com",
      status: "WORKING",
      cpuUsage: "64%",
      ramUsage: "1.2GB",
      lastHeartbeat: new Date(now.getTime() - 800).toISOString(),
    },
    {
      workerId: "worker-elite-02",
      capability: "elite-clean-ip",
      profile: "deep_logic",
      currentTask: "IDOR/Race Condition Session Mapping",
      status: "IDLE",
      cpuUsage: "2%",
      ramUsage: "180MB",
      lastHeartbeat: new Date(now.getTime() - 3000).toISOString(),
    },
    {
      workerId: "worker-stealth-01",
      capability: "residential-proxy",
      profile: "deep_logic",
      currentTask: "OAST Callback Verification",
      status: "IDLE",
      cpuUsage: "1%",
      ramUsage: "140MB",
      lastHeartbeat: new Date(now.getTime() - 4200).toISOString(),
    },
  ];

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    activeWorkersCount: 5,
    workers,
  });
}
