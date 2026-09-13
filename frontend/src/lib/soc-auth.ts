import "server-only";

import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { cookies } from "next/headers";
import { getPrismaClient } from "@/lib/prisma";

export const SOC_COOKIE_NAME = "adq_soc_session";
export const SOC_SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours in seconds
export const SOC_SESSION_MAX_AGE_SECONDS = SOC_SESSION_MAX_AGE;

// ---------------------------------------------------------------------------
// Rate Limiter for Login (in-memory sliding window fallback + Redis support)
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

export function checkLoginRateLimit(ip: string): { allowed: boolean; remainingAttempts: number; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = loginRateLimits.get(ip);

  if (!entry) {
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }

  if (entry.lockedUntil > now) {
    const retryAfter = Math.ceil((entry.lockedUntil - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds: retryAfter };
  }

  // If window expired, reset
  if (now - entry.lastAttempt > WINDOW_DURATION_MS) {
    loginRateLimits.delete(ip);
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }

  return {
    allowed: entry.attempts < MAX_LOGIN_ATTEMPTS,
    remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - entry.attempts),
  };
}

export function recordLoginAttempt(ip: string, success: boolean): void {
  const now = Date.now();
  if (success) {
    loginRateLimits.delete(ip);
    return;
  }

  const entry = loginRateLimits.get(ip) || { attempts: 0, lockedUntil: 0, lastAttempt: now };
  entry.attempts += 1;
  entry.lastAttempt = now;

  if (entry.attempts >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  loginRateLimits.set(ip, entry);
}

// ---------------------------------------------------------------------------
// Cryptographic Password Hashing (scrypt N=16384, r=8, p=1)
// ---------------------------------------------------------------------------
const SCRYPT_PARAMS = {
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
      // Legacy plaintext fallback check during bootstrap only if explicitly configured
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
// Password Bootstrap & Retrieval (Database Authoritative)
// ---------------------------------------------------------------------------
let cachedPasswordHash: string | null = null;
let lastCacheCheck = 0;

export async function getOrBootstrapAdminPasswordHash(): Promise<string> {
  const now = Date.now();
  if (cachedPasswordHash && now - lastCacheCheck < 30000) {
    return cachedPasswordHash;
  }

  const prisma = getPrismaClient();

  try {
    // 1. Check if hash is already persisted in DB
    const existingAction = await prisma.adminAction.findFirst({
      where: { action: "SOC_PASSWORD_HASH" },
      orderBy: { createdAt: "desc" },
    });

    if (existingAction && existingAction.detail && typeof existingAction.detail === "object") {
      const detailObj = existingAction.detail as Record<string, any>;
      if (detailObj.hash && typeof detailObj.hash === "string" && detailObj.hash.startsWith("scrypt$")) {
        cachedPasswordHash = detailObj.hash;
        lastCacheCheck = now;
        return cachedPasswordHash;
      }
    }

    // 2. If not stored yet, bootstrap from runtime environment secret
    const bootstrapPassword = String(
      process.env.SOC_ADMIN_PASSWORD ||
      process.env.ADQ_SOC_ADMIN_PASSWORD ||
      process.env.ADQ_SOC_MASTER_KEY ||
      ""
    ).trim();

    if (!bootstrapPassword) {
      throw new Error("SOC_ADMIN_PASSWORD_NOT_CONFIGURED");
    }

    const generatedHash = hashPassword(bootstrapPassword);

    await prisma.adminAction.create({
      data: {
        adminAuthUserId: "soc-system",
        action: "SOC_PASSWORD_HASH",
        detail: {
          hash: generatedHash,
          bootstrappedAt: new Date().toISOString(),
          version: "1.0",
        },
      },
    });

    cachedPasswordHash = generatedHash;
    lastCacheCheck = now;
    return generatedHash;
  } catch (err: any) {
    if (cachedPasswordHash) return cachedPasswordHash;
    // Fallback if DB is initializing
    const bootstrapPassword = String(
      process.env.SOC_ADMIN_PASSWORD ||
      process.env.ADQ_SOC_ADMIN_PASSWORD ||
      process.env.ADQ_SOC_MASTER_KEY ||
      ""
    ).trim();

    if (bootstrapPassword) {
      return hashPassword(bootstrapPassword);
    }
    throw err;
  }
}

export async function verifySocPassword(input: string): Promise<boolean> {
  if (!input) return false;
  try {
    const hash = await getOrBootstrapAdminPasswordHash();
    return verifyPassword(input, hash);
  } catch {
    return false;
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

  const isValidCurrent = await verifySocPassword(currentPassword);
  if (!isValidCurrent) {
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
