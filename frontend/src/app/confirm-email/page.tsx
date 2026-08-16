"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Mail, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

function ConfirmEmailContent() {
  const searchParams = useSearchParams();
  const targetEmail = searchParams.get("email") ?? "email của bạn";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.12),transparent_30%)]" />

      <div className="relative w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900/75 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
        <div className="border-b border-slate-800 bg-slate-950/60 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/30">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">ADQ Security</p>
              <h1 className="text-xl font-semibold text-white">Xác nhận email</h1>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-8 sm:px-8">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            <span>Đăng ký đã được nhận. Vui lòng kích hoạt tài khoản bằng email xác nhận.</span>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">Gửi tới</p>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-base font-medium text-cyan-200 break-all">
              {targetEmail}
            </div>
          </div>

          <div className="space-y-4 text-slate-300">
            <p>
              Vui lòng mở hộp thư và nhấn vào liên kết xác nhận để kích hoạt tài khoản. Nếu email chưa đến, hãy kiểm tra
              hộp thư Spam hoặc Promotions.
            </p>

            <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 text-cyan-300" />
                <span>Đảm bảo bạn đang dùng đúng địa chỉ email khi đăng ký.</span>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-cyan-300" />
                <span>Liên kết xác nhận sẽ có hiệu lực trong thời gian ngắn nhất định.</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <a href="mailto:support@yourdomain.com?subject=Xác nhận email không đến" className="flex-1">
              <Button className="w-full">Liên hệ hỗ trợ</Button>
            </a>

            <Link href="/login" className="flex-1">
              <Button variant="secondary" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay lại đăng nhập
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
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">Đang tải...</div>}>
      <ConfirmEmailContent />
    </Suspense>
  );
}
