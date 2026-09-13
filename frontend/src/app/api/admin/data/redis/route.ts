import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin";
import {
  getRedisKeyValue,
  scanRedisKeys,
} from "@/lib/admin-data-sources";

export async function GET(request: Request) {
  try {
    await requireAdminRequest();

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (key) {
      const data = await getRedisKeyValue(key);
      return NextResponse.json(data);
    }

    const prefix = searchParams.get("prefix") || undefined;
    const cursor = searchParams.get("cursor") || "0";
    const limit = Number.parseInt(searchParams.get("limit") || "30", 10);

    const scanData = await scanRedisKeys({ prefix, cursor, limit });
    return NextResponse.json(scanData);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "UNAUTHORIZED" },
      { status: 400 }
    );
  }
}
