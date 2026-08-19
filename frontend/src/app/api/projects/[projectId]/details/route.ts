import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";

const prisma = getPrismaClient();

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const detail = await prisma.projectDetail.findUnique({
      where: { projectId },
    });

    return NextResponse.json({ ok: true, detail });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const body = await req.json();

    const project = await prisma.target.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
    }

    const currentDetail = await prisma.projectDetail.findUnique({ where: { projectId } });
    const currentSummary = (currentDetail?.summary as Record<string, any>) || {};

    const updatedSummary = {
      ...currentSummary,
      ...(body.summary || {}),
      ...(body.findings ? { findings: body.findings } : {}),
      ...(body.stressTest ? { stressTest: body.stressTest } : {}),
      ...(body.apkAudit ? { apkAudit: body.apkAudit } : {}),
    };

    const detail = await prisma.projectDetail.upsert({
      where: { projectId },
      update: {
        title: body.title ?? undefined,
        description: body.description ?? undefined,
        module: body.module ?? undefined,
        status: body.status ?? undefined,
        riskScore: body.riskScore ?? undefined,
        summary: updatedSummary,
        lastScanAt: body.lastScanAt ? new Date(body.lastScanAt) : undefined,
      },
      create: {
        projectId,
        title: body.title ?? project.domain,
        description: body.description ?? "",
        module: body.module ?? "web",
        status: body.status ?? "ACTIVE",
        riskScore: body.riskScore ?? 0,
        summary: updatedSummary,
        lastScanAt: body.lastScanAt ? new Date(body.lastScanAt) : null,
      },
    });

    return NextResponse.json({ ok: true, detail });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
