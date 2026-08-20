import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPrismaClient } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const prisma = getPrismaClient();

async function getAuthenticatedUser(request: Request) {
  let authUser: any = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    authUser = data.user ?? null;
  } catch {
    authUser = null;
  }

  if (!authUser) {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && anonKey && token) {
        const client = createClient(url, anonKey);
        try {
          (client.auth as any).setAuth(token);
          const { data } = await client.auth.getUser();
          authUser = data.user ?? null;
        } catch {
          authUser = null;
        }
      }
    }
  }
  return authUser;
}

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { projectId } = await params;
    const project = await prisma.target.findUnique({
      where: { id: projectId },
      include: { projectDetail: true },
    });

    if (!project) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
    }

    // Kiểm tra quyền sở hữu
    const summary = (project.projectDetail?.summary as any) || {};
    const ownerEmail = (summary.userEmail ?? "").toLowerCase().trim();
    const ownerId = summary.userId ?? "";

    if (ownerEmail && ownerEmail !== (authUser.email ?? "").toLowerCase().trim() && ownerId !== authUser.id) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, project });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { projectId } = await params;
    const existing = await prisma.target.findUnique({
      where: { id: projectId },
      include: { projectDetail: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
    }

    // Kiểm tra quyền sở hữu trước khi xoá
    const summary = (existing.projectDetail?.summary as any) || {};
    const ownerEmail = (summary.userEmail ?? "").toLowerCase().trim();
    const ownerId = summary.userId ?? "";

    if (ownerEmail && ownerEmail !== (authUser.email ?? "").toLowerCase().trim() && ownerId !== authUser.id) {
      return NextResponse.json({ ok: false, error: "Forbidden: You do not own this project" }, { status: 403 });
    }

    await prisma.projectDetail.deleteMany({ where: { projectId } });
    await prisma.target.delete({ where: { id: projectId } });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
