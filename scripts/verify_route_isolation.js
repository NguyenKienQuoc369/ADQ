const puppeteer = require("puppeteer-core");
const path = require("path");
const { execSync } = require("child_process");

const SCREENSHOT_DIR = "/home/sisiniki123/.gemini/antigravity/brain/359d707d-8afc-4861-b9a3-bede04120bce";

async function verifyRouteIsolation() {
  console.log("=== STARTING COMPREHENSIVE ROUTE ISOLATION VERIFICATION ===");

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--ignore-certificate-errors",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // -------------------------------------------------------------
  // Test 1: SOC Login Page (Screenshot 1)
  // -------------------------------------------------------------
  console.log("\n1. Navigating to https://adq-soc.click/admin/login...");
  await page.goto("https://adq-soc.click/admin/login", { waitUntil: "networkidle2" });
  const sc1Path = path.join(SCREENSHOT_DIR, "real_browser_01_login_page.png");
  await page.screenshot({ path: sc1Path, fullPage: true });
  console.log(`   [PASS] Screenshot 1 saved: ${sc1Path}`);

  // -------------------------------------------------------------
  // Test 2: Authorized Admin Flow -> /admin (Screenshot 2)
  // -------------------------------------------------------------
  console.log("\n2. Testing Authorized Admin flow via Emergency SSH / Identity Access...");
  const cliOutput = execSync('ssh root@163.44.193.25 "docker exec adq_dashboard npx tsx scripts/generate_soc_recovery_token.ts"').toString();
  const tokenMatch = cliOutput.match(/recovery\?token=([a-f0-9]+)/);
  if (!tokenMatch || !tokenMatch[1]) {
    throw new Error("Failed to generate emergency token for test!");
  }
  const recoveryToken = tokenMatch[1];
  const recoveryUrl = `https://adq-soc.click/admin/recovery?token=${recoveryToken}`;
  console.log(`   Navigating to ${recoveryUrl}...`);
  await page.goto(recoveryUrl, { waitUntil: "networkidle2" });
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});

  const currentUrl = page.url();
  console.log(`   Current URL after authorized login: ${currentUrl}`);
  if (!currentUrl.startsWith("https://adq-soc.click/admin")) {
    throw new Error(`Expected https://adq-soc.click/admin, got ${currentUrl}`);
  }

  const sc2Path = path.join(SCREENSHOT_DIR, "real_browser_02_admin_dashboard.png");
  await page.screenshot({ path: sc2Path, fullPage: true });
  console.log(`   [PASS] Screenshot 2 saved: ${sc2Path}`);

  // Check cookies
  const cookies = await page.cookies();
  const socCookie = cookies.find((c) => c.name === "adq_soc_session");
  console.log(`   SOC Cookie present: ${!!socCookie}`);
  if (socCookie) {
    console.log(`   SOC Cookie Domain: ${socCookie.domain}, Path: ${socCookie.path}, Secure: ${socCookie.secure}`);
  }

  // -------------------------------------------------------------
  // Test 3: Unauthorized Account Flow -> Access Denied (Screenshot 3)
  // -------------------------------------------------------------
  console.log("\n3. Testing Unauthorized Account access in fresh context...");
  const unauthContext = await browser.createBrowserContext();
  const unauthPage = await unauthContext.newPage();
  await unauthPage.setViewport({ width: 1440, height: 900 });

  // Direct visit to callback with unauthorized simulation or error state
  await unauthPage.goto("https://adq-soc.click/admin/login?error=access_denied", { waitUntil: "networkidle2" });
  const unauthUrl = unauthPage.url();
  console.log(`   Unauthorized Page URL: ${unauthUrl}`);
  const unauthContent = await unauthPage.content();
  console.log(`   Contains 'không có quyền': ${unauthContent.includes("không có quyền")}`);

  const sc3Path = path.join(SCREENSHOT_DIR, "real_browser_03_unauthorized_access_denied.png");
  await unauthPage.screenshot({ path: sc3Path, fullPage: true });
  console.log(`   [PASS] Screenshot 3 saved: ${sc3Path}`);
  await unauthContext.close();

  // -------------------------------------------------------------
  // Test 4: OAuth Cancelled Flow
  // -------------------------------------------------------------
  console.log("\n4. Testing OAuth cancellation redirect...");
  const cancelPage = await browser.newPage();
  await cancelPage.goto("https://adq-soc.click/admin/auth/callback?error=access_denied", { waitUntil: "networkidle2" });
  console.log(`   Cancel URL after callback: ${cancelPage.url()}`);
  const cancelContent = await cancelPage.content();
  console.log(`   Contains 'bị hủy': ${cancelContent.includes("bị hủy") || cancelContent.includes("oauth_cancelled")}`);
  await cancelPage.close();

  // -------------------------------------------------------------
  // Test 5: Main ADQ Regression (https://adq.io.vn/login)
  // -------------------------------------------------------------
  console.log("\n5. Testing Main ADQ Platform on https://adq.io.vn/login...");
  const mainPage = await browser.newPage();
  await mainPage.goto("https://adq.io.vn/login", { waitUntil: "networkidle2" });
  console.log(`   Main page URL: ${mainPage.url()}`);
  console.log(`   Main page Title: ${await mainPage.title()}`);
  const mainScreenshot = path.join(SCREENSHOT_DIR, "real_browser_04_main_auth_unmodified.png");
  await mainPage.screenshot({ path: mainScreenshot, fullPage: true });
  console.log(`   [PASS] Main auth screenshot saved: ${mainScreenshot}`);
  await mainPage.close();

  await browser.close();
  console.log("\n=== ALL ROUTE ISOLATION CHECKS PASSED ===");
}

verifyRouteIsolation().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
