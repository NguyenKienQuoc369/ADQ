"use client";

import { Fingerprint, Globe2, KeyRound, Lock, Mail, UserRound } from "lucide-react";
import { useState } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  });

  const accountSummary = [
    { label: "Trạng thái", value: user?.status ?? "ACTIVE", tone: "success" },
    { label: "Gói", value: user?.packageTier?.replace("_", " ") ?? "FREE", tone: "default" },
    { label: "Lần đăng nhập cuối", value: "Hôm nay, 14:21", tone: "muted" },
  ];

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_380px]">
          <div className="space-y-6">
            <section className="rounded-[22px] border border-[color:var(--line)] bg-[color:var(--background-elevated)] p-5 shadow-[0_0_0_1px_rgba(94,234,212,0.03)]">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--foreground-muted)]">Tài khoản</p>
                  <h2 className="text-[clamp(1.75rem,2vw,2.3rem)] font-semibold tracking-[-0.05em] text-[var(--foreground)]">Cài đặt hồ sơ</h2>
                </div>
                <Badge variant="success" className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-300">
                  Đã xác thực
                </Badge>
              </div>

              <div className="mb-5 flex items-center gap-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] p-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[color:var(--accent-soft)] text-lg font-semibold text-[var(--accent-strong)]">
                  {(user?.name ?? "A").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-[var(--foreground)]">{user?.name ?? "Người dùng"}</p>
                  <p className="truncate text-sm text-[var(--foreground-muted)]">{user?.email ?? ""}</p>
                </div>
                <Button variant="secondary" className="shrink-0 rounded-xl border border-[color:var(--line)] bg-[color:var(--background-elevated)] text-[var(--foreground)] hover:bg-[color:var(--background-muted)]">
                  Chỉnh sửa ảnh
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Tên hiển thị</Label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                    <Input
                      id="name"
                      value={profile.name}
                      onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                      className="h-12 border-[color:var(--line)] bg-transparent pl-10 text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company" className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Công ty / tổ chức</Label>
                  <div className="relative">
                    <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                    <Input
                      id="company"
                      value={profile.company}
                      onChange={(e) => setProfile((prev) => ({ ...prev, company: e.target.value }))}
                      className="h-12 border-[color:var(--line)] bg-transparent pl-10 text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email" className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))}
                      className="h-12 border-[color:var(--line)] bg-transparent pl-10 text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="phone" className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Số điện thoại</Label>
                  <div className="relative">
                    <Fingerprint className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                    <Input
                      id="phone"
                      value={profile.phone}
                      onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
                      className="h-12 border-[color:var(--line)] bg-transparent pl-10 text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button className="rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-95">Lưu thay đổi</Button>
                <Button variant="secondary" className="rounded-xl border border-[color:var(--line)] bg-[color:var(--background-muted)] text-[var(--foreground)] hover:bg-[color:var(--background-elevated)]">Đặt lại</Button>
              </div>
            </section>

            <section className="rounded-[22px] border border-[color:var(--line)] bg-[color:var(--background-elevated)] p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--accent-soft)] text-[var(--accent-strong)]">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-[var(--foreground)]">Bảo mật & phiên làm việc</h3>
                  <p className="text-sm text-[var(--foreground-muted)]">Quản lý mật khẩu và ràng buộc bảo mật.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password" className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Mật khẩu hiện tại</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={security.currentPassword}
                    onChange={(e) => setSecurity((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="••••••••"
                    className="h-12 border-[color:var(--line)] bg-transparent text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Mật khẩu mới</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={security.newPassword}
                      onChange={(e) => setSecurity((prev) => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Nhập mật khẩu mới"
                      className="h-12 border-[color:var(--line)] bg-transparent text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--foreground-muted)]">Xác nhận mật khẩu</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={security.confirmPassword}
                      onChange={(e) => setSecurity((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Nhập lại mật khẩu"
                      className="h-12 border-[color:var(--line)] bg-transparent text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--accent-soft)] text-[var(--accent-strong)]">
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
              </div>
            </section>
          </div>

          <aside className="rounded-[22px] border border-[color:var(--line)] bg-[color:var(--background-elevated)] p-5">
            <div className="mb-4">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--foreground-muted)]">Thông tin tài khoản</h3>
              <p className="mt-2 text-[1.8rem] font-semibold tracking-[-0.06em] text-[var(--foreground)]">quyền hạn hiện tại</p>
            </div>

            <div className="space-y-3">
              {accountSummary.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] px-3 py-3">
                  <span className="text-sm text-[var(--foreground-muted)]">{item.label}</span>
                  <Badge
                    variant={item.tone === "success" ? "success" : item.tone === "default" ? "default" : "muted"}
                    className="rounded-full border border-[color:var(--line)] bg-transparent px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]"
                  >
                    {item.value}
                  </Badge>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}
