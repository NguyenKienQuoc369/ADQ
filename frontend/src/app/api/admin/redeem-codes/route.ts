import { NextResponse } from "next/server";
import crypto from "crypto";

import {
  normalisePackageTier,
  normalizeRedeemCode,
  parseDurationLabelToDays,
  requireAdminRequest,
  toRedeemCodeRecord,
} from "@/lib/admin";
import { getPrismaClient } from "@/lib/prisma";

function generateRedeemCode(packageTier: "PRO" | "PRO_MAX") {
  // 128-bit cryptographic entropy (16 bytes = 32 hex chars) from CSPRNG
  const secret = crypto.randomBytes(16).toString("hex").toUpperCase();
  const cleanTier = packageTier.replace(/_/g, "");
  // Formatted into readable 8-char blocks: ADQ-PROMAX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX
  const formatted = `${secret.slice(0, 8)}-${secret.slice(8, 16)}-${secret.slice(16, 24)}-${secret.slice(24, 32)}`;
  return `ADQ-${cleanTier}-${formatted}`;
}

export async function GET() {
  try {
    await requireAdminRequest();

    const prisma = getPrismaClient();
    const rows = await prisma.redeemCode.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ codes: rows.map(toRedeemCodeRecord) });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (error?.code === "P2021" || /redeem_codes|does not exist|table/i.test(String(error?.message ?? ""))) {
      return NextResponse.json({ codes: [] });
    }
    return NextResponse.json({ error: error?.message ?? "Failed to load redeem codes." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdminRequest();
    const payload = await request.json();
    const packageTier = normalisePackageTier(payload?.packageTier ?? "PRO");

    if (packageTier === "FREE") {
      return NextResponse.json({ error: "Mã nâng cấp chỉ áp dụng cho PRO hoặc PRO MAX." }, { status: 400 });
    }

    const durationLabel = String(payload?.durationLabel ?? "").trim();
    const maxUses = Number(payload?.maxUses ?? 1);

    if (durationLabel.length < 2) {
      return NextResponse.json({ error: "Vui lòng nhập thời hạn sử dụng." }, { status: 400 });
    }

    if (!Number.isFinite(maxUses) || maxUses < 1) {
      return NextResponse.json({ error: "Số lượt sử dụng tối đa phải lớn hơn 0." }, { status: 400 });
    }

    const prisma = getPrismaClient();
    const durationDays = parseDurationLabelToDays(durationLabel);
    const codeToCreate = String(payload?.code ?? "").trim().toUpperCase() || generateRedeemCode(packageTier);
    const canonicalNew = normalizeRedeemCode(codeToCreate);

    if (!canonicalNew || canonicalNew.length < 6) {
      return NextResponse.json({ error: "Mã kích hoạt không hợp lệ." }, { status: 400 });
    }

    // Canonical Uniqueness Verification:
    // Check if any existing code in the database shares the exact same normalized canonical key
    const allCodes = await prisma.redeemCode.findMany({ select: { code: true } });
    const hasCollision = allCodes.some((rc) => normalizeRedeemCode(rc.code) === canonicalNew);
    if (hasCollision) {
      return NextResponse.json(
        { error: "Mã kích hoạt với định dạng chuẩn hóa này đã tồn tại trong hệ thống." },
        { status: 409 }
      );
    }

    const row = await prisma.redeemCode.create({
      data: {
        code: codeToCreate,
        packageTier,
        durationLabel,
        durationDays,
        maxUses,
        usedCount: 0,
        status: "UNUSED",
        createdByAuthUserId: adminUser.id,
        createdByEmail: adminUser.email ?? null,
      },
    });

    // Read-after-write verification to guarantee persistence in authoritative DB
    const verified = await prisma.redeemCode.findUnique({
      where: { id: row.id },
    });
    if (!verified) {
      throw new Error("Không thể xác minh bản ghi mã sau khi lưu vào cơ sở dữ liệu.");
    }

    const maskedCode = `${codeToCreate.slice(0, 8)}****${codeToCreate.slice(-4)}`;
    console.log(`[admin/redeem-codes] Successfully issued code ${maskedCode} tier=${packageTier} maxUses=${maxUses}`);

    return NextResponse.json({ code: toRedeemCodeRecord(verified) });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Mã kích hoạt này đã tồn tại trong hệ thống." }, { status: 409 });
    }
    return NextResponse.json({ error: error?.message ?? "Failed to create redeem code." }, { status: 500 });
  }
}


