import { NextResponse } from "next/server";
import crypto from "crypto";

import {
  normalisePackageTier,
  parseDurationLabelToDays,
  requireAdminRequest,
  toRedeemCodeRecord,
} from "@/lib/admin";
import { getPrismaClient } from "@/lib/prisma";

function generateRedeemCode(packageTier: "PRO" | "PRO_MAX") {
  const seed = crypto.randomBytes(4).toString("hex").toUpperCase();
  const cleanTier = packageTier.replace(/_/g, "");
  return `ADQ-${cleanTier}-${seed}`;
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
    const generatedCode = String(payload?.code ?? "").trim().toUpperCase() || generateRedeemCode(packageTier);

    const row = await prisma.redeemCode.create({
      data: {
        code: generatedCode,
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

    const maskedCode = `${generatedCode.slice(0, 4)}****${generatedCode.slice(-4)}`;
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
      return NextResponse.json({ error: "Mã nâng cấp đã tồn tại. Vui lòng thử lại." }, { status: 409 });
    }
    return NextResponse.json({ error: error?.message ?? "Failed to create redeem code." }, { status: 500 });
  }
}

