import { randomBytes, createHash } from "crypto";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const adminAuthId = process.argv[2] || "6fab82b0-d0d0-4474-a25a-d3f1ccb6f1a1"; // kienquocn64@gmail.com
  const ttlMinutes = parseInt(process.argv[3] || "5", 10);

  // Check that the target admin is authorized
  const admin = await prisma.socAdmin.findUnique({
    where: { userAuthId: adminAuthId },
  });

  if (!admin) {
    console.error(`[ERROR] No SOC Admin record found for user_auth_id: ${adminAuthId}`);
    process.exit(1);
  }

  if (!admin.enabled) {
    console.error(`[ERROR] SOC Admin record is disabled for user_auth_id: ${adminAuthId}`);
    process.exit(1);
  }

  const token = randomBytes(32).toString("hex"); // 256 bits CSPRNG
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await prisma.socRecoveryToken.create({
    data: {
      tokenHash,
      adminAuthId,
      expiresAt,
      used: false,
    },
  });

  await prisma.adminAction.create({
    data: {
      adminAuthUserId: adminAuthId,
      action: "SOC_RECOVERY_CREATED",
      detail: {
        expiresAt: expiresAt.toISOString(),
        ttlMinutes,
        generatedVia: "SSH_OPERATOR_CLI",
        timestamp: new Date().toISOString(),
      },
    },
  });

  console.log("\n=======================================================");
  console.log("   ADQ SOC EMERGENCY ONE-TIME ACCESS TOKEN GENERATED   ");
  console.log("=======================================================");
  console.log(`Administrator:     ${admin.emailSnapshot || "SOC_ADMIN"}`);
  console.log(`Admin Auth UUID:   ${adminAuthId}`);
  console.log(`Token TTL:         ${ttlMinutes} minutes`);
  console.log(`Expires At:        ${expiresAt.toISOString()}`);
  console.log(`Single-Use:        YES`);
  console.log("-------------------------------------------------------");
  console.log(`EMERGENCY RECOVERY URL:\nhttps://adq-soc.click/admin/recovery?token=${token}`);
  console.log("=======================================================\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Failed to generate recovery token:", err);
  process.exit(1);
});

