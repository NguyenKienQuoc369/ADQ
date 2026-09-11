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
import { maskEmail, resizeImageToBase64 } from "@/lib/utils";
import {
  UserAvatar,
  getCanonicalDisplayName,
  getCanonicalAvatarUrl,
  getCanonicalPackageTier,
} from "@/components/ui/user-avatar";

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
        name: getCanonicalDisplayName(user),
        email: user.email || "",
        phone: (user as any).phone || "",
        avatarUrl: getCanonicalAvatarUrl(user) || "",
      });
    }
  }, [user]);

  // 1. Xử lý Upload Avatar
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (avatarUploading) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileStatus({ type: "error", msg: "Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP)." });
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileStatus({ type: "error", msg: "Kích thước ảnh tối đa là 5MB." });
      e.target.value = "";
      return;
    }

    setAvatarUploading(true);
    setProfileStatus(null);

    try {
      // Nén ảnh nhỏ gọn (256x256 WebP/JPEG) để lưu nhanh và đồng bộ tức thì
      const base64Url = await resizeImageToBase64(file, 256, 0.85);
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        data: {
          avatar_url: base64Url,
          picture: base64Url,
        },
      });

      if (error) throw error;

      setProfile((prev) => ({ ...prev, avatarUrl: base64Url }));
      updateUser({ avatar: base64Url, ...({ avatar_url: base64Url } as any) });
      setProfileStatus({ type: "success", msg: "Cập nhật ảnh đại diện thành công!" });
    } catch (err: any) {
      setProfileStatus({ type: "error", msg: err?.message || "Không thể tải lên ảnh đại diện." });
    } finally {
      setAvatarUploading(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  // 2. Xử lý Lưu Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileLoading) return;
    setProfileLoading(true);
    setProfileStatus(null);

    try {
      const trimmedName = profile.name.trim();
      const trimmedPhone = profile.phone.trim();
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        data: {
          name: trimmedName,
          full_name: trimmedName,
          phone: trimmedPhone,
        },
      });

      if (error) throw error;

      updateUser({
        name: trimmedName,
        ...({ phone: trimmedPhone } as any),
      });

      // Background sync with API
      fetch("/api/account", { method: "GET" }).catch(() => {});

      setProfileStatus({ type: "success", msg: "Cập nhật thông tin hồ sơ thành công!" });
    } catch (err: any) {
      setProfileStatus({ type: "error", msg: err?.message || "Lỗi cập nhật hồ sơ." });
    } finally {
      setProfileLoading(false);
    }
  };

  // 3. Xử lý Đổi Mật Khẩu (Xác thực mật khẩu hiện tại trước)
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassStatus(null);

    if (passLoading) return;

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
        setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
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
      setPassStatus({ type: "error", msg: err?.message || "Không thể cập nhật mật khẩu." });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } finally {
      setPassLoading(false);
    }
  };

  const canonicalTier = getCanonicalPackageTier(user);
  const accountSummary: { label: string; value: string; tone: "success" | "default" | "muted" }[] = [
    { label: "Trạng thái", value: user?.status ?? "ACTIVE", tone: "success" },
    { label: "Gói cước", value: canonicalTier.replace("_", " "), tone: "default" },
    { label: "Xác thực", value: user?.oauthProvider === "google" ? "Google OAuth" : "Email & Password", tone: "muted" },
  ];

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 max-w-7xl mx-auto font-sans text-[#ededed]">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_360px]">
          {/* CỘT TRÁI: HỒ SƠ & ĐỔI MẬT KHẨU */}
          <div className="space-y-6">
            {/* 1. Form Cài Đặt Hồ Sơ & Thay Avatar */}
            <section className="rounded-lg border border-[#222222] bg-[#000000] p-6">
              <div className="mb-5 flex items-center justify-between gap-4 border-b border-[#222222] pb-4">
                <div>
                  <h2 className="text-base font-semibold text-white">Cài đặt hồ sơ</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">Quản lý thông tin định danh và tài khoản người dùng.</p>
                </div>
                <span className="border border-neutral-700 bg-neutral-800 text-white text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full">
                  Đã xác thực
                </span>
              </div>

              {profileStatus && (
                <div
                  className={`mb-4 p-3 rounded-md flex items-center gap-2 text-xs border ${
                    profileStatus.type === "success"
                      ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-950/20 border-rose-500/40 text-rose-300"
                  }`}
                >
                  {profileStatus.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>{profileStatus.msg}</span>
                </div>
              )}

              {/* Phần Avatar */}
              <div className="mb-6 flex flex-col sm:flex-row items-center gap-5 rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
                <div className="relative group">
                  <UserAvatar
                    user={{
                      name: profile.name || user?.name,
                      email: profile.email || user?.email,
                      avatar: profile.avatarUrl || user?.avatar,
                    }}
                    size="lg"
                    className="h-16 w-16 text-xl border border-[#333333]"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-white hover:bg-neutral-200 text-black shadow cursor-pointer transition active:scale-95 z-10"
                    title="Thay đổi ảnh đại diện"
                  >
                    {avatarUploading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5 font-bold" />}
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
                  <p className="text-sm font-semibold text-white truncate">
                    {profile.name || getCanonicalDisplayName(user)}
                  </p>
                  <p className="text-xs font-mono text-neutral-400 truncate">{maskEmail(user?.email || profile.email)}</p>
                  <p className="text-[11px] text-neutral-500">Hỗ trợ JPG, PNG, WEBP (Tối đa 2MB).</p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="shrink-0 h-8 border-[#333333] bg-[#111111] hover:bg-neutral-800 text-xs text-neutral-200 rounded-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {avatarUploading ? "Đang tải..." : "Đổi avatar"}
                </Button>
              </div>

              {/* Form Thông tin */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 font-mono">
                      Tên hiển thị
                    </Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
                      <Input
                        id="name"
                        value={profile.name}
                        onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                        className="h-9 border-[#333333] bg-[#000000] pl-9 text-xs text-white focus:border-white focus:ring-0 rounded-md"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 font-mono">
                      Số điện thoại
                    </Label>
                    <div className="relative">
                      <Fingerprint className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
                      <Input
                        id="phone"
                        value={profile.phone}
                        onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
                        placeholder="+84 912 345 678"
                        className="h-9 border-[#333333] bg-[#000000] pl-9 text-xs text-white focus:border-white focus:ring-0 rounded-md"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="email" className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 font-mono">
                      Email đăng nhập (Được bảo vệ)
                    </Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600" />
                      <Input
                        id="email"
                        type="text"
                        value={maskEmail(profile.email || user?.email)}
                        disabled
                        className="h-9 border-[#222222] bg-[#0a0a0a] pl-9 text-xs text-neutral-400 font-mono rounded-md cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <Button
                    type="submit"
                    disabled={profileLoading}
                    className="h-8 bg-white hover:bg-neutral-200 text-black text-xs font-medium rounded-md px-4 flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {profileLoading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    {profileLoading ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                </div>
              </form>
            </section>

            {/* 2. Form Đổi Mật Khẩu */}
            <section className="rounded-lg border border-[#222222] bg-[#000000] p-6">
              <div className="mb-4 border-b border-[#222222] pb-3">
                <h3 className="text-sm font-semibold text-white">Mật khẩu & Bảo mật</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Nhập mật khẩu hiện tại để thiết lập mật khẩu mới.</p>
              </div>

              {passStatus && (
                <div
                  className={`mb-4 p-3 rounded-md flex items-center gap-2 text-xs border ${
                    passStatus.type === "success"
                      ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-950/20 border-rose-500/40 text-rose-300"
                  }`}
                >
                  {passStatus.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>{passStatus.msg}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="current-password" className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 font-mono">
                    Mật khẩu hiện tại *
                  </Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(e) => setPasswords((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="Mật khẩu đang dùng"
                    className="h-9 border-[#333333] bg-[#000000] text-xs text-white focus:border-white focus:ring-0 rounded-md"
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 font-mono">
                      Mật khẩu mới *
                    </Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={passwords.newPassword}
                      onChange={(e) => setPasswords((prev) => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Tối thiểu 6 ký tự"
                      className="h-9 border-[#333333] bg-[#000000] text-xs text-white focus:border-white focus:ring-0 rounded-md"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 font-mono">
                      Xác nhận mật khẩu mới *
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={passwords.confirmPassword}
                      onChange={(e) => setPasswords((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Nhập lại mật khẩu mới"
                      className="h-9 border-[#333333] bg-[#000000] text-xs text-white focus:border-white focus:ring-0 rounded-md"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={passLoading || !passwords.currentPassword || !passwords.newPassword}
                  className="h-8 bg-white hover:bg-neutral-200 text-black font-medium text-xs rounded-md px-4 flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {passLoading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                  {passLoading ? "Đang cập nhật..." : "Đổi mật khẩu"}
                </Button>
              </form>
            </section>
          </div>

          {/* CỘT PHẢI: THÔNG TIN TÀI KHOẢN & HỖ TRỢ */}
          <div className="space-y-6">
            {/* Thông tin gói & trạng thái */}
            <aside className="rounded-lg border border-[#222222] bg-[#000000] p-5">
              <div className="mb-4 border-b border-[#222222] pb-3">
                <h3 className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">Giấy phép</h3>
                <p className="text-base font-semibold text-white mt-0.5">Thông tin tài khoản</p>
              </div>

              <div className="space-y-2 text-xs">
                {accountSummary.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-md border border-[#222222] bg-[#0a0a0a] px-3 py-2.5">
                    <span className="text-neutral-400">{item.label}</span>
                    <span className="font-mono text-white text-[11px]">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </aside>

            {/* Card Hỗ Trợ Trực Tiếp Từ Developer */}
            <aside className="rounded-lg border border-[#222222] bg-[#000000] p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <Headphones className="h-4 w-4 text-white" />
                <div>
                  <h3 className="text-sm font-semibold text-white">Trung Tâm Hỗ Trợ</h3>
                  <p className="text-[11px] text-neutral-500">Liên hệ trực tiếp với Lead Developer</p>
                </div>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Gặp sự cố quét DAST, lỗi license hoặc cần tích hợp hệ thống SOC?
              </p>
              <Button
                type="button"
                onClick={() => setShowSupportModal(true)}
                className="w-full h-8 bg-white hover:bg-neutral-200 text-black font-medium text-xs rounded-md flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Code2 className="h-3.5 w-3.5" /> Liên hệ Developer
              </Button>
            </aside>

            {/* Nút Đăng xuất */}
            <aside className="rounded-lg border border-[#222222] bg-[#000000] p-5">
              <h3 className="text-sm font-semibold text-white">Phiên làm việc</h3>
              <p className="text-xs text-neutral-500 mt-1 mb-3">Đăng xuất tài khoản khỏi trình duyệt này.</p>
              <Button
                onClick={() => logout()}
                variant="outline"
                className="w-full h-8 border-[#333333] hover:bg-neutral-900 text-rose-400 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" /> Đăng xuất phiên làm việc
              </Button>
            </aside>
          </div>
        </div>

        {/* Modal Thông Tin Hỗ Trợ Developer */}
        {showSupportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowSupportModal(false)} />
            <div className="relative z-10 w-full max-w-md rounded-xl border border-[#262626] bg-[#0a0a0a] p-6 shadow-2xl space-y-4 text-[#ededed]">
              <div className="flex items-center justify-between border-b border-[#222222] pb-3">
                <h3 className="font-semibold text-sm text-white">Thông Tin Developer & SOC Lead</h3>
                <button onClick={() => setShowSupportModal(false)} className="text-neutral-500 hover:text-white p-1">
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-md bg-[#000000] border border-[#222222] space-y-1">
                  <p className="text-[10px] font-mono uppercase text-neutral-500">Nhà phát triển</p>
                  <p className="font-semibold text-sm text-white">Nguyễn Kiến Quốc</p>
                  <p className="text-neutral-400">Lead Security Engineer & System Architect</p>
                </div>

                <div className="p-3.5 rounded-md bg-[#000000] border border-[#222222] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Email Hỗ trợ:</span>
                    <a href="mailto:kienquocn64@gmail.com" className="font-mono text-white hover:underline">
                      kienquocn64@gmail.com
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Hệ thống:</span>
                    <span className="font-medium text-white">ADQ Security Operations Center</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Thời gian phản hồi:</span>
                    <span className="text-neutral-300 font-mono">Dưới 15 phút (24/7)</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <a
                  href="mailto:kienquocn64@gmail.com?subject=[ADQ Support] Yêu cầu hỗ trợ kỹ thuật"
                  className="flex-1 h-8 bg-white hover:bg-neutral-200 text-black font-medium text-xs rounded-md flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Mail className="h-3.5 w-3.5" /> Gửi Email Hỗ Trợ
                </a>
                <Button variant="outline" onClick={() => setShowSupportModal(false)} className="h-8 border-[#333333] text-xs rounded-md">
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
