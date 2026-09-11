import { NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest, syncAdminUserFromAuthUser, toUserRecord } from "@/lib/admin";

export async function GET(request: Request) {
  try {
    const dataUser = await getAuthenticatedUserFromRequest(request);
    if (!dataUser) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const row = await syncAdminUserFromAuthUser(dataUser);
    const appUser = {
      ...toUserRecord(row, dataUser),
      lastLoginAt: dataUser.last_sign_in_at ?? row.lastLoginAt ?? new Date().toISOString(),
    };

    if (appUser.status === "LOCKED") {
      return NextResponse.json({ error: "LOCKED", user: appUser }, { status: 403 });
    }

    return NextResponse.json({ ok: true, user: appUser });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to fetch account." }, { status: 500 });
  }
}
