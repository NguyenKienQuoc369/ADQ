"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Radar, ScanSearch, Sparkles, TerminalSquare, ShieldCheck } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContainerTextFlip } from "@/components/ui/container-text-flip";
import { NoiseBackground } from "@/components/ui/noise-background";
import { TextFlippingBoard } from "@/components/ui/text-flipping-board";
import { TextHoverEffect } from "@/components/ui/text-hover-effect";

const Globe = dynamic(() => import("@/components/ui/globe").then((mod) => mod.Globe), {
  ssr: false,
  loading: () => <div className="h-[360px] w-full animate-pulse rounded-3xl border border-cyan-500/20 bg-[#020617]/80" />,
});

const heroWords = ["bề mặt", "lỗ hổng", "hạ tầng", "luồng dữ liệu"];

const matrixLines = [
  "POST /api/scan → tạo job quét mới và đưa vào hàng đợi",
  "GET /api/scans → đồng bộ danh sách job, trạng thái và metadata",
  "POST /api/copilot/analyze → AI phân tích kết quả scan theo ngữ cảnh",
  "POST /api/copilot/patch → sinh one-click fix theo loại lỗ hổng",
  "POST /api/stress → kích hoạt stress test bằng stress orchestrator",
  "POST /api/apk → chạy pipeline mobile audit và quét secret Android",
];

const features = [
  {
    icon: ShieldCheck,
    title: "Điều phối quét DAST theo job",
    description: "Backend có luồng `POST /api/scan`, `GET /api/scans`, `GET /api/scan/{job_id}` để tạo, theo dõi và truy vết từng phiên quét.",
  },
  {
    icon: ScanSearch,
    title: "Recon & phân tích giao thức",
    description: "Engine có các module thật như `recon_scan/scanner.py`, `waf_detector.py`, `protocol_analyzer.py`, `param_fuzzer.py` để mở rộng bề mặt kiểm tra.",
  },
  {
    icon: Radar,
    title: "Copilot phân tích và vá lỗi",
    description: "Các endpoint `POST /api/copilot/chat|analyze|patch` kết nối AI copilot để diễn giải rủi ro và đề xuất mã vá theo framework.",
  },
  {
    icon: TerminalSquare,
    title: "Stress test + Mobile APK audit",
    description: "`POST /api/stress` gọi stress orchestrator, còn `POST /api/apk` chạy `mobile_audit/apk_analyzer.py` để kiểm tra secret và cấu hình nguy hiểm.",
  },
];

const terminalLines = [
  "[21:08:11] POST /api/scan  target=adq.io.vn  status=queued",
  "[21:08:14] engine.recon_scan.scanner  discovered=18 endpoints",
  "[21:08:17] GET /api/scan/{job_id}  status=running",
  "[21:08:18] finding: SQL Injection  severity=CRITICAL",
  "[21:08:20] POST /api/copilot/patch  framework=Next.js",
  "[21:08:22] POST /api/projects/{project_id}/details  saved",
];

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="relative overflow-hidden bg-[#020617] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(6,182,212,0.16),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.14),transparent_38%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.1),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(56,189,248,0.11)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.1)_1px,transparent_1px)] [background-size:40px_40px]" />
      <NoiseBackground />

      <section className="relative mx-auto max-w-7xl px-4 pb-10 pt-16 md:px-8 md:pb-16 md:pt-20">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-7">
            <Badge className="w-fit border-cyan-500/30 bg-cyan-500/10 text-cyan-200 shadow-[0_0_28px_rgba(6,182,212,0.2)]">
              <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              ADQ DAST Scanner • Copilot AI đang hoạt động
            </Badge>

            <h1 className="max-w-4xl text-4xl font-semibold leading-[0.95] tracking-[-0.03em] text-slate-100 md:text-6xl">
              Kiểm soát
              <br />
              <ContainerTextFlip words={heroWords} className="ml-2" />
              <br />
              trước khi bị khai thác
            </h1>

            <p className="max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
              ADQ SECURITY hợp nhất DAST, asset intelligence và AI để đơn giản hóa quá trình kiểm thử bảo mật web
              
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href={user ? "/dashboard" : "/login"}>
                <Button
                  size="lg"
                  className="border border-cyan-300/70 bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 text-slate-950 shadow-[0_18px_36px_rgba(34,211,238,0.32)] hover:shadow-[0_22px_40px_rgba(34,211,238,0.44)]"
                >
                  Bắt đầu quét miễn phí
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#recon-globe">
                <Button size="lg" variant="outline" className="border-cyan-500/35 bg-[#0b0f19]/70 text-cyan-100 hover:bg-cyan-500/10">
                  Khám phá
                </Button>
              </Link>
            </div>

            <div className="grid max-w-xl grid-cols-2 gap-3 text-xs text-slate-300 md:grid-cols-4">
              {[
                ["/api/scan", "Tạo job quét"],
                ["/api/copilot/*", "Phân tích và vá"],
                ["/api/stress", "Kiểm thử tải"],
                ["/api/apk", "Audit APK"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-xl border border-cyan-500/20 bg-[#0b0f19]/70 p-3 text-center backdrop-blur">
                  <p className="text-lg font-semibold text-cyan-200">{value}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative overflow-hidden rounded-3xl border border-cyan-500/25 bg-[#030816]/85 p-5 shadow-[0_30px_80px_rgba(2,6,23,0.6)] backdrop-blur-xl"
          >
            <div className="pointer-events-none absolute -top-12 left-1/2 h-36 w-36 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="mb-4 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <p className="ml-3 text-xs uppercase tracking-[0.2em] text-cyan-200/80">Nhật ký quét</p>
            </div>
            <div className="space-y-2 rounded-2xl border border-cyan-500/20 bg-[#020617]/90 p-4 font-mono text-xs text-slate-200">
              {terminalLines.map((line, idx) => (
                <div key={line} className="flex items-start gap-2">
                  <span className="text-cyan-400">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="text-slate-300">{line}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section id="matrix" className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-3xl border border-cyan-500/20 bg-[#0b0f19]/80 p-7 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Luồng điều phối backend</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-slate-100 md:text-4xl">Cập nhật trạng thái quét theo real time
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Dữ liệu hiển thị bám sát thực tế trong: tạo job quét, lấy trạng thái, phân tích AI,
              sinh bản vá, stress test và mobile audit.
            </p>
          </div>
          <TextFlippingBoard lines={matrixLines} className="min-h-[270px]" />
        </div>
      </section>

      <section id="recon-globe" className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-cyan-500/20 bg-[#0b0f19]/80 p-7 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">Recon Engine</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-slate-100 md:text-4xl">Theo dõi trạng thái bảo mật theo module quét</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Hệ thống có sẵn các module `waf_detector`, `protocol_fuzzer`, `raw_socket_prober`, `logic_chain` để mở
              rộng vùng phát hiện và tăng chiều sâu kiểm thử.
            </p>
          </div>
          <Globe />
        </div>
      </section>

      <section id="features" className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-14">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Năng lực thực tế của hệ thống</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-100 md:text-4xl">Một dashboard cho toàn bộ vòng đời bảo mật</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <motion.article
                key={item.title}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="group rounded-3xl border border-cyan-500/20 bg-[#0b0f19]/70 p-6 backdrop-blur-xl"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 transition group-hover:shadow-[0_0_24px_rgba(6,182,212,0.3)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-100">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section id="pricing" className="relative mx-auto max-w-7xl px-4 pb-10 pt-2 md:px-8 md:pb-14">
        <div className="rounded-3xl border border-cyan-500/20 bg-[#0b0f19]/80 p-8 text-center backdrop-blur-xl">
          <Sparkles className="mx-auto h-7 w-7 text-cyan-300" />
          <h2 className="mt-4 text-3xl font-semibold text-slate-100 md:text-4xl">Sẵn sàng quét bảo mật?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            Bắt đầu với luồng `scan → analyze → patch`, sau đó mở rộng sang stress test và quản trị tài khoản.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href={user ? "/dashboard" : "/register"}>
              <Button className="border border-cyan-300/70 bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 text-slate-950">
                Đăng kí
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="border-cyan-500/35 bg-[#020617]/70 text-cyan-100 hover:bg-cyan-500/10">
                Đăng nhập
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-cyan-500/20 bg-[#020617]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-slate-400 md:flex-row md:px-8">
          <TextHoverEffect text="© 2026 ADQ SECURITY. All rights reserved." className="text-sm tracking-[0.3em]" />
          <div className="flex items-center gap-4">
            <Link href="/login" className="transition hover:text-cyan-200">Console</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
