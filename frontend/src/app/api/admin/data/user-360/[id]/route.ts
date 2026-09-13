import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin";
import { getUser360Profile } from "@/lib/admin-data-sources";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminRequest();

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "User ID or Email is required" },
        { status: 400 }
      );
    }

    const profile = await getUser360Profile(decodeURIComponent(id));
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "UNAUTHORIZED" },
      { status: 400 }
    );
  }
}
