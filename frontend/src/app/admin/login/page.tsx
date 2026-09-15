"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Shield, ArrowRight, Loader2, AlertCircle, Lock, Mail, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrowserClient } from "@supabase/ssr";

function LoginContent() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [mode, setMode] = useState<"oauth" | "password">("oauth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Canonical SOC Host Enforcement
    if (typeof window !== "undefined" && window.location.hostname === "www.adq-soc.click") {
      window.location.replace(`https://adq-soc.click${window.location.pathname}${window.location.search}`);
      return;
    }

    if (errorParam === "access_denied") {
      setError("Tài khoản của bạn không có quyền SOC Administrator.");
    } else if (errorParam === "oauth_cancelled") {
      setError("Đăng nhập OAuth đã bị hủy bởi người dùng.");
    } else if (errorParam === "auth_failed" || errorParam === "missing_code" || errorParam === "callback_failed") {
      setError("Xác thực danh tính ADQ thất bại. Vui lòng thử lại.");
    } else if (errorParam === "no_identity") {
      setError("Không tìm thấy danh tính người dùng từ hệ thống xác thực.");
    }
  }, [errorParam]);

  const handleOAuthLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Strict Canonical SOC Callback URL
      const callbackUrl = "https://adq-soc.click/admin/auth/callback";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
        },
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (err: any) {
      setError(err.message || "Lỗi khởi tạo đăng nhập Google OAuth");
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Vui lòng nhập đầy đủ email và mật khẩu tài khoản ADQ.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Xác thực danh tính thất bại");
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
            Xác thực bằng tài khoản ADQ được cấp quyền quản trị
          </p>
        </div>

        {/* Login Box */}
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#222222] shadow-2xl space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {mode === "oauth" ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#050505] border border-[#1a1a1a] text-center space-y-2">
                <Shield className="h-8 w-8 text-emerald-400 mx-auto" />
                <h3 className="text-xs font-semibold text-white">Identity Access Management</h3>
                <p className="text-[11px] text-neutral-400 leading-relaxed font-mono">
                  Chỉ tài khoản được cấp quyền SOC Administrator mới có thể truy cập Control Center.
                </p>
              </div>

              <Button
                onClick={handleOAuthLogin}
                disabled={loading}
                className="w-full h-11 bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang chuyển hướng Supabase Identity...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    Đăng nhập bằng ADQ Identity (Google)
                  </>
                )}
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("password");
                    setError(null);
                  }}
                  className="text-[11px] font-mono text-neutral-400 hover:text-white underline underline-offset-4"
                >
                  Đăng nhập bằng Email & Mật khẩu ADQ
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-neutral-300">EMAIL TÀI KHOẢN ADQ</label>
                <div className="relative">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@adq.io.vn..."
                    className="bg-[#000000] border-[#333333] text-white text-xs h-10 pr-10"
                    autoFocus
                    disabled={loading}
                  />
                  <Mail className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-neutral-300">MẬT KHẨU TÀI KHOẢN ADQ</label>
                <div className="relative">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="bg-[#000000] border-[#333333] text-white text-xs h-10 pr-10"
                    disabled={loading}
                  />
                  <KeyRound className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500" />
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
                    Đang xác thực danh tính...
                  </>
                ) : (
                  <>
                    Xác thực Danh tính ADQ <ArrowRight className="h-4 w-4 ml-1.5" />
                  </>
                )}
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("oauth");
                    setError(null);
                  }}
                  className="text-[11px] font-mono text-neutral-400 hover:text-white underline underline-offset-4"
                >
                  Quay lại Đăng nhập qua Google Identity
                </button>
              </div>
            </form>
          )}

          <div className="pt-3 border-t border-[#1a1a1a] flex items-center justify-between text-[10px] font-mono text-neutral-500">
            <span>REALM: adq-soc.click</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              SOC ACCESS GUARD ACTIVE
            </span>
          </div>
        </div>

        {/* Security Notice */}
        <div className="p-3.5 rounded-lg bg-[#050505] border border-[#1a1a1a] text-[11px] text-neutral-400 text-center leading-relaxed font-mono">
          Hệ thống được bảo vệ bởi Authoritative SOC Guard. Truy cập bị từ chối đối với tất cả danh tính chưa được ủy quyền quản trị.
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-white text-xs font-mono">
          Loading SOC Console...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
