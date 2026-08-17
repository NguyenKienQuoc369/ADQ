import { NextResponse } from "next/server";

import { requireAdminRequest, resolveSupabaseAuthUser } from "@/lib/admin";
import { getPrismaClient } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentAdmin = await requireAdminRequest();
    const { id } = await params;

    const prisma = getPrismaClient();
    const record = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!record) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản cần xóa." }, { status: 404 });
    }

    if (record.authUserId && record.authUserId === currentAdmin.id) {
      return NextResponse.json({ error: "Bạn không thể tự xóa tài khoản admin hiện tại." }, { status: 400 });
    }

    const authUser = await resolveSupabaseAuthUser(record);
    if (authUser?.id === currentAdmin.id) {
      return NextResponse.json({ error: "Bạn không thể tự xóa tài khoản admin hiện tại." }, { status: 400 });
    }

    if (authUser?.id) {
      const admin = createSupabaseAdminClient();
      const { error } = await admin.auth.admin.deleteUser(authUser.id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      try {
        const { invalidateSupabaseSessionsForUser } = await import("@/lib/supabase/revoke");
        const result = await invalidateSupabaseSessionsForUser(authUser.id);
        if (!result.ok) {
          console.warn('Session revoke skipped after delete; candidate methods not available.', result.tried);
        }
      } catch (e) {
        console.error('Failed to attempt session revoke after delete', e);
      }

      try {
        const { logAdminAction } = await import("@/lib/admin-actions");
        const { queueEmail } = await import("@/lib/mail");
        await logAdminAction(currentAdmin?.id ?? null, id ?? null, "delete_user", { authUserId: authUser.id });
        await queueEmail(authUser.email ?? "", "Tài khoản của bạn đã bị xóa", `Tài khoản ${authUser.email} đã bị xóa bởi quản trị viên.`);
      } catch (err) {
        console.error("Failed to log/notify delete action", err);
      }
    }

    await prisma.adminUser.delete({
      where: { id: record.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json({ error: error?.message ?? "Failed to delete user." }, { status: 500 });
  }
}
