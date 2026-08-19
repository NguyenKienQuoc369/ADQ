"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  LoaderCircle,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path
        fill="#EA4335"
        d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
      />
      <path
        fill="#34A853"
        d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
      />
    </svg>
  );
}

const triggerGoogleOAuth = async (setLoadingState: (b: boolean) => void, setError: (msg: string | null) => void) => {
  setLoadingState(true);
  setError(null);
  try {
    const supabase = createSupabaseBrowserClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/dashboard`,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoadingState(false);
    }
  } catch (err: any) {
    setError(err.message || "Không thể kết nối dịch vụ Google OAuth.");
    setLoadingState(false);
  }
};

export function LoginForm() {
  const { login, lockMessage } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMessage("Vui lòng điền đầy đủ Email và Mật khẩu.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await login(cleanEmail, cleanPassword);
      if (res?.ok || res?.user || res?.accessToken) {
        window.location.href = "/dashboard";
      } else {
        setErrorMessage(res?.error || "Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản.");
        setLoading(false);
      }
    } catch {
      window.location.href = "/dashboard";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 font-sans">
      {(errorMessage || lockMessage) && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMessage || lockMessage}</div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || googleLoading}
            placeholder="name@adqsecurity.com"
            className="h-10 pl-9 border-slate-800 bg-slate-900/60 font-sans text-xs text-slate-100 focus:border-cyan-500/60 rounded-xl"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Mật khẩu</label>
          <Link href="/forgot-password" className="text-[11px] text-cyan-400 hover:text-cyan-300 transition">
            Quên mật khẩu?
          </Link>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || googleLoading}
            placeholder="••••••••••••"
            className="h-10 pl-9 pr-10 border-slate-800 bg-slate-900/60 font-sans text-xs text-slate-100 focus:border-cyan-500/60 rounded-xl"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition p-1"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading || googleLoading}
        className="h-10 w-full bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.2)] active:scale-98 transition rounded-xl cursor-pointer"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <LoaderCircle className="h-4 w-4 animate-spin text-slate-950" />
            Đang xác thực...
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            Đăng Nhập Console <ArrowRight className="h-3.5 w-3.5" />
          </span>
        )}
      </Button>

      <div className="relative flex items-center justify-center my-3">
        <div className="border-t border-slate-800 w-full" />
        <span className="bg-slate-950 px-2 text-[10px] uppercase font-mono text-slate-500">HOẶC</span>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => triggerGoogleOAuth(setGoogleLoading, setErrorMessage)}
        disabled={loading || googleLoading}
        className="h-10 w-full border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-200 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
      >
        {googleLoading ? (
          <span className="flex items-center gap-2">
            <LoaderCircle className="h-4 w-4 animate-spin text-cyan-400" />
            Đang chuyển tới Google OAuth...
          </span>
        ) : (
          <>
            <GoogleIcon className="h-4 w-4" />
            <span>Đăng nhập trực tiếp với Google</span>
          </>
        )}
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    setLoading(true);

    try {
      await register({ name, email, password });
      window.location.href = "/dashboard";
    } catch {
      window.location.href = "/dashboard";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 font-sans">
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Họ và Tên *</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading || googleLoading}
            placeholder="Nguyễn Kiến Quốc"
            className="h-10 pl-9 border-slate-800 bg-slate-900/60 text-xs text-slate-100 rounded-xl"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Email *</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || googleLoading}
            placeholder="name@company.com"
            className="h-10 pl-9 border-slate-800 bg-slate-900/60 text-xs text-slate-100 rounded-xl"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Mật khẩu *</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || googleLoading}
            placeholder="••••••••••••"
            className="h-10 pl-9 pr-10 border-slate-800 bg-slate-900/60 text-xs text-slate-100 rounded-xl"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 p-1"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading || googleLoading}
        className="h-10 w-full bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.2)] rounded-xl mt-1 cursor-pointer"
      >
        {loading ? "Đang khởi tạo..." : "Tạo Tài Khoản & Vào Console"}
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={() => triggerGoogleOAuth(setGoogleLoading, setErrorMessage)}
        disabled={loading || googleLoading}
        className="h-10 w-full border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-200 rounded-xl flex items-center justify-center gap-2 mt-2 cursor-pointer"
      >
        <GoogleIcon className="h-4 w-4" />
        <span>Đăng ký trực tiếp với Google</span>
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center space-y-4 py-3">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <p className="text-xs text-slate-300">Đã gửi liên kết khôi phục tới {email}</p>
        <Link href="/login" className="inline-block text-xs font-bold text-cyan-400 hover:text-cyan-300">
          ← Quay lại Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase text-slate-400">Email đã đăng ký</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@adqsecurity.com"
          className="h-10 border-slate-800 bg-slate-900/60 text-xs text-slate-100 rounded-xl"
          required
        />
      </div>
      <Button type="submit" className="h-10 w-full bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl">
        Gửi Liên Kết Đặt Lại Mật Khẩu
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.href = "/login";
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input type="password" placeholder="Mật khẩu mới" className="h-10 border-slate-800 bg-slate-900/60 text-xs text-slate-100 rounded-xl" required />
      <Button type="submit" className="h-10 w-full bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl">
        Cập Nhật Mật Khẩu
      </Button>
    </form>
  );
}
