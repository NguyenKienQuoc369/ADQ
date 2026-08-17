"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, CheckCircle2, KeyRound, LoaderCircle, Lock, Mail, User2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/components/providers/auth-provider";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function FormAlert({
  type,
  message,
}: {
  type: "error" | "success";
  message: string;
}) {
  const Icon = type === "error" ? AlertCircle : CheckCircle2;

  return (
    <div
      className={`mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
        type === "error"
          ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-100"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100"
      }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

function FieldError({ message }: { message?: unknown }) {
  const text = typeof message === "string" ? message : message ? String(message) : "";
  if (!text) return null;
  return <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{text}</p>;
}

function routeAfterLogin(role: "USER" | "ADMIN") {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ."),
  password: z.string().min(6, "Mật khẩu cần ít nhất 6 ký tự."),
});

const registerSchema = z
  .object({
    name: z.string().min(2, "Họ tên cần ít nhất 2 ký tự."),
    email: z.string().email("Email không hợp lệ."),
    password: z.string().min(8, "Mật khẩu cần ít nhất 8 ký tự."),
    confirmPassword: z.string().min(8, "Vui lòng nhập lại mật khẩu."),
    company: z.string().optional(),
    phone: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu nhập lại không khớp.",
    path: ["confirmPassword"],
  });

const googleOnboardingSchema = z.object({
  name: z.string().min(2, "Họ tên cần ít nhất 2 ký tự."),
  email: z.string().email("Email không hợp lệ."),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
});

const emailSchema = z.object({
  email: z.string().email("Email không hợp lệ."),
});

const resetSchema = z
  .object({
    token: z.string().min(6, "Token khôi phục không hợp lệ."),
    password: z.string().min(8, "Mật khẩu mới cần ít nhất 8 ký tự."),
    confirmPassword: z.string().min(8, "Vui lòng nhập lại mật khẩu."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu nhập lại không khớp.",
    path: ["confirmPassword"],
  });

export function LoginForm() {
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setMessage(null);
    try {
      const session = await login(values.email, values.password);
      setMessage({ type: "success", text: "Đăng nhập thành công. Đang chuyển vào secure workspace..." });
      router.push(routeAfterLogin(session.user.role));
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Đăng nhập thất bại.",
      });
    } finally {
      setSubmitting(false);
    }
  });

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const session = await loginWithGoogle();
      setMessage({ type: "success", text: "Xác thực Google thành công." });
      router.push(routeAfterLogin(session.user.role));
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể đăng nhập bằng Google.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isGoogleLoading = submitting;
  const isLoginLoading = submitting;

  const GoogleMark = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.4-1.6 4.1-5.4 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 4 1.5l2.7-2.6C16.9 3.5 14.7 2.6 12 2.6 6.7 2.6 2.4 6.9 2.4 12S6.7 21.4 12 21.4c6.9 0 11.5-4.8 11.5-11.6 0-.8-.1-1.4-.2-2H12Z"
      />
      <path fill="#34A853" d="M3.9 7.3l3.5 2.6c.9-1.8 2.9-3 5.1-3 1.9 0 3.2.8 4 1.5l2.7-2.6C16.9 3.5 14.7 2.6 12 2.6c-3.5 0-6.4 2-8.1 4.7Z" />
      <path fill="#FBBC05" d="M3.9 16.7c1.8 3.5 5.3 5.7 8.1 5.7 2.4 0 4.4-.9 5.8-2.4l-2.7-2.2c-.8.6-1.9 1-3.1 1-2.3 0-4.2-1.5-4.8-3.5l-3.8 2.9Z" />
      <path fill="#4285F4" d="M12 19.4c1.8 0 3.4-.6 4.7-1.7l2.7 2.2c-1.9 1.9-4.6 3-7.4 3-4.8 0-8.9-3.2-10.3-7.5l3.8-2.9c.6 2 2.5 3.5 4.8 3.5Z" />
    </svg>
  );

  return (
    <AuthShell
      title="Đăng nhập"
      description="Đăng nhập bằng email hoặc Google để truy cập workspace bảo mật của bạn."
    >
      {message ? <FormAlert type={message.type} message={message.text} /> : null}

      <form className="space-y-5" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="email">Email</Label>
          <div className="relative mt-2">
            <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--foreground-muted)]" />
            <Input id="email" className="pl-10" placeholder="you@company.com" {...form.register("email")} />
          </div>
          <FieldError message={form.formState.errors.email?.message} />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mật khẩu</Label>
            <Link href="/forgot-password" className="text-xs text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200">
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative mt-2">
            <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--foreground-muted)]" />
            <Input id="password" type="password" className="pl-10" placeholder="••••••••" {...form.register("password")} />
          </div>
          <FieldError message={form.formState.errors.password?.message} />
        </div>

        <Button className="w-full" type="submit" disabled={isLoginLoading}>
          {isLoginLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {isLoginLoading ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--line)]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[var(--background-elevated)] px-3 text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
              Hoặc
            </span>
          </div>
        </div>

        <Button
          className="w-full border-[var(--line)] bg-[var(--background-elevated)] text-[var(--foreground)] shadow-sm hover:bg-[var(--background-muted)] dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
          type="button"
          variant="secondary"
          disabled={isGoogleLoading}
          onClick={handleGoogleLogin}
        >
          {isGoogleLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <GoogleMark />}
          {isGoogleLoading ? "Đang chuyển hướng đến Google..." : "Đăng nhập bằng Google"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--foreground-muted)]">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200">
          Tạo tài khoản mới
        </Link>
      </p>
    </AuthShell>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, register: registerAccount, completeGoogleProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const isGoogleOnboarding = searchParams.get("oauth") === "google";
  const googleEmail = searchParams.get("email") ?? user?.email ?? "";

  const form = useForm<any>({
    resolver: zodResolver(isGoogleOnboarding ? googleOnboardingSchema : registerSchema),
    defaultValues: {
      name: "",
      email: googleEmail,
      password: "",
      confirmPassword: "",
      company: "",
      phone: "",
    },
  });
  const emailValue = form.watch("email") || googleEmail;

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setMessage(null);
    try {
      if (isGoogleOnboarding) {
        await completeGoogleProfile({
          name: values.name,
          company: values.company,
          phone: values.phone,
        });
        setMessage({ type: "success", text: "Tài khoản Google đã được xác thực và hồ sơ của bạn đã được hoàn tất." });
        window.setTimeout(() => router.push("/dashboard"), 600);
        return;
      }

      await registerAccount({
        name: values.name,
        email: values.email,
        password: values.password,
        company: values.company,
        phone: values.phone,
      });
      setMessage({ type: "success", text: "Tài khoản đã được tạo. Đang chuyển tới dashboard..." });
      router.push("/dashboard");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Không thể tạo tài khoản.";
      if (typeof msg === 'string' && msg.startsWith('EMAIL_CONFIRM_SENT')) {
        const cleanMsg = msg.replace('EMAIL_CONFIRM_SENT: ', '');
        setMessage({ type: 'success', text: cleanMsg });
        const email = values.email.trim();
        window.setTimeout(() => router.push(`/confirm-email?email=${encodeURIComponent(email)}`), 1000);
      } else {
        setMessage({ type: 'error', text: msg });
      }
    } finally {
      setSubmitting(false);
    }
  });

  const isRegisterLoading = submitting;

  return (
    <AuthShell
      title={isGoogleOnboarding ? "Hoàn tất hồ sơ Google" : "Tạo tài khoản"}
      description={
        isGoogleOnboarding
          ? "Google đã xác thực email của bạn. Vui lòng điền thông tin bổ sung để hoàn tất thiết lập tài khoản và bắt đầu quản lý bảo mật."
          : "Tạo tài khoản để bắt đầu quản lý bảo mật website và theo dõi các rủi ro hiệu quả."
      }
    >
      {message ? <FormAlert type={message.type} message={message.text} /> : null}

      <form className="space-y-5" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="name">Họ và tên</Label>
          <div className="relative mt-2">
            <User2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--foreground-muted)]" />
            <Input id="name" className="pl-10" placeholder="Nguyễn Văn A" {...form.register("name")} />
          </div>
          <FieldError message={form.formState.errors.name?.message} />
        </div>

        <div>
          <Label htmlFor="company">Công ty (tùy chọn)</Label>
          <div className="relative mt-2">
            <Input id="company" className="pl-3" placeholder="Công ty / Tổ chức" {...form.register("company")} />
          </div>
          <FieldError message={form.formState.errors.company?.message} />
        </div>

        <div>
          <Label htmlFor="phone">Số điện thoại (tùy chọn)</Label>
          <div className="relative mt-2">
            <Input id="phone" className="pl-3" placeholder="+84 9xx xxx xxx" {...form.register("phone")} />
          </div>
          <FieldError message={form.formState.errors.phone?.message} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label htmlFor="register-email">Email</Label>
            {isGoogleOnboarding ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
                Đã xác thực Google
              </span>
            ) : null}
          </div>
          <div className="relative mt-2">
            <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--foreground-muted)]" />
            <Input
              id="register-email"
              className="pl-10 disabled:cursor-default disabled:opacity-100"
              placeholder="security@company.com"
              value={emailValue}
              readOnly={isGoogleOnboarding}
              {...form.register("email")}
            />
          </div>
          <FieldError message={form.formState.errors.email?.message} />
        </div>

        {!isGoogleOnboarding ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="register-password">Mật khẩu</Label>
              <div className="relative mt-2">
                <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--foreground-muted)]" />
                <Input
                  id="register-password"
                  type="password"
                  className="pl-10"
                  placeholder="Tối thiểu 8 ký tự"
                  {...form.register("password")}
                />
              </div>
              <FieldError message={form.formState.errors.password?.message} />
            </div>

            <div>
              <Label htmlFor="confirm-password">Nhập lại mật khẩu</Label>
              <div className="relative mt-2">
                <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--foreground-muted)]" />
                <Input
                  id="confirm-password"
                  type="password"
                  className="pl-10"
                  placeholder="Nhập lại mật khẩu"
                  {...form.register("confirmPassword")}
                />
              </div>
              <FieldError message={form.formState.errors.confirmPassword?.message} />
            </div>
          </div>
        ) : null}

        <Button className="w-full" type="submit" disabled={isRegisterLoading}>
          {isRegisterLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {isRegisterLoading ? (isGoogleOnboarding ? "Đang hoàn tất hồ sơ..." : "Đang tạo tài khoản...") : isGoogleOnboarding ? "Hoàn tất hồ sơ" : "Tạo tài khoản"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--foreground-muted)]">
        {isGoogleOnboarding ? "Muốn dùng email và mật khẩu khác?" : "Đã có tài khoản?"}{" "}
        <Link href="/login" className="font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200">
          {isGoogleOnboarding ? "Quay lại đăng nhập" : "Đăng nhập ngay"}
        </Link>
      </p>
    </AuthShell>
  );
}

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setMessage(null);
    try {
      const api = await import("@/lib/api");
      const response = await api.forgotPassword(values.email);
      setMessage({ type: "success", text: response.message });
      form.reset();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể gửi email khôi phục.",
      });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthShell
      title="Khôi phục mật khẩu"
      description="Nhập email để nhận liên kết reset và khôi phục truy cập vào workspace bảo mật."
    >
      {message ? <FormAlert type={message.type} message={message.text} /> : null}

      <form className="space-y-5" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="forgot-email">Email đăng ký</Label>
          <div className="relative mt-2">
            <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--foreground-muted)]" />
            <Input id="forgot-email" className="pl-10" placeholder="security@company.com" {...form.register("email")} />
          </div>
          <FieldError message={form.formState.errors.email?.message} />
        </div>

        <Button className="w-full" type="submit" disabled={submitting}>
          {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Gửi liên kết khôi phục
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--foreground-muted)]">
        Quay lại{" "}
        <Link href="/login" className="font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200">
          đăng nhập
        </Link>
      </p>
    </AuthShell>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialToken = useMemo(() => searchParams.get("token") ?? "demo-reset-token", [searchParams]);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      token: initialToken,
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setMessage(null);
    try {
      const api = await import("@/lib/api");
      const response = await api.resetPassword(values.token, values.password);
      setMessage({ type: "success", text: response.message });
      window.setTimeout(() => router.push("/login"), 800);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể đặt lại mật khẩu.",
      });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthShell
      title="Đặt lại mật khẩu"
      description="Thiết lập mật khẩu mới cho JWT session và tiếp tục truy cập dashboard."
    >
      {message ? <FormAlert type={message.type} message={message.text} /> : null}

      <form className="space-y-5" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="reset-token">Reset token</Label>
          <Input id="reset-token" className="mt-2" {...form.register("token")} />
          <FieldError message={form.formState.errors.token?.message} />
        </div>

        <div>
          <Label htmlFor="new-password">Mật khẩu mới</Label>
          <Input
            id="new-password"
            type="password"
            className="mt-2"
            placeholder="Tối thiểu 8 ký tự"
            {...form.register("password")}
          />
          <FieldError message={form.formState.errors.password?.message} />
        </div>

        <div>
          <Label htmlFor="new-password-confirm">Nhập lại mật khẩu mới</Label>
          <Input
            id="new-password-confirm"
            type="password"
            className="mt-2"
            placeholder="Nhập lại mật khẩu"
            {...form.register("confirmPassword")}
          />
          <FieldError message={form.formState.errors.confirmPassword?.message} />
        </div>

        <Button className="w-full" type="submit" disabled={submitting}>
          {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Cập nhật mật khẩu
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--foreground-muted)]">
        <Link href="/login" className="font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200">
          Trở lại đăng nhập
        </Link>
      </p>
    </AuthShell>
  );
}
