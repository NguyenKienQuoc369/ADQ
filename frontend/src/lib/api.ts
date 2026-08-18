"use client";

/**
 * ADQ Security Platform - Frontend API Client Service
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000";

const APP_VERSION = "2.0.0";

if (typeof window !== "undefined") {
  const currentVer = localStorage.getItem("adq_app_version");
  if (currentVer !== APP_VERSION) {
    localStorage.clear();
    localStorage.setItem("adq_app_version", APP_VERSION);
  }
}

export type UserRole = "USER" | "ADMIN";
export type PackageTier = "FREE" | "PRO" | "PRO_MAX";
export type AccountStatus = "ACTIVE" | "PENDING" | "LOCKED";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
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
  id?: string;
  vulnerabilityId: string;
  title?: string;
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
  cve?: string;
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
  rawActionAdvice?: string;
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
  let url = path;
  try {
    if (!/^(https?:)?\/\//.test(path)) {
      url = `${API_BASE_URL.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
    }
  } catch {
    url = `${API_BASE_URL.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  let authHeader: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        authHeader["Authorization"] = `Bearer ${data.session.access_token}`;
      }
    } catch {
      // Ignore auth error if Supabase client fails
    }
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.clear();
    window.location.href = "/login?error=session_expired";
    throw new Error("UNAUTHORIZED: Session expired");
  }

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
        ? payload.detail
        : payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : res.statusText) || "Request failed";
    throw new Error(message);
  }

  return payload as T;
}

// ------------------------------------------------------------
// Copilot AI & Scan API
// ------------------------------------------------------------

export async function startScanJob(target: string, extraArgs: string[] = []): Promise<{ ok: boolean; job_id: string }> {
  return requestJson<{ ok: boolean; job_id: string }>("/api/scan", {
    method: "POST",
    body: JSON.stringify({ target, extra_args: extraArgs }),
  });
}

export async function getScanJobStatus(jobId: string): Promise<any> {
  return requestJson<any>(`/api/scan/${encodeURIComponent(jobId)}`);
}

export async function copilotChat(prompt: string): Promise<{ copilot_response: string }> {
  return requestJson<{ copilot_response: string }>("/api/copilot/chat", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

export async function copilotAnalyze(jobId: string): Promise<{ job_id: string; analysis: string }> {
  return requestJson<{ job_id: string; analysis: string }>("/api/copilot/analyze", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId }),
  });
}

export async function copilotPatch(payload: {
  vulnerability_type: string;
  endpoint: string;
  framework?: string;
}): Promise<{ patch_result: string }> {
  return requestJson<{ patch_result: string }>("/api/copilot/patch", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
