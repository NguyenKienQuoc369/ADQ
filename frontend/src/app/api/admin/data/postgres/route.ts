import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin";
import {
  ALLOWLISTED_POSTGRES_TABLES,
  queryPostgresTable,
} from "@/lib/admin-data-sources";

export async function GET(request: Request) {
  try {
    await requireAdminRequest();

    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");

    // If no table specified, return the registry list of all tables
    if (!table) {
      return NextResponse.json({
        ok: true,
        tables: Object.values(ALLOWLISTED_POSTGRES_TABLES),
      });
    }

    const page = Number.parseInt(searchParams.get("page") || "1", 10);
    const limit = Number.parseInt(searchParams.get("limit") || "25", 10);
    const sortBy = searchParams.get("sortBy") || undefined;
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";
    const search = searchParams.get("search") || undefined;
    const filterField = searchParams.get("filterField") || undefined;
    const filterValue = searchParams.get("filterValue") || undefined;

    const data = await queryPostgresTable({
      table,
      page,
      limit,
      sortBy,
      sortOrder,
      search,
      filterField,
      filterValue,
    });

    return NextResponse.json({
      ok: true,
      ...data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "UNAUTHORIZED" },
      { status: 400 }
    );
  }
}
