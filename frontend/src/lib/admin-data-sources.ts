import "server-only";

import { getPrismaClient } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Redis from "ioredis";

// ---------------------------------------------------------------------------
// 1. Redis Client Manager (Safe, Reusable, Bounded)
// ---------------------------------------------------------------------------
let redisClientInstance: Redis | null = null;

export function getAdminRedisClient(): Redis {
  if (!redisClientInstance) {
    const redisUrl =
      process.env.REDIS_URL ||
      `redis://${process.env.REDIS_HOST || "redis"}:${process.env.REDIS_PORT || 6379}`;

    redisClientInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      connectTimeout: 3000,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redisClientInstance.on("error", (err) => {
      console.error("[AdminRedis] Connection error:", err.message);
    });
  }
  return redisClientInstance;
}

// ---------------------------------------------------------------------------
// 2. Sensitive Data Redaction
// ---------------------------------------------------------------------------
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /auth/i,
  /credential/i,
  /private/i,
  /cookie/i,
  /master_key/i,
  /masterkey/i,
  /apikey/i,
  /api_key/i,
  /jwt/i,
  /bearer/i,
  /signature/i,
  /test_credential/i,
  /authorized_test_credential/i,
];

export function maskSensitiveValue(key: string, value: any): any {
  if (value === null || value === undefined) return value;

  const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
  if (isSensitiveKey) {
    if (typeof value === "string") {
      if (value.length <= 8) return "[REDACTED]";
      return `${value.slice(0, 3)}...[REDACTED]...${value.slice(-3)}`;
    }
    return "[REDACTED]";
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      sanitized[k] = maskSensitiveValue(k, v);
    }
    return sanitized;
  }

  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "object" ? maskSensitiveValue(key, item) : item));
  }

  return value;
}

export function redactRow(row: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key] = maskSensitiveValue(key, value);
  }
  return result;
}

// ---------------------------------------------------------------------------
// 3. PostgreSQL Authoritative Tables Registry (Allowlisted)
// ---------------------------------------------------------------------------
export interface TableSchemaInfo {
  name: string;
  displayName: string;
  description: string;
  category: "CORE" | "SECURITY" | "PRODUCTS" | "BILLING" | "SYSTEM";
  primaryKey: string;
  allowSortColumns: string[];
  searchColumns: string[];
}

export const ALLOWLISTED_POSTGRES_TABLES: Record<string, TableSchemaInfo> = {
  admin_users: {
    name: "admin_users",
    displayName: "Tài khoản & Hồ sơ (admin_users)",
    description: "Hồ sơ người dùng ứng dụng, phân quyền, gói dịch vụ, hạn mức quét hàng ngày.",
    category: "CORE",
    primaryKey: "id",
    allowSortColumns: ["id", "email", "role", "packageTier", "status", "scansToday", "dailyLimit", "createdAt", "lastLoginAt"],
    searchColumns: ["email", "name", "authUserId", "id"],
  },
  admin_actions: {
    name: "admin_actions",
    displayName: "Nhật ký Hoạt động Quản trị (admin_actions)",
    description: "Ghi vết mọi thay đổi phân quyền, cấu hình hệ thống, tạo mã license, đăng nhập SOC.",
    category: "SYSTEM",
    primaryKey: "id",
    allowSortColumns: ["id", "action", "adminAuthUserId", "targetAdminUserId", "createdAt"],
    searchColumns: ["action", "adminAuthUserId", "targetAdminUserId"],
  },
  targets: {
    name: "targets",
    displayName: "Mục tiêu Rà quét (targets)",
    description: "Danh sách domain và mục tiêu được cấu hình trong các dự án.",
    category: "PRODUCTS",
    primaryKey: "id",
    allowSortColumns: ["id", "domain", "createdAt", "updatedAt"],
    searchColumns: ["domain", "id"],
  },
  project_details: {
    name: "project_details",
    displayName: "Chi tiết Dự án (project_details)",
    description: "Thông tin dự án, điểm rủi ro (risk_score), tóm tắt bảo mật, thời điểm quét gần nhất.",
    category: "PRODUCTS",
    primaryKey: "id",
    allowSortColumns: ["id", "projectId", "title", "status", "riskScore", "lastScanAt", "createdAt"],
    searchColumns: ["title", "description", "projectId", "id"],
  },
  scan_jobs: {
    name: "scan_jobs",
    displayName: "Phiên Rà quét Bảo mật (scan_jobs)",
    description: "Lịch sử và trạng thái các phiên quét tự động DAST, Recon, Port Scan, Secret Hunter.",
    category: "SECURITY",
    primaryKey: "scanId",
    allowSortColumns: ["scanId", "targetDomain", "status", "priorityScore", "startedAt", "endedAt", "createdAt"],
    searchColumns: ["scanId", "targetDomain", "status"],
  },
  live_hosts: {
    name: "live_hosts",
    displayName: "Subdomain & Live Hosts (live_hosts)",
    description: "Các subdomain và host còn hoạt động phát hiện qua Subfinder, DNSX, Katana.",
    category: "SECURITY",
    primaryKey: "id",
    allowSortColumns: ["id", "scanId", "statusCode", "title", "createdAt"],
    searchColumns: ["url", "title", "tech", "scanId"],
  },
  scan_endpoints: {
    name: "scan_endpoints",
    displayName: "Endpoints & URLs (scan_endpoints)",
    description: "Danh sách URL/API Endpoint thu thập được trong quá trình crawl mục tiêu.",
    category: "SECURITY",
    primaryKey: "id",
    allowSortColumns: ["id", "scanId", "source", "method", "statusCode", "contentLength", "createdAt"],
    searchColumns: ["url", "source", "scanId"],
  },
  vulnerabilities: {
    name: "vulnerabilities",
    displayName: "Lỗ hổng Phát hiện (vulnerabilities)",
    description: "Các lỗ hổng bảo mật (Critical, High, Medium, Low, Info) được xác thực.",
    category: "SECURITY",
    primaryKey: "id",
    allowSortColumns: ["id", "scanId", "severity", "source", "templateId", "host", "createdAt"],
    searchColumns: ["templateId", "host", "endpoint", "severity", "scanId"],
  },
  stress_jobs: {
    name: "stress_jobs",
    displayName: "Kiểm thử Tải & Hiệu năng (stress_jobs)",
    description: "Dữ liệu kiểm thử tải WAF/DDoS, cấu hình RPS, kết quả latency, tỷ lệ lỗi, phán quyết ổn định.",
    category: "PRODUCTS",
    primaryKey: "jobId",
    allowSortColumns: ["jobId", "userId", "tier", "targetUrl", "targetRequests", "targetRps", "status", "phase", "progress", "createdAt", "finishedAt"],
    searchColumns: ["jobId", "userId", "targetUrl", "status", "verdict"],
  },
  redeem_codes: {
    name: "redeem_codes",
    displayName: "Mã License Khuyến mãi (redeem_codes)",
    description: "Kho mã kích hoạt gói PRO/PRO_MAX, số lượt sử dụng tối đa, trạng thái kích hoạt.",
    category: "BILLING",
    primaryKey: "id",
    allowSortColumns: ["id", "code", "packageTier", "durationLabel", "maxUses", "usedCount", "status", "createdAt"],
    searchColumns: ["code", "packageTier", "activatedBy", "createdByEmail"],
  },
  redeem_code_redemptions: {
    name: "redeem_code_redemptions",
    displayName: "Lịch sử Đổi mã (redeem_code_redemptions)",
    description: "Ghi nhận từng lần người dùng nhập mã kích hoạt thành công.",
    category: "BILLING",
    primaryKey: "id",
    allowSortColumns: ["id", "redeemCodeId", "userAuthId", "userEmail", "createdAt"],
    searchColumns: ["userEmail", "userAuthId", "redeemCodeId"],
  },
  outgoing_emails: {
    name: "outgoing_emails",
    displayName: "Email Hệ thống (outgoing_emails)",
    description: "Hàng đợi và lịch sử gửi email thông báo, xác minh, kích hoạt tài khoản.",
    category: "SYSTEM",
    primaryKey: "id",
    allowSortColumns: ["id", "to", "subject", "sentAt", "createdAt"],
    searchColumns: ["to", "subject"],
  },
};

export async function queryPostgresTable(params: {
  table: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  filterField?: string;
  filterValue?: string;
}) {
  const tableConfig = ALLOWLISTED_POSTGRES_TABLES[params.table];
  if (!tableConfig) {
    throw new Error(`Bảng '${params.table}' không nằm trong danh sách bảng được phép quan sát.`);
  }

  const prisma = getPrismaClient();
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 25));
  const skip = (page - 1) * limit;

  const sortBy = params.sortBy && tableConfig.allowSortColumns.includes(params.sortBy)
    ? params.sortBy
    : "createdAt" in tableConfig.allowSortColumns
    ? "createdAt"
    : tableConfig.primaryKey;

  const sortOrder = params.sortOrder === "asc" ? "asc" : "desc";
  const orderBy = { [sortBy]: sortOrder };

  // Build where clause
  let where: Record<string, any> = {};

  if (params.search && tableConfig.searchColumns.length > 0) {
    where.OR = tableConfig.searchColumns.map((col) => ({
      [col]: { contains: params.search, mode: "insensitive" },
    }));
  }

  if (params.filterField && params.filterValue && tableConfig.allowSortColumns.includes(params.filterField)) {
    where[params.filterField] = params.filterValue;
  }

  // Map to prisma model dynamically
  let modelDelegate: any;
  switch (params.table) {
    case "admin_users":
      modelDelegate = prisma.adminUser;
      break;
    case "admin_actions":
      modelDelegate = prisma.adminAction;
      break;
    case "targets":
      modelDelegate = prisma.target;
      break;
    case "project_details":
      modelDelegate = prisma.projectDetail;
      break;
    case "scan_jobs":
      modelDelegate = prisma.scanJob;
      break;
    case "live_hosts":
      modelDelegate = prisma.liveHost;
      break;
    case "scan_endpoints":
      modelDelegate = prisma.scanEndpoint;
      break;
    case "vulnerabilities":
      modelDelegate = prisma.vulnerability;
      break;
    case "stress_jobs":
      modelDelegate = prisma.stressJob;
      break;
    case "redeem_codes":
      modelDelegate = prisma.redeemCode;
      break;
    case "redeem_code_redemptions":
      modelDelegate = prisma.redeemCodeRedemption;
      break;
    case "outgoing_emails":
      modelDelegate = prisma.outgoingEmail;
      break;
    default:
      throw new Error("Không thể kết nối model Prisma tương ứng.");
  }

  const [rows, total] = await Promise.all([
    modelDelegate.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
    modelDelegate.count({ where }),
  ]);

  const sanitizedRows = rows.map((r: any) => redactRow(r));

  return {
    table: params.table,
    schema: tableConfig,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    rows: sanitizedRows,
  };
}

// ---------------------------------------------------------------------------
// 4. Supabase Auth Adapter & Reconciliation
// ---------------------------------------------------------------------------
export async function getSupabaseUsersList(page: number = 1, limit: number = 25) {
  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: limit,
    });

    if (error) {
      return { ok: false, error: error.message, users: [], total: 0 };
    }

    const sanitizedUsers = (data?.users || []).map((u) => ({
      id: u.id,
      email: u.email,
      phone: u.phone || null,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at,
      confirmedAt: u.email_confirmed_at,
      appMetadata: {
        provider: u.app_metadata?.provider || "email",
        providers: u.app_metadata?.providers || ["email"],
        role: u.app_metadata?.role || "USER",
      },
      userMetadata: {
        name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split("@")[0] || "Người dùng",
        packageTier: u.user_metadata?.packageTier || "FREE",
      },
    }));

    return {
      ok: true,
      users: sanitizedUsers,
      total: data?.total ?? sanitizedUsers.length,
      page,
      limit,
    };
  } catch (err: any) {
    return { ok: false, error: err.message, users: [], total: 0 };
  }
}

export async function getSupabaseReconciliation() {
  const prisma = getPrismaClient();
  const supabaseAdmin = createSupabaseAdminClient();

  try {
    const [{ data: authData }, dbUsers] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      prisma.adminUser.findMany({ select: { id: true, authUserId: true, email: true, packageTier: true, role: true } }),
    ]);

    const authUsers = authData?.users || [];

    const dbUserByAuthId = new Map(dbUsers.filter((u) => u.authUserId).map((u) => [u.authUserId!, u]));
    const dbUserByEmail = new Map(dbUsers.map((u) => [u.email.toLowerCase(), u]));

    const missingInDb: any[] = [];
    const tierMismatches: any[] = [];

    for (const au of authUsers) {
      const email = (au.email || "").toLowerCase();
      const matchedDb = dbUserByAuthId.get(au.id) || dbUserByEmail.get(email);

      if (!matchedDb) {
        missingInDb.push({
          authUserId: au.id,
          email: au.email,
          createdAt: au.created_at,
          lastSignInAt: au.last_sign_in_at,
          anomaly: "Chưa có bản ghi trong bảng admin_users (PostgreSQL)",
        });
      } else {
        const authTier = au.user_metadata?.packageTier || "FREE";
        if (matchedDb.packageTier !== authTier && matchedDb.packageTier !== "FREE") {
          tierMismatches.push({
            authUserId: au.id,
            email: au.email,
            authMetadataTier: authTier,
            postgresTier: matchedDb.packageTier,
            anomaly: "Lệch thông tin Package Tier giữa Supabase User Metadata và PostgreSQL",
          });
        }
      }
    }

    const authUserIds = new Set(authUsers.map((u) => u.id));
    const orphanedInDb = dbUsers
      .filter((u) => u.authUserId && !authUserIds.has(u.authUserId))
      .map((u) => ({
        dbId: u.id,
        authUserId: u.authUserId,
        email: u.email,
        anomaly: "Auth User ID trong PostgreSQL không tồn tại trên Supabase Auth",
      }));

    return {
      ok: true,
      totalAuthUsers: authUsers.length,
      totalDbUsers: dbUsers.length,
      anomaliesCount: missingInDb.length + orphanedInDb.length + tierMismatches.length,
      missingInDb,
      orphanedInDb,
      tierMismatches,
    };
  } catch (err: any) {
    return { ok: false, error: err.message, anomaliesCount: 0, missingInDb: [], orphanedInDb: [], tierMismatches: [] };
  }
}

// ---------------------------------------------------------------------------
// 5. Redis Safe Explorer (Non-blocking SCAN, Categorized Namespaces)
// ---------------------------------------------------------------------------
export interface RedisKeySummary {
  key: string;
  namespace: string;
  type: string;
  ttl: number;
  valuePreview?: any;
}

const REDIS_NAMESPACES = [
  { prefix: "stress_job:", name: "Stress Tests (Live Jobs)", category: "STRESS" },
  { prefix: "stress_history:", name: "Stress History Index", category: "STRESS" },
  { prefix: "stress_active_user:", name: "Stress Concurrency Lock", category: "STRESS" },
  { prefix: "copilot_convs:", name: "Copilot Conversations List", category: "COPILOT" },
  { prefix: "copilot_conv_meta:", name: "Copilot Conversation Metadata", category: "COPILOT" },
  { prefix: "copilot_msgs:", name: "Copilot Messages", category: "COPILOT" },
  { prefix: "copilot_memory:", name: "Copilot Session Memory", category: "COPILOT" },
  { prefix: "adq:copilot_cache:", name: "Copilot AI Response Cache", category: "COPILOT" },
  { prefix: "job_meta:", name: "Scan Job Metadata", category: "SCAN" },
  { prefix: "job_result:", name: "Scan Live Result", category: "SCAN" },
  { prefix: "scan_ai_risk:", name: "Scan AI Risk Assessment", category: "SCAN" },
  { prefix: "worker_heartbeat:", name: "Worker Heartbeats", category: "INFRA" },
  { prefix: "apk:history:", name: "APK Audit User History", category: "APK" },
  { prefix: "apk:queue:", name: "APK Processing Queue", category: "APK" },
  { prefix: "apk:job:", name: "APK Job Telemetry", category: "APK" },
  { prefix: "target_verification:", name: "Domain Verification Token", category: "AUTH" },
  { prefix: "user_usage:", name: "User Rate Limiting & Quotas", category: "AUTH" },
];

export async function scanRedisKeys(params: {
  prefix?: string;
  cursor?: string;
  limit?: number;
}) {
  const redis = getAdminRedisClient();
  const pattern = params.prefix ? `${params.prefix}*` : "*";
  const count = Math.min(100, Math.max(10, params.limit || 30));
  const cursor = params.cursor || "0";

  try {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", count);

    const items: RedisKeySummary[] = [];

    // Pipeline to fetch types and TTLs efficiently
    if (keys.length > 0) {
      const pipe = redis.pipeline();
      for (const k of keys) {
        pipe.type(k);
        pipe.ttl(k);
      }
      const results = await pipe.exec();

      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const keyType = (results?.[i * 2]?.[1] as string) || "unknown";
        const ttl = (results?.[i * 2 + 1]?.[1] as number) ?? -1;

        const matchedNamespace = REDIS_NAMESPACES.find((ns) => k.startsWith(ns.prefix))?.name || "Khác / Chung";

        items.push({
          key: k,
          namespace: matchedNamespace,
          type: keyType,
          ttl,
        });
      }
    }

    return {
      ok: true,
      keys: items,
      nextCursor: nextCursor === "0" ? null : nextCursor,
      totalReturned: items.length,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message,
      keys: [],
      nextCursor: null,
      totalReturned: 0,
    };
  }
}

export async function getRedisKeyValue(key: string) {
  const redis = getAdminRedisClient();
  try {
    const keyType = await redis.type(key);
    let rawValue: any = null;

    if (keyType === "string") {
      rawValue = await redis.get(key);
      try {
        rawValue = JSON.parse(rawValue);
      } catch {}
    } else if (keyType === "hash") {
      rawValue = await redis.hgetall(key);
    } else if (keyType === "list") {
      rawValue = await redis.lrange(key, 0, 50);
    } else if (keyType === "set") {
      rawValue = await redis.smembers(key);
    } else if (keyType === "zset") {
      rawValue = await redis.zrange(key, 0, 50 as any);
    }

    const ttl = await redis.ttl(key);
    const sanitizedValue = maskSensitiveValue(key, rawValue);

    return {
      ok: true,
      key,
      type: keyType,
      ttl,
      value: sanitizedValue,
    };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// 6. User 360 Aggregated Profile
// ---------------------------------------------------------------------------
export async function getUser360Profile(userIdOrEmail: string) {
  const prisma = getPrismaClient();
  const supabaseAdmin = createSupabaseAdminClient();

  try {
    // 1. Search in PostgreSQL admin_users
    const dbUser = await prisma.adminUser.findFirst({
      where: {
        OR: [
          { id: userIdOrEmail },
          { authUserId: userIdOrEmail },
          { email: { equals: userIdOrEmail, mode: "insensitive" } },
        ],
      },
    });

    // 2. Search in Supabase Auth
    let authUser: any = null;
    if (dbUser?.authUserId) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(dbUser.authUserId);
      authUser = data?.user || null;
    } else if (userIdOrEmail.includes("-") && userIdOrEmail.length >= 32) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(userIdOrEmail);
      authUser = data?.user || null;
    }

    const effectiveAuthId = authUser?.id || dbUser?.authUserId || null;
    const effectiveEmail = dbUser?.email || authUser?.email || userIdOrEmail;

    // 3. Query all related durable application entities in parallel
    const [scans, stressJobs, redemptions] = await Promise.all([
      prisma.scanJob.findMany({
        where: {
          OR: [
            { targetDomain: { contains: effectiveEmail.split("@")[0], mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      effectiveAuthId
        ? prisma.stressJob.findMany({
            where: { userId: effectiveAuthId },
            orderBy: { createdAt: "desc" },
            take: 10,
          })
        : [],
      prisma.redeemCodeRedemption.findMany({
        where: {
          OR: [
            ...(effectiveAuthId ? [{ userAuthId: effectiveAuthId }] : []),
            { userEmail: { equals: effectiveEmail, mode: "insensitive" } },
          ],
        },
        include: { redeemCode: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // 4. Query Redis for Copilot and live state
    let copilotConversations: any[] = [];
    if (effectiveAuthId) {
      try {
        const redis = getAdminRedisClient();
        const convKeys = await redis.smembers(`copilot_convs:${effectiveAuthId}`);
        if (convKeys && convKeys.length > 0) {
          const pipe = redis.pipeline();
          for (const cId of convKeys.slice(0, 10)) {
            pipe.get(`copilot_conv_meta:${effectiveAuthId}:${cId}`);
          }
          const results = await pipe.exec();
          copilotConversations = results
            ?.map(([err, val]) => {
              if (err || !val) return null;
              try {
                return JSON.parse(val as string);
              } catch {
                return null;
              }
            })
            .filter(Boolean) || [];
        }
      } catch {}
    }

    return {
      ok: true,
      user: {
        id: dbUser?.id || null,
        authUserId: effectiveAuthId,
        email: effectiveEmail,
        name: dbUser?.name || authUser?.user_metadata?.name || effectiveEmail.split("@")[0],
        role: dbUser?.role || "USER",
        packageTier: dbUser?.packageTier || "FREE",
        status: dbUser?.status || "ACTIVE",
        dailyLimit: dbUser?.dailyLimit || 5,
        scansToday: dbUser?.scansToday || 0,
        planExpiresAt: dbUser?.planExpiresAt || null,
        lastLoginAt: dbUser?.lastLoginAt || authUser?.last_sign_in_at || null,
        createdAt: dbUser?.createdAt || authUser?.created_at || null,
        authConfirmedAt: authUser?.email_confirmed_at || null,
        authProvider: authUser?.app_metadata?.provider || "email",
      },
      activity: {
        scansCount: scans.length,
        recentScans: scans.map((s) => redactRow(s)),
        stressJobsCount: stressJobs.length,
        recentStressJobs: stressJobs.map((st) => redactRow(st)),
        redeemRedemptionsCount: redemptions.length,
        recentRedemptions: redemptions.map((r) => redactRow(r)),
        copilotConversationsCount: copilotConversations.length,
        recentCopilotConversations: copilotConversations.map((c) => redactRow(c)),
      },
    };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// 7. System Overview & Health Aggregator
// ---------------------------------------------------------------------------
export async function getAdminSystemOverview() {
  const prisma = getPrismaClient();

  // Test PostgreSQL connection & counts
  let pgStatus = "HEALTHY";
  let pgError: string | null = null;
  let counts = {
    users: 0,
    freeUsers: 0,
    proUsers: 0,
    proMaxUsers: 0,
    targets: 0,
    projects: 0,
    scanJobs: 0,
    vulnerabilities: 0,
    stressJobs: 0,
    redeemCodes: 0,
    redeemUsed: 0,
  };

  try {
    const [
      totalUsers,
      freeUsers,
      proUsers,
      proMaxUsers,
      targets,
      projects,
      scanJobs,
      vulnerabilities,
      stressJobs,
      redeemCodes,
      redeemUsed,
    ] = await Promise.all([
      prisma.adminUser.count(),
      prisma.adminUser.count({ where: { packageTier: "FREE" } }),
      prisma.adminUser.count({ where: { packageTier: "PRO" } }),
      prisma.adminUser.count({ where: { packageTier: "PRO_MAX" } }),
      prisma.target.count(),
      prisma.projectDetail.count(),
      prisma.scanJob.count(),
      prisma.vulnerability.count(),
      prisma.stressJob.count(),
      prisma.redeemCode.count(),
      prisma.redeemCodeRedemption.count(),
    ]);

    counts = {
      users: totalUsers,
      freeUsers,
      proUsers,
      proMaxUsers,
      targets,
      projects,
      scanJobs,
      vulnerabilities,
      stressJobs,
      redeemCodes,
      redeemUsed,
    };
  } catch (err: any) {
    pgStatus = "DOWN";
    pgError = err.message;
  }

  // Test Supabase Auth connection
  let supabaseStatus = "HEALTHY";
  let supabaseError: string | null = null;
  let supabaseUserCount = 0;
  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) {
      supabaseStatus = "DEGRADED";
      supabaseError = error.message;
    } else {
      supabaseUserCount = data?.total ?? 0;
    }
  } catch (err: any) {
    supabaseStatus = "DOWN";
    supabaseError = err.message;
  }

  // Test Redis connection
  let redisStatus = "HEALTHY";
  let redisError: string | null = null;
  let redisKeyCount = 0;
  let workerHeartbeats: Record<string, any> = {};

  try {
    const redis = getAdminRedisClient();
    const pong = await redis.ping();
    if (pong !== "PONG") {
      redisStatus = "DEGRADED";
    }

    const dbsize = await redis.dbsize();
    redisKeyCount = dbsize;

    // Scan worker heartbeats
    const [, hbKeys] = await redis.scan("0", "MATCH", "worker_heartbeat:*", "COUNT", 50);
    if (hbKeys.length > 0) {
      const pipe = redis.pipeline();
      for (const k of hbKeys) {
        pipe.get(k);
      }
      const hbVals = await pipe.exec();
      for (let i = 0; i < hbKeys.length; i++) {
        const workerName = hbKeys[i].replace("worker_heartbeat:", "");
        try {
          workerHeartbeats[workerName] = JSON.parse(hbVals?.[i]?.[1] as string);
        } catch {
          workerHeartbeats[workerName] = { raw: hbVals?.[i]?.[1] };
        }
      }
    }
  } catch (err: any) {
    redisStatus = "DOWN";
    redisError = err.message;
  }

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    metrics: {
      ...counts,
      supabaseAuthUsers: supabaseUserCount,
      redisTotalKeys: redisKeyCount,
    },
    sources: {
      postgres: { status: pgStatus, error: pgError, database: "adq_db", schema: "public" },
      supabaseAuth: { status: supabaseStatus, error: supabaseError, project: "audgnatnirrkpgbxcuut" },
      redis: { status: redisStatus, error: redisError, host: "adq_redis:6379" },
    },
    services: {
      apiServer: "HEALTHY",
      webDashboard: "HEALTHY",
      workerLight: workerHeartbeats["worker-light-1"] ? "HEALTHY" : "ACTIVE",
      workerElite: workerHeartbeats["worker-elite-1"] ? "HEALTHY" : "ACTIVE",
      workerStress: workerHeartbeats["worker-stress-1"] ? "HEALTHY" : "ACTIVE",
    },
    workerHeartbeats,
  };
}

export async function logAdminAction(
  adminAuthUserId: string,
  action: string,
  detail?: Record<string, any>,
  targetAdminUserId?: string
) {
  try {
    const prisma = getPrismaClient();
    await prisma.adminAction.create({
      data: {
        adminAuthUserId,
        targetAdminUserId,
        action,
        detail: detail ? maskSensitiveValue("detail", detail) : undefined,
      },
    });
  } catch (err) {
    console.error("[AdminActionLog] Error logging admin action:", err);
  }
}
