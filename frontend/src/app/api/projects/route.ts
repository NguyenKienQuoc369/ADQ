import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPrismaClient } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const prisma = getPrismaClient();

// Helper lấy thông tin user đang đăng nhập từ Supabase
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

export async function GET(request: Request) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userEmail = (authUser.email ?? "").toLowerCase().trim();
    const userId = authUser.id;

    // Lấy toàn bộ targets kèm chi tiết
    const allTargets = await prisma.target.findMany({
      orderBy: { createdAt: "desc" },
      include: { projectDetail: true },
    });

    // Lọc các dự án thuộc về tài khoản hiện tại
    const userTargets = allTargets.filter((t) => {
      const summary = (t.projectDetail?.summary as any) || {};
      const ownerEmail = (summary.userEmail ?? "").toLowerCase().trim();
      const ownerId = summary.userId ?? "";

      // Khớp email hoặc Supabase User ID
      return ownerEmail === userEmail || ownerId === userId;
    });

    return NextResponse.json({ ok: true, projects: userTargets });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userEmail = (authUser.email ?? "").toLowerCase().trim();
    const userId = authUser.id;

    const body = await req.json();
    const name = (body.name || "untitled").toString().trim();
    const description = (body.description || body.projectInfo || "").toString();
    const module = (body.module || "web").toString();
    const password = body.password !== undefined && body.password !== null ? String(body.password) : "";

    // Domain người dùng nhập dùng cho scanner phải luôn là hostname sạch.
    // `domain` bên DB vẫn có suffix user để tránh collision giữa project,
    // còn `summary.domain` giữ target thật để scanner sử dụng.
    const rawDomainInput = (
      body.domain || `${name.replace(/\s+/g, "-").toLowerCase()}`
    ).toString().trim();

    const rawDomain = rawDomainInput
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      .trim()
      .replace(/\/+$/, "");

    if (!rawDomain) {
      return NextResponse.json(
        { ok: false, error: "Domain không hợp lệ." },
        { status: 400 }
      );
    }

    const domain = rawDomain.includes("@")
      ? rawDomain
      : `${rawDomain}-${userId.slice(0, 6)}`;

    const summary = {
      projectInfo: description,
      password: password || null,
      module,
      domain: rawDomain,
      userEmail,
      userId,
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

    return NextResponse.json({
      ok: true,
      project: {
        ...created,
        name: created.projectDetail?.title ?? name,
        description,
        module,
        password,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
