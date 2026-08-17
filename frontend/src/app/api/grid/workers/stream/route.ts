import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendGridUpdate = async () => {
        const now = new Date().toISOString();
        let activeTarget = "";

        try {
          const prisma = getPrismaClient();
          const activeJobs = await prisma.scanJob.findMany({
            where: { status: "RUNNING" },
            orderBy: { createdAt: "desc" },
            take: 1,
          });
          if (activeJobs.length > 0) {
            activeTarget = activeJobs[0].targetDomain;
          }
        } catch {
          // ignore
        }

        const workers = [
          {
            workerId: "worker-light-01",
            capability: "light-fast",
            profile: "recon_infra",
            currentTask: activeTarget ? `subfinder ${activeTarget}` : "IDLE (Listening for dispatch)",
            status: activeTarget ? "WORKING" : "IDLE",
            cpuUsage: activeTarget ? `${Math.floor(Math.random() * 25) + 10}%` : "1%",
            ramUsage: "210MB",
            lastHeartbeat: now,
          },
          {
            workerId: "worker-light-02",
            capability: "light-fast",
            profile: "web_mapping",
            currentTask: activeTarget ? `httpx -u ${activeTarget}` : "IDLE (Listening for dispatch)",
            status: activeTarget ? "WORKING" : "IDLE",
            cpuUsage: activeTarget ? `${Math.floor(Math.random() * 30) + 20}%` : "1%",
            ramUsage: "310MB",
            lastHeartbeat: now,
          },
          {
            workerId: "worker-elite-01",
            capability: "elite-clean-ip",
            profile: "dast_active",
            currentTask: activeTarget ? `nuclei -u https://${activeTarget}` : "IDLE (Listening for dispatch)",
            status: activeTarget ? "WORKING" : "IDLE",
            cpuUsage: activeTarget ? `${Math.floor(Math.random() * 40) + 50}%` : "2%",
            ramUsage: "1.1GB",
            lastHeartbeat: now,
          },
          {
            workerId: "worker-stealth-01",
            capability: "residential-proxy",
            profile: "deep_logic",
            currentTask: activeTarget ? `OAST & Deep Logic Scan on ${activeTarget}` : "IDLE (Listening for dispatch)",
            status: activeTarget ? "WORKING" : "IDLE",
            cpuUsage: activeTarget ? "30%" : "1%",
            ramUsage: "180MB",
            lastHeartbeat: now,
          },
        ];

        const payload = `data: ${JSON.stringify({ ok: true, timestamp: now, workers })}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      // Send initial heartbeat
      await sendGridUpdate();

      // Stream every 3 seconds
      const interval = setInterval(() => {
        sendGridUpdate().catch(() => clearInterval(interval));
      }, 3000);

      // Clean up after 10 minutes or disconnect
      setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 600000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
