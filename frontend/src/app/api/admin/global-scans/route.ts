import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdminRequest();
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (error?.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "SOC_AUTH_FAILED" },
      { status: 500 }
    );
  }

  try {
    const backendUrl =
      process.env.BACKEND_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "https://api.adq.io.vn";

    const authHeader = req.headers.get("authorization");
    let bearerToken: string | undefined = authHeader?.startsWith("Bearer ")
      ? authHeader
      : undefined;

    if (!bearerToken) {
      try {
        const supabase = await createSupabaseServerClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          bearerToken = `Bearer ${session.access_token}`;
        }
      } catch {}
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (bearerToken) {
      headers["Authorization"] = bearerToken;
    }

    const res = await fetch(`${backendUrl}/api/admin/global-scans`, {
      cache: "no-store",
      headers,
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
