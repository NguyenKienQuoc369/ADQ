"use client";

import { Bell, ChevronRight, Fingerprint, Globe2, KeyRound, Lock, Mail, Palette, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function SettingsClient() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    company: "NQ SECURITY Labs",
    phone: "+84 912 345 678",
  });
  const [security, setSecurity] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    mfaEnabled: true,
    sessionTimeout: "30 phút",
  });
  const [preferences, setPreferences] = useState({
    darkMode: true,
    autoScan: true,
    weeklyReports: true,
    criticalAlerts: true,
  });

  const accountSummary = [
    { label: "Trạng thái", value: user?.status ?? "ACTIVE", tone: "success" },
    { label: "Gói", value: user?.packageTier?.replace("_", " ") ?? "FREE", tone: "default" },
    { label: "Lần đăng nhập cuối", value: "Hôm nay, 14:21", tone: "muted" },
  ];

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="overflow-hidden border-[color:var(--line)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_12%,transparent),transparent_52%)]">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--foreground-muted)]">Tài khoản</p>
                  <CardTitle className="mt-2 text-2xl">Cài đặt hồ sơ</CardTitle>
                </div>
                <Badge variant="success">Đã xác thực</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] p-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:var(--accent-soft)] text-xl font-semibold text-[color:var(--accent-strong)]">
                  {(user?.name ?? "A").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-[var(--foreground)]">{user?.name ?? "Người dùng"}</p>
                  <p className="truncate text-sm text-[var(--foreground-muted)]">{user?.email ?? ""}</p>
                </div>
                <Button variant="secondary" className="shrink-0">
                  Chỉnh sửa ảnh
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Tên hiển thị</Label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                    <Input
                      id="name"
                      value={profile.name}
                      onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Công ty / tổ chức</Label>
                  <div className="relative">
                    <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                    <Input
                      id="company"
                      value={profile.company}
                      onChange={(e) => setProfile((prev) => ({ ...prev, company: e.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="phone">Số điện thoại</Label>
                  <div className="relative">
                    <Fingerprint className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                    <Input
                      id="phone"
                      value={profile.phone}
                      onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button>Lưu thay đổi</Button>
                <Button variant="secondary">Đặt lại</Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Thông tin tài khoản</CardTitle>
                <CardDescription>quyền hạn hiện tại</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {accountSummary.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] px-3 py-2.5">
                    <span className="text-sm text-[var(--foreground-muted)]">{item.label}</span>
                    <Badge variant={item.tone === "success" ? "success" : item.tone === "default" ? "default" : "muted"}>
                      {item.value}
                    </Badge>
                  </div>
                ))}


              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[color:var(--accent-soft)] p-2 text-[color:var(--accent-strong)]">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>Bảo mật & phiên làm việc</CardTitle>
                  <CardDescription>Quản lý mật khẩu và ràng buộc bảo mật.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={security.currentPassword}
                  onChange={(e) => setSecurity((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Mật khẩu mới</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={security.newPassword}
                    onChange={(e) => setSecurity((prev) => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="Nhập mật khẩu mới"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Xác nhận mật khẩu</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={security.confirmPassword}
                    onChange={(e) => setSecurity((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Nhập lại mật khẩu"
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[color:var(--accent-soft)] p-2 text-[color:var(--accent-strong)]">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-[var(--foreground)]">Xác thực 2 lớp</p>
                      <p className="text-sm text-[var(--foreground-muted)]">Tự động bắt buộc khi truy cập từ thiết bị lạ.</p>
                    </div>
                  </div>
                  <Switch checked={security.mfaEnabled} onCheckedChange={(val) => setSecurity((prev) => ({ ...prev, mfaEnabled: val }))} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}

function SettingRow({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-[color:var(--accent-soft)] p-2 text-[color:var(--accent-strong)]">{icon}</div>
          <div>
            <p className="font-medium text-[var(--foreground)]">{label}</p>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">{description}</p>
          </div>
        </div>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
    </div>
  );
}
