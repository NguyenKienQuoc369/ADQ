export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendOastPing = () => {
        const now = new Date().toISOString();
        const cbId = `cb_${Date.now().toString().slice(-4)}`;
        const ips = ["52.14.88.102", "34.201.12.99", "18.220.10.45", "104.28.18.91"];
        const methods = ["GET", "POST", "DNS", "HTTP"];

        const callback = {
          id: cbId,
          timestamp: now,
          remoteIp: ips[Math.floor(Math.random() * ips.length)],
          method: methods[Math.floor(Math.random() * methods.length)],
          path: `/callback/uuid_ssrf_${Math.floor(Math.random() * 8999) + 1000}`,
          userAgent: "Python-urllib/3.11 (OAST Verification Probe)",
          headers: {
            Host: "oast.adq-sec.internal:8888",
            "X-AWS-Ec2-Instance-Id": `i-0988${Math.floor(Math.random() * 89) + 10}abf`,
          },
        };

        const payload = `data: ${JSON.stringify({ type: "OAST_PINGBACK", data: callback })}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      // Send initial OAST callback ping
      sendOastPing();

      // Emit random OAST pings every 3 seconds
      const interval = setInterval(() => {
        try {
          if (Math.random() < 0.7) {
            sendOastPing();
          }
        } catch (err) {
          clearInterval(interval);
        }
      }, 3000);

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
