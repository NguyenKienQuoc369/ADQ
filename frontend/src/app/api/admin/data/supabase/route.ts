import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin";
import {
  getSupabaseReconciliation,
  getSupabaseUsersList,
} from "@/lib/admin-data-sources";

export async function GET(request: Request) {
  try {
    await requireAdminRequest();

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "users";
    const page = Number.parseInt(searchParams.get("page") || "1", 10);
    const limit = Number.parseInt(searchParams.get("limit") || "25", 10);

    if (view === "reconciliation") {
      const reconciliation = await getSupabaseReconciliation();
      return NextResponse.json(reconciliation);
    }

    const usersData = await getSupabaseUsersList(page, limit);
    return NextResponse.json(usersData);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "UNAUTHORIZED" },
      { status: 400 }
    );
  }
}
