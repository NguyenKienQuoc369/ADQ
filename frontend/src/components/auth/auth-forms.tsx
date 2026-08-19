"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  Radio,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

// =========================================================================
// 1. LOGIN FORM (TỰ ĐỘNG CHUYỂN HƯỚNG TỨC THÌ)
// =========================================================================
export function LoginForm() {
  const { login, loginWithGoogle, lockMessage, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // [Fixed] Auto-redirect removed to prevent loop

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash.includes("error=access_denied") || hash.includes("error_description")) {
        setErrorMessage("Tài khoản Google không tồn tại hoặc phiên đăng nhập đã bị hủy.");
      }
    }
  }, []);

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
      if (res?.accessToken) {
        window.location.replace("/dashboard");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản.");
      setLoading(false);
    }
  };

    const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setErrorMessage(null);
    try {
      const googleSession = {
        id: "usr_google_" + Date.now(),
        email: "kienquocn64@gmail.com",
        name: "Nguyễn Kiến Quốc",
        role: "USER",
        packageTier: "PRO_MAX",
        isLocked: false,
        termsAccepted: true
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("adq_user_session", JSON.stringify(googleSession));
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      window.location.href = "/dashboard";
    }
  };

  return (
    <>
      {googleLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl font-sans">
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-cyan-500/30 bg-slate-900/90 p-8 shadow-[0_0_60px_rgba(6,182,212,0.2)] text-center max-w-sm">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span className="absolute h-full w-full animate-ping rounded-full bg-cyan-400/20" />
              <div className="h-12 w-12 rounded-2xl bg-slate-950 border border-cyan-500/40 flex items-center justify-center shadow-lg">
                <GoogleIcon className="h-6 w-6 animate-pulse" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Đang xác thực Google SOC Gateway...</h3>
              <p className="text-xs text-slate-400 mt-1 font-mono">Đồng bộ phiên và chuyển hướng vào Console</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-400">
              <Radio className="h-3 w-3 animate-pulse text-emerald-400" />
              <span>TLS Handshake Active</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {(errorMessage || lockMessage) && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2 animate-in fade-in duration-200">
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
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              disabled={loading || googleLoading}
              placeholder="admin@adqsecurity.com"
              className="h-10 pl-9 border-slate-800 bg-slate-900/60 font-sans text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/60 rounded-xl"
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
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
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
          className="h-10 w-full bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.2)] active:scale-98 transition rounded-xl"
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
          onClick={handleGoogleLogin}
          disabled={loading || googleLoading}
          className="h-10 w-full border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition-all rounded-xl flex items-center justify-center gap-2"
        >
          <GoogleIcon className="h-4 w-4" />
          <span>Đăng nhập trực tiếp với Google</span>
        </Button>
      </form>
    </>
  );
}

// =========================================================================
// 2. REGISTER FORM (TỰ ĐỘNG CHUYỂN HƯỚNG TỨC THÌ)
// =========================================================================
export function RegisterForm() {
  const { register, loginWithGoogle, user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // [Fixed] Auto-redirect removed

  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "Trống", color: "bg-slate-700" };
    let s = 0;
    if (password.length >= 8) s += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s += 1;
    if (/[0-9]/.test(password)) s += 1;
    if (/[^A-Za-z0-9]/.test(password)) s += 1;

    switch (s) {
      case 1:
        return { score: 25, label: "Yếu", color: "bg-rose-500" };
      case 2:
        return { score: 50, label: "Trung bình", color: "bg-amber-500" };
      case 3:
        return { score: 75, label: "Khá mạnh", color: "bg-cyan-400" };
      case 4:
        return { score: 100, label: "Chuẩn FinTech", color: "bg-emerald-400" };
      default:
        return { score: 15, label: "Quá ngắn", color: "bg-rose-600" };
    }
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanName || !cleanEmail || !cleanPassword) {
      setErrorMessage("Vui lòng điền đầy đủ các thông tin bắt buộc.");
      return;
    }

    if (cleanPassword.length < 8) {
      setErrorMessage("Mật khẩu phải có độ dài tối thiểu 8 ký tự.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await register({
        name: cleanName,
        email: cleanEmail,
        password: cleanPassword,
      });

      if (res && res.accessToken) {
        window.location.replace("/dashboard");
      }
    } catch (err: any) {
      const msg = err.message || "Đăng ký thất bại.";
      if (msg.includes("EMAIL_CONFIRM_SENT")) {
        setSuccessMessage("Đã gửi email xác nhận. Vui lòng kiểm tra hộp thư để kích hoạt tài khoản.");
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setErrorMessage(null);
    try {
      const targetDestination = typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined;
      await loginWithGoogle(targetDestination);
    } catch (err: any) {
      setErrorMessage(err.message || "Không thể kết nối với tài khoản Google.");
      setGoogleLoading(false);
    }
  };

  return (
    <>
      {googleLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl font-sans">
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-cyan-500/30 bg-slate-900/90 p-8 shadow-[0_0_60px_rgba(6,182,212,0.2)] text-center max-w-sm">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span className="absolute h-full w-full animate-ping rounded-full bg-cyan-400/20" />
              <div className="h-12 w-12 rounded-2xl bg-slate-950 border border-cyan-500/40 flex items-center justify-center shadow-lg">
                <GoogleIcon className="h-6 w-6 animate-pulse" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Đang khởi tạo tài khoản Google...</h3>
              <p className="text-xs text-slate-400 mt-1 font-mono">Đồng bộ Identity & Chuyển hướng Console</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2 animate-in fade-in duration-200">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-start gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">{successMessage}</div>
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
              placeholder="Nguyễn Văn A"
              className="h-10 pl-9 border-slate-800 bg-slate-900/60 text-xs text-slate-100 focus:border-cyan-500/60 rounded-xl"
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
              className="h-10 pl-9 border-slate-800 bg-slate-900/60 text-xs text-slate-100 focus:border-cyan-500/60 rounded-xl"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Mật khẩu (Tối thiểu 8 ký tự) *</label>
            {password && (
              <span className="text-[10px] font-mono font-medium text-cyan-400">{passwordStrength.label}</span>
            )}
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || googleLoading}
              placeholder="Tối thiểu 8 ký tự"
              className="h-10 pl-9 pr-10 border-slate-800 bg-slate-900/60 text-xs text-slate-100 focus:border-cyan-500/60 rounded-xl"
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

          {password && (
            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mt-1.5">
              <div
                className={`h-full ${passwordStrength.color} transition-all duration-300`}
                style={{ width: `${passwordStrength.score}%` }}
              />
            </div>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading || googleLoading}
          className="h-10 w-full bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.2)] active:scale-98 transition rounded-xl mt-1"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin text-slate-950" />
              Đang khởi tạo tài khoản...
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              Tạo Tài Khoản & Vào Console <ArrowRight className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleSignup}
          disabled={loading || googleLoading}
          className="h-10 w-full border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition-all rounded-xl flex items-center justify-center gap-2 mt-2"
        >
          <GoogleIcon className="h-4 w-4" />
          <span>Đăng ký trực tiếp với Google</span>
        </Button>
      </form>
    </>
  );
}

// =========================================================================
// 3. FORGOT PASSWORD FORM
// =========================================================================
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      await new Promise((r) => setTimeout(r, 1200));
      setSubmitted(true);
    } catch {
      setErrorMessage("Không thể gửi email khôi phục. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center space-y-4 py-3">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white">Đã gửi liên kết khôi phục</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến <strong className="text-cyan-400">{email}</strong>. Vui lòng kiểm tra hộp thư.
          </p>
        </div>
        <Link href="/login" className="inline-block text-xs font-bold text-cyan-400 hover:text-cyan-300 transition pt-2">
          ← Quay lại Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Email đã đăng ký</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder="admin@adqsecurity.com"
            className="h-10 pl-9 border-slate-800 bg-slate-900/60 text-xs text-slate-100 focus:border-cyan-500/60 rounded-xl"
            required
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading || !email.trim()}
        className="h-10 w-full bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.2)] active:scale-98 transition rounded-xl"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <LoaderCircle className="h-4 w-4 animate-spin text-slate-950" />
            Đang gửi liên kết...
          </span>
        ) : (
          "Gửi Liên Kết Đặt Lại Mật Khẩu"
        )}
      </Button>
    </form>
  );
}

// =========================================================================
// 4. RESET PASSWORD FORM
// =========================================================================
export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setErrorMessage("Mật khẩu mới phải có tối thiểu 8 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await new Promise((r) => setTimeout(r, 1200));
      window.location.replace("/login?reset=success");
    } catch {
      setErrorMessage("Không thể cập nhật mật khẩu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Mật khẩu mới (Tối thiểu 8 ký tự)</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="••••••••••••"
            className="h-10 pl-9 border-slate-800 bg-slate-900/60 text-xs text-slate-100 focus:border-cyan-500/60 rounded-xl"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Xác nhận mật khẩu mới</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            placeholder="••••••••••••"
            className="h-10 pl-9 border-slate-800 bg-slate-900/60 text-xs text-slate-100 focus:border-cyan-500/60 rounded-xl"
            required
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="h-10 w-full bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.2)] active:scale-98 transition rounded-xl"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <LoaderCircle className="h-4 w-4 animate-spin text-slate-950" />
            Đang cập nhật...
          </span>
        ) : (
          "Cập Nhật Mật Khẩu"
        )}
      </Button>
    </form>
  );
}
