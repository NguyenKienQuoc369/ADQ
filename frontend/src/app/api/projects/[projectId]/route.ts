import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";

const prisma = getPrismaClient();

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const project = await prisma.target.findUnique({
      where: { id: projectId },
      include: { projectDetail: true },
    });

    if (!project) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, project });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const existing = await prisma.target.findUnique({ where: { id: projectId } });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
    }

    await prisma.projectDetail.deleteMany({ where: { projectId } });
    await prisma.target.delete({ where: { id: projectId } });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
