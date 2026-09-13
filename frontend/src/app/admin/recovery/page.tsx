"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ShieldCheck, AlertCircle, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

function RecoveryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Không tìm thấy mã token khôi phục khẩn cấp trong URL.");
      setLoading(false);
      return;
    }

    const redeemToken = async () => {
      try {
        const res = await fetch("/api/admin/auth/recovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: token.trim() }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Mã khôi phục không hợp lệ hoặc đã hết hạn");
        }

        setSuccess(true);
        setTimeout(() => {
          window.location.href = "/admin";
        }, 1000);
      } catch (err: any) {
        setError(err.message || "Lỗi xử lý xác thực khẩn cấp");
      } finally {
        setLoading(false);
      }
    };

    redeemToken();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-[#000000] text-[#ededed] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[#222222] bg-[#0a0a0a] p-2 shadow-sm mb-2">
            <Image
              src="/logo.png"
              alt="ADQ logo"
              width={40}
              height={40}
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            SOC EMERGENCY RECOVERY
          </h1>
          <p className="text-xs font-mono text-neutral-400">
            Xác thực phiên khẩn cấp qua SSH Operator Token
          </p>
        </div>

        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#222222] shadow-2xl space-y-5">
          {loading && (
            <div className="py-8 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-400" />
              <p className="text-xs font-mono text-neutral-300">
                Đang xác thực mã khôi phục CSPRNG 256-bit...
              </p>
            </div>
          )}

          {success && (
            <div className="py-6 text-center space-y-3">
              <ShieldCheck className="h-10 w-10 text-emerald-400 mx-auto" />
              <p className="text-sm font-semibold text-emerald-400">
                Xác thực thành công! Đang chuyển hướng đến Control Center...
              </p>
            </div>
          )}

          {error && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
              <Button
                onClick={() => (window.location.href = "/admin/login")}
                className="w-full bg-white hover:bg-neutral-200 text-black text-xs font-semibold"
              >
                Quay lại trang Đăng nhập SOC
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminRecoveryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-white text-xs font-mono">
          Loading...
        </div>
      }
    >
      <RecoveryContent />
    </Suspense>
  );
}

