import assert from "node:assert/strict";
import test from "node:test";

function isFastApiBackendRoute(path) {
  if (!path) return false;
  const cleanPath = path.split("?")[0];
  const isMatch = (prefix) => cleanPath === prefix || cleanPath.startsWith(prefix + "/");

  if (
    cleanPath === "/api/health" ||
    isMatch("/api/scan") ||
    isMatch("/api/copilot") ||
    isMatch("/api/stress") ||
    isMatch("/api/verification") ||
    isMatch("/api/c2") ||
    isMatch("/api/oast") ||
    isMatch("/api/apk-audit")
  ) {
    return true;
  }
  return false;
}

test("API route classification regression tests", () => {
  // 1. FastAPI Scan endpoints
  assert.equal(isFastApiBackendRoute("/api/scan"), true, "/api/scan must route to FastAPI");
  assert.equal(isFastApiBackendRoute("/api/scan/"), true, "/api/scan/ must route to FastAPI");
  assert.equal(isFastApiBackendRoute("/api/scan/scan-12345"), true, "/api/scan/<id> must route to FastAPI");
  assert.equal(isFastApiBackendRoute("/api/scan/scan-12345/stream"), true, "/api/scan/<id>/stream must route to FastAPI");
  assert.equal(isFastApiBackendRoute("/api/scan/scan-12345/assurance"), true, "/api/scan/<id>/assurance must route to FastAPI");

  // 2. Next.js Scan endpoints (CRITICAL REGRESSION CHECK)
  assert.equal(isFastApiBackendRoute("/api/scans"), false, "/api/scans MUST NOT route to FastAPI (Next.js owned)");
  assert.equal(isFastApiBackendRoute("/api/scans/"), false, "/api/scans/ MUST NOT route to FastAPI (Next.js owned)");
  assert.equal(isFastApiBackendRoute("/api/scans/scan-123"), false, "/api/scans/<id> MUST NOT route to FastAPI (Next.js owned)");

  // 3. Next.js Account & Admin endpoints
  assert.equal(isFastApiBackendRoute("/api/account"), false, "/api/account must be Next.js");
  assert.equal(isFastApiBackendRoute("/api/account/me"), false, "/api/account/me must be Next.js");
  assert.equal(isFastApiBackendRoute("/api/account/redeem"), false, "/api/account/redeem must be Next.js");
  assert.equal(isFastApiBackendRoute("/api/admin/users"), false, "/api/admin/users must be Next.js");
  assert.equal(isFastApiBackendRoute("/api/admin/redeem-codes"), false, "/api/admin/redeem-codes must be Next.js");

  // 4. FastAPI Other namespaces
  assert.equal(isFastApiBackendRoute("/api/health"), true, "/api/health must route to FastAPI");
  assert.equal(isFastApiBackendRoute("/api/copilot/chat"), true, "/api/copilot/chat must route to FastAPI");
  assert.equal(isFastApiBackendRoute("/api/stress/detect-waf"), true, "/api/stress/detect-waf must route to FastAPI");
  assert.equal(isFastApiBackendRoute("/api/verification/start"), true, "/api/verification/start must route to FastAPI");
  assert.equal(isFastApiBackendRoute("/api/c2/fuzz"), true, "/api/c2/fuzz must route to FastAPI");
  assert.equal(isFastApiBackendRoute("/api/oast/stream"), true, "/api/oast/stream must route to FastAPI");
  assert.equal(isFastApiBackendRoute("/api/apk-audit/jobs"), true, "/api/apk-audit/jobs must route to FastAPI");
});
