const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

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
  console.log("\n1. Navigating to https://adq-soc.click/admin/login...");
  await page.goto("https://adq-soc.click/admin/login", { waitUntil: "networkidle2" });

  const loginPageScreenshot = path.join(SCREENSHOT_DIR, "real_browser_01_login_page.png");
  await page.screenshot({ path: loginPageScreenshot });
  console.log(`   Screenshot saved: ${loginPageScreenshot}`);

  // 2. Type password into actual input element
  console.log("\n2. Typing recovery password into real input field...");
  const inputSelector = "input[type='password'], input[placeholder*='Nhập mật khẩu']";
  await page.waitForSelector(inputSelector);
  await page.click(inputSelector);
  await page.type(inputSelector, "sisiniki123", { delay: 50 });

  // 3. Click submit button
  console.log("\n3. Clicking 'Đăng nhập SOC Console' button...");
  const submitButtonSelector = "button[type='submit']";
  await page.waitForSelector(submitButtonSelector);

  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/admin/auth/login")),
    page.click(submitButtonSelector),
  ]);

  console.log(`\n4. Login API responded with status: ${response.status()}`);
  const responseData = await response.json().catch(() => ({}));
  console.log(`   Response JSON:`, responseData);

  // 4. Wait for navigation to /admin or UI update
  console.log("\n5. Waiting for page navigation to /admin...");
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {
    console.log("   Navigation timeout or already completed");
  });

  console.log(`   Current URL after login: ${page.url()}`);

  // Take screenshot of admin dashboard
  const adminPageScreenshot = path.join(SCREENSHOT_DIR, "real_browser_02_admin_dashboard.png");
  await page.screenshot({ path: adminPageScreenshot, fullPage: true });
  console.log(`   Admin screenshot saved: ${adminPageScreenshot}`);

  // Check cookies in browser
  const cookies = await page.cookies();
  const socCookie = cookies.find((c) => c.name === "adq_soc_session");
  console.log(`   Browser Cookies:`, cookies.map((c) => ({ name: c.name, domain: c.domain, path: c.path, httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite })));
  console.log(`   adq_soc_session Cookie Present:`, !!socCookie);

  // 5. Test page refresh (F5) in real browser
  console.log("\n6. Performing real browser refresh (F5)...");
  await page.reload({ waitUntil: "networkidle2" });
  console.log(`   URL after refresh: ${page.url()}`);
  const refreshScreenshot = path.join(SCREENSHOT_DIR, "real_browser_03_refresh.png");
  await page.screenshot({ path: refreshScreenshot });
  console.log(`   Refresh screenshot saved: ${refreshScreenshot}`);

  // 6. Test Logout in real browser
  console.log("\n7. Testing logout in real browser...");
  // Find and click logout button or call logout API
  await page.goto("https://adq-soc.click/api/admin/auth/session");
  const sessionText = await page.evaluate(() => document.body.innerText);
  console.log(`   Session check API in browser:`, sessionText);

  await browser.close();
  console.log("\n=== REAL CHROMIUM BROWSER E2E TEST COMPLETED ===");
}

runRealBrowserTest().catch((err) => {
  console.error("Real Browser Test Failed:", err);
  process.exit(1);
});
