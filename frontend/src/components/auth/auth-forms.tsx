"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  Sparkles,
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

const triggerGoogleOAuth = async (
  setLoadingState: (b: boolean) => void,
  setError: (msg: string | null) => void,
  nextPath = "/dashboard"
) => {
  setLoadingState(true);
  setError(null);
  try {
    const supabase = createSupabaseBrowserClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
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

function getFriendlyErrorMessage(err: any): string {
  const msg = (err?.message || err?.error_description || String(err || "")).toLowerCase();
  if (msg.includes("invalid login credentials") || msg.includes("invalid_grant")) {
    return "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.";
  }
  if (msg.includes("email not confirmed")) {
    return "Email của bạn chưa được kích hoạt. Vui lòng kiểm tra hộp thư để xác nhận.";
  }
  if (msg.includes("user is banned") || msg.includes("locked")) {
    return "Tài khoản của bạn đã bị khóa bởi quản trị viên.";
  }
  if (msg.includes("too many requests") || msg.includes("rate_limit")) {
    return "Đã thử đăng nhập quá nhiều lần. Vui lòng chờ 1-2 phút rồi thử lại.";
  }
  return err?.message || "Đăng nhập thất bại. Vui lòng kiểm tra thông tin và thử lại.";
}

export function LoginForm() {
  const { login, lockMessage } = useAuth();
  const searchParams = useSearchParams();
  const nextDestination = searchParams?.get("next") || searchParams?.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [capsLockActive, setCapsLockActive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Khôi phục email đã ghi nhớ từ localStorage
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("adq_remembered_email");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {}
  }, []);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (errorMessage) setErrorMessage(null);
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (errorMessage) setErrorMessage(null);
  };

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
        // Lưu / Xóa email ghi nhớ theo lựa chọn
        if (rememberMe) {
          localStorage.setItem("adq_remembered_email", cleanEmail);
        } else {
          localStorage.removeItem("adq_remembered_email");
        }
        window.location.href = nextDestination;
      } else {
        setErrorMessage(
          res?.error ? getFriendlyErrorMessage(res.error) : "Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản."
        );
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 font-sans">
      {(errorMessage || lockMessage) && (
        <div className="p-3 rounded-md bg-rose-950/20 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2.5 shadow-sm">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{errorMessage || lockMessage}</div>
        </div>
      )}

      {/* Google OAuth Button */}
      <Button
        type="button"
        variant="outline"
        onClick={() => triggerGoogleOAuth(setGoogleLoading, setErrorMessage, nextDestination)}
        disabled={loading || googleLoading}
        className="h-10 w-full border border-[#333333] bg-[#000000] hover:bg-[#111111] text-xs font-medium text-white rounded-md flex items-center justify-center gap-2.5 transition shadow-sm cursor-pointer"
      >
        {googleLoading ? (
          <span className="flex items-center gap-2">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-white" />
            Đang chuyển tới Google OAuth...
          </span>
        ) : (
          <>
            <GoogleIcon className="h-4 w-4" />
            <span>Tiếp tục nhanh với Google</span>
          </>
        )}
      </Button>

      {/* Đường phân cách */}
      <div className="relative flex items-center justify-center my-3">
        <div className="border-t border-[#222222] w-full" />
        <span className="bg-[#000000] px-3 text-[10px] uppercase font-mono tracking-widest text-neutral-500">
          HOẶC DÙNG EMAIL
        </span>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium uppercase text-neutral-400 tracking-wider font-mono">
          Email
        </label>
        <div className="relative group">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
          <Input
            type="email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            disabled={loading || googleLoading}
            placeholder="name@example.com"
            className="h-10 pl-10 border-[#333333] bg-[#000000] focus:border-white focus:ring-0 font-sans text-xs text-white placeholder:text-neutral-500 rounded-md transition"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium uppercase text-neutral-400 tracking-wider font-mono">
            Mật khẩu
          </label>
          <Link
            href="/forgot-password"
            className="text-[11px] text-neutral-400 hover:text-white transition-colors"
          >
            Quên mật khẩu?
          </Link>
        </div>
        <div className="relative group">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            onKeyDown={(e) => setCapsLockActive(e.getModifierState("CapsLock"))}
            onKeyUp={(e) => setCapsLockActive(e.getModifierState("CapsLock"))}
            disabled={loading || googleLoading}
            placeholder="••••••••••••"
            className="h-10 pl-10 pr-10 border-[#333333] bg-[#000000] focus:border-white focus:ring-0 font-sans text-xs text-white placeholder:text-neutral-500 rounded-md transition"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition p-1"
          >
            {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        {capsLockActive && (
          <p className="text-[10px] text-amber-400 font-mono flex items-center gap-1 mt-1 pl-1">
            <span>⚠️ Đang bật phím Caps Lock</span>
          </p>
        )}
      </div>

      {/* Tùy chọn Ghi nhớ tài khoản */}
      <div className="flex items-center pt-0.5">
        <label className="flex items-center gap-2 text-neutral-400 hover:text-white cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-[#333333] bg-[#000000] text-white accent-white cursor-pointer"
          />
          <span className="text-xs">Ghi nhớ đăng nhập</span>
        </label>
      </div>

      <Button
        type="submit"
        disabled={loading || googleLoading}
        className="h-10 w-full bg-white hover:bg-neutral-200 !text-black font-bold text-xs rounded-md transition shadow-sm cursor-pointer mt-1"
      >
        {loading ? (
          <span className="flex items-center gap-2 !text-black font-bold">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin !text-black" />
            Đang xác thực...
          </span>
        ) : (
          <span className="flex items-center gap-1.5 !text-black font-bold">
            Đăng Nhập Console <ArrowRight className="h-3.5 w-3.5 !text-black" />
          </span>
        )}
      </Button>
    </form>
  );
}

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  bgColor: string;
  hasMinLength: boolean;
  hasMixedCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

function evaluatePasswordStrength(pass: string): PasswordStrength {
  const hasMinLength = pass.length >= 8;
  const hasMixedCase = /[a-z]/.test(pass) && /[A-Z]/.test(pass);
  const hasNumber = /\d/.test(pass);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/`~]/.test(pass);

  let score = 0;
  if (hasMinLength) score++;
  if (hasMixedCase) score++;
  if (hasNumber) score++;
  if (hasSpecialChar) score++;

  if (!pass) {
    return {
      score: 0,
      label: "Chưa nhập",
      color: "text-slate-500",
      bgColor: "bg-slate-800",
      hasMinLength: false,
      hasMixedCase: false,
      hasNumber: false,
      hasSpecialChar: false,
    };
  }

  switch (score) {
    case 1:
      return {
        score: 1,
        label: "Yếu",
        color: "text-rose-400",
        bgColor: "bg-rose-500",
        hasMinLength,
        hasMixedCase,
        hasNumber,
        hasSpecialChar,
      };
    case 2:
      return {
        score: 2,
        label: "Trung bình",
        color: "text-amber-400",
        bgColor: "bg-amber-500",
        hasMinLength,
        hasMixedCase,
        hasNumber,
        hasSpecialChar,
      };
    case 3:
      return {
        score: 3,
        label: "Khá mạnh",
        color: "text-cyan-400",
        bgColor: "bg-cyan-400",
        hasMinLength,
        hasMixedCase,
        hasNumber,
        hasSpecialChar,
      };
    case 4:
      return {
        score: 4,
        label: "Rất mạnh (Tối ưu)",
        color: "text-emerald-400",
        bgColor: "bg-emerald-400",
        hasMinLength,
        hasMixedCase,
        hasNumber,
        hasSpecialChar,
      };
    default:
      return {
        score: 0,
        label: "Rất yếu",
        color: "text-rose-400",
        bgColor: "bg-rose-500",
        hasMinLength,
        hasMixedCase,
        hasNumber,
        hasSpecialChar,
      };
  }
}

export function RegisterForm() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const strength = evaluatePasswordStrength(password);
  const isPasswordMatch =
    confirmPassword.length > 0 && password === confirmPassword;
  const isPasswordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanConfirmPassword = confirmPassword.trim();

    if (!cleanName || !cleanEmail || !cleanPassword || !cleanConfirmPassword) {
      setErrorMessage("Vui lòng điền đầy đủ tất cả các trường thông tin bắt buộc.");
      return;
    }

    if (cleanPassword.length < 8) {
      setErrorMessage("Mật khẩu phải có tối thiểu 8 ký tự để đảm bảo an toàn.");
      return;
    }

    if (cleanPassword !== cleanConfirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await register({ name: cleanName, email: cleanEmail, password: cleanPassword });

      if (result?.session) {
        window.location.href = "/onboarding";
        return;
      }

      setErrorMessage(
        "Tài khoản đã được tạo thành công. Vui lòng kiểm tra hộp thư email để xác minh tài khoản, sau đó đăng nhập để tiếp tục."
      );
      setLoading(false);
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Không thể tạo tài khoản. Vui lòng kiểm tra lại thông tin và thử lại."
      );
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 font-sans">
      {errorMessage && (
        <div className="p-3 rounded-md bg-rose-950/20 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2 shadow-sm">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-snug">{errorMessage}</div>
        </div>
      )}

      {/* Đăng ký nhanh với Google */}
      <Button
        type="button"
        variant="outline"
        onClick={() => triggerGoogleOAuth(setGoogleLoading, setErrorMessage, "/onboarding")}
        disabled={loading || googleLoading}
        className="h-10 w-full border border-[#333333] bg-[#000000] hover:bg-[#111111] text-xs font-medium text-white rounded-md flex items-center justify-center gap-2.5 transition shadow-sm cursor-pointer"
      >
        <GoogleIcon className="h-4 w-4" />
        <span>Đăng ký nhanh với Google</span>
      </Button>

      {/* Đường phân cách */}
      <div className="relative flex items-center justify-center my-2">
        <div className="border-t border-[#222222] w-full" />
        <span className="bg-[#000000] px-3 text-[10px] uppercase font-mono tracking-widest text-neutral-500">
          HOẶC DÙNG EMAIL
        </span>
      </div>

      {/* Hàng 1: Họ tên & Email (2 cột) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase text-neutral-400 tracking-wider font-mono">
            Họ và Tên *
          </label>
          <div className="relative group">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              disabled={loading || googleLoading}
              placeholder="Ví dụ: Minh Hoàng"
              className="h-9 pl-9 border-[#333333] bg-[#000000] focus:border-white focus:ring-0 font-sans text-xs text-white placeholder:text-neutral-500 rounded-md transition"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase text-neutral-400 tracking-wider font-mono">
            Email *
          </label>
          <div className="relative group">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              disabled={loading || googleLoading}
              placeholder="name@example.com"
              className="h-9 pl-9 border-[#333333] bg-[#000000] focus:border-white focus:ring-0 font-sans text-xs text-white placeholder:text-neutral-500 rounded-md transition"
              required
            />
          </div>
        </div>
      </div>

      {/* Hàng 2: Mật khẩu & Xác nhận Mật khẩu (2 cột) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase text-neutral-400 tracking-wider font-mono">
            Mật khẩu *
          </label>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              onKeyDown={(e) => setCapsLockActive(e.getModifierState("CapsLock"))}
              onKeyUp={(e) => setCapsLockActive(e.getModifierState("CapsLock"))}
              disabled={loading || googleLoading}
              placeholder="••••••••••••"
              className="h-9 pl-9 pr-9 border-[#333333] bg-[#000000] focus:border-white focus:ring-0 font-sans text-xs text-white placeholder:text-neutral-500 rounded-md transition"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition p-1"
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium uppercase text-neutral-400 tracking-wider font-mono">
              Xác nhận Mật khẩu *
            </label>
            {isPasswordMatch && (
              <span className="text-[10px] font-mono text-emerald-400 font-medium">
                ✓ Khớp
              </span>
            )}
            {isPasswordMismatch && (
              <span className="text-[10px] font-mono text-rose-400">
                ✕ Chưa khớp
              </span>
            )}
          </div>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            <Input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              onKeyDown={(e) => setCapsLockActive(e.getModifierState("CapsLock"))}
              onKeyUp={(e) => setCapsLockActive(e.getModifierState("CapsLock"))}
              disabled={loading || googleLoading}
              placeholder="Nhập lại mật khẩu..."
              className={`h-9 pl-9 pr-9 border-[#333333] bg-[#000000] focus:ring-0 font-sans text-xs text-white placeholder:text-neutral-500 rounded-md transition ${
                isPasswordMismatch
                  ? "border-rose-500 focus:border-rose-400"
                  : "focus:border-white"
              }`}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition p-1"
            >
              {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {capsLockActive && (
        <p className="text-[10px] text-amber-400 font-mono flex items-center gap-1 pl-1">
          <span>⚠️ Đang bật phím Caps Lock</span>
        </p>
      )}

      {/* Thanh Đo Độ Mạnh Mật Khẩu */}
      {password.length > 0 && (
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-neutral-400">
              Độ an toàn: <span className={`font-semibold ${strength.color}`}>{strength.label}</span>
            </span>
            <span className="text-[10px] text-neutral-500">
              {strength.score >= 3 ? "Đạt tiêu chuẩn bảo mật" : "Cần thêm hoa/số/ký tự đặc biệt"}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 h-1">
            {[1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={`h-full rounded-full transition-all duration-300 ${
                  level <= strength.score ? strength.bgColor : "bg-neutral-800"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <Button
        type="submit"
        disabled={loading || googleLoading}
        className="h-10 w-full bg-white hover:bg-neutral-200 !text-black font-bold text-xs rounded-md shadow-sm transition active:scale-[0.99] cursor-pointer mt-2"
      >
        {loading ? (
          <span className="flex items-center gap-2 !text-black font-bold">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin !text-black" />
            Đang khởi tạo tài khoản...
          </span>
        ) : (
          <span className="!text-black font-bold">
            Tạo Tài Khoản & Vào Console
          </span>
        )}
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
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 border border-neutral-700 text-white">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <p className="text-xs text-neutral-300">Đã gửi liên kết khôi phục tới {email}</p>
        <Link
          href="/login"
          className="inline-block text-xs font-medium text-white hover:underline transition-colors"
        >
          ← Quay lại Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 font-sans">
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium uppercase text-neutral-400 tracking-wider font-mono">
          Email đã đăng ký
        </label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="h-10 border-[#333333] bg-[#000000] focus:border-white focus:ring-0 font-sans text-xs text-white rounded-md transition"
          required
        />
      </div>
      <Button
        type="submit"
        className="h-10 w-full bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm transition active:scale-[0.98] cursor-pointer"
      >
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
    <form onSubmit={handleSubmit} className="space-y-4 font-sans">
      <Input
        type="password"
        placeholder="Mật khẩu mới"
        className="h-10 border-[#333333] bg-[#000000] focus:border-white focus:ring-0 font-sans text-xs text-white rounded-md transition"
        required
      />
      <Button
        type="submit"
        className="h-10 w-full bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm transition active:scale-[0.98] cursor-pointer"
      >
        Cập Nhật Mật Khẩu
      </Button>
    </form>
  );
}
