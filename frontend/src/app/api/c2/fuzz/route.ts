import { NextResponse } from "next/server";

type FuzzRequestBody = {
  url?: string;
  method?: string;
  params?: string[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as FuzzRequestBody;
    const { url, method, params } = body;

    if (!url) {
      return NextResponse.json({ ok: false, error: "Endpoint URL is required" }, { status: 400 });
    }

    const taskId = `fuzz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    return NextResponse.json({
      ok: true,
      message: `Endpoint '${url}' queued for Targeted Parameter Discovery & Deep Logic Scan`,
      taskId,
      assignedProfile: "deep_logic",
      targetUrl: url,
      method: method || "GET",
      fuzzParams: params || [],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không thể tạo tác vụ fuzz." },
      { status: 500 },
    );
  }
}
