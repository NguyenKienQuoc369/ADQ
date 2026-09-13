import {
  checkLoginRateLimit,
  recordLoginAttempt,
  createSocSessionToken,
  verifySocSessionToken,
  generateRecoveryTokenHash,
  maskSensitiveValue,
  redactRow,
  ALLOWLISTED_POSTGRES_TABLES,
} from "../src/lib/soc-auth-test-helpers";

async function runTests() {
  console.log("=== ADQ SOC ADMIN TEST SUITE ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      failed++;
    }
  }

  // 1. Session Security (v2 Identity Token)
  console.log("\n1. Testing HMAC-SHA256 v2 Identity Session Security:");
  process.env.ADQ_SOC_SESSION_SECRET = "test-secret-salt-key-1234567890";
  const userAuthId = "6fab82b0-d0d0-4474-a25a-d3f1ccb6f1a1";
  const sessionToken = createSocSessionToken(userAuthId, "SOC_ADMIN");
  const verification = verifySocSessionToken(sessionToken);
  assert(verification.valid, "Valid v2 session token verifies successfully");
  assert(verification.userAuthId === userAuthId, "Extracted userAuthId matches");
  assert(verification.role === "SOC_ADMIN", "Extracted role matches SOC_ADMIN");
  assert(!verifySocSessionToken(sessionToken + "tampered").valid, "Tampered session token rejected");
  assert(!verifySocSessionToken("invalid.token").valid, "Invalid token format rejected");
  assert(!verifySocSessionToken("").valid, "Empty token rejected");

  // 2. Emergency Recovery Token Hashing
  console.log("\n2. Testing Emergency Recovery Token Hashing:");
  const testToken = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const tokenHash = generateRecoveryTokenHash(testToken);
  assert(tokenHash.length === 64, "SHA-256 hash length is 64 hex characters");
  assert(tokenHash === generateRecoveryTokenHash(testToken), "Hash is deterministic");
  assert(tokenHash !== generateRecoveryTokenHash(testToken + "x"), "Hash changes on token alteration");

  // 3. Rate Limiter
  console.log("\n3. Testing Rate Limiter:");
  const testIp = "192.168.1.100";
  recordLoginAttempt(testIp, true); // reset
  for (let i = 0; i < 5; i++) {
    const check = checkLoginRateLimit(testIp);
    assert(check.allowed, `Attempt ${i + 1} allowed (remaining: ${check.remainingAttempts})`);
    recordLoginAttempt(testIp, false);
  }
  const blockedCheck = checkLoginRateLimit(testIp);
  assert(!blockedCheck.allowed, "6th attempt blocked after 5 failed attempts");
  recordLoginAttempt(testIp, true); // successful login resets
  assert(checkLoginRateLimit(testIp).allowed, "Successful login resets rate limit");

  // 4. Sensitive Data Masking & Redaction
  console.log("\n4. Testing Sensitive Data Masking:");
  const testRow = {
    id: "user_123",
    email: "admin@adq.io.vn",
    password_hash: "scrypt$16384$8$1$salt$hash",
    api_key: "adq_live_key_9999",
    authorized_test_credential: "user:pass123",
    role: "SOC_ADMIN",
    public_status: "HEALTHY",
  };
  const redacted = redactRow(testRow);
  assert(redacted.id === "user_123", "Non-sensitive ID preserved");
  assert(redacted.email === "admin@adq.io.vn", "Non-sensitive email preserved");
  assert(redacted.role === "SOC_ADMIN", "Role preserved");
  assert(redacted.public_status === "HEALTHY", "Status preserved");
  assert(redacted.password_hash.includes("[REDACTED]"), "Password hash redacted");
  assert(redacted.api_key.includes("[REDACTED]"), "API key redacted");
  assert(redacted.authorized_test_credential.includes("[REDACTED]"), "Test credential redacted");

  // 5. Allowlisted PostgreSQL Tables
  console.log("\n5. Testing Allowlisted PostgreSQL Tables Registry:");
  assert(Object.keys(ALLOWLISTED_POSTGRES_TABLES).length === 14, "Exactly 14 allowlisted tables registered");
  assert("admin_users" in ALLOWLISTED_POSTGRES_TABLES, "admin_users table registered");
  assert("soc_admins" in ALLOWLISTED_POSTGRES_TABLES, "soc_admins table registered");
  assert("soc_recovery_tokens" in ALLOWLISTED_POSTGRES_TABLES, "soc_recovery_tokens table registered");
  assert("scan_jobs" in ALLOWLISTED_POSTGRES_TABLES, "scan_jobs table registered");
  assert("stress_jobs" in ALLOWLISTED_POSTGRES_TABLES, "stress_jobs table registered");
  assert("redeem_codes" in ALLOWLISTED_POSTGRES_TABLES, "redeem_codes table registered");
  assert(!("arbitrary_table" in ALLOWLISTED_POSTGRES_TABLES), "Arbitrary table not allowlisted");

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
