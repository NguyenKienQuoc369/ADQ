import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit,
  Bug,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DatabaseZap,
  Globe2,
  Lock,
  Network,
  Pause,
  Play,
  Radar,
  RotateCcw,
  ScanSearch,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

const PIPELINE_STAGES = [
  {
    step: "01",
    id: "recon",
    title: "Asset Discovery",
    vnTitle: "Khám phá tài sản số & Subdomain",
    icon: Globe2,
    desc: "Tự động lập bản đồ toàn bộ không gian số: rà soát DNS đa nguồn, thu thập chứng chỉ số Certificate Transparency, dò tìm hàng trăm subdomain ẩn và phát hiện dải IP phơi bày ra Internet.",
    tags: ["Passive DNS", "Certificate Transparency", "Subdomain Enum", "Reverse WHOIS"],
    telemetry: [
      { name: "target-domain.vn", status: "ROOT IP: 103.14.22.8", flag: "ROOT" },
      { name: "api.target-domain.vn", status: "AWS CloudFront Edge", flag: "ACTIVE" },
      { name: "auth.target-domain.vn", status: "Keycloak OAuth2 Server", flag: "ACTIVE" },
      { name: "dev-staging.target-domain.vn", status: "Exposed Staging Environment", flag: "ALERT" },
    ],
  },
  {
    step: "02",
    id: "network",
    title: "Network Exposure",
    vnTitle: "Kiểm toán cổng mạng & dịch vụ",
    icon: Network,
    desc: "Thẩm định trạng thái toàn bộ 65.535 cổng dịch vụ (TCP/UDP). Nhận diện các cổng dịch vụ quản trị mở trái phép (SSH, RDP, DB, Admin UI) và phát hiện cấu hình tường lửa sai lệch.",
    tags: ["SYN Stealth Scan", "Banner Grabbing", "Service Fingerprint", "Firewall Check"],
    telemetry: [
      { name: "Port 80 (HTTP)", status: "OPEN - Permanent Redirect to HTTPS", flag: "OK" },
      { name: "Port 443 (HTTPS)", status: "OPEN - TLS 1.3 / Grade A+ Verified", flag: "SECURE" },
      { name: "Port 22 (SSH)", status: "FILTERED - Key-based auth only", flag: "SECURE" },
      { name: "Port 8080 (Admin UI)", status: "OPEN - Unauthenticated Dashboard", flag: "ALERT" },
    ],
  },
  {
    step: "03",
    id: "web",
    title: "Web Surface Mapping",
    vnTitle: "Lập bản đồ ứng dụng Web & API",
    icon: Radar,
    desc: "Thu thập toàn bộ cấu trúc định tuyến, REST API, GraphQL schema và các tham số truy vấn ẩn có nguy cơ bị khai thác thông qua động cơ web spidering thông minh.",
    tags: ["Deep Web Spider", "REST API Discovery", "GraphQL Introspection", "Hidden Forms"],
    telemetry: [
      { name: "GET /api/v1/auth/session", status: "HTTP 200 OK • Latency 42ms", flag: "OK" },
      { name: "POST /api/v1/users/login", status: "Rate Limited (5 req/min)", flag: "SECURE" },
      { name: "POST /graphql", status: "Introspection Query Enabled in Prod", flag: "ALERT" },
      { name: "PUT /api/v1/profile/upload", status: "Unrestricted File Upload Risk", flag: "ALERT" },
    ],
  },
  {
    step: "04",
    id: "vuln",
    title: "Vulnerability Analysis",
    vnTitle: "Phân tích lỗ hổng DAST & OWASP",
    icon: Bug,
    desc: "Áp dụng bộ kiểm thử OWASP Top 10 và CVE mới nhất: SQL Injection, XSS, SSRF, RCE, IDOR và Broken Access Control kèm sinh bằng chứng Proof-of-Concept an toàn.",
    tags: ["OWASP Top 10", "CVE Database Sync", "Blind SQLi Test", "Safe PoC Generator"],
    telemetry: [
      { name: "SQL Injection (Blind Time-Based)", status: "CVSS 9.8 • DB delay 5,021ms", flag: "CRITICAL" },
      { name: "Cross-Site Scripting (Stored XSS)", status: "CVSS 7.2 • Injected in comment thread", flag: "HIGH" },
      { name: "Server-Side Request Forgery (SSRF)", status: "CVSS 8.6 • Cloud metadata exposed", flag: "HIGH" },
      { name: "Security Headers Missing", status: "CVSS 3.1 • CSP & HSTS not configured", flag: "LOW" },
    ],
  },
  {
    step: "05",
    id: "leaks",
    title: "Sensitive Data Exposure",
    vnTitle: "Rà soát rò rỉ dữ liệu & Secrets",
    icon: DatabaseZap,
    desc: "Rà soát thư mục công khai, phát hiện file cấu hình .env, repository git phơi bày, secret tokens, private keys và thông tin nhận dạng cá nhân (PII) vô tình công khai.",
    tags: [".env Exposure", "JWT Secret Scan", "AWS Key Hunter", "Git Leak Audit"],
    telemetry: [
      { name: "Public /.env File Detected", status: "DB_PASSWORD & AWS_SECRET_KEY", flag: "CRITICAL" },
      { name: "Git Repository Exposed", status: "Status: 403 Forbidden (Protected)", flag: "SECURE" },
      { name: "Hardcoded API Keys in JS", status: "Found Stripe Test Key (Publishable)", flag: "MEDIUM" },
      { name: "PII in Query Strings", status: "Email parameters in GET request URLs", flag: "MEDIUM" },
    ],
  },
  {
    step: "06",
    id: "auth",
    title: "Application Security",
    vnTitle: "Kiểm tra logic & phân quyền",
    icon: ScanSearch,
    desc: "Kiểm tra cơ chế xác thực JWT, session fixation, phân quyền đa người dùng (RBAC), kiểm tra phân quyền ngang/dọc (IDOR) và chính sách chia sẻ tài nguyên (CORS).",
    tags: ["JWT Forgery Test", "CORS Misconfig", "IDOR Access Test", "Session Fixation"],
    telemetry: [
      { name: "Broken Object Level Auth (IDOR)", status: "User A can access User B orders", flag: "HIGH" },
      { name: "JWT Signature Verification", status: "Algorithm 'none' rejected cleanly", flag: "SECURE" },
      { name: "CORS Misconfiguration", status: "Access-Control-Allow-Origin: * on API", flag: "MEDIUM" },
      { name: "CSRF Protection", status: "Strict SameSite cookies enforced", flag: "SECURE" },
    ],
  },
  {
    step: "07",
    id: "ai",
    title: "AI Risk Assessment",
    vnTitle: "Đánh giá rủi ro & Vá lỗi bằng AI",
    icon: BrainCircuit,
    desc: "Mô hình AI bảo mật của ADQ tổng hợp toàn bộ kết quả, loại bỏ báo động giả (false positives), phân loại mức độ rủi ro kinh doanh và tự động sinh mã nguồn sửa lỗi (One-Click Patch).",
    tags: ["False-Positive Filter", "Business Impact Score", "1-Click Code Patch", "Executive Report"],
    telemetry: [
      { name: "False-Positive Elimination", status: "99.8% verified by cognitive engine", flag: "OK" },
      { name: "Business Impact Rating", status: "Payment gateway exposed to breach", flag: "HIGH" },
      { name: "Remediation Code Diff", status: "Parameterized Query patch generated", flag: "READY" },
      { name: "Executive Report", status: "Ready in Markdown, JSON and PDF", flag: "READY" },
    ],
  },
];

export function EnhancedSecurityPipeline() {
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Auto Simulation Interval
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setActiveStageIndex((prev) => (prev + 1) % PIPELINE_STAGES.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [isPlaying]);

  const currentStage = PIPELINE_STAGES[activeStageIndex];
  const StageIcon = currentStage.icon;

  return (
    <div className="w-full space-y-6">
      {/* Simulation Control Status Bar */}
      <div className="flex items-center justify-between rounded-2xl border border-cyan-500/30 bg-slate-950/80 px-4 py-3 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.2)]">
        <div className="flex items-center gap-2.5 font-mono text-xs text-cyan-300 font-bold">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span>WORKFLOW SIMULATION // GIAI ĐOẠN {activeStageIndex + 1} / 7</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="cursor-pointer flex items-center gap-1.5 px-3 py-1 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 text-xs font-mono font-bold hover:bg-cyan-500/20 transition-all"
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                <span>Tạm Dừng</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                <span>Tự Động Chạy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveStageIndex(0);
              setIsPlaying(true);
            }}
            className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-white/10 bg-slate-900/80 text-slate-300 text-xs font-mono hover:text-white transition-all"
            title="Chạy lại từ đầu"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Dynamic Laser Progress Bar */}
      <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden border border-white/10">
        <motion.div
          className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 shadow-[0_0_12px_rgba(6,182,212,0.8)]"
          animate={{ width: `${((activeStageIndex + 1) / 7) * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* 1. MASTER 3D PIPELINE ARTWORK SHOWCASE */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="group relative overflow-hidden rounded-3xl border border-white/[0.12] bg-slate-950/20 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-500"
        style={{
          boxShadow: "inset 0 1px 1px 0 rgba(255, 255, 255, 0.18)",
        }}
      >
        <div className="relative aspect-[21/9] w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
          <Image
            src="/images/pipeline-7-stages-v3.jpg"
            alt="ADQ 7-Stage Cybersecurity Automated Pipeline"
            fill
            priority
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 1280px) 100vw, 1200px"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020617]/70 via-transparent to-transparent" />

          {/* Animated Laser Scanning Line */}
          <motion.div
            key={activeStageIndex}
            initial={{ top: "0%" }}
            animate={{ top: "100%" }}
            transition={{ duration: 2.8, ease: "linear", repeat: Infinity }}
            className="pointer-events-none absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(6,182,212,1)]"
          />
        </div>
      </motion.div>

      {/* 2. RESPONSIVE GRID STEP SELECTOR - ALL 7 STEPS 100% VISIBLE */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {PIPELINE_STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isActive = activeStageIndex === idx;

          return (
            <button
              key={stage.step}
              type="button"
              onClick={() => setActiveStageIndex(idx)}
              className={`cursor-pointer group flex flex-col justify-between rounded-2xl border p-3 text-left transition-all duration-300 backdrop-blur-md ${
                isActive
                  ? "border-cyan-400 bg-cyan-500/20 text-white shadow-[0_0_20px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400"
                  : "border-white/[0.08] bg-slate-950/20 text-slate-300 hover:border-white/20 hover:text-white"
              }`}
              style={{
                boxShadow: isActive
                  ? "inset 0 1px 1px 0 rgba(255, 255, 255, 0.2)"
                  : "none",
              }}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                    isActive ? "bg-cyan-400 text-slate-950" : "bg-white/10 text-slate-400"
                  }`}
                >
                  {stage.step}
                </span>
                <Icon
                  className={`h-4 w-4 transition-transform group-hover:scale-110 ${
                    isActive ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"
                  }`}
                />
              </div>

              <div className="mt-2.5">
                <p className="font-semibold text-xs text-white leading-tight truncate">
                  {stage.title}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                  Phase {stage.step}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. ACTIVE STAGE DEEP-DIVE CARD */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStage.step}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="rounded-3xl border border-white/[0.12] bg-slate-950/20 p-6 md:p-8 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.4)]"
          style={{
            boxShadow: "inset 0 1px 1px 0 rgba(255, 255, 255, 0.18)",
          }}
        >
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-center">
            {/* Left Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  <StageIcon className="h-4.5 w-4.5" />
                </div>
                <span className="font-mono text-xs text-cyan-400 font-bold uppercase tracking-wider">
                  PHASE {currentStage.step} // {currentStage.title}
                </span>
              </div>

              <h3 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                {currentStage.vnTitle}
              </h3>

              <p className="text-base leading-relaxed text-slate-200 font-medium">
                {currentStage.desc}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 pt-2">
                {currentStage.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 font-mono text-xs text-cyan-300 font-semibold"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            {/* Right Telemetry Table */}
            <div className="rounded-2xl border border-cyan-500/30 bg-[#020617]/90 p-5 font-mono text-xs">
              <div className="mb-3.5 flex items-center justify-between border-b border-white/10 pb-2.5 text-xs">
                <span className="text-slate-300 font-bold uppercase tracking-wider">THÔNG SỐ ĐO ĐẠC MỤC TIÊU</span>
                <span className="text-cyan-400 font-bold">PHASE AUDIT LOG</span>
              </div>

              <div className="space-y-2.5">
                {currentStage.telemetry.map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 transition hover:border-cyan-500/40"
                  >
                    <div className="space-y-0.5 pr-2">
                      <p className="font-bold text-white text-xs truncate">{row.name}</p>
                      <p className="text-xs text-slate-300">{row.status}</p>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-bold shrink-0 border ${
                        row.flag === "CRITICAL" || row.flag === "ALERT"
                          ? "border-rose-500/40 bg-rose-500/20 text-rose-300"
                          : row.flag === "HIGH"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                          : row.flag === "SECURE" || row.flag === "OK" || row.flag === "READY"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                      }`}
                    >
                      {row.flag}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step Navigation Bar */}
            <div className="mt-4 pt-4 border-t border-white/[0.08] flex items-center justify-between col-span-full">
              <button
                type="button"
                onClick={() =>
                  setActiveStageIndex((prev) =>
                    prev > 0 ? prev - 1 : PIPELINE_STAGES.length - 1
                  )
                }
                className="cursor-pointer flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-1.5 text-xs text-slate-400 hover:border-cyan-500/30 hover:text-white transition"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Bước trước</span>
              </button>

              <span className="font-mono text-xs text-cyan-400 font-bold">
                GIAI ĐOẠN {currentStage.step} / 07
              </span>

              <button
                type="button"
                onClick={() =>
                  setActiveStageIndex((prev) =>
                    prev < PIPELINE_STAGES.length - 1 ? prev + 1 : 0
                  )
                }
                className="cursor-pointer flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 transition shadow-[0_0_20px_rgba(6,182,212,0.2)]"
              >
                <span>
                  {activeStageIndex === 6
                    ? "Quay lại Bước 01"
                    : `Tiếp theo: Bước ${PIPELINE_STAGES[(activeStageIndex + 1) % 7].step}`}
                </span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

