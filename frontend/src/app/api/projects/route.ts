import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";

const prisma = getPrismaClient();

export async function GET() {
  try {
    const targets = await prisma.target.findMany({
      orderBy: { createdAt: "desc" },
      include: { projectDetail: true },
    });
    return NextResponse.json({ ok: true, projects: targets });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = (body.name || "untitled").toString();
    const description = (body.description || body.projectInfo || "").toString();
    const module = (body.module || "web").toString();
    const password = body.password !== undefined && body.password !== null ? String(body.password) : "";
    const domain = (body.domain || `${name.replace(/\s+/g, "-").toLowerCase()}`).toString();

    const summary = {
      projectInfo: description,
      password: password || null,
      module,
      domain,
    };

    let existing = await prisma.target.findUnique({ where: { domain } });
    if (existing) {
      await prisma.projectDetail.upsert({
        where: { projectId: existing.id },
        update: {
          title: name,
          description,
          module,
          status: "ACTIVE",
          summary,
        },
        create: {
          projectId: existing.id,
          title: name,
          description,
          module,
          status: "ACTIVE",
          riskScore: 0,
          summary,
        },
      });
      return NextResponse.json({ ok: true, project: { ...existing, name, description, module, password } });
    }

    const created = await prisma.target.create({
      data: {
        domain,
        projectDetail: {
          create: {
            title: name,
            description,
            module,
            status: "ACTIVE",
            riskScore: 0,
            summary,
          },
        },
      },
      include: { projectDetail: true },
    });

    return NextResponse.json({ ok: true, project: { ...created, name: created.projectDetail?.title ?? name, description, module, password } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
