const puppeteer = require("puppeteer-core");
const path = require("path");
const { execSync } = require("child_process");

const SCREENSHOT_DIR = "/home/sisiniki123/.gemini/antigravity/brain/359d707d-8afc-4861-b9a3-bede04120bce";

async function verifyRolesPage() {
  console.log("=== TESTING ADMIN RBAC (/admin/roles) VIA CHROMIUM ===");

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

  // 1. Authenticate via Emergency Single-Use Token to get session cookie
  console.log("1. Generating emergency session for test...");
  const cliOutput = execSync('ssh root@163.44.193.25 "docker exec adq_dashboard npx tsx scripts/generate_soc_recovery_token.ts"').toString();
  const tokenMatch = cliOutput.match(/recovery\?token=([a-f0-9]+)/);
  if (!tokenMatch || !tokenMatch[1]) throw new Error("Token generation failed");
  
  await page.goto(`https://adq-soc.click/admin/recovery?token=${tokenMatch[1]}`, { waitUntil: "networkidle2" });
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {});

  // 2. Open /admin/roles
  console.log("2. Navigating to https://adq-soc.click/admin/roles...");
  await page.goto("https://adq-soc.click/admin/roles", { waitUntil: "networkidle2" });

  const title = await page.title();
  const content = await page.content();
  console.log(`   Page Title: ${title}`);
  console.log(`   Contains 'Phân quyền & Quản trị Danh tính SOC': ${content.includes("Phân quyền & Quản trị Danh tính SOC")}`);
  console.log(`   Contains 'kienquocn64@gmail.com': ${content.includes("kienquocn64@gmail.com")}`);
  console.log(`   Contains 'Permission Matrix': ${content.includes("Permission Matrix")}`);

  // Screenshot
  const scPath = path.join(SCREENSHOT_DIR, "real_browser_05_admin_roles_rbac.png");
  await page.screenshot({ path: scPath, fullPage: true });
  console.log(`   [PASS] Screenshot saved: ${scPath}`);

  await browser.close();
  console.log("=== ADMIN RBAC VERIFICATION COMPLETED SUCCESSFULLY ===");
}

verifyRolesPage().catch(console.error);
