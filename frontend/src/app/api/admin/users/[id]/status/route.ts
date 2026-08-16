import { NextResponse } from "next/server";

import { normaliseStatus, requireAdminRequest, resolveSupabaseAuthUser, toUserRecord } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPrismaClient } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentAdmin = await requireAdminRequest();
    const { id } = await params;
    const payload = await request.json();
    const prisma = getPrismaClient();
    const newStatus = normaliseStatus(payload?.status ?? "ACTIVE");
    const existing = await prisma.adminUser.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });
    }

    const authUser = await resolveSupabaseAuthUser(existing);
    if ((existing.authUserId && existing.authUserId === currentAdmin.id) || authUser?.id === currentAdmin.id) {
      return NextResponse.json({ error: "Bạn không thể tự khóa tài khoản admin hiện tại." }, { status: 400 });
    }

    const record = await prisma.adminUser.update({
      where: { id },
      data: {
        authUserId: authUser?.id ?? existing.authUserId ?? null,
        status: newStatus,
      },
    });

    // If the admin locked the user, attempt to revoke all Supabase sessions for that user
    if (authUser?.id) {
      try {
        const admin = createSupabaseAdminClient();
        await admin.auth.admin.updateUserById(authUser.id, {
          user_metadata: {
            ...(authUser.user_metadata ?? {}),
            status: newStatus,
          },
          app_metadata: {
            ...(authUser.app_metadata ?? {}),
            status: newStatus,
          },
        });

        try {
          const { invalidateSupabaseSessionsForUser } = await import("@/lib/supabase/revoke");
          const result = await invalidateSupabaseSessionsForUser(authUser.id);
          if (!result.ok) {
            console.warn("Session revoke skipped; candidate methods not available.", result.tried);
          }
        } catch (e) {
          console.error("Failed during session revoke attempts", e);
        }
      } catch (revokeErr: any) {
        console.error("Failed to sync status or revoke user sessions for", authUser.id, revokeErr?.message ?? revokeErr);
      }
    }

    // Log admin action and queue email notification if possible
    try {
      const { logAdminAction } = await import("@/lib/admin-actions");
      const { queueEmail } = await import("@/lib/mail");
      await logAdminAction(currentAdmin?.id ?? null, id ?? null, newStatus === "LOCKED" ? "lock_user" : "update_status", { status: newStatus });
      if (authUser?.email) {
        const subject = newStatus === "LOCKED" ? "Tài khoản của bạn đã bị khóa" : "Trạng thái tài khoản đã được cập nhật";
        const body = newStatus === "LOCKED" ? `Tài khoản ${authUser.email} đã bị khóa bởi quản trị viên.` : `Trạng thái tài khoản của bạn đã được cập nhật thành ${newStatus}.`;
        await queueEmail(authUser.email, subject, body);
      }
    } catch (err) {
      console.error("Failed to log/notify admin action", err);
    }

    return NextResponse.json({ user: toUserRecord(record) });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json({ error: error?.message ?? "Failed to update user status." }, { status: 500 });
  }
}
