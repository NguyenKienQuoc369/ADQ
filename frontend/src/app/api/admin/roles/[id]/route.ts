import { NextResponse } from "next/server";
import { requireSocAdmin, isAllowedSocHost } from "@/lib/soc-auth";
import { getPrismaClient } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAllowedSocHost(request)) {
    return NextResponse.json({ error: "SOC_HOST_REQUIRED" }, { status: 403 });
  }

  try {
    const currentAdmin = await requireSocAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const prisma = getPrismaClient();

    const existing = await prisma.socAdmin.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy quản trị viên SOC." }, { status: 404 });
    }

    const dataToUpdate: any = {};

    if (body.role !== undefined) {
      const validRoles = ["SOC_ADMIN", "SOC_OPERATOR", "SOC_SECURITY", "SOC_AUDITOR"];
      const newRole = String(body.role).trim().toUpperCase();
      if (!validRoles.includes(newRole)) {
        return NextResponse.json(
          { error: `Vai trò không hợp lệ. Hỗ trợ: ${validRoles.join(", ")}` },
          { status: 400 }
        );
      }
      dataToUpdate.role = newRole;
    }

    if (body.enabled !== undefined) {
      const enabled = Boolean(body.enabled);
      dataToUpdate.enabled = enabled;
      if (!enabled) {
        // Protect primary root admin from accidental disabling
        if (existing.emailSnapshot === "kienquocn64@gmail.com") {
          return NextResponse.json(
            { error: "Không thể vô hiệu hóa tài khoản Quản trị viên Root tối cao (kienquocn64@gmail.com)." },
            { status: 400 }
          );
        }
        dataToUpdate.revokedAt = new Date();
      } else {
        dataToUpdate.revokedAt = null;
      }
    }

    const updated = await prisma.socAdmin.update({
      where: { id },
      data: dataToUpdate,
    });

    // Audit log
    await prisma.adminAction.create({
      data: {
        adminAuthUserId: currentAdmin.userAuthId,
        action: body.enabled === false ? "SOC_ROLE_REVOKED" : "SOC_ROLE_UPDATED",
        detail: {
          adminId: id,
          targetAuthId: existing.userAuthId,
          email: existing.emailSnapshot,
          changes: dataToUpdate,
          updatedBy: currentAdmin.userAuthId,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({ ok: true, admin: updated });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_SOC_ADMIN") {
      return NextResponse.json({ error: "UNAUTHORIZED_SOC_ADMIN" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || "Failed to update SOC admin" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAllowedSocHost(request)) {
    return NextResponse.json({ error: "SOC_HOST_REQUIRED" }, { status: 403 });
  }

  try {
    const currentAdmin = await requireSocAdmin();
    const { id } = await params;

    const prisma = getPrismaClient();
    const existing = await prisma.socAdmin.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy quản trị viên SOC." }, { status: 404 });
    }

    // Protect root admin from deletion
    if (existing.emailSnapshot === "kienquocn64@gmail.com") {
      return NextResponse.json(
        { error: "Không thể xóa tài khoản Quản trị viên Root tối cao (kienquocn64@gmail.com)." },
        { status: 400 }
      );
    }

    // Soft delete (mark disabled and revoked)
    const updated = await prisma.socAdmin.update({
      where: { id },
      data: {
        enabled: false,
        revokedAt: new Date(),
      },
    });

    // Audit log
    await prisma.adminAction.create({
      data: {
        adminAuthUserId: currentAdmin.userAuthId,
        action: "SOC_ROLE_REVOKED",
        detail: {
          adminId: id,
          targetAuthId: existing.userAuthId,
          email: existing.emailSnapshot,
          revokedBy: currentAdmin.userAuthId,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({ ok: true, message: "Đã thu hồi quyền quản trị SOC thành công." });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_SOC_ADMIN") {
      return NextResponse.json({ error: "UNAUTHORIZED_SOC_ADMIN" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || "Failed to revoke SOC admin" }, { status: 500 });
  }
}
