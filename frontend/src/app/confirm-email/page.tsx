"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Mail, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { maskEmail } from "@/lib/utils";

function ConfirmEmailContent() {
  const searchParams = useSearchParams();
  const targetEmail = searchParams.get("email") ?? "email của bạn";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#000000] px-4 py-10 text-[#ededed] font-sans selection:bg-white selection:text-black">
      <div className="w-full max-w-md rounded-lg border border-[#222222] bg-[#000000] p-6 sm:p-8 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#222222]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#222222] bg-[#000000] p-1">
              <Image
                src="/logo.png"
                alt="ADQ logo"
                width={32}
                height={32}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-white">
                  ADQ PLATFORM
                </span>
                <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[9px] font-mono font-medium text-neutral-300 border border-neutral-700">
                  VERIFY
                </span>
              </div>
              <h1 className="text-base font-semibold text-white tracking-tight">Xác Nhận Hộp Thư Email</h1>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2.5 rounded-md border border-neutral-700 bg-neutral-900 px-3.5 py-2.5 text-xs font-medium text-neutral-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Đăng ký đã được tiếp nhận. Vui lòng kích hoạt tài khoản bằng email xác nhận.</span>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              Địa chỉ nhận liên kết
            </p>
            <div className="rounded-md border border-[#333333] bg-[#0a0a0a] px-3 py-2 text-xs font-mono text-white break-all">
              {maskEmail(targetEmail)}
            </div>
          </div>

          <div className="space-y-3 text-xs text-neutral-400 leading-relaxed">
            <p>
              Vui lòng mở hộp thư và nhấn vào liên kết xác nhận để kích hoạt tài khoản. Nếu email chưa đến, hãy kiểm tra hộp thư Spam.
            </p>

            <div className="grid gap-2 rounded-md border border-[#222222] bg-[#0a0a0a] p-3 text-xs text-neutral-400">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 text-white shrink-0" />
                <span>Đảm bảo bạn đang dùng đúng địa chỉ email khi đăng ký.</span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-white shrink-0" />
                <span>Liên kết xác nhận sẽ có hiệu lực trong vòng 24 giờ.</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-2 sm:flex-row">
            <a href="mailto:support@adqsecurity.com?subject=Xác nhận email không đến" className="flex-1">
              <Button className="h-9 w-full bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm transition active:scale-[0.99] cursor-pointer">
                Liên Hệ Hỗ Trợ
              </Button>
            </a>

            <Link href="/login" className="flex-1">
              <Button
                variant="outline"
                className="h-9 w-full border border-[#333333] bg-[#111111] hover:bg-neutral-800 text-xs font-medium text-neutral-300 rounded-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-neutral-400" />
                Quay Lại Đăng Nhập
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#000000] text-neutral-400">Đang tải...</div>}>
      <ConfirmEmailContent />
    </Suspense>
  );
}
