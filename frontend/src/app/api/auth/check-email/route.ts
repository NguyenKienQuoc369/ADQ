import { NextResponse } from "next/server";
import { findSupabaseAuthUserByEmail } from "@/lib/admin";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const email = String(payload?.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) return NextResponse.json({ exists: false });

    const user = await findSupabaseAuthUserByEmail(email);
    return NextResponse.json({ exists: Boolean(user) });
  } catch (err: any) {
    console.error("check-email failed:", err);
    return NextResponse.json({
      exists: false,
      error: err?.message ?? "Email lookup failed",
      warning: "Supabase Auth admin lookup is unavailable. Registration will continue and Supabase will reject duplicates server-side.",
    });
  }
}
