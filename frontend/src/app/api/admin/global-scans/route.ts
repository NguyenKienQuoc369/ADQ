import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.adq.io.vn";
    const res = await fetch(`${backendUrl}/api/admin/global-scans`, {
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to fetch global scans" },
      { status: 500 }
    );
  }
}
