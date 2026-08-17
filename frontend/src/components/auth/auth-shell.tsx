"use client";

import Link from "next/link";
import { FileText, SearchCheck, Shield, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="cyber-grid absolute inset-0 opacity-30 dark:opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(6,182,212,0.25),_transparent_55%)] dark:bg-[radial-gradient(circle_at_top,_rgba(103,217,255,0.2),_transparent_55%)]" />

      <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden space-y-8 lg:block"
        >
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_30px_rgba(34,211,238,0.12)]">
              <Shield className="h-7 w-7 text-cyan-600 dark:text-cyan-300" />
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <h1 className="text-2xl font-semibold tracking-wide text-[var(--foreground)]">ADQ Security</h1>
                <div className="pointer-events-none absolute inset-0 -z-10 translate-y-2 scale-110 bg-cyan-400/10 blur-2xl" />
              </div>
            </div>
          </Link>

          <div className="max-w-xl space-y-5">
            <p className="text-sm uppercase tracking-[0.38em] text-cyan-700 dark:text-cyan-300">Bảo mật & hiệu năng</p>
            <h2 className="text-5xl font-semibold leading-tight text-[var(--foreground)]">
              Quản lý bảo mật website một cách rõ ràng, nhanh chóng và an toàn hơn.
            </h2>
            <p className="text-lg leading-8 text-[var(--foreground-muted)]">
              Theo dõi lỗ hổng, quản lý tài sản kỹ thuật và kiểm soát quyền truy cập trong một hệ thống tập trung, dễ vận hành và dễ hiểu.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: SearchCheck,
                title: "Quét nhanh",
                text: "Khởi tạo quét mục tiêu trong vài bước với cấu hình mặc định và cấu hình nâng cao tùy theo nhu cầu.",
              },
              {
                icon: Sparkles,
                title: "Phân tích thông minh",
                text: "Nhận kết quả theo mức độ rủi ro, nguyên nhân và gợi ý xử lý rõ ràng, dễ triển khai cho đội kỹ thuật.",
              },
              {
                icon: FileText,
                title: "Báo cáo chuyên nghiệp",
                text: "Xuất báo cáo đánh giá an ninh để chia sẻ với khách hàng, quản lý hoặc bộ phận công nghệ.",
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.title} className="glass-panel rounded-3xl p-5">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/25 bg-[var(--background-muted)]">
                    <Icon className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-[var(--foreground)]">{item.title}</h3>
                  <p className="text-sm leading-6 text-[var(--foreground-muted)]">{item.text}</p>
                </div>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          className="glass-panel glow-cyan mx-auto w-full max-w-xl rounded-[28px] p-6 sm:p-8"
        >
          <div className="mb-8 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
                <Shield className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
              </div>
              <div className="relative">
                <p className="text-lg font-semibold text-[var(--foreground)]">ADQ Security</p>
                <div className="pointer-events-none absolute inset-0 -z-10 translate-y-2 scale-110 bg-cyan-400/10 blur-xl" />
              </div>
            </Link>
          </div>

          <div className="mb-8 space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Truy cập an toàn</p>
            <h2 className="text-3xl font-semibold text-[var(--foreground)]">{title}</h2>
            <p className="text-sm leading-6 text-[var(--foreground-muted)]">{description}</p>
          </div>

          {children}
        </motion.section>
      </div>
    </div>
  );
}
