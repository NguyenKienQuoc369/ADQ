"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Radar,
  Rocket,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContainerTextFlip } from "@/components/ui/container-text-flip";
import { NoiseBackground } from "@/components/ui/noise-background";
import { TextFlippingBoard } from "@/components/ui/text-flipping-board";
import { TextHoverEffect } from "@/components/ui/text-hover-effect";
import {
  LandingMotionEffects,
  SecurityPipeline,
} from "@/components/ui/landing-motion-effects";

const Globe = dynamic(
  () => import("@/components/ui/globe").then((mod) => mod.Globe),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] w-full animate-pulse rounded-3xl border border-cyan-500/20 bg-[#020617]/80" />
    ),
  }
);

const heroWords = [
  "lỗ hổng",
  "rủi ro",
  "điểm yếu",
  "bề mặt tấn công",
];

const journeyLines = [
  "01  Nhập website hoặc domain cần kiểm tra",
  "02  ADQ tự động lập bản đồ bề mặt tấn công",
  "03  Phân tích dịch vụ, endpoint và dấu hiệu lỗ hổng",
  "04  Tổng hợp phát hiện theo mức độ rủi ro",
  "05  AI hỗ trợ giải thích nguyên nhân và hướng xử lý",
  "06  Lưu kết quả theo từng dự án để theo dõi lâu dài",
];

const features = [
  {
    icon: ShieldCheck,
    title: "Quét bảo mật tự động",
    description:
      "Từ một website hoặc domain, ADQ hỗ trợ rà soát bề mặt tấn công, dịch vụ đang mở và các dấu hiệu lỗ hổng trong một quy trình thống nhất.",
  },
  {
    icon: ScanSearch,
    title: "Nhìn thấy những gì đang bị phơi bày",
    description:
      "Tập hợp subdomain, cổng dịch vụ, endpoint và các thành phần có thể làm tăng rủi ro để đội ngũ không phải ghép dữ liệu từ nhiều công cụ khác nhau.",
  },
  {
    icon: Radar,
    title: "AI giải thích rủi ro",
    description:
      "Với các gói hỗ trợ AI, kết quả kỹ thuật được diễn giải theo ngữ cảnh để người dùng hiểu vấn đề, mức độ ưu tiên và hướng khắc phục dễ hơn.",
  },
  {
    icon: TerminalSquare,
    title: "Kiểm thử chuyên sâu khi cần",
    description:
      "Mở rộng quy trình với Stress Test, AI Copilot, One-Click Patch và APK Audit theo quyền lợi của từng gói dịch vụ.",
  },
];

const activityLines = [
  "[21:08:11] Khởi tạo phiên rà soát bảo mật",
  "[21:08:14] Phát hiện thêm tài sản và endpoint liên quan",
  "[21:08:17] Kiểm tra bề mặt dịch vụ đang công khai",
  "[21:08:18] Phát hiện rủi ro mức CRITICAL cần ưu tiên",
  "[21:08:20] AI đang tổng hợp nguyên nhân và hướng xử lý",
  "[21:08:22] Kết quả đã được lưu vào dự án",
];

const steps = [
  {
    number: "01",
    title: "Nhập mục tiêu",
    description:
      "Tạo một dự án, đặt tên, mô tả phạm vi và cung cấp website hoặc domain cần kiểm tra.",
  },
  {
    number: "02",
    title: "ADQ tự động phân tích",
    description:
      "Hệ thống thực hiện các bước rà soát theo pipeline và cập nhật tiến độ trong dashboard.",
  },
  {
    number: "03",
    title: "Ưu tiên vấn đề cần xử lý",
    description:
      "Kết quả được gom theo mức độ rủi ro để bạn tập trung vào những điểm cần xử lý trước.",
  },
  {
    number: "04",
    title: "Theo dõi trong một workspace",
    description:
      "Mỗi dự án lưu lại dữ liệu kiểm thử để bạn có thể quay lại tiếp tục phân tích khi cần.",
  },
];

const audiences = [
  {
    icon: Rocket,
    title: "Startup & đội ngũ sản phẩm",
    description:
      "Cần kiểm tra bảo mật thường xuyên nhưng chưa có một đội security chuyên trách.",
  },
  {
    icon: Building2,
    title: "Doanh nghiệp nhỏ",
    description:
      "Muốn có một quy trình rà soát dễ tiếp cận hơn trước khi đầu tư vào các chương trình kiểm thử chuyên sâu.",
  },
  {
    icon: ShieldCheck,
    title: "Developer & đội kỹ thuật",
    description:
      "Muốn nhìn thấy vấn đề kỹ thuật, bằng chứng và hướng xử lý trong cùng một nơi.",
  },
];

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div
      id="adq-landing"
      className="relative overflow-hidden bg-[#020617] text-slate-100"
    >
      <LandingMotionEffects />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(6,182,212,0.16),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.14),transparent_38%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.1),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(56,189,248,0.11)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.1)_1px,transparent_1px)] [background-size:40px_40px]" />
      <NoiseBackground />

      {/* HERO */}
      <section className="relative mx-auto max-w-7xl px-4 pb-12 pt-16 md:px-8 md:pb-20 md:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-7">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="w-fit border-cyan-500/30 bg-cyan-500/10 text-cyan-200 shadow-[0_0_28px_rgba(6,182,212,0.2)]">
                <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                ADQ SECURITY
              </Badge>

              <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                PILOT
              </Badge>
            </div>

            <h1 className="max-w-4xl text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-slate-100 md:text-6xl">
              Phát hiện
              <br />
              <ContainerTextFlip words={heroWords} className="ml-2" />
              <br />
              trước khi chúng trở thành sự cố.
            </h1>

            <p className="max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
              ADQ giúp startup và doanh nghiệp nhỏ rà soát bảo mật website,
              nhìn thấy các điểm yếu quan trọng và nhận hướng xử lý trong một
              dashboard duy nhất — không cần bắt đầu bằng một hệ thống security
              phức tạp.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href={user ? "/dashboard" : "/register"} suppressHydrationWarning>
                <Button
                  size="lg"
                  className="border border-cyan-300/70 bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 text-slate-950 shadow-[0_18px_36px_rgba(34,211,238,0.32)] hover:shadow-[0_22px_40px_rgba(34,211,238,0.44)]"
                >
                  {user ? "Mở Dashboard" : "Bắt đầu miễn phí"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>

              <Link href="#how-it-works">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-cyan-500/35 bg-[#0b0f19]/70 text-cyan-100 hover:bg-cyan-500/10"
                >
                  Xem cách hoạt động
                </Button>
              </Link>
            </div>

            <div className="grid max-w-2xl grid-cols-2 gap-3 text-xs text-slate-300 md:grid-cols-4">
              {[
                ["2 lượt", "Quét miễn phí"],
                ["7 bước", "Pipeline bảo mật"],
                ["AI", "Phân tích rủi ro"],
                ["1 nơi", "Quản lý dự án"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-xl border border-cyan-500/20 bg-[#0b0f19]/70 p-3 text-center backdrop-blur"
                >
                  <p className="text-lg font-semibold text-cyan-200">{value}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                    {label}
                  </p>
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
              <p className="ml-3 text-xs uppercase tracking-[0.2em] text-cyan-200/80">
                Phiên kiểm thử đang hoạt động
              </p>
            </div>

            <div className="space-y-2 rounded-2xl border border-cyan-500/20 bg-[#020617]/90 p-4 font-mono text-xs text-slate-200">
              {activityLines.map((line, idx) => (
                <div key={line} className="flex items-start gap-2">
                  <span className="text-cyan-400">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="text-slate-300">{line}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-14">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 backdrop-blur-xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-amber-300">
                Bài toán ADQ muốn giải quyết
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">
                Không phải doanh nghiệp nào cũng có một đội security riêng.
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Công cụ bảo mật chuyên sâu thường khó tiếp cận với đội ngũ nhỏ.",
                "Kết quả kỹ thuật có thể khó hiểu nếu không có chuyên gia bảo mật.",
                "Dữ liệu bị phân tán giữa nhiều công cụ và nhiều phiên kiểm thử.",
                "Chi phí kiểm thử chuyên nghiệp có thể là rào cản với startup và SME.",
              ].map((item) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                  <p className="text-sm leading-6 text-slate-300">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-14"
      >
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-3xl border border-cyan-500/20 bg-[#0b0f19]/80 p-7 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
              Cách ADQ hoạt động
            </p>

            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-slate-100 md:text-4xl">
              Từ một domain đến một bức tranh rủi ro dễ theo dõi.
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              ADQ gom các bước rà soát vào cùng một luồng thay vì yêu cầu người
              dùng tự chạy và ghép kết quả từ nhiều công cụ riêng biệt.
            </p>
          </div>

          <TextFlippingBoard lines={journeyLines} className="min-h-[270px]" />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step) => (
            <motion.div
              key={step.number}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-slate-800 bg-slate-950/65 p-5"
            >
              <span className="font-mono text-sm font-bold text-cyan-400">
                {step.number}
              </span>
              <h3 className="mt-3 font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-xs leading-6 text-slate-400">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>


      {/* 7-STAGE SECURITY PIPELINE */}
      <section
        id="security-pipeline"
        className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-14"
      >
        <div className="mb-7 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
            Automated Security Pipeline
          </p>

          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">
            Một mục tiêu. Bảy lớp phân tích bảo mật.
          </h2>

          <p className="mt-4 text-sm leading-7 text-slate-400">
            ADQ tổ chức quá trình rà soát thành một pipeline xuyên suốt,
            từ khám phá tài sản và bề mặt mạng đến phân tích lỗ hổng,
            nguy cơ lộ dữ liệu và đánh giá rủi ro bằng AI.
          </p>
        </div>

        <SecurityPipeline />
      </section>

      {/* ATTACK SURFACE VISUAL */}
      <section
        id="platform"
        className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-14"
      >
        <div className="grid items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-cyan-500/20 bg-[#0b0f19]/80 p-7 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
              Nhìn rộng hơn một lỗ hổng đơn lẻ
            </p>

            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-slate-100 md:text-4xl">
              Hiểu bề mặt tấn công trước khi ưu tiên xử lý.
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              Một rủi ro không chỉ nằm ở một URL. ADQ giúp tập hợp thông tin về
              tài sản, dịch vụ, endpoint và các phát hiện liên quan để người dùng
              có thêm ngữ cảnh khi đánh giá mức độ ảnh hưởng.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "Asset & subdomain discovery",
                "Network exposure",
                "Web surface mapping",
                "Vulnerability analysis",
                "Sensitive data exposure",
                "AI-assisted risk assessment",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-xs text-slate-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <Globe />
        </div>
      </section>

      {/* FEATURES */}
      <section
        id="features"
        className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-14"
      >
        <div className="mb-7 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
            Một nền tảng, nhiều lớp kiểm thử
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-100 md:text-4xl">
            Tập trung vào vấn đề cần xử lý, không phải cách vận hành công cụ.
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-400">
            Các chức năng được tổ chức quanh quy trình của người dùng:
            phát hiện → đánh giá → hiểu rủi ro → khắc phục → theo dõi.
          </p>
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

                <h3 className="text-lg font-semibold text-slate-100">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {item.description}
                </p>
              </motion.article>
            );
          })}
        </div>
      </section>

      {/* AUDIENCE */}
      <section className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-14">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 md:p-9">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
              ADQ dành cho ai?
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
              Bảo mật dễ tiếp cận hơn cho những đội ngũ đang phát triển nhanh.
            </h2>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {audiences.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-800 bg-slate-950/65 p-5"
                >
                  <Icon className="h-5 w-5 text-cyan-400" />
                  <h3 className="mt-4 font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ABOUT TEAM */}
      <section
        id="about"
        className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-14"
      >
        <div className="overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#0b0f19]/80 p-7 backdrop-blur-xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                Về chúng tôi
              </p>

              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">
                Một đội ngũ sinh viên xây dựng ADQ từ một bài toán thực tế.
              </h2>

              <p className="mt-4 text-sm leading-7 text-slate-300">
                ADQ được phát triển bởi ba sinh viên năm 2 Trường Đại học Kinh tế – Luật,
                Đại học Quốc gia Thành phố Hồ Chí Minh. Chúng tôi cùng xây dựng sản phẩm
                với mục tiêu giúp startup và doanh nghiệp nhỏ tiếp cận kiểm thử bảo mật
                dễ dàng hơn, với quy trình đơn giản và chi phí phù hợp hơn.
              </p>

              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                ADQ hiện đang được phát triển trong giai đoạn Pilot
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  initials: "KQ",
                  name: "Nguyễn Kiến Quốc",
                  role: "Backend & System Architecture",
                  description:
                    "Phát triển Backend, kiến trúc hệ thống, cơ sở dữ liệu phía máy chủ và lõi công nghệ của ADQ.",
                },
                {
                  initials: "Đ",
                  name: "Nguyễn Minh Đức",
                  role: "Frontend & Product Experience",
                  description:
                    "Phát triển Frontend, dashboard, trực quan hóa dữ liệu và trải nghiệm sử dụng sản phẩm.",
                },
                {
                  initials: "Â",
                  name: "Ngô Thiên Ân",
                  role: "Content & Communication",
                  description:
                    "Phụ trách nội dung, truyền thông, tài liệu và trình bày sản phẩm.",
                },
              ].map((member) => (
                <motion.article
                  key={member.name}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-sm font-bold text-cyan-300">
                    {member.initials}
                  </div>

                  <h3 className="mt-4 text-sm font-bold text-white">
                    {member.name}
                  </h3>

                  <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.12em] text-cyan-400">
                    {member.role}
                  </p>

                  <p className="mt-3 text-xs leading-6 text-slate-400">
                    {member.description}
                  </p>
                </motion.article>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-800 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Sinh viên năm 2 • Trường Đại học Kinh tế – Luật • ĐHQG TP.HCM
            </p>
            <p className="font-mono text-cyan-400/70">
              3 MEMBERS · 1 PRODUCT
            </p>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section
        id="pricing"
        className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-14"
      >
        <div className="mb-7 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
            Bắt đầu nhỏ, mở rộng khi cần
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
            Chọn mức công cụ phù hợp với nhu cầu kiểm thử.
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
            <Badge variant="muted">FREE</Badge>
            <h3 className="mt-4 text-xl font-bold text-white">Khám phá ADQ</h3>
            <p className="mt-2 text-sm text-slate-400">
              Dành cho người dùng muốn thử quy trình quét cơ bản.
            </p>

            <div className="mt-5 text-3xl font-bold text-white">0đ</div>

            <div className="mt-5 space-y-2 text-sm text-slate-300">
              <p>✓ 2 lượt DAST Scan trọn đời</p>
              <p>✓ Xuất báo cáo Markdown</p>
              <p className="text-slate-500">— AI Analysis</p>
              <p className="text-slate-500">— Stress Test</p>
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-500/30 bg-cyan-950/10 p-6 shadow-[0_0_40px_rgba(6,182,212,0.08)]">
            <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              PRO
            </Badge>
            <h3 className="mt-4 text-xl font-bold text-white">
              Kiểm thử thường xuyên
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Dành cho đội ngũ cần rà soát bảo mật liên tục hơn.
            </p>

            <div className="mt-5 text-3xl font-bold text-white">
              199.000đ
              <span className="text-sm font-normal text-slate-500"> / tháng</span>
            </div>

            <div className="mt-5 space-y-2 text-sm text-slate-300">
              <p>✓ DAST Scan không giới hạn</p>
              <p>✓ AI Scan Analysis</p>
              <p>✓ 1 Stress Test / ngày</p>
              <p>✓ Markdown, JSON và HTML</p>
            </div>
          </div>

          <div className="relative rounded-3xl border border-purple-500/30 bg-purple-950/10 p-6 shadow-[0_0_40px_rgba(168,85,247,0.08)]">
            <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-300">
              PRO MAX
            </Badge>

            <h3 className="mt-4 text-xl font-bold text-white">
              Bộ công cụ đầy đủ
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Dành cho nhu cầu kiểm thử và phân tích chuyên sâu.
            </p>

            <div className="mt-5 text-3xl font-bold text-white">
              499.000đ
              <span className="text-sm font-normal text-slate-500"> / tháng</span>
            </div>

            <div className="mt-5 space-y-2 text-sm text-slate-300">
              <p>✓ Toàn bộ quyền lợi PRO</p>
              <p>✓ 10 Stress Test / ngày</p>
              <p>✓ AI Copilot & Analyze</p>
              <p>✓ One-Click Patch & APK Audit</p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] leading-5 text-slate-500">
          ADQ hiện đang trong giai đoạn Pilot. Tính năng, hạn mức và hạ tầng có
          thể tiếp tục được điều chỉnh trong quá trình hoàn thiện sản phẩm.
        </p>
      </section>

      {/* FINAL CTA */}
      <section className="relative mx-auto max-w-7xl px-4 pb-14 pt-4 md:px-8 md:pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#0b0f19]/80 p-8 text-center backdrop-blur-xl md:p-12">
          <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-72 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />

          <Sparkles className="mx-auto h-7 w-7 text-cyan-300" />

          <h2 className="mt-4 text-3xl font-semibold text-slate-100 md:text-4xl">
            Bắt đầu từ website của bạn.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            Tạo một dự án, nhập target và để ADQ giúp bạn nhìn thấy những rủi ro
            cần quan tâm trước khi chúng trở thành vấn đề lớn hơn.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={user ? "/dashboard" : "/register"} suppressHydrationWarning>
              <Button className="border border-cyan-300/70 bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 text-slate-950">
                {user ? "Đi tới Dashboard" : "Tạo tài khoản miễn phí"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>

            {!user && (
              <Link href="/login">
                <Button
                  variant="outline"
                  className="border-cyan-500/35 bg-[#020617]/70 text-cyan-100 hover:bg-cyan-500/10"
                >
                  Đăng nhập
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative border-t border-cyan-500/20 bg-[#020617]">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
          <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
            <div className="max-w-md">
              <p className="text-lg font-semibold text-white">ADQ SECURITY</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Nền tảng hỗ trợ rà soát, phân tích và quản lý rủi ro bảo mật dành
                cho startup, doanh nghiệp nhỏ và đội ngũ kỹ thuật.
              </p>

              <Badge className="mt-4 border-amber-500/30 bg-amber-500/10 text-amber-300">
                PILOT PRODUCT
              </Badge>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                Sản phẩm
              </p>
              <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500">
                <Link href="#features" className="transition hover:text-cyan-300">
                  Tính năng
                </Link>
                <Link href="#how-it-works" className="transition hover:text-cyan-300">
                  Cách hoạt động
                </Link>
                <Link href="#pricing" className="transition hover:text-cyan-300">
                  Bảng giá
                </Link>
                <Link href="#about" className="transition hover:text-cyan-300">
                  Về chúng tôi
                </Link>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                Tài khoản
              </p>
              <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500">
                <Link href="/login" className="transition hover:text-cyan-300">
                  Đăng nhập
                </Link>
                <Link href="/register" className="transition hover:text-cyan-300">
                  Tạo tài khoản
                </Link>
                <Link href="/dashboard" className="transition hover:text-cyan-300">
                  Dashboard
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-9 flex flex-col gap-4 border-t border-slate-800 pt-6 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
            <TextHoverEffect
              text="© 2026 ADQ SECURITY"
              className="text-sm tracking-[0.24em]"
            />
            <p>Security made more accessible for growing teams.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
