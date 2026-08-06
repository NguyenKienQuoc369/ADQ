export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendGridUpdate = () => {
        const now = new Date().toISOString();
        const workers = [
          {
            workerId: "worker-light-01",
            capability: "light-fast",
            profile: "recon_infra",
            currentTask: "subfinder target-enterprise.com",
            status: "WORKING",
            cpuUsage: `${Math.floor(Math.random() * 25) + 10}%`,
            ramUsage: `${Math.floor(Math.random() * 50) + 200}MB`,
            lastHeartbeat: now,
          },
          {
            workerId: "worker-light-02",
            capability: "light-fast",
            profile: "web_mapping",
            currentTask: "httpx --title --status-code",
            status: "WORKING",
            cpuUsage: `${Math.floor(Math.random() * 30) + 20}%`,
            ramUsage: `${Math.floor(Math.random() * 60) + 300}MB`,
            lastHeartbeat: now,
          },
          {
            workerId: "worker-elite-01",
            capability: "elite-clean-ip",
            profile: "dast_active",
            currentTask: "nuclei -t cves/2026/ -u https://api.target.com",
            status: "WORKING",
            cpuUsage: `${Math.floor(Math.random() * 40) + 50}%`,
            ramUsage: `${(Math.random() * 0.4 + 1.1).toFixed(1)}GB`,
            lastHeartbeat: now,
          },
          {
            workerId: "worker-elite-02",
            capability: "elite-clean-ip",
            profile: "deep_logic",
            currentTask: "IDOR/Race Condition Session Mapping",
            status: Math.random() > 0.4 ? "WORKING" : "IDLE",
            cpuUsage: `${Math.floor(Math.random() * 10) + 2}%`,
            ramUsage: "180MB",
            lastHeartbeat: now,
          },
          {
            workerId: "worker-stealth-01",
            capability: "residential-proxy",
            profile: "deep_logic",
            currentTask: "OAST Callback Verification",
            status: "IDLE",
            cpuUsage: "1%",
            ramUsage: "140MB",
            lastHeartbeat: now,
          },
        ];

        const payload = `data: ${JSON.stringify({ ok: true, timestamp: now, workers })}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      // Send initial heartbeat
      sendGridUpdate();

      // Stream every 2 seconds
      const interval = setInterval(() => {
        try {
          sendGridUpdate();
        } catch (err) {
          clearInterval(interval);
        }
      }, 2000);

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
