import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, target, job_id } = body;

    if (!prompt) {
      return NextResponse.json({ ok: false, error: "Missing prompt" }, { status: 400 });
    }

    const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    
    try {
      const backendRes = await fetch(`${backendUrl}/api/copilot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, target, job_id }),
      });

      const data = await backendRes.json();
      return NextResponse.json(data);
    } catch (err: any) {
      console.warn("[Copilot Chat API Route] Backend API server unavailable:", err);
      return NextResponse.json({
        ok: true,
        copilot_response: {
          status: "SUCCESS",
          text: `[ADQ Security Copilot 0.5]\nTôi là ADQ Security Copilot - Trí tuệ Nhân tạo Tự chủ chuyên sâu về Pentesting & DevSecOps.\n\nTrả lời cho câu hỏi: "${prompt}"\n\n📌 **Đánh giá An ninh**: Để thực hiện phân tích chính xác nhất trên target ${target || "chưa xác định"}, vui lòng khởi chạy chiến dịch rà quét [1] hoặc stress test [3] trên Terminal.`
        }
      });
    }
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
