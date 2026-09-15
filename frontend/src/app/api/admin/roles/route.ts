import { NextResponse } from "next/server";
import { requireSocAdmin, isAllowedSocHost } from "@/lib/soc-auth";
import { getPrismaClient } from "@/lib/prisma";

export async function GET(request: Request) {
  if (!isAllowedSocHost(request)) {
    return NextResponse.json({ error: "SOC_HOST_REQUIRED" }, { status: 403 });
  }

  try {
    const currentAdmin = await requireSocAdmin();
    const prisma = getPrismaClient();

    // 1. Fetch all SOC Admins
    const admins = await prisma.socAdmin.findMany({
      orderBy: { createdAt: "asc" },
    });

    // 2. Fetch available Supabase users for convenient assignment
    let availableUsers: { id: string; email: string; name: string }[] = [];
    try {
      const dbUsers = await prisma.adminUser.findMany({
        select: {
          authUserId: true,
          email: true,
          name: true,
        },
        take: 100,
      });

      const existingAuthIds = new Set(admins.map((a) => a.userAuthId));
      availableUsers = dbUsers
        .filter((u): u is typeof u & { authUserId: string } => Boolean(u.authUserId) && !existingAuthIds.has(u.authUserId!))
        .map((u) => ({
          id: u.authUserId,
          email: u.email,
          name: u.name || u.email,
        }));
    } catch {}

    const totalAdmins = admins.length;
    const activeAdmins = admins.filter((a) => a.enabled).length;
    const revokedAdmins = admins.filter((a) => !a.enabled).length;

    return NextResponse.json({
      ok: true,
      currentAdmin: {
        userAuthId: currentAdmin.userAuthId,
        emailSnapshot: currentAdmin.emailSnapshot,
        role: currentAdmin.role,
      },
      stats: {
        total: totalAdmins,
        active: activeAdmins,
        revoked: revokedAdmins,
        rolesCount: {
          SOC_ADMIN: admins.filter((a) => a.role === "SOC_ADMIN" && a.enabled).length,
          SOC_OPERATOR: admins.filter((a) => a.role === "SOC_OPERATOR" && a.enabled).length,
          SOC_SECURITY: admins.filter((a) => a.role === "SOC_SECURITY" && a.enabled).length,
          SOC_AUDITOR: admins.filter((a) => a.role === "SOC_AUDITOR" && a.enabled).length,
        },
      },
      admins,
      availableUsers,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_SOC_ADMIN") {
      return NextResponse.json({ error: "UNAUTHORIZED_SOC_ADMIN" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || "Failed to fetch SOC roles" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAllowedSocHost(request)) {
    return NextResponse.json({ error: "SOC_HOST_REQUIRED" }, { status: 403 });
  }

  try {
    const currentAdmin = await requireSocAdmin();
    const body = await request.json().catch(() => ({}));
    const userAuthId = String(body.userAuthId || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "SOC_ADMIN").trim().toUpperCase();

    if (!userAuthId || userAuthId.length < 10) {
      return NextResponse.json({ error: "Supabase User Auth UUID không hợp lệ." }, { status: 400 });
    }

    const validRoles = ["SOC_ADMIN", "SOC_OPERATOR", "SOC_SECURITY", "SOC_AUDITOR"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Vai trò không hợp lệ. Hỗ trợ: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    const prisma = getPrismaClient();

    const record = await prisma.socAdmin.upsert({
      where: { userAuthId },
      update: {
        role,
        enabled: true,
        emailSnapshot: email || undefined,
        revokedAt: null,
      },
      create: {
        userAuthId,
        emailSnapshot: email || "admin@adq.io.vn",
        role,
        enabled: true,
      },
    });

    // Audit log
    await prisma.adminAction.create({
      data: {
        adminAuthUserId: currentAdmin.userAuthId,
        action: "SOC_ROLE_GRANTED",
        detail: {
          grantedTo: userAuthId,
          email,
          role,
          grantedBy: currentAdmin.userAuthId,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({ ok: true, admin: record });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_SOC_ADMIN") {
      return NextResponse.json({ error: "UNAUTHORIZED_SOC_ADMIN" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || "Failed to grant SOC role" }, { status: 500 });
  }
}
