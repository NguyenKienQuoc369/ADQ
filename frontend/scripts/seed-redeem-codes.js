// scripts/seed-redeem-codes.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CANONICAL_SEEDS = [
  {
    code: 'ADQ-PRO-1M-INITIAL-01',
    packageTier: 'PRO',
    durationLabel: '1 Tháng (PRO)',
    durationDays: 30,
    maxUses: 10,
    status: 'UNUSED',
    createdByEmail: 'system-seed@adq.io.vn',
  },
  {
    code: 'ADQ-PRO-3M-INITIAL-02',
    packageTier: 'PRO',
    durationLabel: '3 Tháng (PRO)',
    durationDays: 90,
    maxUses: 10,
    status: 'UNUSED',
    createdByEmail: 'system-seed@adq.io.vn',
  },
  {
    code: 'ADQ-PROMAX-1Y-CANONICAL-01',
    packageTier: 'PRO_MAX',
    durationLabel: '1 Năm (PRO MAX)',
    durationDays: 365,
    maxUses: 10,
    status: 'UNUSED',
    createdByEmail: 'system-seed@adq.io.vn',
  },
  {
    code: 'ADQ-PROMAX-LIFETIME-01',
    packageTier: 'PRO_MAX',
    durationLabel: 'Trọn Đời (PRO MAX)',
    durationDays: null,
    maxUses: 10,
    status: 'UNUSED',
    createdByEmail: 'system-seed@adq.io.vn',
  },
];

async function seedRedeemCodes() {
  console.log("🌱 Bắt đầu khởi tạo dữ liệu mã kích hoạt (Redeem Codes)...");

  // 1. Seed canonical codes
  for (const item of CANONICAL_SEEDS) {
    const existing = await prisma.redeemCode.findUnique({
      where: { code: item.code },
    });
    if (!existing) {
      await prisma.redeemCode.create({ data: item });
      console.log(`✅ Đã tạo mã chuẩn: ${item.packageTier} (${item.durationLabel})`);
    } else {
      console.log(`ℹ️ Mã chuẩn đã tồn tại: ${item.packageTier}`);
    }
  }

  // 2. If dynamic ADQ_REDEEM_CODE is set in env, ensure it is safely seeded as PRO_MAX
  const customCode = (process.env.ADQ_REDEEM_CODE || "").trim().toUpperCase();
  if (customCode && customCode.length >= 3) {
    const existingCustom = await prisma.redeemCode.findUnique({
      where: { code: customCode },
    });
    if (!existingCustom) {
      await prisma.redeemCode.create({
        data: {
          code: customCode,
          packageTier: 'PRO_MAX',
          durationLabel: '1 Năm (PRO MAX)',
          durationDays: 365,
          maxUses: 10,
          usedCount: 0,
          status: 'UNUSED',
          createdByEmail: 'system-env@adq.io.vn',
        },
      });
      console.log(`✅ Đã khởi tạo mã nâng cấp PRO MAX từ môi trường.`);
    } else {
      console.log(`ℹ️ Mã nâng cấp từ môi trường đã tồn tại trong hệ thống.`);
    }
  }

  const total = await prisma.redeemCode.count();
  console.log(`🎉 Tổng số mã kích hoạt hiện tại trong hệ thống: ${total}`);
}

seedRedeemCodes()
  .catch((e) => {
    console.error("❌ Lỗi khi seed mã kích hoạt:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
