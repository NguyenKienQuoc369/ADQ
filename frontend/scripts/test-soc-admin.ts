import {
  hashPassword,
  verifyPassword,
  checkLoginRateLimit,
  recordLoginAttempt,
  createSocSessionToken,
  verifySocSessionToken,
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

  // 1. Password Hashing & Verification
  console.log("\n1. Testing scrypt Password Hashing & Verification:");
  const testPassword = "sisiniki123";
  const hash = hashPassword(testPassword);
  assert(hash.startsWith("scrypt$"), "Hash follows scrypt$ format");
  assert(verifyPassword(testPassword, hash), "Correct password verification succeeds");
  assert(!verifyPassword("wrong_password", hash), "Wrong password rejected");
  assert(!verifyPassword("", hash), "Empty password rejected");
  assert(!verifyPassword(testPassword, ""), "Empty hash rejected");

  // 2. Rate Limiter
  console.log("\n2. Testing Login Rate Limiter:");
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

  // 3. Session Security
  console.log("\n3. Testing HMAC-SHA256 Session Security:");
  process.env.ADQ_SOC_SESSION_SECRET = "test-secret-salt-key-1234567890";
  const sessionToken = createSocSessionToken("soc-root");
  assert(verifySocSessionToken(sessionToken), "Valid session token verifies successfully");
  assert(!verifySocSessionToken(sessionToken + "tampered"), "Tampered session token rejected");
  assert(!verifySocSessionToken("invalid.token"), "Invalid token format rejected");
  assert(!verifySocSessionToken(""), "Empty token rejected");

  // 4. Sensitive Data Masking & Redaction
  console.log("\n4. Testing Sensitive Data Masking:");
  const testRow = {
    id: "user_123",
    email: "admin@adq.io.vn",
    password_hash: "scrypt$16384$8$1$salt$hash",
    api_key: "adq_live_key_9999",
    authorized_test_credential: "user:pass123",
    role: "ADMIN",
    public_status: "HEALTHY",
  };
  const redacted = redactRow(testRow);
  assert(redacted.id === "user_123", "Non-sensitive ID preserved");
  assert(redacted.email === "admin@adq.io.vn", "Non-sensitive email preserved");
  assert(redacted.role === "ADMIN", "Role preserved");
  assert(redacted.public_status === "HEALTHY", "Status preserved");
  assert(redacted.password_hash.includes("[REDACTED]"), "Password hash redacted");
  assert(redacted.api_key.includes("[REDACTED]"), "API key redacted");
  assert(redacted.authorized_test_credential.includes("[REDACTED]"), "Test credential redacted");

  // 5. Allowlisted PostgreSQL Tables
  console.log("\n5. Testing Allowlisted PostgreSQL Tables Registry:");
  assert(Object.keys(ALLOWLISTED_POSTGRES_TABLES).length === 12, "Exactly 12 allowlisted tables registered");
  assert("admin_users" in ALLOWLISTED_POSTGRES_TABLES, "admin_users table registered");
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
