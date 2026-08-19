"use client";

import React, { useState, useEffect } from "react";
import {
  Globe2,
  KeyRound,
  Lock,
  Mail,
  UserRound,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Copy,
  Check,
  Bell,
  ShieldCheck,
  LogOut,
  Send,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsClient() {
  const { user, updateUser, logout } = useAuth();

  // State Profile
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // State Password
  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [passLoading, setPassLoading] = useState(false);
  const [passStatus, setPassStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // State API Token
  const [apiToken, setApiToken] = useState("");
  const [tokenCopied, setTokenCopied] = useState(false);

  // State Webhook Notification
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSaved, setWebhookSaved] = useState(false);

  // Đồng bộ dữ liệu khi user nạp xong
  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || "",
        email: user.email || "",
        company: (user as any).company || "NQ SECURITY Labs",
        phone: (user as any).phone || "",
      });
    }

    if (typeof window !== "undefined") {
      const savedWebhook = localStorage.getItem("adq_webhook_url") || "";
      setWebhookUrl(savedWebhook);

      // Lấy token Supabase hiện tại làm API Key
      const supabase = createSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.access_token) {
          setApiToken(data.session.access_token);
        }
      });
    }
  }, [user]);

  // 1. Xử lý Lưu Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        data: {
          name: profile.name.trim(),
          full_name: profile.name.trim(),
          company: profile.company.trim(),
          phone: profile.phone.trim(),
        },
      });

      if (error) throw error;

      updateUser({
        name: profile.name.trim(),
        ...({ company: profile.company.trim(), phone: profile.phone.trim() } as any),
      });

      setProfileStatus({ type: "success", msg: "Cập nhật thông tin hồ sơ thành công!" });
    } catch (err: any) {
      setProfileStatus({ type: "error", msg: err.message || "Lỗi cập nhật hồ sơ." });
    } finally {
      setProfileLoading(false);
    }
  };

  // 2. Xử lý Đổi Mật Khẩu
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassStatus(null);

    if (passwords.newPassword.length < 6) {
      setPassStatus({ type: "error", msg: "Mật khẩu mới phải có ít nhất 6 ký tự." });
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPassStatus({ type: "error", msg: "Xác nhận mật khẩu không khớp." });
      return;
    }

    setPassLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        password: passwords.newPassword,
      });

      if (error) throw error;

      setPassStatus({ type: "success", msg: "Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới." });
      setPasswords({ newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      setPassStatus({ type: "error", msg: err.message || "Không thể đổi mật khẩu." });
    } finally {
      setPassLoading(false);
    }
  };

  // 3. Xử lý Lưu Webhook
  const handleSaveWebhook = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("adq_webhook_url", webhookUrl.trim());
      setWebhookSaved(true);
      setTimeout(() => setWebhookSaved(false), 2500);
    }
  };

  // 4. Sao chép API Token
  const handleCopyToken = () => {
    if (!apiToken) return;
    navigator.clipboard.writeText(apiToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  const accountSummary = [
    { label: "Trạng thái", value: user?.status ?? "ACTIVE", tone: "success" },
    { label: "Gói cước", value: user?.packageTier?.replace("_", " ") ?? "FREE", tone: "default" },
    { label: "Xác thực OAuth", value: user?.oauthProvider === "google" ? "Google Account" : "Email & Password", tone: "muted" },
  ];

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 max-w-7xl mx-auto font-sans text-slate-100">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_380px]">
          {/* CỘT TRÁI: FORM CÀI ĐẶT */}
          <div className="space-y-6">
            {/* 1. Form Cài Đặt Hồ Sơ */}
            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
              <div className="mb-5 flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400">Tài khoản & Cá nhân</p>
                  <h2 className="text-xl font-bold tracking-tight text-white mt-0.5">Cài đặt hồ sơ</h2>
                </div>
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-semibold px-3 py-1">
                  Đã xác thực
                </Badge>
              </div>

              {profileStatus && (
                <div
                  className={`mb-4 p-3 rounded-xl flex items-center gap-2 text-xs border ${
                    profileStatus.type === "success"
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                  }`}
                >
                  {profileStatus.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>{profileStatus.msg}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-lg font-bold">
                    {(profile.name || user?.name || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-white">{profile.name || user?.name || "Người dùng"}</p>
                    <p className="truncate text-xs font-mono text-slate-400">{user?.email}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-semibold uppercase text-slate-400">
                      Tên hiển thị
                    </Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input
                        id="name"
                        value={profile.name}
                        onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                        className="h-10 border-slate-800 bg-slate-950/80 pl-9 text-xs text-white focus:border-cyan-500/60 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="company" className="text-xs font-semibold uppercase text-slate-400">
                      Công ty / Đơn vị
                    </Label>
                    <div className="relative">
                      <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input
                        id="company"
                        value={profile.company}
                        onChange={(e) => setProfile((prev) => ({ ...prev, company: e.target.value }))}
                        className="h-10 border-slate-800 bg-slate-950/80 pl-9 text-xs text-white focus:border-cyan-500/60 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold uppercase text-slate-400">
                      Email (Được quản lý bởi Auth)
                    </Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        disabled
                        className="h-10 border-slate-800/60 bg-slate-950/40 pl-9 text-xs text-slate-400 rounded-xl cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold uppercase text-slate-400">
                      Số điện thoại
                    </Label>
                    <div className="relative">
                      <Fingerprint className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input
                        id="phone"
                        value={profile.phone}
                        onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
                        placeholder="+84 912 345 678"
                        className="h-10 border-slate-800 bg-slate-950/80 pl-9 text-xs text-white focus:border-cyan-500/60 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <Button
                    type="submit"
                    disabled={profileLoading}
                    className="h-10 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl px-5 flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-950/50"
                  >
                    {profileLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    {profileLoading ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                </div>
              </form>
            </section>

            {/* 2. Form Đổi Mật Khẩu */}
            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Mật khẩu & Bảo mật</h3>
                  <p className="text-xs text-slate-400">Cập nhật mật khẩu tài khoản để tăng cường an toàn.</p>
                </div>
              </div>

              {passStatus && (
                <div
                  className={`mb-4 p-3 rounded-xl flex items-center gap-2 text-xs border ${
                    passStatus.type === "success"
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                  }`}
                >
                  {passStatus.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>{passStatus.msg}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-xs font-semibold uppercase text-slate-400">
                      Mật khẩu mới
                    </Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={passwords.newPassword}
                      onChange={(e) => setPasswords((prev) => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Tối thiểu 6 ký tự"
                      className="h-10 border-slate-800 bg-slate-950/80 text-xs text-white focus:border-cyan-500/60 rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="text-xs font-semibold uppercase text-slate-400">
                      Xác nhận mật khẩu
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={passwords.confirmPassword}
                      onChange={(e) => setPasswords((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Nhập lại mật khẩu"
                      className="h-10 border-slate-800 bg-slate-950/80 text-xs text-white focus:border-cyan-500/60 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={passLoading || !passwords.newPassword}
                  className="h-10 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-xl px-5 flex items-center gap-2 cursor-pointer"
                >
                  {passLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  {passLoading ? "Đang cập nhật..." : "Đổi mật khẩu"}
                </Button>
              </form>
            </section>

            {/* 3. Cấu hình Webhook thông báo SOC */}
            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Webhook Cảnh Báo SOC</h3>
                  <p className="text-xs text-slate-400">Nhận cảnh báo lỗ hổng nghiêm trọng về Telegram / Discord / Slack bot.</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="webhook" className="text-xs font-semibold uppercase text-slate-400">
                  Webhook URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="webhook"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/... hoặc Telegram Bot webhook"
                    className="h-10 border-slate-800 bg-slate-950/80 text-xs text-white focus:border-cyan-500/60 rounded-xl flex-1"
                  />
                  <Button
                    onClick={handleSaveWebhook}
                    className="h-10 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl px-4 flex items-center gap-1.5 cursor-pointer"
                  >
                    {webhookSaved ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    {webhookSaved ? "Đã lưu" : "Lưu Webhook"}
                  </Button>
                </div>
              </div>
            </section>
          </div>

          {/* CỘT PHẢI: QUYỀN HẠN & API TOKEN */}
          <div className="space-y-6">
            {/* Thông tin gói & trạng thái */}
            <aside className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-xl">
              <div className="mb-4 border-b border-slate-800 pb-3">
                <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Hạn mức tài khoản</h3>
                <p className="text-xl font-bold text-white mt-1">Thông tin giấy phép</p>
              </div>

              <div className="space-y-2.5">
                {accountSummary.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 px-3.5 py-2.5">
                    <span className="text-xs text-slate-400">{item.label}</span>
                    <Badge
                      variant={item.tone === "success" ? "success" : item.tone === "default" ? "default" : "outline"}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] font-mono uppercase"
                    >
                      {item.value}
                    </Badge>
                  </div>
                ))}
              </div>
            </aside>

            {/* Quản lý Personal API Token */}
            <aside className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-xl">
              <div className="mb-3 border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-[10px] font-mono uppercase tracking-widest text-cyan-400">Developer API</h3>
                  <p className="text-base font-bold text-white mt-0.5">Personal Access Token</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyToken}
                  className="h-8 border-slate-800 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 rounded-lg cursor-pointer"
                >
                  {tokenCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {tokenCopied ? "Đã copy" : "Sao chép"}
                </Button>
              </div>

              <p className="text-xs text-slate-400 mb-3">
                Dùng token này làm Bearer Header để gọi API tự động hóa quét DAST từ CI/CD hoặc Python CLI.
              </p>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[10px] text-slate-400 break-all select-all">
                {apiToken ? `${apiToken.slice(0, 48)}...` : "Đang nạp access token..."}
              </div>
            </aside>

            {/* Nút Đăng xuất an toàn */}
            <aside className="rounded-2xl border border-rose-900/40 bg-rose-950/10 p-5 backdrop-blur-xl">
              <h3 className="text-sm font-bold text-rose-300">Phiên làm việc</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">Đăng xuất tài khoản khỏi trình duyệt này.</p>
              <Button
                onClick={() => logout()}
                variant="outline"
                className="w-full h-10 border-rose-800/60 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="h-4 w-4" /> Đăng xuất phiên làm việc
              </Button>
            </aside>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
