"use client";

/**
 * ADQ Security Platform - Frontend API Client Service
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (typeof window !== "undefined" ? window.location.origin : "");

const APP_VERSION = "2.0.0";

if (typeof window !== "undefined") {
  const currentVer = localStorage.getItem("adq_app_version");
  if (currentVer !== APP_VERSION) {
    // localStorage.clear();
    localStorage.setItem("adq_app_version", APP_VERSION);
  }
}

export type UserRole = "USER" | "ADMIN";
export type PackageTier = "FREE" | "PRO" | "PRO_MAX";
export type AccountStatus = "ACTIVE" | "PENDING" | "LOCKED";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type FlagLikelihood = "HIGH" | "MEDIUM" | "LOW";
export type ScanTool = "Subfinder" | "DNSX" | "Naabu" | "Katana" | "GAU" | "Nuclei";
export type ControlStatus = "PASS" | "FAIL" | "NOT_TESTED" | "INCONCLUSIVE";

export interface EvaluatedSecurityControl {
  id: string;
  code: string;
  title: string;
  title_vi: string;
  category: string;
  stage_id: string;
  stage_name: string;
  description: string;
  description_vi: string;
  severity_if_failed: Severity;
  owasp_category: string;
  cwe_ids: string[];
  minimum_tier: PackageTier;
  remediation_guide: string;
  remediation_code_snippet?: string | null;
  status: ControlStatus;
  reason: string;
  findings_count: number;
  findings: any[];
  evidence?: any;
  tested_at?: number;
}

export interface StageSummary {
  stage_id: string;
  name: string;
  name_vi: string;
  description: string;
  state: "COMPLETED" | "IN_PROGRESS" | "FAILED" | "PENDING" | "SKIPPED" | "NOT_TESTED";
  progress_pct: number;
  total_controls: number;
  pass_count: number;
  fail_count: number;
  inconclusive_count: number;
  not_tested_count: number;
}

export interface CoverageSummary {
  total_controls: number;
  tested_controls: number;
  passed_controls: number;
  failed_controls: number;
  inconclusive_controls: number;
  not_tested_controls: number;
  coverage_percentage: number;
  assurance_score: number;
  honest_coverage_statement: string;
}

export interface ScopeLimitation {
  id: string;
  title: string;
  title_vi: string;
  description: string;
  description_vi: string;
}

export interface AssuranceMatrix {
  engine_version: string;
  evaluated_at: number;
  scan_status: string;
  target: string;
  user_tier: PackageTier;
  coverage_summary: CoverageSummary;
  stages_summary: StageSummary[];
  controls: EvaluatedSecurityControl[];
  scope_limitations: ScopeLimitation[];
}

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
  if (!/^(https?:)?\/\//.test(path)) {
    // Các route do Backend FastAPI xử lý
    const isBackendRoute =
      path.startsWith("/api/scan") ||
      path.startsWith("/api/copilot") ||
      path.startsWith("/api/stress") ||
      path.startsWith("/api/c2") ||
      path.startsWith("/api/oast") ||
      path.startsWith("/api/apk-audit");

    if (isBackendRoute) {
      const backendUrl = (process.env.NEXT_PUBLIC_API_URL || "https://api.adq.io.vn").replace(/\/$/, "");
      url = `${backendUrl}${path.startsWith("/") ? "" : "/"}${path}`;
    } else {
      if (typeof window === "undefined") {
        const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://adq.io.vn")).replace(/\/$/, "");
        url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
      } else {
        url = path;
      }
    }
  }

  let authHeader: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        authHeader["Authorization"] = `Bearer ${data.session.access_token}`;
      }
    } catch {}
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
// Auth Functions
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
    dailyLimit: metadata.packageTier === "FREE" ? 2 : 999999,
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
// Copilot AI & Scan API
// ------------------------------------------------------------

export async function startScanJob(target: string, extraArgs: string[] = []): Promise<{ ok: boolean; job_id: string }> {
  return requestJson<{ ok: boolean; job_id: string }>("/api/scan", {
    method: "POST",
    body: JSON.stringify({ target, extra_args: extraArgs }),
  });
}

export interface ScanEndpoint {
  id: number;
  scan_id: string;
  url: string;
  source: string;
  method?: string | null;
  status_code?: number | null;
  content_length?: number | null;
  raw?: string | null;
  created_at?: string | null;
}

export async function getScanJobStatus(jobId: string): Promise<any> {
  return requestJson<any>(`/api/scan/${encodeURIComponent(jobId)}`);
}

export async function getScanAssurance(
  jobId: string
): Promise<{ ok: boolean; job_id: string; assurance: AssuranceMatrix }> {
  return requestJson<{ ok: boolean; job_id: string; assurance: AssuranceMatrix }>(
    `/api/scan/${encodeURIComponent(jobId)}/assurance`
  );
}

export async function streamScanJob(
  jobId: string,
  onData: (chunk: any) => void,
  signal?: AbortSignal
): Promise<void> {
  const backendUrl = (process.env.NEXT_PUBLIC_API_URL || "https://api.adq.io.vn").replace(/\/$/, "");
  const url = `${backendUrl}/api/scan/${encodeURIComponent(jobId)}/stream`;

  let authHeader: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        authHeader["Authorization"] = `Bearer ${data.session.access_token}`;
      }
    } catch {}
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      ...authHeader,
    },
    signal,
  });

  if (!response.ok || !response.body) {
    let errorMsg = `Scan stream failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.detail) errorMsg = errJson.detail;
    } catch {}
    throw new Error(errorMsg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(trimmed.slice(6));
          onData(parsed);
        } catch {}
      } else {
        try {
          const parsed = JSON.parse(trimmed);
          onData(parsed);
        } catch {}
      }
    }
  }
}

export async function getScanEndpoints(
  jobId: string
): Promise<{
  ok: boolean;
  job_id: string;
  total: number;
  endpoints: ScanEndpoint[];
}> {
  return requestJson(
    `/api/scan/${encodeURIComponent(jobId)}/endpoints`
  );
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
// Dashboard + Scan Projects
// ------------------------------------------------------------

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const res = await requestJson<{ ok: true; overview: DashboardOverview }>("/api/dashboard/overview");
  return res.overview;
}

export async function getScanResults(): Promise<ScanResult[]> {
  const res = await requestJson<{ ok: true; scans: ScanResult[] }>("/api/scans");
  return res.scans;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  let authHeader: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        authHeader["Authorization"] = `Bearer ${data.session.access_token}`;
      }
    } catch {}
  }
  return authHeader;
}

export async function getProjects(): Promise<any[]> {
  const headers = await getAuthHeader();
  const res = await fetch("/api/projects", { headers });
  if (!res.ok) return [];
  const data = await res.json();
  return data.projects ?? [];
}

export async function getProjectById(projectId: string): Promise<any> {
  const headers = await getAuthHeader();
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  return data.project;
}

export async function createProject(input: {
  name: string;
  domain?: string;
  description?: string;
  password?: string;
  module?: string;
}): Promise<any> {
  const headers = await getAuthHeader();
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Không thể tạo dự án.");
  return data.project;
}

export async function deleteProject(projectId: string): Promise<boolean> {
  const headers = await getAuthHeader();
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
    headers,
  });
  return res.ok;
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
  let authHeader: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        authHeader["Authorization"] = `Bearer ${data.session.access_token}`;
      }
    } catch {}
  }

  const res = await fetch("/api/account/redeem", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
    },
    body: JSON.stringify({ code }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Mã kích hoạt không hợp lệ hoặc đã hết hạn.");
  }
  return data.user;
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
    dailyLimit: values.packageTier === "FREE" ? 2 : 999999,
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

export async function detectWaf(targetUrl: string) {
  return requestJson<any>("/api/stress/detect-waf", {
    method: "POST",
    body: JSON.stringify({ target_url: targetUrl }),
  });
}



export async function discoverEndpoints(targetUrl: string) {
  return requestJson<{ ok: boolean; target: string; total_found: number; endpoints: string[] }>("/api/stress/discover-endpoints", {
    method: "POST",
    body: JSON.stringify({ target_url: targetUrl }),
  });
}

export async function startTargetVerification(targetUrl: string) {
  return requestJson<{ ok: boolean; target: string; verification_token: string; meta_tag: string; expires_in: number; verified: boolean }>("/api/verification/start", {
    method: "POST",
    body: JSON.stringify({ target_url: targetUrl }),
  });
}

export async function checkTargetVerification(targetUrl: string) {
  return requestJson<{ ok: boolean; verified: boolean; target: string; message: string; verified_at?: number }>("/api/verification/check", {
    method: "POST",
    body: JSON.stringify({ target_url: targetUrl }),
  });
}

export async function startStressVerification(targetUrl: string) {
  return startTargetVerification(targetUrl);
}

export async function checkStressVerification(targetUrl: string) {
  return checkTargetVerification(targetUrl);
}

export async function verifyBypass(payload: { target_url: string; bypass_code: string; waf_type: string }) {
  return requestJson<{ ok: boolean; is_valid: boolean; status_no_bypass: number; status_with_bypass: number; message: string }>("/api/stress/verify-bypass", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}



export interface StressJobState {
  job_id: string;
  user_id?: string;
  tier?: string;
  target_url?: string;
  target_requests?: number;
  duration_sec?: number;
  target_rps?: number;
  waf_type?: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  progress?: number;
  metrics?: {
    total_requests?: number;
    target_requests?: number;
    target_rps?: number;
    status_200?: number;
    status_403_waf_blocked?: number;
    status_429_rate_limited?: number;
    status_500_crashed?: number;
    other_status?: number;
    rps?: number;
    p95_latency?: string;
  };
  created_at?: number;
  started_at?: number | null;
  finished_at?: number | null;
  error_safe?: string | null;
  done?: boolean;
}

export async function createStressJob(payload: {
  target_url: string;
  target_requests?: number;
  duration?: string | number;
  bypass_code?: string;
  waf_type?: string;
  custom_headers?: Record<string, string>;
}): Promise<{ ok: boolean; job_id: string; status: string; message?: string }> {
  const formattedPayload = {
    target_url: payload.target_url,
    target_requests: Number(payload.target_requests ?? 1000),
    duration: typeof payload.duration === "number" ? `${payload.duration}s` : String(payload.duration || "5s"),
    bypass_code: String(payload.bypass_code || ""),
    waf_type: String(payload.waf_type || "standard"),
    custom_headers: payload.custom_headers || null,
  };

  return requestJson<{ ok: boolean; job_id: string; status: string; message?: string }>("/api/stress/jobs", {
    method: "POST",
    body: JSON.stringify(formattedPayload),
  });
}

export async function getStressJob(jobId: string): Promise<StressJobState> {
  return requestJson<StressJobState>(`/api/stress/${encodeURIComponent(jobId)}`, {
    method: "GET",
  });
}

export async function streamStressJob(
  jobId: string,
  onData: (chunk: StressJobState) => void,
  signal?: AbortSignal
): Promise<void> {
  const backendUrl = (process.env.NEXT_PUBLIC_API_URL || "https://api.adq.io.vn").replace(/\/$/, "");
  const url = `${backendUrl}/api/stress/${encodeURIComponent(jobId)}/stream`;

  let authHeader: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        authHeader["Authorization"] = `Bearer ${data.session.access_token}`;
      }
    } catch {}
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      ...authHeader,
    },
    signal,
  });

  if (!response.ok || !response.body) {
    let errorMsg = `Stream failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.detail) errorMsg = errJson.detail;
    } catch {}
    throw new Error(errorMsg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(trimmed.slice(6));
          onData(parsed);
        } catch {}
      } else {
        try {
          const parsed = JSON.parse(trimmed);
          onData(parsed);
        } catch {}
      }
    }
  }
}

// ------------------------------------------------------------
// Mobile APK Audit API
// ------------------------------------------------------------

export interface ApkFinding {
  id: string;
  title: string;
  severity: Severity;
  category: string;
  description: string;
  evidence: string;
  remediation: string;
  file: string;
}

export interface ApkPermission {
  name: string;
  isDangerous: boolean;
  description: string;
}

export interface ApkExportedComponents {
  activities?: string[];
  services?: string[];
  receivers?: string[];
  providers?: string[];
}

export interface ApkSigningInfo {
  isSigned?: boolean;
  scheme?: string | null;
  debugCert?: boolean | null;
  certificate?: string | null;
}

export interface ApkManifestInfo {
  debuggable?: boolean | null;
  allowBackup?: boolean | null;
  usesCleartextTraffic?: boolean | null;
}

export interface ApkSdkInfo {
  minSdkVersion?: string | number | null;
  targetSdkVersion?: string | number | null;
  compileSdkVersion?: string | number | null;
}

export interface ApkAuditResultPayload {
  status: "COMPLETED" | "PARTIAL" | "FAILED" | string;
  analysisMode?: string;
  partial?: boolean;
  package?: string | null;
  version?: string | null;
  sdk?: ApkSdkInfo;
  manifest?: ApkManifestInfo;
  permissions?: ApkPermission[];
  exportedComponents?: ApkExportedComponents;
  signing?: ApkSigningInfo;
  endpoints?: string[];
  findings?: ApkFinding[];
  toolsUsed?: string[];
  toolFailures?: Record<string, string>;
  apk_name?: string;
}

export interface ApkJobStatusResponse {
  ok: boolean;
  job_id: string;
  status: "QUEUED" | "VALIDATING" | "DECOMPILING" | "ANALYZING" | "PARTIAL" | "COMPLETED" | "FAILED" | "CANCELLING" | "CANCELLED" | string;
  stage?: string;
  progress?: number;
  created_at?: number;
  started_at?: number | null;
  completed_at?: number | null;
  error?: string | null;
  partial?: boolean;
  message?: string;
}

export interface ApkJobResultResponse {
  ok: boolean;
  job_id: string;
  status: string;
  result: ApkAuditResultPayload;
}

export async function createApkAuditJob(
  file: File,
  projectId?: string,
  signal?: AbortSignal
): Promise<ApkJobStatusResponse> {
  const backendUrl = (process.env.NEXT_PUBLIC_API_URL || "https://api.adq.io.vn").replace(/\/$/, "");
  const url = `${backendUrl}/api/apk-audit/jobs`;

  let authHeader: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        authHeader["Authorization"] = `Bearer ${data.session.access_token}`;
      }
    } catch {}
  }

  const formData = new FormData();
  formData.append("file", file);
  if (projectId) {
    formData.append("project_id", projectId);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeader,
      // Note: do not set Content-Type header manually so fetch sets the boundary automatically
    },
    body: formData,
    credentials: "include",
    signal,
  });

  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login?error=session_expired";
    throw new Error("UNAUTHORIZED: Phiên đăng nhập đã hết hạn.");
  }

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
        ? payload.detail
        : payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : res.statusText) || "Upload APK thất bại";
    throw new Error(message);
  }

  return payload as ApkJobStatusResponse;
}

export async function getApkAuditJobStatus(
  jobId: string,
  signal?: AbortSignal
): Promise<ApkJobStatusResponse> {
  return requestJson<ApkJobStatusResponse>(`/api/apk-audit/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
    signal,
  });
}

export async function getApkAuditJobResult(
  jobId: string,
  signal?: AbortSignal
): Promise<ApkJobResultResponse> {
  return requestJson<ApkJobResultResponse>(`/api/apk-audit/jobs/${encodeURIComponent(jobId)}/result`, {
    method: "GET",
    signal,
  });
}

export async function cancelApkAuditJob(
  jobId: string,
  signal?: AbortSignal
): Promise<{ ok: boolean; job_id: string; status: string; message: string }> {
  return requestJson<{ ok: boolean; job_id: string; status: string; message: string }>(
    `/api/apk-audit/jobs/${encodeURIComponent(jobId)}`,
    {
      method: "DELETE",
      signal,
    }
  );
}

