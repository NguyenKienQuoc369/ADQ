import { getPrismaClient } from "./prisma";

export async function logAdminAction(adminAuthUserId: string | null, targetAdminUserId: string | null, action: string, detail?: any) {
  const prisma = getPrismaClient();
  try {
    await prisma.adminAction.create({
      data: {
        adminAuthUserId: adminAuthUserId ?? null,
        targetAdminUserId: targetAdminUserId ?? null,
        action,
        detail: detail ? detail : undefined,
      },
    });
  } catch (err) {
    console.error('Failed to log admin action', err);
  }
}
