import "server-only";

import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { cookies } from "next/headers";
import { getPrismaClient } from "@/lib/prisma";
import Redis from "ioredis";

export const SOC_COOKIE_NAME = "adq_soc_session";
export const SOC_SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours in seconds
export const SOC_SESSION_MAX_AGE_SECONDS = SOC_SESSION_MAX_AGE;

// ---------------------------------------------------------------------------
// Rate Limiter for Login (Redis-backed with In-Memory fallback)
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
// Cryptographic Password Hashing (scrypt N=16384, r=8, p=1)
// ---------------------------------------------------------------------------
export const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keyLen: 64,
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, SCRYPT_PARAMS.keyLen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  }).toString("hex");

  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!password || !storedHash) return false;

    const parts = storedHash.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") {
      return false;
    }

    const [, rawN, rawR, rawP, salt, originalKey] = parts;
    const N = Number(rawN);
    const r = Number(rawR);
    const p = Number(rawP);

    if (!salt || !originalKey || !N || !r || !p) return false;

    const derivedKey = scryptSync(password, salt, Buffer.from(originalKey, "hex").length, {
      N,
      r,
      p,
    }).toString("hex");

    const a = Buffer.from(derivedKey, "hex");
    const b = Buffer.from(originalKey, "hex");

    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Password Bootstrap & Retrieval (Database Authoritative + Runtime Reconciliation)
// ---------------------------------------------------------------------------
let cachedPasswordHash: string | null = null;
let lastCacheCheck = 0;

export async function getOrBootstrapAdminPasswordHash(): Promise<string> {
  const now = Date.now();
  if (cachedPasswordHash && now - lastCacheCheck < 10000) {
    return cachedPasswordHash;
  }

  const prisma = getPrismaClient();

  const bootstrapPassword = String(
    process.env.SOC_ADMIN_PASSWORD ||
    process.env.ADQ_SOC_ADMIN_PASSWORD ||
    process.env.ADQ_SOC_MASTER_KEY ||
    ""
  ).trim();

  try {
    // 1. Check if hash is already persisted in DB
    const existingAction = await prisma.adminAction.findFirst({
      where: { action: "SOC_PASSWORD_HASH" },
      orderBy: { createdAt: "desc" },
    });

    let currentDbHash: string | null = null;
    if (existingAction && existingAction.detail && typeof existingAction.detail === "object") {
      const detailObj = existingAction.detail as Record<string, any>;
      if (detailObj.hash && typeof detailObj.hash === "string" && detailObj.hash.startsWith("scrypt$")) {
        currentDbHash = detailObj.hash;
      }
    }

    // 2. If runtime secret is provided:
    if (bootstrapPassword) {
      // If DB hash exists and verifies against runtime secret, use it
      if (currentDbHash && verifyPassword(bootstrapPassword, currentDbHash)) {
        cachedPasswordHash = currentDbHash;
        lastCacheCheck = now;
        return currentDbHash;
      }

      // If DB hash does NOT match runtime secret (or does not exist), RECONCILE / UPDATE IT!
      const newHash = hashPassword(bootstrapPassword);
      await prisma.adminAction.create({
        data: {
          adminAuthUserId: "soc-system",
          action: "SOC_PASSWORD_HASH",
          detail: {
            hash: newHash,
            bootstrappedAt: new Date().toISOString(),
            version: "1.0",
            recoveryReason: currentDbHash ? "RUNTIME_SECRET_RECONCILIATION" : "INITIAL_BOOTSTRAP",
          },
        },
      });

      cachedPasswordHash = newHash;
      lastCacheCheck = now;
      return newHash;
    }

    // 3. If no runtime secret was supplied, use currentDbHash if valid
    if (currentDbHash) {
      cachedPasswordHash = currentDbHash;
      lastCacheCheck = now;
      return currentDbHash;
    }

    throw new Error("AUTH_CONFIG_ERROR");
  } catch (err: any) {
    if (bootstrapPassword) {
      return hashPassword(bootstrapPassword);
    }
    if (cachedPasswordHash) return cachedPasswordHash;
    throw err;
  }
}

export async function verifySocPassword(input: string): Promise<{ valid: boolean; code?: string }> {
  if (!input) {
    return { valid: false, code: "INVALID_CREDENTIAL" };
  }
  try {
    const hash = await getOrBootstrapAdminPasswordHash();
    const matches = verifyPassword(input, hash);
    return {
      valid: matches,
      code: matches ? undefined : "INVALID_CREDENTIAL",
    };
  } catch (err: any) {
    const code = err.message === "AUTH_CONFIG_ERROR" ? "AUTH_CONFIG_ERROR" : "HASH_ERROR";
    return { valid: false, code };
  }
}

export async function rotateSocPassword(
  currentPassword: string,
  newPassword: string,
  adminId: string = "soc-root"
): Promise<{ success: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: "Mật khẩu mới phải có ít nhất 8 ký tự" };
  }

  const verifyResult = await verifySocPassword(currentPassword);
  if (!verifyResult.valid) {
    return { success: false, error: "Mật khẩu hiện tại không chính xác" };
  }

  const prisma = getPrismaClient();
  const newHash = hashPassword(newPassword);

  await prisma.adminAction.create({
    data: {
      adminAuthUserId: adminId,
      action: "SOC_PASSWORD_HASH",
      detail: {
        hash: newHash,
        rotatedAt: new Date().toISOString(),
        rotatedBy: adminId,
      },
    },
  });

  cachedPasswordHash = newHash;
  lastCacheCheck = Date.now();

  return { success: true };
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 Signed SOC Sessions
// ---------------------------------------------------------------------------
function getSessionSecret(): string {
  const secret = String(process.env.ADQ_SOC_SESSION_SECRET || process.env.SUPABASE_JWT_SECRET || "").trim();
  if (!secret) {
    return "adq-soc-secure-session-secret-salt-2026-prod-fallback";
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

export function createSocSessionToken(adminId: string = "soc-root"): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(18).toString("hex");
  const payload = `v1.${issuedAt}.${adminId}.${nonce}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifySocSessionToken(token?: string | null): boolean {
  if (!token) return false;

  try {
    const parts = token.split(".");
    if (parts.length !== 5) return false;

    const [version, rawIssuedAt, adminId, nonce, signature] = parts;
    if (version !== "v1" || !adminId || !nonce || !signature) return false;

    const issuedAt = Number(rawIssuedAt);
    if (!Number.isFinite(issuedAt)) return false;

    const now = Math.floor(Date.now() / 1000);
    const age = now - issuedAt;

    if (age < -60 || age > SOC_SESSION_MAX_AGE) {
      return false;
    }

    const expected = sign(`${version}.${rawIssuedAt}.${adminId}.${nonce}`);
    return safeEqual(signature, expected);
  } catch {
    return false;
  }
}

export async function isSocSessionValid(): Promise<boolean> {
  try {
    const store = await cookies();
    const token = store.get(SOC_COOKIE_NAME)?.value;
    return verifySocSessionToken(token);
  } catch {
    return false;
  }
}

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
