import { NextResponse } from "next/server";

import {
  getDailyLimitForPackage,
  normalisePackageTier,
  normaliseRole,
  normaliseStatus,
  requireAdminRequest,
  resolveSupabaseAuthUser,
  syncSupabaseMetadataForAdminUser,
  toUserRecord,
  computePlanExpiry,
} from "@/lib/admin";
import { getPrismaClient } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentAdmin = await requireAdminRequest();
    const { id } = await params;
    const payload = await request.json();
    const prisma = getPrismaClient();
    const existing = await prisma.adminUser.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });
    }

    const nextRole = normaliseRole(payload?.role ?? "USER");
    const nextPackage = normalisePackageTier(payload?.packageTier ?? "FREE");
    const authUser = await resolveSupabaseAuthUser(existing);

    // compute plan expiry default when package changes: PRO -> 30 days, PRO_MAX -> 365 days, FREE -> null
    let planExpiryDate: Date | null = null;
    if (payload?.planExpiresAt) {
      planExpiryDate = new Date(payload.planExpiresAt);
    } else if (nextPackage !== existing.packageTier) {
      const defaultDurationDays = nextPackage === "PRO" ? 30 : nextPackage === "PRO_MAX" ? 365 : null;
      planExpiryDate = defaultDurationDays !== null ? computePlanExpiry(defaultDurationDays) : null;
    }

    const record = await prisma.adminUser.update({
      where: { id },
      data: {
        authUserId: authUser?.id ?? existing.authUserId ?? null,
        role: nextRole,
        packageTier: nextPackage,
        dailyLimit: Number(payload?.dailyLimit ?? getDailyLimitForPackage(nextPackage)),
        planExpiresAt: planExpiryDate,
      },
    });
 
    if (authUser?.id) {
      await syncSupabaseMetadataForAdminUser({
        authUserId: authUser.id,
        name: record.name,
        role: nextRole,
        packageTier: nextPackage,
        status: normaliseStatus(record.status as string),
      });

    // Log admin action and queue email for package change
      try {
      const { logAdminAction } = await import("@/lib/admin-actions");
      const { queueEmail } = await import("@/lib/mail");
        const currentAdmin = await requireAdminRequest();
        await logAdminAction(currentAdmin?.id ?? null, authUser.id, "update_package", { previousPackage: existing.packageTier, newPackage: nextPackage, planExpiresAt: record.planExpiresAt });
      const subject = `Gói của bạn đã được cập nhật: ${nextPackage}`;
      const body = `Gói tài khoản ${String(authUser.email)} đã được cập nhật thành ${nextPackage}. Hạn sử dụng: ${record.planExpiresAt ?? "Không có"}`;
      if (authUser.email) await queueEmail(String(authUser.email), subject, body);
    } catch (err) {
      console.error("Failed to log/notify package change", err);
    }

    // If demoting from ADMIN -> non-ADMIN, revoke sessions for security
    try {
      const previousWasAdmin = String(existing.role ?? "").toUpperCase() === "ADMIN";
      const nowIsAdmin = String(nextRole ?? "").toUpperCase() === "ADMIN";
      if (previousWasAdmin && !nowIsAdmin) {
        try {
          const { invalidateSupabaseSessionsForUser } = await import("@/lib/supabase/revoke");
          const result = await invalidateSupabaseSessionsForUser(authUser.id);
          if (!result.ok) {
            console.warn("Demotion revoke skipped; candidate methods not available.", result.tried);
          }
        } catch (e) {
          console.error('Failed to attempt demotion revoke', e);
        }
      }
    } catch (revokeErr: any) {
      console.error('Failed to revoke sessions after demotion for', authUser.id, revokeErr?.message ?? revokeErr);
    }
    }

    return NextResponse.json({ user: toUserRecord(record) });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json({ error: error?.message ?? "Failed to update user role and package." }, { status: 500 });
  }
}
