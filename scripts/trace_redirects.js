const puppeteer = require("puppeteer-core");

async function traceOAuthRedirect() {
  console.log("=== TRACING REAL BROWSER SOC OAUTH REDIRECTS ===");
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
  const redirects = [];

  page.on("request", (req) => {
    if (req.isNavigationRequest()) {
      redirects.push(req.url());
      console.log(`[NAVIGATE] -> ${req.url()}`);
    }
  });

  page.on("response", (res) => {
    const status = res.status();
    const loc = res.headers()["location"];
    if (status >= 300 && status < 400 && loc) {
      console.log(`[HTTP ${status} REDIRECT] from ${res.url()} to ${loc}`);
    }
  });

  console.log("1. Opening https://adq-soc.click/admin/login");
  await page.goto("https://adq-soc.click/admin/login", { waitUntil: "networkidle2" });

  console.log("2. Clicking OAuth login button");
  const oauthBtn = await page.waitForSelector("button:has-text('Đăng nhập bằng ADQ Identity'), button:has-text('Google')");
  
  // Intercept navigation
  await Promise.all([
    page.waitForNavigation({ timeout: 15000 }).catch((e) => console.log("Navigation timeout/finished:", e.message)),
    oauthBtn.click(),
  ]);

  console.log("\n--- NAVIGATION CHAIN CAPTURED ---");
  redirects.forEach((url, i) => {
    console.log(`REDIRECT_${i + 1} = ${url}`);
  });
  console.log(`FINAL_URL = ${page.url()}`);

  await browser.close();
}

traceOAuthRedirect().catch(console.error);

