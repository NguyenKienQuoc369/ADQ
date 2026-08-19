"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  KeyRound,
  Lock,
  Mail,
  UserRound,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  ShieldCheck,
  LogOut,
  Camera,
  Headphones,
  Code2,
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // State Profile
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    avatarUrl: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // State Password
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passLoading, setPassLoading] = useState(false);
  const [passStatus, setPassStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // State Modal Hỗ Trợ Developer
  const [showSupportModal, setShowSupportModal] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || "",
        email: user.email || "",
        phone: (user as any).phone || "",
        avatarUrl: user.avatar || (user as any).avatar_url || "",
      });
    }
  }, [user]);

  // 1. Xử lý Upload Avatar
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileStatus({ type: "error", msg: "Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP)." });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setProfileStatus({ type: "error", msg: "Kích thước ảnh tối đa là 2MB." });
      return;
    }

    setAvatarUploading(true);
    setProfileStatus(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Url = reader.result as string;
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.updateUser({
          data: {
            avatar_url: base64Url,
            picture: base64Url,
          },
        });

        if (error) throw error;

        setProfile((prev) => ({ ...prev, avatarUrl: base64Url }));
        updateUser({ avatar: base64Url });
        setProfileStatus({ type: "success", msg: "Cập nhật ảnh đại diện thành công!" });
        setAvatarUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setProfileStatus({ type: "error", msg: err.message || "Không thể tải lên ảnh đại diện." });
      setAvatarUploading(false);
    }
  };

  // 2. Xử lý Lưu Profile
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
          phone: profile.phone.trim(),
        },
      });

      if (error) throw error;

      updateUser({
        name: profile.name.trim(),
        ...({ phone: profile.phone.trim() } as any),
      });

      setProfileStatus({ type: "success", msg: "Cập nhật thông tin hồ sơ thành công!" });
    } catch (err: any) {
      setProfileStatus({ type: "error", msg: err.message || "Lỗi cập nhật hồ sơ." });
    } finally {
      setProfileLoading(false);
    }
  };

  // 3. Xử lý Đổi Mật Khẩu (Xác thực mật khẩu hiện tại trước)
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassStatus(null);

    if (!passwords.currentPassword) {
      setPassStatus({ type: "error", msg: "Vui lòng nhập mật khẩu hiện tại của bạn." });
      return;
    }

    if (passwords.newPassword.length < 6) {
      setPassStatus({ type: "error", msg: "Mật khẩu mới phải có ít nhất 6 ký tự." });
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPassStatus({ type: "error", msg: "Xác nhận mật khẩu mới không khớp." });
      return;
    }

    if (passwords.currentPassword === passwords.newPassword) {
      setPassStatus({ type: "error", msg: "Mật khẩu mới không được trùng với mật khẩu hiện tại." });
      return;
    }

    setPassLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // Bước 3.1: Xác thực mật khẩu cũ
      const userEmail = user?.email || profile.email;
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: passwords.currentPassword,
      });

      if (verifyError) {
        setPassStatus({ type: "error", msg: "Mật khẩu hiện tại không chính xác. Vui lòng kiểm tra lại." });
        setPassLoading(false);
        return;
      }

      // Bước 3.2: Cập nhật mật khẩu mới khi mật khẩu cũ đã chính xác
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwords.newPassword,
      });

      if (updateError) throw updateError;

      setPassStatus({ type: "success", msg: "Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới của bạn." });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      setPassStatus({ type: "error", msg: err.message || "Không thể cập nhật mật khẩu." });
    } finally {
      setPassLoading(false);
    }
  };

  const accountSummary: { label: string; value: string; tone: "success" | "default" | "muted" }[] = [
    { label: "Trạng thái", value: user?.status ?? "ACTIVE", tone: "success" },
    { label: "Gói cước", value: user?.packageTier?.replace("_", " ") ?? "FREE", tone: "default" },
    { label: "Xác thực", value: user?.oauthProvider === "google" ? "Google OAuth" : "Email & Password", tone: "muted" },
  ];

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 max-w-7xl mx-auto font-sans text-slate-100">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_380px]">
          {/* CỘT TRÁI: HỒ SƠ & ĐỔI MẬT KHẨU */}
          <div className="space-y-6">
            {/* 1. Form Cài Đặt Hồ Sơ & Thay Avatar */}
            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
              <div className="mb-5 flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400">Tài khoản & Cá nhân</p>
                  <h2 className="text-xl font-bold tracking-tight text-white mt-0.5">Cài đặt hồ sơ</h2>
                </div>
                <Badge variant="success" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-semibold px-3 py-1">
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

              {/* Phần Avatar */}
              <div className="mb-6 flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <div className="relative group">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl overflow-hidden bg-cyan-500/10 text-cyan-400 border-2 border-cyan-500/30 text-2xl font-bold shadow-lg shadow-cyan-950/40">
                    {profile.avatarUrl ? (
                      <img src={profile.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      (profile.name || user?.name || "U").slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute -bottom-1.5 -right-1.5 p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg cursor-pointer transition active:scale-95"
                    title="Thay đổi ảnh đại diện"
                  >
                    {avatarUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4 font-bold" />}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>

                <div className="min-w-0 flex-1 text-center sm:text-left space-y-1">
                  <p className="text-lg font-bold text-white truncate">{profile.name || user?.name || "Người dùng"}</p>
                  <p className="text-xs font-mono text-slate-400 truncate">{user?.email}</p>
                  <p className="text-[11px] text-slate-500">Hỗ trợ JPG, PNG, WEBP (Tối đa 2MB).</p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="shrink-0 h-9 border-slate-800 hover:border-cyan-500/50 bg-slate-900 text-xs font-semibold text-slate-200 rounded-xl flex items-center gap-1.5"
                >
                  <Camera className="h-3.5 w-3.5 text-cyan-400" />
                  {avatarUploading ? "Đang tải ảnh..." : "Đổi avatar"}
                </Button>
              </div>

              {/* Form Thông tin */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
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

                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="email" className="text-xs font-semibold uppercase text-slate-400">
                      Email đăng nhập (Cố định bởi Auth)
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

            {/* 2. Form Đổi Mật Khẩu có Xác thực Mật khẩu hiện tại */}
            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Mật khẩu & Bảo mật</h3>
                  <p className="text-xs text-slate-400">Cần nhập chính xác mật khẩu hiện tại để đổi mật khẩu mới.</p>
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
                <div className="space-y-1.5">
                  <Label htmlFor="current-password" className="text-xs font-semibold uppercase text-slate-400">
                    Mật khẩu hiện tại *
                  </Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(e) => setPasswords((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="Nhập mật khẩu đang dùng để xác thực"
                    className="h-10 border-slate-800 bg-slate-950/80 text-xs text-white focus:border-cyan-500/60 rounded-xl"
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-xs font-semibold uppercase text-slate-400">
                      Mật khẩu mới *
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
                      Xác nhận mật khẩu mới *
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={passwords.confirmPassword}
                      onChange={(e) => setPasswords((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Nhập lại mật khẩu mới"
                      className="h-10 border-slate-800 bg-slate-950/80 text-xs text-white focus:border-cyan-500/60 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={passLoading || !passwords.currentPassword || !passwords.newPassword}
                  className="h-10 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-xl px-5 flex items-center gap-2 cursor-pointer"
                >
                  {passLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  {passLoading ? "Đang xác thực & cập nhật..." : "Đổi mật khẩu"}
                </Button>
              </form>
            </section>
          </div>

          {/* CỘT PHẢI: THÔNG TIN TÀI KHOẢN & HỖ TRỢ */}
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
                      variant={item.tone}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] font-mono uppercase"
                    >
                      {item.value}
                    </Badge>
                  </div>
                ))}
              </div>
            </aside>

            {/* Card Hỗ Trợ Trực Tiếp Từ Developer */}
            <aside className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5 backdrop-blur-xl shadow-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  <Headphones className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Trung Tâm Hỗ Trợ</h3>
                  <p className="text-[11px] text-slate-400">Liên hệ trực tiếp với Developer</p>
                </div>
              </div>
              <p className="text-xs text-slate-300">
                Gặp sự cố quét DAST, lỗi license hoặc cần tư vấn tích hợp hệ thống SOC?
              </p>
              <Button
                type="button"
                onClick={() => setShowSupportModal(true)}
                className="w-full h-10 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-950/60"
              >
                <Code2 className="h-4 w-4" /> Liên hệ Developer
              </Button>
            </aside>

            {/* Nút Đăng xuất */}
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

        {/* Modal Thông Tin Hỗ Trợ Developer */}
        {showSupportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowSupportModal(false)} />
            <div className="relative z-10 w-full max-w-md rounded-2xl border border-cyan-500/40 bg-slate-900 p-6 shadow-2xl space-y-5 text-slate-100">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                    <Code2 className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-base text-white">Thông Tin Developer & SOC Lead</h3>
                </div>
                <button onClick={() => setShowSupportModal(false)} className="text-slate-400 hover:text-white p-1">
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                  <p className="text-[10px] font-mono uppercase text-slate-500">Nhà phát triển / Developer</p>
                  <p className="font-bold text-sm text-cyan-300">Nguyễn Kiến Quốc</p>
                  <p className="text-slate-400">Lead Security Engineer & System Architect</p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Email Hỗ trợ:</span>
                    <a href="mailto:kienquocn64@gmail.com" className="font-mono text-cyan-400 hover:underline">
                      kienquocn64@gmail.com
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Hệ thống:</span>
                    <span className="font-semibold text-emerald-400">ADQ Security Operations Center</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Thời gian phản hồi:</span>
                    <span className="text-slate-200 font-mono">Dưới 15 phút (24/7)</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <a
                  href="mailto:kienquocn64@gmail.com?subject=[ADQ Support] Yêu cầu hỗ trợ kỹ thuật"
                  className="flex-1 h-10 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-950/60"
                >
                  <Mail className="h-4 w-4" /> Gửi Email Hỗ Trợ
                </a>
                <Button variant="outline" onClick={() => setShowSupportModal(false)} className="h-10 border-slate-800 text-xs">
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
