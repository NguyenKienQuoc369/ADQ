"use client";

/**
 * Lưu ý:
 * - File này là “frontend client SDK” gọi vào các Next.js Route Handlers trong `src/app/api`.
 * - Không còn dùng mock localStorage nữa. Dữ liệu thật lấy từ Prisma (Supabase Postgres) + Supabase Auth (cookie).
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export type UserRole = "USER" | "ADMIN";
export type PackageTier = "FREE" | "PRO" | "PRO_MAX";
export type AccountStatus = "ACTIVE" | "PENDING" | "LOCKED";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type FlagLikelihood = "HIGH" | "MEDIUM" | "LOW";
export type ScanTool = "Subfinder" | "DNSX" | "Naabu" | "Katana" | "GAU" | "Nuclei";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  packageTier: PackageTier;
  status: AccountStatus;
  dailyLimit: number;
  scansToday: number;
  telegramConnected: boolean;
  planExpiresAt?: string | null;
  oauthProvider?: "google" | null;
  lastLoginAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface TrendPoint {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface TechStackSlice {
  name: string;
  value: number;
}

export interface RiskPriorityRow {
  target: string;
  riskScore: number;
  flagLikelihood: FlagLikelihood;
  severity: Severity;
  primaryIssue: string;
}

export interface SummaryMetric {
  label: string;
  value: number;
  change: string;
}

export interface DashboardOverview {
  metrics: {
    totalTargets: SummaryMetric;
    totalVulnerabilities: SummaryMetric;
    totalAssets: SummaryMetric;
    subdomains: SummaryMetric;
  };
  vulnerabilityTrend: TrendPoint[];
  techStackDistribution: TechStackSlice[];
  riskPriorityTable: RiskPriorityRow[];
  realtime: {
    activeScans: number;
    queueDepth: number;
    successRate: number;
    lastUpdatedAt: string;
  };
  recentActivity: Array<{
    id: string;
    title: string;
    state: "RUNNING" | "COMPLETED" | "QUEUED";
    startedAt: string;
    target: string;
  }>;
}

export interface LiveSubdomain {
  host: string;
  ip: string;
  status: "LIVE" | "MONITORING";
  tech: string;
}

export interface PortFinding {
  port: number;
  service: string;
  exposure: string;
}

export interface SecretFinding {
  id: string;
  type: string;
  value: string;
  confidence: number;
  encoded: boolean;
  source: string;
}

export interface ActionAdvice {
  vulnerabilityId: string;
  title: string;
  rootCause: string;
  remediation: string[];
}

export interface Vulnerability {
  id: string;
  title: string;
  severity: Severity | (string & {});
  cvss: number;
  endpoint: string;
  asset: string;
  description: string;
  exploitability: number;
  impact: string;
}

export interface ScanResult {
  id: string;
  target: string;
  status: "RUNNING" | "COMPLETED" | "QUEUED";
  planUsed: PackageTier;
  startedAt: string;
  liveSubdomains: LiveSubdomain[];
  portScan: PortFinding[];
  urlHistory: string[];
  secretsHunter: SecretFinding[];
  vulnerabilities: Vulnerability[];
  actionAdvice: ActionAdvice[];
  enabledTools: ScanTool[];
  autoThrottle: boolean;
  telegram: {
    enabled: boolean;
    chatId?: string;
  };
}

export interface PackagePlan {
  tier: PackageTier;
  name: string;
  priceLabel: string;
  description: string;
  features: string[];
}

export interface RedeemCode {
  id: string;
  code: string;
  packageTier: PackageTier;
  durationLabel: string;
  maxUses: number;
  usedCount: number;
  status: "UNUSED" | "PARTIAL" | "USED";
  activatedBy?: string | null;
  createdAt: string;
}

export interface CreateManualUserResult {
  user: User;
  temporaryPassword?: string | null;
  linkedExistingAuthUser?: boolean;
}

export interface SystemStats {
  cpuUsage: number;
  ramUsage: number;
  backendNodes: number;
  totalUsers: number;
  totalScans: number;
  runningScans: number;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  // Normalize URL: if path is a relative API path (/api/...), prefix with API_BASE_URL.
  let url = path;
  try {
    // treat absolute URLs as-is
    const parsed = new URL(path, API_BASE_URL);
    if (!/^(https?:)?\/\//.test(path)) {
      // path was relative, ensure we build absolute using API_BASE_URL
      url = `${API_BASE_URL.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
    }
  } catch (e) {
    url = `${API_BASE_URL.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : res.statusText) || "Request failed";
    throw new Error(message);
  }

  return payload as T;
}

// ------------------------------------------------------------
// Auth: đã chuyển sang Supabase trong AuthProvider
// ------------------------------------------------------------

export function getStoredSession() {
  return null as AuthResponse | null;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  void email;
  void password;
  throw new Error("Auth đã chuyển sang Supabase. Vui lòng dùng AuthProvider.");
}

export async function register(payload: { name: string; email: string; password: string }): Promise<AuthResponse> {
  void payload;
  throw new Error("Auth đã chuyển sang Supabase. Vui lòng dùng AuthProvider.");
}

export async function loginWithGoogle(): Promise<AuthResponse> {
  throw new Error("Auth đã chuyển sang Supabase. Vui lòng dùng AuthProvider.");
}

export async function logout() {
  return;
}

export async function getCurrentUser() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null as User | null;
  }

  const metadata = data.user.user_metadata ?? {};
  return {
    id: data.user.id,
    name: metadata.name || metadata.full_name || data.user.email?.split("@")[0] || "Người dùng",
    email: data.user.email ?? "",
    avatar: metadata.avatar_url || metadata.picture || undefined,
    role: metadata.role === "ADMIN" ? "ADMIN" : "USER",
    packageTier: metadata.packageTier === "PRO_MAX" ? "PRO_MAX" : metadata.packageTier === "PRO" ? "PRO" : "FREE",
    status: "ACTIVE",
    dailyLimit: metadata.packageTier === "FREE" ? 5 : 999,
    scansToday: 0,
    telegramConnected: false,
    planExpiresAt: null,
    oauthProvider: metadata.provider === "google" ? "google" : null,
    lastLoginAt: new Date().toISOString(),
  } satisfies User;
}

export async function forgotPassword(email: string) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw error;
  }

  return {
    ok: true,
    message: "Nếu email tồn tại, hệ thống đã gửi liên kết đặt lại mật khẩu.",
  };
}

export async function resetPassword(token: string, password: string) {
  const supabase = createSupabaseBrowserClient();

  if (token.trim()) {
    const url = new URL(window.location.href);
    url.searchParams.set("token", token);
    window.history.replaceState({}, "", url.toString());
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw error;
  }

  return {
    ok: true,
    message: "Mật khẩu đã được cập nhật. Bạn có thể đăng nhập lại ngay.",
  };
}

// ------------------------------------------------------------
// Dashboard + Scan
// ------------------------------------------------------------

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const res = await requestJson<{ ok: true; overview: DashboardOverview }>("/api/dashboard/overview");
  return res.overview;
}

export async function getScanResults(): Promise<ScanResult[]> {
  const res = await requestJson<{ ok: true; scans: ScanResult[] }>("/api/scans");
  return res.scans;
}

export async function getProjects(): Promise<any[]> {
  const res = await requestJson<{ ok: true; projects: any[] }>("/api/projects");
  return res.projects ?? [];
}

export async function getProjectById(projectId: string): Promise<any> {
  const res = await requestJson<{ ok: true; project: any }>(`/api/projects/${encodeURIComponent(projectId)}`);
  return res.project;
}

export async function createProject(input: {
  name: string;
  domain?: string;
  description?: string;
  password?: string;
  module?: string;
}): Promise<any> {
  const res = await requestJson<{ ok: true; project: any }>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.project;
}

export async function deleteProject(projectId: string): Promise<boolean> {
  const res = await requestJson<{ ok: true; deleted: boolean }>(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
  });
  return Boolean(res.deleted);
}

export async function saveProjectDetail(projectId: string, payload: Record<string, any>) {
  const res = await requestJson<{ ok: true; detail: any }>(`/api/projects/${encodeURIComponent(projectId)}/details`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.detail;
}

export async function exportReport(scanId: string, format: "json" | "html" | "markdown") {
  const res = await requestJson<{ ok: true; scan: ScanResult }>(`/api/scans/${encodeURIComponent(scanId)}`);
  const scan = res.scan;

  const payload = {
    generatedAt: new Date().toISOString(),
    source: API_BASE_URL,
    scan,
  };

  if (format === "json") {
    return {
      filename: `${scan.target}-report.json`,
      content: JSON.stringify(payload, null, 2),
      mimeType: "application/json",
    };
  }

  if (format === "html") {
    return {
      filename: `${scan.target}-report.html`,
      content: `<!doctype html><html><head><meta charset="utf-8" /><title>ADQ Report - ${scan.target}</title></head><body style="font-family:Arial;background:#0b1220;color:#e2e8f0;padding:24px"><h1>ADQ Report - ${scan.target}</h1><p>Generated from ${API_BASE_URL}</p><pre style="white-space:pre-wrap;background:#0f172a;padding:16px;border-radius:12px">${escapeHtml(
        JSON.stringify(payload, null, 2),
      )}</pre></body></html>`,
      mimeType: "text/html",
    };
  }

  return {
    filename: `${scan.target}-report.md`,
    content: `# ADQ Report\n\n- Target: ${scan.target}\n- Generated At: ${new Date().toISOString()}\n- Vulnerabilities: ${scan.vulnerabilities.length}\n- Source: ${API_BASE_URL}\n`,
    mimeType: "text/markdown",
  };
}

function escapeHtml(input: string) {
  return input.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function decodeBase64Value(value: string) {
  try {
    return atob(value);
  } catch {
    return "Không thể decode giá trị này.";
  }
}

// ------------------------------------------------------------
// Admin
// ------------------------------------------------------------

export async function getPackagePlans(): Promise<PackagePlan[]> {
  return [
    { tier: "FREE", name: "Free", priceLabel: "0đ / tháng", description: "Cơ bản", features: [] },
    { tier: "PRO", name: "Pro", priceLabel: "799.000đ / tháng", description: "Nâng cao", features: [] },
    { tier: "PRO_MAX", name: "Pro Max", priceLabel: "1.499.000đ / tháng", description: "Enterprise", features: [] },
  ];
}

export async function redeemCode(code: string): Promise<User> {
  const res = await requestJson<{ user: User }>("/api/account/redeem", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return res.user;
}

export async function getSystemStats(): Promise<SystemStats> {
  const res = await requestJson<{ ok: true; overview?: any; adminStats?: any }>("/api/dashboard/overview");
  // if adminStats present, use it
  if (res?.adminStats) {
    return {
      cpuUsage: Number(res.adminStats.cpuUsage ?? 0),
      ramUsage: Number(res.adminStats.ramUsage ?? 0),
      backendNodes: Number(res.adminStats.backendNodes ?? 0),
      totalUsers: Number(res.adminStats.totalUsers ?? 0),
      totalScans: Number(res.adminStats.totalScans ?? 0),
      runningScans: Number(res.adminStats.runningScans ?? 0),
    };
  }

  // fallback: try to map from overview.realtime and metrics
  if (res?.overview) {
    const realtime = res.overview.realtime ?? {};
    const metrics = res.overview.metrics ?? {};
    const totalScans = metrics.subdomains?.value ?? 0;
    return {
      cpuUsage: 0,
      ramUsage: 0,
      backendNodes: Number(process.env.BACKEND_NODE_COUNT ?? 1),
      totalUsers: 0,
      totalScans: Number(totalScans ?? 0),
      runningScans: Number(realtime.activeScans ?? 0),
    };
  }

  return { cpuUsage: 0, ramUsage: 0, backendNodes: 0, totalUsers: 0, totalScans: 0, runningScans: 0 };
}

export async function getAdminUsers(filters: { search?: string; role?: UserRole | "ALL"; packageTier?: PackageTier | "ALL" } = {}): Promise<User[]> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.role && filters.role !== "ALL") params.set("role", filters.role);
  if (filters.packageTier && filters.packageTier !== "ALL") params.set("packageTier", filters.packageTier);

  const query = params.toString();
  const res = await requestJson<{ users: User[] }>(`/api/admin/users${query ? `?${query}` : ""}`);
  return res.users ?? [];
}

export async function createManualUser(values: {
  name: string;
  email: string;
  role: UserRole;
  packageTier: PackageTier;
  password?: string;
}, planDurationDays?: number | null): Promise<CreateManualUserResult> {
  const body: any = {
    name: values.name,
    email: values.email,
    role: values.role,
    packageTier: values.packageTier,
    password: values.password?.trim() || undefined,
    status: "ACTIVE",
    dailyLimit: values.packageTier === "FREE" ? 5 : values.packageTier === "PRO" ? 25 : 100,
    scansToday: 0,
    telegramConnected: false,
  };
  if (planDurationDays !== undefined) {
    if (planDurationDays === null) {
      body.planExpiresAt = null;
    } else {
      const expires = new Date();
      expires.setDate(expires.getDate() + planDurationDays);
      body.planExpiresAt = expires.toISOString();
    }
  }

  const res = await requestJson<CreateManualUserResult>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res;
}

export async function updateUserStatus(userId: string, status: AccountStatus): Promise<User> {
  const res = await requestJson<{ user: User }>(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return res.user;
}

export async function updateUserRoleAndPackage(userId: string, nextRole: UserRole, nextPackage: PackageTier, planExpiresAt?: string | null): Promise<User> {
  const body: any = { role: nextRole, packageTier: nextPackage };
  if (planExpiresAt !== undefined) body.planExpiresAt = planExpiresAt;
  const res = await requestJson<{ user: User }>(`/api/admin/users/${encodeURIComponent(userId)}/role-package`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return res.user;
}

export async function deleteAdminUser(userId: string) {
  await requestJson<{ ok: true }>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
  return true;
}

export async function getRedeemCodes(): Promise<RedeemCode[]> {
  const res = await requestJson<{ codes: RedeemCode[] }>("/api/admin/redeem-codes");
  return res.codes ?? [];
}

export async function createRedeemCode(input: {
  packageTier: Exclude<PackageTier, "FREE">;
  durationLabel: string;
  maxUses: number;
}): Promise<RedeemCode> {
  const res = await requestJson<{ code: RedeemCode }>("/api/admin/redeem-codes", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.code;
}
