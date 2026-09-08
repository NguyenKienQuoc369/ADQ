"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  LoaderCircle,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function AdminLoginForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const router = useRouter();

  const [masterKey, setMasterKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!masterKey.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          masterKey: masterKey.trim(),
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Mã Access Key không chính xác. Yêu cầu quyền truy cập Root bị từ chối."
          );
        }

        if (response.status === 403) {
          throw new Error(
            "SOC Gateway chỉ cho phép đăng nhập từ miền quản trị được cấp phép."
          );
        }

        throw new Error("Không thể khởi tạo phiên SOC.");
      }

      setMasterKey("");

      if (onSuccess) {
        onSuccess();
      } else {
        router.replace("/admin");
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "Không thể đăng nhập SOC.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#000000] text-[#ededed] font-sans selection:bg-white selection:text-black px-4">
      <div className="w-full max-w-md rounded-lg border border-[#222222] bg-[#000000] p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between pb-5 border-b border-[#222222]">
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
                <h1 className="text-sm font-semibold text-white tracking-tight">
                  SOC ROOT GATEWAY
                </h1>

                <span className="px-2 py-0.5 rounded-full border border-neutral-700 bg-neutral-800 text-[10px] font-mono text-neutral-300">
                  ISOLATED
                </span>
              </div>

              <p className="text-xs text-neutral-500 font-mono mt-0.5">
                ADQ Security Operations Center
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-neutral-700 bg-neutral-800 text-[10px] font-mono text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ONLINE
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-md bg-[#0a0a0a] border border-[#222222] text-xs text-neutral-400 font-mono flex items-center gap-2.5">
          <ShieldAlert className="h-4 w-4 text-neutral-400 shrink-0" />

          <span>
            Khu vực quản trị giới hạn. Phiên SOC được xác thực độc lập với tài khoản người dùng ADQ.
          </span>
        </div>

        <form onSubmit={handleLogin} className="mt-5 space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-rose-950/20 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-mono text-[11px] uppercase text-neutral-400">
                Root Master Access Key
              </label>

              <span className="text-[11px] text-neutral-500 font-mono">
                Server Auth
              </span>
            </div>

            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />

              <Input
                type="password"
                value={masterKey}
                onChange={(e) => setMasterKey(e.target.value)}
                placeholder="Nhập mã truy cập..."
                className="h-10 pl-9 pr-4 border-[#333333] bg-[#0a0a0a] font-mono text-xs text-white placeholder:text-neutral-500 focus:border-white focus:ring-0 rounded-md transition"
                autoFocus
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !masterKey.trim()}
            className="h-10 w-full bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm transition active:scale-[0.99] cursor-pointer mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2 font-mono">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Đang xác thực SOC...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2 font-mono uppercase tracking-wider">
                Mở Bảng Điều Khiển SOC
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

