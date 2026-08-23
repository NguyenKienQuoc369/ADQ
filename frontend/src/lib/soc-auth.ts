import "server-only";

import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { cookies } from "next/headers";

export const SOC_COOKIE_NAME = "adq_soc_session";
const SOC_SESSION_MAX_AGE = 60 * 60 * 8; // 8 giờ

function getSessionSecret() {
  return String(process.env.ADQ_SOC_SESSION_SECRET || "").trim();
}

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);

  if (aa.length !== bb.length) return false;

  return timingSafeEqual(aa, bb);
}

function sign(payload: string) {
  const secret = getSessionSecret();

  if (!secret) {
    throw new Error("SOC_SESSION_SECRET_NOT_CONFIGURED");
  }

  return createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

export function verifySocMasterKey(input: string) {
  const expected = String(
    process.env.ADQ_SOC_MASTER_KEY || ""
  ).trim();

  if (!expected || !input) return false;

  return safeEqual(input, expected);
}

export function createSocSessionToken() {
  const issuedAt = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(18).toString("hex");

  const payload = `v1.${issuedAt}.${nonce}`;
  const signature = sign(payload);

  return `${payload}.${signature}`;
}

export function verifySocSessionToken(
  token?: string | null
) {
  if (!token) return false;

  try {
    const parts = token.split(".");
    if (parts.length !== 4) return false;

    const [version, rawIssuedAt, nonce, signature] =
      parts;

    if (version !== "v1" || !nonce || !signature) {
      return false;
    }

    const issuedAt = Number(rawIssuedAt);

    if (!Number.isFinite(issuedAt)) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const age = now - issuedAt;

    if (age < -60 || age > SOC_SESSION_MAX_AGE) {
      return false;
    }

    const expected = sign(
      `${version}.${rawIssuedAt}.${nonce}`
    );

    return safeEqual(signature, expected);
  } catch {
    return false;
  }
}

export async function isSocSessionValid() {
  try {
    const store = await cookies();
    const token = store.get(SOC_COOKIE_NAME)?.value;

    return verifySocSessionToken(token);
  } catch {
    return false;
  }
}

export function isAllowedSocHost(request: Request) {
  const rawHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "";

  const host = rawHost
    .split(",")[0]
    .trim()
    .toLowerCase()
    .split(":")[0];

  if (
    host === "localhost" ||
    host === "127.0.0.1"
  ) {
    return true;
  }

  return (
    host === "adq-soc.click" ||
    host === "www.adq-soc.click" ||
    host.startsWith("admin.")
  );
}

export const SOC_SESSION_MAX_AGE_SECONDS =
  SOC_SESSION_MAX_AGE;
