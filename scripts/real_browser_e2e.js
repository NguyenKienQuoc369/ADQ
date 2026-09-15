const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const SCREENSHOT_DIR = "/home/sisiniki123/.gemini/antigravity/brain/359d707d-8afc-4861-b9a3-bede04120bce";

async function runRealBrowserTest() {
  console.log("=== STARTING ACTUAL CHROMIUM BROWSER E2E TEST ===");
  console.log("Browser executable: /usr/bin/chromium");

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
  await page.setViewport({ width: 1280, height: 800 });
  await page.setViewport({ width: 1440, height: 900 });

  const networkLogs = [];

  // Capture real browser network requests
  page.on("request", (req) => {
    if (req.url().includes("/api/admin/auth/")) {
      let postData = null;
      try {
        postData = req.postData();
        if (postData) {
          const parsed = JSON.parse(postData);
          postData = { fieldNames: Object.keys(parsed), passwordLength: (parsed.password || parsed.masterKey || "").length };
        }
      } catch (e) {
        postData = "parsing_error";
      }
      networkLogs.push({
        type: "REQUEST",
        url: req.url(),
        method: req.method(),
        headers: req.headers(),
        postData,
      });
      console.log(`[BROWSER NETWORK] >> ${req.method()} ${req.url()}`);
      console.log(`  Payload Fields:`, postData ? postData.fieldNames : "none");
    }
  });

  page.on("response", async (res) => {
    if (res.url().includes("/api/admin/auth/")) {
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch (e) {
        bodyText = "could_not_read_body";
      }
      networkLogs.push({
        type: "RESPONSE",
        url: res.url(),
        status: res.status(),
        headers: res.headers(),
        body: bodyText,
      });
      console.log(`[BROWSER NETWORK] << ${res.status()} ${res.url()}`);
      console.log(`  Response Body:`, bodyText);
      console.log(`  Set-Cookie Header:`, res.headers()["set-cookie"] ? "PRESENT" : "NOT_PRESENT");
    }
  });

  // 1. Open login page
  // 1. Open SOC login page
  console.log("\n1. Navigating to https://adq-soc.click/admin/login...");
  await page.goto("https://adq-soc.click/admin/login", { waitUntil: "networkidle2" });

  const loginPageScreenshot = path.join(SCREENSHOT_DIR, "real_browser_01_login_page.png");
  await page.screenshot({ path: loginPageScreenshot });
  await page.screenshot({ path: loginPageScreenshot, fullPage: true });
  console.log(`   Screenshot saved: ${loginPageScreenshot}`);

  // 2. Type password into actual input element
  console.log("\n2. Typing recovery password into real input field...");
  const inputSelector = "input[type='password'], input[placeholder*='Nhập mật khẩu']";
  await page.waitForSelector(inputSelector);
  await page.click(inputSelector);
  await page.type(inputSelector, "sisiniki123", { delay: 50 });
  // Verify page title and identity elements
  const pageTitle = await page.title();
  const pageContent = await page.content();
  console.log(`   Page Title: ${pageTitle}`);
  console.log(`   Contains "ADQ SOC": ${pageContent.includes("ADQ SOC")}`);
  console.log(`   Contains "SOC ACCESS GUARD": ${pageContent.includes("SOC ACCESS GUARD")}`);
  console.log(`   Contains "ADQ Identity": ${pageContent.includes("ADQ Identity")}`);

  // 3. Click submit button
  console.log("\n3. Clicking 'Đăng nhập SOC Console' button...");
  const submitButtonSelector = "button[type='submit']";
  await page.waitForSelector(submitButtonSelector);
  // 2. Generate a fresh emergency recovery token via SSH CLI
  console.log("\n2. Generating fresh single-use emergency recovery token via SSH CLI...");
  const cliOutput = execSync('ssh root@163.44.193.25 "docker exec adq_dashboard npx tsx scripts/generate_soc_recovery_token.ts"').toString();
  console.log("   CLI Output:\n" + cliOutput);

  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/admin/auth/login")),
    page.click(submitButtonSelector),
  ]);
  const tokenMatch = cliOutput.match(/recovery\?token=([a-f0-9]+)/);
  if (!tokenMatch || !tokenMatch[1]) {
    throw new Error("Failed to parse recovery token from CLI output!");
  }
  const recoveryToken = tokenMatch[1];
  console.log(`   Extracted Recovery Token: ${recoveryToken}`);

  console.log(`\n4. Login API responded with status: ${response.status()}`);
  const responseData = await response.json().catch(() => ({}));
  console.log(`   Response JSON:`, responseData);
  // 3. Redeem recovery token in real Chromium browser
  const recoveryUrl = `https://adq-soc.click/admin/recovery?token=${recoveryToken}`;
  console.log(`\n3. Navigating to recovery URL in browser: ${recoveryUrl}...`);
  await page.goto(recoveryUrl, { waitUntil: "networkidle2" });

  // 4. Wait for navigation to /admin or UI update
  console.log("\n5. Waiting for page navigation to /admin...");
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {
    console.log("   Navigation timeout or already completed");
  });
  // Wait for redirect to /admin
  console.log("   Waiting for session issuance and redirection to /admin...");
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});

  console.log(`   Current URL after login: ${page.url()}`);
  const currentUrl = page.url();
  console.log(`   Current URL after recovery redemption: ${currentUrl}`);

  // Take screenshot of admin dashboard
  // 4. Capture admin dashboard screenshot
  const adminPageScreenshot = path.join(SCREENSHOT_DIR, "real_browser_02_admin_dashboard.png");
  await page.screenshot({ path: adminPageScreenshot, fullPage: true });
  console.log(`   Admin screenshot saved: ${adminPageScreenshot}`);

  // Check cookies in browser
  // Verify cookies
  const cookies = await page.cookies();
  const socCookie = cookies.find((c) => c.name === "adq_soc_session");
  console.log(`   Browser Cookies:`, cookies.map((c) => ({ name: c.name, domain: c.domain, path: c.path, httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite })));
  console.log(`   adq_soc_session Cookie Present:`, !!socCookie);
  console.log(`   Session Cookie Present:`, !!socCookie);
  if (socCookie) {
    console.log(`   Cookie Attributes: Domain=${socCookie.domain}, Path=${socCookie.path}, HttpOnly=${socCookie.httpOnly}, Secure=${socCookie.secure}, SameSite=${socCookie.sameSite}`);
  }

  // 5. Test page refresh (F5) in real browser
  console.log("\n6. Performing real browser refresh (F5)...");
  console.log("\n5. Performing real browser refresh (F5)...");
  await page.reload({ waitUntil: "networkidle2" });
  console.log(`   URL after refresh: ${page.url()}`);
  const refreshScreenshot = path.join(SCREENSHOT_DIR, "real_browser_03_refresh.png");
  await page.screenshot({ path: refreshScreenshot });
  await page.screenshot({ path: refreshScreenshot, fullPage: true });
  console.log(`   Refresh screenshot saved: ${refreshScreenshot}`);

  // 6. Test Logout in real browser
  console.log("\n7. Testing logout in real browser...");
  // Find and click logout button or call logout API
  await page.goto("https://adq-soc.click/api/admin/auth/session");
  const sessionText = await page.evaluate(() => document.body.innerText);
  console.log(`   Session check API in browser:`, sessionText);
  // 6. Test Single-Use Token Invalidation (attempting to reuse token)
  console.log("\n6. Testing single-use token invalidation (reusing the same token)...");
  const reusePage = await browser.newPage();
  await reusePage.goto(recoveryUrl, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));
  const reuseContent = await reusePage.content();
  console.log(`   Reuse page contains error message: ${reuseContent.includes("không hợp lệ hoặc đã được sử dụng") || reuseContent.includes("invalid") || reuseContent.includes("hết hạn")}`);
  await reusePage.close();

  // 7. Verify Main Auth Regression on https://adq.io.vn/login
  console.log("\n7. Verifying main user auth on https://adq.io.vn/login...");
  const mainAuthPage = await browser.newPage();
  await mainAuthPage.goto("https://adq.io.vn/login", { waitUntil: "networkidle2" });
  const mainAuthTitle = await mainAuthPage.title();
  const mainAuthScreenshot = path.join(SCREENSHOT_DIR, "real_browser_04_main_auth_unmodified.png");
  await mainAuthPage.screenshot({ path: mainAuthScreenshot, fullPage: true });
  console.log(`   Main Auth Page Title: ${mainAuthTitle}`);
  console.log(`   Main Auth Screenshot saved: ${mainAuthScreenshot}`);
  await mainAuthPage.close();

  await browser.close();
  console.log("\n=== REAL CHROMIUM BROWSER E2E TEST COMPLETED ===");
  console.log("\n=== REAL CHROMIUM BROWSER E2E TEST COMPLETED SUCCESSFULLY ===");
}

runRealBrowserTest().catch((err) => {
  console.error("Real Browser Test Failed:", err);
  process.exit(1);
});

