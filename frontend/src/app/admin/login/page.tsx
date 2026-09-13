"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Shield, KeyRound, ArrowRight, Loader2, AlertCircle, Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Vui lòng nhập mật khẩu quản trị viên SOC.");
      return;
    }

    setLoading(true);
    setError(null);
    setIsRateLimited(false);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429 || data.code === "RATE_LIMITED" || data.locked) {
          setIsRateLimited(true);
          throw new Error(data.error || "Tài khoản tạm thời bị khóa do nhập sai nhiều lần. Vui lòng thử lại sau.");
        }
        throw new Error(data.error || "Mật khẩu quản trị viên SOC không chính xác.");
      }

      window.location.href = "/admin";
    } catch (err: any) {
      setError(err.message || "Lỗi kết nối máy chủ xác thực");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#ededed] flex flex-col justify-center items-center p-4 selection:bg-white selection:text-black">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
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
            ADQ SOC ROOT CONSOLE
          </h1>
          <p className="text-xs font-mono text-neutral-400">
            Xác thực phiên điều hành quản trị viên hệ thống an ninh
          </p>
        </div>

        {/* Login Box */}
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#222222] shadow-2xl space-y-5">
          {error && (
            <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
              isRateLimited
                ? "bg-amber-950/40 border-amber-800/60 text-amber-300"
                : "bg-rose-950/40 border-rose-800/60 text-rose-300"
            }`}>
              {isRateLimited ? (
                <Lock className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-neutral-300 flex items-center justify-between">
                <span>SOC MASTER PASSWORD</span>
                <span className="text-[10px] text-neutral-500 font-mono">scrypt (N=16384, r=8, p=1)</span>
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu quản trị SOC..."
                  className="bg-[#000000] border-[#333333] text-white text-xs h-10 pr-10 focus-visible:ring-emerald-500/50"
                  autoFocus
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Đang xác thực bảo mật...
                </>
              ) : (
                <>
                  Đăng nhập SOC Console <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              )}
            </Button>
          </form>

          <div className="pt-3 border-t border-[#1a1a1a] flex items-center justify-between text-[10px] font-mono text-neutral-500">
            <span>REALM: adq-soc.click</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              BRUTE-FORCE SHIELD: ACTIVE
            </span>
          </div>
        </div>

        {/* Security Warning Notice */}
        <div className="p-3.5 rounded-lg bg-[#050505] border border-[#1a1a1a] text-[11px] text-neutral-400 text-center leading-relaxed font-mono">
          Hệ thống được bảo vệ bởi Authoritative SOC Guard. Mọi hoạt động xác thực không hợp lệ đều được ghi vết và giới hạn tần suất tự động.
        </div>
      </div>
    </div>
  );
}
