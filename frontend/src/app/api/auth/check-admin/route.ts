import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) return NextResponse.json({ exists: false });

    const prisma = getPrismaClient();
    const existing = await prisma.adminUser.findFirst({ where: { email } });
    return NextResponse.json({ exists: Boolean(existing) });
  } catch (err: any) {
    return NextResponse.json({ exists: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
