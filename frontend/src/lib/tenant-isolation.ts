import { getPrismaClient } from "@/lib/prisma";

export function normalizeDomain(input: string): string {
  if (!input) return "";
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .trim()
    .toLowerCase();
}

/**
 * Retrieves all authorized domain names for a given user from the database.
 * Matches projectDetail.summary.userId and projectDetail.summary.userEmail.
 */
export async function getUserAuthorizedDomains(authUser: { id: string; email?: string | null }): Promise<string[]> {
  if (!authUser || !authUser.id) return [];

  const prisma = getPrismaClient();
  const userEmail = (authUser.email ?? "").toLowerCase().trim();
  const userId = authUser.id;

  try {
    const allTargets = await prisma.target.findMany({
      include: { projectDetail: true },
    });

    const authorizedDomains = new Set<string>();

    for (const t of allTargets) {
      const summary = (t.projectDetail?.summary as any) || {};
      const ownerEmail = (summary.userEmail ?? "").toLowerCase().trim();
      const ownerId = summary.userId ?? "";

      const isOwned = (ownerId && ownerId === userId) || (userEmail && ownerEmail && ownerEmail === userEmail);
      if (isOwned) {
        if (t.domain) {
          authorizedDomains.add(t.domain.toLowerCase().trim());
          const clean = normalizeDomain(t.domain);
          if (clean) authorizedDomains.add(clean);
          // Also handle domain with suffix stripped e.g. "quocbank.com-abc123" -> "quocbank.com"
          const base = clean.split("-")[0];
          if (base && base.includes(".")) {
            authorizedDomains.add(base);
          }
        }
        if (summary.domain) {
          const clean = normalizeDomain(summary.domain);
          if (clean) authorizedDomains.add(clean);
        }
      }
    }

    return Array.from(authorizedDomains);
  } catch (err) {
    console.error("[tenant-isolation] Error fetching authorized domains:", err);
    return [];
  }
}

/**
 * Verifies whether a project object is owned by the current authenticated user.
 * FAIL-CLOSED: returns false if project has no owner info or does not match.
 */
export function isProjectAuthorized(
  authUser: { id: string; email?: string | null },
  project: any
): boolean {
  if (!authUser || !authUser.id || !project) return false;

  const summary = (project.projectDetail?.summary as any) || (project.summary as any) || {};
  const ownerEmail = (summary.userEmail ?? "").toLowerCase().trim();
  const ownerId = summary.userId ?? "";
  const currentEmail = (authUser.email ?? "").toLowerCase().trim();
  const currentId = authUser.id;

  if (ownerId && ownerId === currentId) return true;
  if (currentEmail && ownerEmail && ownerEmail === currentEmail) return true;

  // Fail-closed for legacy unowned records
  return false;
}

/**
 * Checks whether a domain is authorized for the given authenticated user.
 */
export async function isDomainAuthorized(
  authUser: { id: string; email?: string | null },
  targetDomain: string
): Promise<boolean> {
  const normalized = normalizeDomain(targetDomain);
  if (!normalized) return false;

  const authorized = await getUserAuthorizedDomains(authUser);
  return authorized.some((d) => d === normalized || d.startsWith(normalized) || normalized.startsWith(d));
}

