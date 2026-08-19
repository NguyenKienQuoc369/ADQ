import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> | { jobId: string } }
) {
  try {
    const params = await context.params;
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.adq.io.vn";
    const res = await fetch(`${backendUrl}/api/admin/global-scans/${params.jobId}/kill`, {
      method: "POST",
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to terminate scan job" },
      { status: 500 }
    );
  }
}
