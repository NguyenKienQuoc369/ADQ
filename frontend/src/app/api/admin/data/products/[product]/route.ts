import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin";
import { getPrismaClient } from "@/lib/prisma";
import { getAdminRedisClient, redactRow } from "@/lib/admin-data-sources";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ product: string }> }
) {
  try {
    await requireAdminRequest();
    const { product } = await params;
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "25", 10)));
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    const prisma = getPrismaClient();

    switch (product) {
      case "projects": {
        const where = search
          ? {
              OR: [
                { domain: { contains: search, mode: "insensitive" as const } },
                { id: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {};

        const [items, total] = await Promise.all([
          prisma.target.findMany({
            where,
            include: { projectDetail: true },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.target.count({ where }),
        ]);

        return NextResponse.json({
          ok: true,
          product: "projects",
          items: items.map((i) => redactRow(i)),
          total,
          page,
          limit,
        });
      }

      case "scans": {
        const where = search
          ? {
              OR: [
                { targetDomain: { contains: search, mode: "insensitive" as const } },
                { scanId: { contains: search, mode: "insensitive" as const } },
                { status: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {};

        const [items, total] = await Promise.all([
          prisma.scanJob.findMany({
            where,
            include: {
              _count: {
                select: {
                  liveHosts: true,
                  vulnerabilities: true,
                  endpoints: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.scanJob.count({ where }),
        ]);

        return NextResponse.json({
          ok: true,
          product: "scans",
          items: items.map((i) => redactRow(i)),
          total,
          page,
          limit,
        });
      }

      case "stress": {
        const where = search
          ? {
              OR: [
                { jobId: { contains: search, mode: "insensitive" as const } },
                { targetUrl: { contains: search, mode: "insensitive" as const } },
                { userId: { contains: search, mode: "insensitive" as const } },
                { status: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {};

        const [items, total] = await Promise.all([
          prisma.stressJob.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.stressJob.count({ where }),
        ]);

        return NextResponse.json({
          ok: true,
          product: "stress",
          items: items.map((i) => redactRow(i)),
          total,
          page,
          limit,
        });
      }

      case "apk": {
        // APK jobs are tracked in Redis under apk:history:* and apk:job:*
        const redis = getAdminRedisClient();
        const [, historyKeys] = await redis.scan("0", "MATCH", "apk:history:*", "COUNT", 50);

        let apkJobs: any[] = [];
        if (historyKeys.length > 0) {
          const pipe = redis.pipeline();
          for (const hk of historyKeys) {
            pipe.lrange(hk, 0, 50);
          }
          const results = await pipe.exec();
          for (const [, list] of results || []) {
            if (Array.isArray(list)) {
              for (const item of list) {
                try {
                  apkJobs.push(JSON.parse(item));
                } catch {
                  apkJobs.push({ raw: item });
                }
              }
            }
          }
        }

        // Sort by timestamp desc
        apkJobs.sort((a, b) => {
          const tA = new Date(a.created_at || a.started_at || a.timestamp || 0).getTime();
          const tB = new Date(b.created_at || b.started_at || b.timestamp || 0).getTime();
          return tB - tA;
        });

        if (search) {
          const sLower = search.toLowerCase();
          apkJobs = apkJobs.filter(
            (j) =>
              (j.package_name && j.package_name.toLowerCase().includes(sLower)) ||
              (j.filename && j.filename.toLowerCase().includes(sLower)) ||
              (j.job_id && j.job_id.toLowerCase().includes(sLower))
          );
        }

        const total = apkJobs.length;
        const paged = apkJobs.slice(skip, skip + limit).map((j) => redactRow(j));

        return NextResponse.json({
          ok: true,
          product: "apk",
          items: paged,
          total,
          page,
          limit,
        });
      }

      case "copilot": {
        // Copilot conversation metadata tracked in Redis
        const redis = getAdminRedisClient();
        const [, metaKeys] = await redis.scan("0", "MATCH", "copilot_conv_meta:*", "COUNT", 100);

        let convs: any[] = [];
        if (metaKeys.length > 0) {
          const pipe = redis.pipeline();
          for (const mk of metaKeys) {
            pipe.get(mk);
          }
          const results = await pipe.exec();
          for (const [, val] of results || []) {
            if (val) {
              try {
                convs.push(JSON.parse(val as string));
              } catch {}
            }
          }
        }

        convs.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));

        if (search) {
          const sLower = search.toLowerCase();
          convs = convs.filter(
            (c) =>
              (c.id && c.id.toLowerCase().includes(sLower)) ||
              (c.title && c.title.toLowerCase().includes(sLower)) ||
              (c.target && c.target.toLowerCase().includes(sLower))
          );
        }

        const total = convs.length;
        const paged = convs.slice(skip, skip + limit).map((c) => redactRow(c));

        return NextResponse.json({
          ok: true,
          product: "copilot",
          items: paged,
          total,
          page,
          limit,
        });
      }

      case "audit-logs": {
        const where = search
          ? {
              OR: [
                { action: { contains: search, mode: "insensitive" as const } },
                { adminAuthUserId: { contains: search, mode: "insensitive" as const } },
                { targetAdminUserId: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {};

        const [items, total] = await Promise.all([
          prisma.adminAction.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.adminAction.count({ where }),
        ]);

        return NextResponse.json({
          ok: true,
          product: "audit-logs",
          items: items.map((i) => redactRow(i)),
          total,
          page,
          limit,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown product view: ${product}` },
          { status: 404 }
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "UNAUTHORIZED" },
      { status: 400 }
    );
  }
}
