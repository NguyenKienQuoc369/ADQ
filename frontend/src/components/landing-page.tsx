"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  LayoutDashboard,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const glossary = [
  {
    term: "Lượt quét",
    meaning: "Một lần hệ thống kiểm tra website của bạn để tìm điểm cần chú ý.",
  },
  {
    term: "Cảnh báo",
    meaning: "Một dấu hiệu cho thấy website có thể có vấn đề, cần bạn xem lại.",
  },
  {
    term: "Tài sản",
    meaning: "Các phần liên quan tới website như tên miền phụ, trang con hoặc dịch vụ đang mở.",
  },
  {
    term: "Báo cáo",
    meaning: "Bản tóm tắt kết quả kiểm tra để bạn chia sẻ cho đội kỹ thuật hoặc lưu lại.",
  },
];

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="relative overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_52%)] dark:bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.24),_transparent_52%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:48px_48px] dark:opacity-40" />

      <section className="relative mx-auto max-w-7xl px-4 pb-8 pt-10 md:px-8 md:pb-12 md:pt-16">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-700 shadow-[0_0_24px_rgba(34,211,238,0.12)] dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-200">
              ADQ Security
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold leading-[0.96] tracking-[-0.04em] text-[var(--foreground)] md:text-6xl">
                Quản lý bảo mật website một cách rõ ràng, nhanh chóng và an toàn hơn.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-[var(--foreground-muted)] md:text-lg">
                Theo dõi lỗ hổng, quản lý tài sản kỹ thuật và kiểm soát quyền truy cập trong một hệ thống tập trung,
                dễ vận hành và dễ hiểu.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href={user ? "/dashboard" : "/login"}>
                <Button
                  size="lg"
                  className="border-cyan-300/50 bg-gradient-to-r from-cyan-300 via-cyan-400 to-sky-400 text-slate-950 shadow-[0_16px_32px_rgba(34,211,238,0.38)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_38px_rgba(34,211,238,0.46)] dark:border-cyan-200/60 dark:from-cyan-200 dark:via-cyan-300 dark:to-sky-300"
                >
                  {user ? "Mở dashboard" : "Đăng nhập"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button size="lg" variant="outline" className="border-[var(--line)] bg-[var(--background-elevated)] text-[var(--foreground)] hover:bg-[var(--background-muted)]">
                  Khám phá
                </Button>
              </Link>
            </div>
          </div>

          <Card className="relative overflow-hidden border-[var(--line)] bg-[var(--background-elevated)] shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:shadow-[0_24px_80px_rgba(2,6,23,0.55)]">
            <div className="pointer-events-none absolute inset-x-10 top-0 h-24 bg-cyan-400/10 blur-3xl" />
            <CardHeader className="relative">
              <CardTitle className="text-[var(--foreground)]">Hệ thống bảo mật tập trung</CardTitle>
              <CardDescription className="text-[var(--foreground-muted)]">Quản lý lỗ hổng, phân tích rủi ro và kiểm soát quyền truy cập trong một nơi.</CardDescription>
            </CardHeader>
            <CardContent className="relative space-y-4">
              {[
                "1. Thêm mục tiêu cần giám sát",
                "2. Cấu hình quét và kiểm tra bảo mật",
                "3. Phân tích kết quả và ưu tiên xử lý",
                "4. Theo dõi thời gian thực và báo cáo trạng thái",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-[var(--line)] bg-[var(--background-muted)] px-4 py-3 text-sm text-[var(--foreground-soft)] transition-transform duration-300 hover:-translate-y-0.5 hover:border-cyan-500/40">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--background-muted)] p-6 md:p-8">
            <p className="mb-4 text-sm uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300">Giải nghĩa nhanh</p>
            <h3 className="text-4xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">Một vài từ dễ gặp trên website</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {glossary.map((item) => (
              <div key={item.term} className="rounded-[24px] border border-[var(--line)] bg-[var(--background-elevated)] p-5 transition-all duration-300 hover:border-cyan-500/40 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.04)] dark:hover:shadow-[0_10px_24px_rgba(2,6,23,0.24)]">
                <p className="text-2xl font-semibold text-[var(--foreground)]">{item.term}</p>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">{item.meaning}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
