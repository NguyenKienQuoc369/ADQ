import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apk_path } = body;

    if (!apk_path) {
      return NextResponse.json({ ok: false, error: "Missing apk_path" }, { status: 400 });
    }

    const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    
    try {
      const backendRes = await fetch(`${backendUrl}/api/apk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apk_path }),
      });

      const data = await backendRes.json();
      return NextResponse.json(data);
    } catch (err: any) {
      console.warn("[APK API Route] Backend API server unavailable:", err);
      return NextResponse.json({
        ok: false,
        error: "Backend API Server offline. Cannot decompile APK locally on Vercel Node runtime."
      });
    }
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
