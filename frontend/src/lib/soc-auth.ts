import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { cookies } from "next/headers";
import { getPrismaClient } from "@/lib/prisma";
import Redis from "ioredis";

export const SOC_COOKIE_NAME = "adq_soc_session";
export const SOC_SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours in seconds
export const SOC_SESSION_MAX_AGE_SECONDS = SOC_SESSION_MAX_AGE;

// ---------------------------------------------------------------------------
// Rate Limiter for SOC Auth (Redis-backed with In-Memory fallback)
// ---------------------------------------------------------------------------
interface RateLimitEntry {
  attempts: number;
  lockedUntil: number;
  lastAttempt: number;
}

const loginRateLimits = new Map<string, RateLimitEntry>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_DURATION_MS = 15 * 60 * 1000;
const REDIS_RATE_LIMIT_TTL_SECONDS = 900; // 15 minutes

let redisRateLimitClient: Redis | null = null;

function getRedisClient(): Redis | null {
  try {
    if (!redisRateLimitClient) {
      const redisUrl =
        process.env.REDIS_URL ||
        `redis://${process.env.REDIS_HOST || "redis"}:${process.env.REDIS_PORT || 6379}/0`;

      redisRateLimitClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        connectTimeout: 2000,
        enableReadyCheck: true,
        lazyConnect: false,
        retryStrategy(times) {
          return Math.min(times * 100, 1000);
        },
      });

      redisRateLimitClient.on("error", () => {
        // Fallback silently to in-memory limiter
      });
    }
    return redisRateLimitClient;
  } catch {
    return null;
  }
}

export function getRateLimitKey(ip: string): string {
  const sanitized = String(ip || "127.0.0.1").replace(/[^a-zA-Z0-9_.-]/g, "_");
  return `soc:ratelimit:login:${sanitized}`;
}

export async function checkLoginRateLimit(ip: string): Promise<{
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
  attempts: number;
  key: string;
  ttl: number;
  blocked: boolean;
}> {
  const key = getRateLimitKey(ip);
  const redis = getRedisClient();

  // Try Redis first
  if (redis && redis.status === "ready") {
    try {
      const attemptsStr = await redis.get(key);
      const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
      const ttl = await redis.ttl(key);

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const retryAfter = ttl > 0 ? ttl : REDIS_RATE_LIMIT_TTL_SECONDS;
        return {
          allowed: false,
          remainingAttempts: 0,
          retryAfterSeconds: retryAfter,
          attempts,
          key,
          ttl: retryAfter,
          blocked: true,
        };
      }

      return {
        allowed: true,
        remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - attempts),
        attempts,
        key,
        ttl: ttl > 0 ? ttl : 0,
        blocked: false,
      };
    } catch {
      // Fallback to memory
    }
  }

  // In-Memory Fallback
  const now = Date.now();
  const entry = loginRateLimits.get(ip);

  if (!entry) {
    return {
      allowed: true,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
      attempts: 0,
      key,
      ttl: 0,
      blocked: false,
    };
  }

  if (entry.lockedUntil > now) {
    const retryAfter = Math.ceil((entry.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: retryAfter,
      attempts: entry.attempts,
      key,
      ttl: retryAfter,
      blocked: true,
    };
  }

  // If window expired, reset
  if (now - entry.lastAttempt > WINDOW_DURATION_MS) {
    loginRateLimits.delete(ip);
    return {
      allowed: true,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
      attempts: 0,
      key,
      ttl: 0,
      blocked: false,
    };
  }

  const blocked = entry.attempts >= MAX_LOGIN_ATTEMPTS;
  return {
    allowed: !blocked,
    remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - entry.attempts),
    attempts: entry.attempts,
    key,
    ttl: blocked ? Math.ceil(LOCKOUT_DURATION_MS / 1000) : 0,
    blocked,
  };
}

export async function recordLoginAttempt(ip: string, success: boolean): Promise<void> {
  const key = getRateLimitKey(ip);
  const redis = getRedisClient();

  if (success) {
    loginRateLimits.delete(ip);
    if (redis && redis.status === "ready") {
      try {
        await redis.del(key);
      } catch {}
    }
    return;
  }

  // Failed attempt
  if (redis && redis.status === "ready") {
    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, REDIS_RATE_LIMIT_TTL_SECONDS);
      }
    } catch {}
  }

  const now = Date.now();
  const entry = loginRateLimits.get(ip) || { attempts: 0, lockedUntil: 0, lastAttempt: now };
  entry.attempts += 1;
  entry.lastAttempt = now;

  if (entry.attempts >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  loginRateLimits.set(ip, entry);
}

export async function clearLoginRateLimit(ip: string): Promise<void> {
  const key = getRateLimitKey(ip);
  loginRateLimits.delete(ip);
  const redis = getRedisClient();
  if (redis && redis.status === "ready") {
    try {
      await redis.del(key);
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Authoritative SOC Admin Authorization Model (UUID-Based via soc_admins)
// ---------------------------------------------------------------------------

export async function checkSocAdminAuthorization(userAuthId: string): Promise<{
  authorized: boolean;
  role?: string;
  emailSnapshot?: string | null;
  enabled?: boolean;
}> {
  if (!userAuthId || typeof userAuthId !== "string") {
    return { authorized: false };
  }

  try {
    const prisma = getPrismaClient();
    const admin = await prisma.socAdmin.findUnique({
      where: { userAuthId },
    });

    if (!admin || !admin.enabled) {
      return { authorized: false, enabled: admin?.enabled ?? false };
    }

    return {
      authorized: true,
      role: admin.role,
      emailSnapshot: admin.emailSnapshot,
      enabled: admin.enabled,
    };
  } catch (error) {
    console.error("[SOC Auth] Database lookup error:", error);
    return { authorized: false };
  }
}

export async function grantSocAdminRole(params: {
  userAuthId: string;
  emailSnapshot: string;
  grantedByAuthId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const prisma = getPrismaClient();
    await prisma.socAdmin.upsert({
      where: { userAuthId: params.userAuthId },
      update: {
        role: "SOC_ADMIN",
        enabled: true,
        emailSnapshot: params.emailSnapshot,
        revokedAt: null,
      },
      create: {
        userAuthId: params.userAuthId,
        emailSnapshot: params.emailSnapshot,
        role: "SOC_ADMIN",
        enabled: true,
      },
    });

    // Audit log
    await prisma.adminAction.create({
      data: {
        adminAuthUserId: params.grantedByAuthId || "system-bootstrap",
        action: "SOC_ROLE_GRANTED",
        detail: {
          userAuthId: params.userAuthId,
          email: params.emailSnapshot,
          role: "SOC_ADMIN",
          timestamp: new Date().toISOString(),
        },
      },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function revokeSocAdminRole(params: {
  userAuthId: string;
  revokedByAuthId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const prisma = getPrismaClient();
    await prisma.socAdmin.update({
      where: { userAuthId: params.userAuthId },
      data: {
        enabled: false,
        revokedAt: new Date(),
      },
    });

    // Audit log
    await prisma.adminAction.create({
      data: {
        adminAuthUserId: params.revokedByAuthId || "system",
        action: "SOC_ROLE_REVOKED",
        detail: {
          userAuthId: params.userAuthId,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 Signed SOC Sessions (v2 Identity Format)
// ---------------------------------------------------------------------------
function getSessionSecret(): string {
  const secret = String(
    process.env.ADQ_SOC_SESSION_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    ""
  ).trim();

  if (!secret) {
    return "adq-soc-identity-session-secret-2026-prod-fallback";
  }
  return secret;
}

function sign(payload: string): string {
  const secret = getSessionSecret();
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

export function createSocSessionToken(userAuthId: string, role = "SOC_ADMIN"): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(16).toString("hex");
  const payload = `v2.${issuedAt}.${userAuthId}.${role}.${nonce}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifySocSessionToken(token?: string | null): {
  valid: boolean;
  userAuthId?: string;
  role?: string;
  issuedAt?: number;
} {
  if (!token || !token.trim()) return { valid: false };

  try {
    const parts = token.split(".");
    
    // Support v2 token format: v2.issuedAt.userAuthId.role.nonce.signature
    if (parts.length === 6 && parts[0] === "v2") {
      const [version, rawIssuedAt, userAuthId, role, nonce, signature] = parts;
      const issuedAt = Number(rawIssuedAt);
      if (!Number.isFinite(issuedAt)) return { valid: false };

      const now = Math.floor(Date.now() / 1000);
      const age = now - issuedAt;

      if (age < -60 || age > SOC_SESSION_MAX_AGE) {
        return { valid: false };
      }

      const expected = sign(`${version}.${rawIssuedAt}.${userAuthId}.${role}.${nonce}`);
      if (!safeEqual(signature, expected)) {
        return { valid: false };
      }

      return {
        valid: true,
        userAuthId,
        role,
        issuedAt,
      };
    }

    // Support legacy v1 token format during migration transition
    if (parts.length === 5 && parts[0] === "v1") {
      const [version, rawIssuedAt, adminId, nonce, signature] = parts;
      const issuedAt = Number(rawIssuedAt);
      if (!Number.isFinite(issuedAt)) return { valid: false };

      const now = Math.floor(Date.now() / 1000);
      const age = now - issuedAt;

      if (age < -60 || age > SOC_SESSION_MAX_AGE) {
        return { valid: false };
      }

      const expected = sign(`${version}.${rawIssuedAt}.${adminId}.${nonce}`);
      if (!safeEqual(signature, expected)) {
        return { valid: false };
      }

      return {
        valid: true,
        userAuthId: adminId === "soc-root" ? "6fab82b0-d0d0-4474-a25a-d3f1ccb6f1a1" : adminId,
        role: "SOC_ADMIN",
        issuedAt,
      };
    }

    return { valid: false };
  } catch {
    return { valid: false };
  }
}

export async function isSocSessionValid(): Promise<boolean> {
  const admin = await getAuthenticatedSocAdmin();
  return admin.authenticated;
}

export async function getAuthenticatedSocAdmin(): Promise<{
  authenticated: boolean;
  userAuthId?: string;
  emailSnapshot?: string | null;
  role?: string;
  reason?: string;
}> {
  try {
    const store = await cookies();
    const token = store.get(SOC_COOKIE_NAME)?.value;
    if (!token) {
      return { authenticated: false, reason: "NO_COOKIE" };
    }

    const session = verifySocSessionToken(token);
    if (!session.valid || !session.userAuthId) {
      return { authenticated: false, reason: "INVALID_SESSION" };
    }

    // Authoritative DB verification to ensure identity was not revoked
    const authCheck = await checkSocAdminAuthorization(session.userAuthId);
    if (!authCheck.authorized) {
      return { authenticated: false, reason: "REVOKED_OR_UNAUTHORIZED" };
    }

    return {
      authenticated: true,
      userAuthId: session.userAuthId,
      emailSnapshot: authCheck.emailSnapshot,
      role: authCheck.role || "SOC_ADMIN",
    };
  } catch (error) {
    return { authenticated: false, reason: "ERROR" };
  }
}

export async function requireSocAdmin(): Promise<{
  userAuthId: string;
  emailSnapshot?: string | null;
  role: string;
}> {
  const admin = await getAuthenticatedSocAdmin();
  if (!admin.authenticated || !admin.userAuthId) {
    throw new Error("UNAUTHORIZED_SOC_ADMIN");
  }
  return {
    userAuthId: admin.userAuthId,
    emailSnapshot: admin.emailSnapshot,
    role: admin.role || "SOC_ADMIN",
  };
}

// ---------------------------------------------------------------------------
// Emergency SSH Recovery (Single-Use CSPRNG 256-Bit Token)
// ---------------------------------------------------------------------------

export async function generateEmergencyRecoveryToken(
  adminAuthId = "6fab82b0-d0d0-4474-a25a-d3f1ccb6f1a1",
  ttlMinutes = 5
): Promise<{ token: string; expiresAt: Date; recoveryUrl: string }> {
  const token = randomBytes(32).toString("hex"); // 256 bits CSPRNG
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  const prisma = getPrismaClient();
  await prisma.socRecoveryToken.create({
    data: {
      tokenHash,
      adminAuthId,
      expiresAt,
      used: false,
    },
  });

  await prisma.adminAction.create({
    data: {
      adminAuthUserId: adminAuthId,
      action: "SOC_RECOVERY_CREATED",
      detail: {
        expiresAt: expiresAt.toISOString(),
        ttlMinutes,
        timestamp: new Date().toISOString(),
      },
    },
  });

  return {
    token,
    expiresAt,
    recoveryUrl: `https://adq-soc.click/admin/recovery?token=${token}`,
  };
}

export async function redeemEmergencyRecoveryToken(token: string): Promise<{
  success: boolean;
  sessionToken?: string;
  error?: string;
  adminAuthId?: string;
}> {
  if (!token || token.length < 32) {
    return { success: false, error: "INVALID_RECOVERY_TOKEN" };
  }

  const tokenHash = createHash("sha256").update(token.trim()).digest("hex");
  const prisma = getPrismaClient();

  const record = await prisma.socRecoveryToken.findUnique({
    where: { tokenHash },
  });

  if (!record) {
    return { success: false, error: "RECOVERY_TOKEN_NOT_FOUND" };
  }

  if (record.used) {
    return { success: false, error: "RECOVERY_TOKEN_ALREADY_USED" };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    return { success: false, error: "RECOVERY_TOKEN_EXPIRED" };
  }

  // Mark token used (single use)
  await prisma.socRecoveryToken.update({
    where: { id: record.id },
    data: { used: true },
  });

  // Verify that the target admin is authorized
  const authCheck = await checkSocAdminAuthorization(record.adminAuthId);
  if (!authCheck.authorized) {
    return { success: false, error: "ADMIN_IDENTITY_DISABLED" };
  }

  // Issue SOC session
  const sessionToken = createSocSessionToken(record.adminAuthId, "SOC_ADMIN");

  await prisma.adminAction.create({
    data: {
      adminAuthUserId: record.adminAuthId,
      action: "SOC_RECOVERY_USED",
      detail: {
        timestamp: new Date().toISOString(),
      },
    },
  });

  return {
    success: true,
    sessionToken,
    adminAuthId: record.adminAuthId,
  };
}

// ---------------------------------------------------------------------------
// Hostname Validation
// ---------------------------------------------------------------------------
export function isAllowedSocHost(request: Request): boolean {
  const rawHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "";

  const host = rawHost
    .split(",")[0]
    .trim()
    .toLowerCase()
    .split(":")[0];

  if (host === "localhost" || host === "127.0.0.1") {
    return true;
  }

  return (
    host === "adq-soc.click" ||
    host === "www.adq-soc.click" ||
    host === "adq.io.vn" ||
    host === "www.adq.io.vn" ||
    host.startsWith("admin.")
  );
}
