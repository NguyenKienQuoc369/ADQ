import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";
import { syncAdminUserFromAuthUser } from "@/lib/admin";

export const runtime = "nodejs";

function normalizeDomain(input: string) {
  return input.trim().replace(/^https?:\/\//, "").split("/")[0];
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const prisma = getPrismaClient();
  const jobs = await prisma.scanJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      liveHosts: { orderBy: { createdAt: "desc" }, take: 200 },
      vulnerabilities: { orderBy: { createdAt: "desc" }, take: 500 },
    },
  });

  return NextResponse.json({
    ok: true,
    scans: jobs.map((job) => ({
      id: job.scanId,
      target: job.targetDomain,
      status: job.status,
      planUsed: "PRO",
      startedAt: (job.startedAt ?? job.createdAt).toISOString(),
      liveSubdomains: job.liveHosts
        .map((host) => ({
          host: host.url ?? job.targetDomain,
          ip: "",
          status: "LIVE",
          tech: host.tech ?? "Unknown",
        }))
        .slice(0, 40),
      portScan: [],
      urlHistory: [],
      secretsHunter: [],
      vulnerabilities: job.vulnerabilities.map((v) => ({
        id: String(v.id),
        title: v.templateId || v.source,
        severity: (v.severity ?? "LOW").toUpperCase(),
        cvss: 0,
        endpoint: v.endpoint ?? "",
        asset: v.host ?? job.targetDomain,
        description: v.matched ?? "",
        exploitability: 0,
        impact: v.raw ?? "",
      })),
      actionAdvice: [],
      enabledTools: ["Subfinder", "DNSX", "Naabu", "Katana", "GAU", "Nuclei"],
      autoThrottle: true,
      telegram: { enabled: false },
    })),
  });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const prisma = getPrismaClient();
  const body = await req.json().catch(() => null);

  const target = typeof body?.target === "string" ? normalizeDomain(body.target) : "";
  const priorityScore = typeof body?.priority === "number" ? body.priority : 10;

  if (!target) {
    return NextResponse.json({ ok: false, error: "Vui lòng nhập domain/website hợp lệ." }, { status: 400 });
  }

  // 1. Lấy thông tin tài khoản người dùng từ DB
  const userRecord = await syncAdminUserFromAuthUser(data.user);

  let currentTier = userRecord.packageTier;
  const isExpired = userRecord.planExpiresAt ? new Date(userRecord.planExpiresAt) < new Date() : false;

  // Nếu gói trả phí (PRO, PRO_MAX) đã hết hạn 30 ngày -> hạ về FREE
  if (currentTier !== "FREE" && isExpired) {
    currentTier = "FREE";
    await prisma.adminUser.update({
      where: { id: userRecord.id },
      data: { packageTier: "FREE", planExpiresAt: null },
    });
  }

  // 2. Ràng buộc gói FREE: Đúng 2 lượt duy nhất không hồi lại
  if (currentTier === "FREE") {
    const totalScans = userRecord.scansToday ?? 0;
    if (totalScans >= 2) {
      return NextResponse.json(
        {
          ok: false,
          error: "Tài khoản Dùng Thử Miễn Phí đã sử dụng hết 2 lượt quét vĩnh viễn. Vui lòng nâng cấp lên gói PRO hoặc PRO MAX để quét không giới hạn.",
          code: "FREE_TIER_LIMIT_REACHED",
        },
        { status: 403 }
      );
    }
  }

  // 3. Khởi tạo Scan Job
  const targetRecord = await prisma.target.upsert({
    where: { domain: target },
    update: { updatedAt: new Date() },
    create: { domain: target },
  });

  const scanId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const scanJob = await prisma.scanJob.create({
    data: {
      scanId,
      targetDomain: targetRecord.domain,
      status: "RUNNING",
      startedAt: new Date(),
      priorityScore,
    },
  });

  // 4. Tăng số lượt quét đã dùng của người dùng
  await prisma.adminUser.update({
    where: { id: userRecord.id },
    data: {
      scansToday: { increment: 1 },
      lastScanAt: new Date(),
    },
  });

  // Gửi lệnh sang SOC Engine Python (nếu có)
  const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  try {
    await fetch(`${backendUrl}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target,
        no_telegram: true,
        logic_scan: false,
      }),
    });
  } catch {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    scan: {
      id: scanJob.scanId,
      target: scanJob.targetDomain,
      status: scanJob.status,
      startedAt: scanJob.startedAt?.toISOString() ?? scanJob.createdAt.toISOString(),
    },
  });
}
