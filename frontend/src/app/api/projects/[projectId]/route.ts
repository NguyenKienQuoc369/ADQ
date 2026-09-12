import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { getAuthenticatedUserFromRequest } from "@/lib/admin";
import { isProjectAuthorized } from "@/lib/tenant-isolation";

const prisma = getPrismaClient();

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const authUser = await getAuthenticatedUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { projectId } = await params;
    const project = await prisma.target.findUnique({
      where: { id: projectId },
      include: { projectDetail: true },
    });

    if (!project || !isProjectAuthorized(authUser, project)) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, project });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const authUser = await getAuthenticatedUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { projectId } = await params;
    const existing = await prisma.target.findUnique({
      where: { id: projectId },
      include: { projectDetail: true },
    });

    if (!existing || !isProjectAuthorized(authUser, existing)) {
      return NextResponse.json({ ok: false, error: "Forbidden: You do not own this project" }, { status: 403 });
    }

    await prisma.projectDetail.deleteMany({ where: { projectId } });
    await prisma.target.delete({ where: { id: projectId } });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
