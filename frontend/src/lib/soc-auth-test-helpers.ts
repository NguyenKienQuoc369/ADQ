import {
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "crypto";

export const SOC_COOKIE_NAME = "adq_soc_session";
export const SOC_SESSION_MAX_AGE = 60 * 60 * 8;

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
} {
  if (!token || !token.trim()) return { valid: false };

  try {
    const parts = token.split(".");
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

      return { valid: true, userAuthId, role };
    }

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

      return { valid: true, userAuthId: adminId, role: "SOC_ADMIN" };
    }

    return { valid: false };
  } catch {
    return { valid: false };
  }
}

export function generateRecoveryTokenHash(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
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
  soc_admins: true,
  soc_recovery_tokens: true,
};
