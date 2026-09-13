import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";

export const SOC_COOKIE_NAME = "adq_soc_session";
export const SOC_SESSION_MAX_AGE = 60 * 60 * 8;

interface RateLimitEntry {
  attempts: number;
  lockedUntil: number;
  lastAttempt: number;
}

const loginRateLimits = new Map<string, RateLimitEntry>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
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

function getSessionSecret(): string {
  return String(process.env.ADQ_SOC_SESSION_SECRET || "test-secret").trim();
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

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /auth/i,
  /credential/i,
  /private/i,
  /cookie/i,
  /master_key/i,
  /masterkey/i,
  /apikey/i,
  /api_key/i,
  /jwt/i,
  /bearer/i,
  /signature/i,
  /test_credential/i,
  /authorized_test_credential/i,
];

export function maskSensitiveValue(key: string, value: any): any {
  if (value === null || value === undefined) return value;

  const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
  if (isSensitiveKey) {
    if (typeof value === "string") {
      if (value.length <= 8) return "[REDACTED]";
      return `${value.slice(0, 3)}...[REDACTED]...${value.slice(-3)}`;
    }
    return "[REDACTED]";
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      sanitized[k] = maskSensitiveValue(k, v);
    }
    return sanitized;
  }

  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "object" ? maskSensitiveValue(key, item) : item));
  }

  return value;
}

export function redactRow(row: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key] = maskSensitiveValue(key, value);
  }
  return result;
}

export const ALLOWLISTED_POSTGRES_TABLES = {
  admin_users: true,
  admin_actions: true,
  targets: true,
  project_details: true,
  scan_jobs: true,
  live_hosts: true,
  scan_endpoints: true,
  vulnerabilities: true,
  stress_jobs: true,
  redeem_codes: true,
  redeem_code_redemptions: true,
  outgoing_emails: true,
};
