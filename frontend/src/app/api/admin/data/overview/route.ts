import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin";
import { getAdminSystemOverview } from "@/lib/admin-data-sources";

export async function GET() {
  try {
    await requireAdminRequest();
    const overview = await getAdminSystemOverview();
    return NextResponse.json(overview);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "UNAUTHORIZED" },
      { status: err.status || 401 }
    );
  }
}
