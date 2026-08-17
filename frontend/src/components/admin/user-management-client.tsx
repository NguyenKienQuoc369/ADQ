"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, LoaderCircle, Search, Trash2, UserPlus, UserRoundCheck, UserX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createManualUser, deleteAdminUser, getAdminUsers, updateUserRoleAndPackage, updateUserStatus, type PackageTier, type UserRole } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

const createUserSchema = z.object({
  name: z.string().min(2, "Tên người dùng quá ngắn."),
  email: z.string().email("Email không hợp lệ."),
  password: z.string().optional(),
  role: z.enum(["USER", "ADMIN"]),
  packageTier: z.enum(["FREE", "PRO", "PRO_MAX"]),
  packageDuration: z.enum(["default", "30", "90", "365", "permanent"]),
});

export function UserManagementClient() {
  const [users, setUsers] = useState<Awaited<ReturnType<typeof getAdminUsers>>>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "ALL">("ALL");
  const [packageTier, setPackageTier] = useState<PackageTier | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const form = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "USER",
      packageTier: "FREE",
      packageDuration: "default",
    },
  });


  const loadUsers = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await getAdminUsers({ search, role, packageTier });
      setUsers(response);
    } catch (err) {
      setUsers([]);
      setMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Không thể tải danh sách người dùng. Vui lòng kiểm tra cấu hình DATABASE_URL (Prisma).",
      });
    } finally {
      setLoading(false);
    }
  }, [packageTier, role, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const onSubmit = form.handleSubmit(async (values) => {
    setMessage(null);
    setSavingId("create");
    try {
      let planDuration: number | null | undefined = undefined;
      if (values.packageDuration === "30") planDuration = 30;
      if (values.packageDuration === "90") planDuration = 90;
      if (values.packageDuration === "365") planDuration = 365;
      if (values.packageDuration === "permanent") planDuration = null;
      const result = await createManualUser(values, planDuration);
      const pieces = [`Đã lưu tài khoản ${result.user.email} thành công.`];
      if (result.temporaryPassword) {
        pieces.push(`Mật khẩu tạm: ${result.temporaryPassword}`);
      }
      if (result.linkedExistingAuthUser) {
        pieces.push("Tài khoản Auth đã tồn tại trước đó và vừa được liên kết lại.");
      }
      setMessage({ type: "success", text: pieces.join(" ") });
      form.reset({ name: "", email: "", password: "", role: "USER", packageTier: "FREE" });
      await loadUsers();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Không thể tạo người dùng.",
      });
    } finally {
      setSavingId(null);
    }
  });

  const handleStatusChange = async (userId: string, status: "ACTIVE" | "PENDING" | "LOCKED") => {
    setSavingId(userId);
    setMessage(null);
    try {
      await updateUserStatus(userId, status);
      await loadUsers();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Không thể cập nhật trạng thái.",
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleRolePackageChange = async (userId: string, nextRole: UserRole, nextPackage: PackageTier) => {
    setSavingId(userId);
    setMessage(null);
    try {
      // Prompt admin for custom duration: enter number of days, leave empty for default, 0 for permanent
      let planExpiresAt: string | null | undefined = undefined;
      const input = window.prompt('Nhập số ngày cho thời hạn gói (ví dụ 30) hoặc để trống để sử dụng mặc định, nhập 0 cho vĩnh viễn');
      if (input !== null) {
        const trimmed = input.trim();
        if (trimmed !== "") {
          const n = Number(trimmed);
          if (!Number.isNaN(n)) {
            if (n === 0) {
              planExpiresAt = null;
            } else if (n > 0) {
              const d = new Date();
              d.setDate(d.getDate() + Math.floor(n));
              planExpiresAt = d.toISOString();
            }
          }
        }
      }

      await updateUserRoleAndPackage(userId, nextRole, nextPackage, planExpiresAt);
      await loadUsers();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Không thể cập nhật role / package.",
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    const confirmed = window.confirm(`Xóa hẳn tài khoản ${email}? Hành động này sẽ xóa cả bản ghi trong hệ thống đăng nhập.`);
    if (!confirmed) return;

    setSavingId(userId);
    setMessage(null);
    try {
      await deleteAdminUser(userId);
      setMessage({ type: "success", text: `Đã xóa tài khoản ${email}.` });
      await loadUsers();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Không thể xóa tài khoản.",
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <DashboardShell area="admin">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Thêm tài khoản mới</CardTitle>
              <CardDescription>Tạo thủ công user hoặc admin và gán gói cước ngay từ đầu.</CardDescription>
            </CardHeader>
            <CardContent>
              {message ? (
                <div
                  className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
                    message.type === "error"
                      ? "border-rose-500/20 bg-rose-500/10 text-rose-100"
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                  }`}
                >
                  {message.text}
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={onSubmit}>
                <div>
                  <Label htmlFor="manual-name">Họ và tên</Label>
                  <Input id="manual-name" className="mt-2" {...form.register("name")} />
                  {form.formState.errors.name ? <p className="mt-2 text-xs text-rose-300">{form.formState.errors.name.message}</p> : null}
                </div>
                <div>
                  <Label htmlFor="manual-email">Email</Label>
                  <Input id="manual-email" className="mt-2" {...form.register("email")} />
                  {form.formState.errors.email ? <p className="mt-2 text-xs text-rose-300">{form.formState.errors.email.message}</p> : null}
                </div>
                <div>
                  <Label htmlFor="manual-password">Mật khẩu tạm thời</Label>
                  <Input id="manual-password" className="mt-2" type="text" placeholder="Để trống để hệ thống tự sinh" {...form.register("password")} />
                  <p className="mt-2 text-xs text-slate-400">Nếu để trống, hệ thống sẽ tạo mật khẩu tạm và hiển thị lại sau khi tạo.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="manual-role">Role</Label>
                    <Select id="manual-role" className="mt-2" {...form.register("role")}>
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="manual-package">Package</Label>
                    <Select id="manual-package" className="mt-2" {...form.register("packageTier")}>
                      <option value="FREE">FREE</option>
                      <option value="PRO">PRO</option>
                      <option value="PRO_MAX">PRO MAX</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="manual-package-duration">Thời hạn gói (tùy chọn)</Label>
                  <Select id="manual-package-duration" className="mt-2" {...form.register("packageDuration")}> 
                    <option value="default">Sử dụng mặc định theo gói</option>
                    <option value="30">30 ngày</option>
                    <option value="90">90 ngày</option>
                    <option value="365">365 ngày</option>
                    <option value="permanent">Vĩnh viễn</option>
                  </Select>
                  <p className="mt-2 text-xs text-slate-400">Chọn thời hạn gói khi tạo. Để mặc định để dùng chính sách mặc định của hệ thống.</p>
                </div>

                <Button className="w-full" type="submit" disabled={savingId === "create"}>
                  {savingId === "create" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Tạo tài khoản
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bộ lọc người dùng</CardTitle>
              <CardDescription>Tìm kiếm theo tên, email, vai trò và gói cước.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10" placeholder="Tìm theo tên hoặc email..." />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select value={role} onChange={(event) => setRole(event.target.value as UserRole | "ALL")}>
                  <option value="ALL">Tất cả role</option>
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </Select>
                <Select value={packageTier} onChange={(event) => setPackageTier(event.target.value as PackageTier | "ALL")}>
                  <option value="ALL">Tất cả package</option>
                  <option value="FREE">FREE</option>
                  <option value="PRO">PRO</option>
                  <option value="PRO_MAX">PRO MAX</option>
                </Select>
              </div>
              <Button variant="secondary" className="w-full" onClick={loadUsers}>
                Làm mới danh sách
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Duyệt, kích hoạt, khóa tài khoản và chỉnh role/package trực tiếp trên bảng quản trị.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-24 rounded-3xl border border-slate-800 bg-slate-900/60" />)
            ) : (
              users.map((user) => (
                <div key={user.id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
                  <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-100">{user.name}</p>
                      <p className="text-sm text-slate-400">{user.email}</p>
                      <p className="mt-2 text-xs text-slate-500">Đăng nhập gần nhất: {formatDateTime(user.lastLoginAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={user.role === "ADMIN" ? "danger" : "success"}>{user.role}</Badge>
                      <Badge variant="default">{user.packageTier.replace("_", " ")}</Badge>
                      <Badge variant={user.status === "ACTIVE" ? "success" : user.status === "PENDING" ? "warning" : "danger"}>{user.status}</Badge>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[0.8fr_0.8fr_1fr]">
                    <Select
                      value={user.role}
                      onChange={(event) => handleRolePackageChange(user.id, event.target.value as UserRole, user.packageTier)}
                      disabled={savingId === user.id}
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </Select>

                    <Select
                      value={user.packageTier}
                      onChange={(event) => handleRolePackageChange(user.id, user.role, event.target.value as PackageTier)}
                      disabled={savingId === user.id}
                    >
                      <option value="FREE">FREE</option>
                      <option value="PRO">PRO</option>
                      <option value="PRO_MAX">PRO MAX</option>
                    </Select>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" disabled={savingId === user.id} onClick={() => handleStatusChange(user.id, "ACTIVE")}>
                        {savingId === user.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserRoundCheck className="h-4 w-4" />}
                        Kích hoạt
                      </Button>
                      <Button size="sm" variant="outline" disabled={savingId === user.id} onClick={() => handleStatusChange(user.id, "PENDING")}>
                        Chờ duyệt
                      </Button>
                      <Button size="sm" variant="destructive" disabled={savingId === user.id} onClick={() => handleStatusChange(user.id, "LOCKED")}>
                        <UserX className="h-4 w-4" />
                        Khóa
                      </Button>
                      <Button size="sm" variant="outline" disabled={savingId === user.id} onClick={() => handleDeleteUser(user.id, user.email)}>
                        <Trash2 className="h-4 w-4" />
                        Xóa
                      </Button>
                    </div>
                  </div>
                  {user.planExpiresAt ? (
                    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                      <div className="flex items-center gap-2 text-cyan-300">
                        <KeyRound className="h-4 w-4" />
                        Hạn gói hiện tại: {formatDateTime(user.planExpiresAt)}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            )}

            {!loading && users.length === 0 ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">Không có tài khoản nào khớp bộ lọc hiện tại.</div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
