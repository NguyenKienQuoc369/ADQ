import { NextResponse } from "next/server";
import { isSocSessionValid } from "@/lib/soc-auth";

export async function GET() {
  const authenticated = await isSocSessionValid();

  if (!authenticated) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    realm: "ADQ_SOC",
  });
}
