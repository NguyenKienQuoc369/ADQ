"use client";

import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  CreditCard,
  Search,
  RefreshCw,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminEntitlementsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Mutation Dialog State
  const [editingUser, setEditingUser] = useState<any>(null);
  const [selectedTier, setSelectedTier] = useState("FREE");
  const [durationDays, setDurationDays] = useState("30");
  const [mutating, setMutating] = useState(false);
  const [mutationSuccess, setMutationSuccess] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users?limit=100&search=${encodeURIComponent(search)}`);
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tải danh sách");
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openMutationDialog = (user: any) => {
    setEditingUser(user);
    setSelectedTier(user.packageTier || "FREE");
    setDurationDays("30");
    setMutationSuccess(null);
  };

  const handleMutateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setMutating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}/role-package`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editingUser.role || "USER",
          packageTier: selectedTier,
          durationDays: Number.parseInt(durationDays, 10) || 30,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cập nhật thất bại");

      setMutationSuccess(`Đã nâng cấp gói thành công cho ${editingUser.email}`);
      setTimeout(() => {
        setEditingUser(null);
        fetchUsers();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Lỗi cập nhật gói");
    } finally {
      setMutating(false);
    }
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-sky-400" />
              Quản lý Gói & Phân quyền Entitlements
            </h1>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Điều chỉnh quyền hạn cấp phép PRO / PRO_MAX, thời hạn gói dịch vụ và hạn mức quét
            </p>
          </div>
          <Button
            onClick={fetchUsers}
            variant="outline"
            size="sm"
            disabled={loading}
            className="h-8 gap-2 border-[#333333] bg-[#0a0a0a] text-xs text-neutral-300 hover:text-white hover:bg-[#151515]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-2 bg-[#0a0a0a] p-3 rounded-lg border border-[#222222]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm tài khoản..."
              className="bg-[#000000] border-[#333333] text-xs h-8 pl-9 text-white"
            />
          </div>
          <Button size="sm" onClick={fetchUsers} className="h-8 text-xs bg-white text-black hover:bg-neutral-200">
            Tìm
          </Button>
        </div>

        {/* Entitlements Table */}
        <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#222222] bg-[#050505] text-neutral-400 font-mono text-[11px]">
                <tr>
                  <th className="px-4 py-3">Tài khoản / Email</th>
                  <th className="px-4 py-3">Gói Dịch Vụ</th>
                  <th className="px-4 py-3">Hạn mức Scan/Ngày</th>
                  <th className="px-4 py-3">Stress Test Quota</th>
                  <th className="px-4 py-3">Hết hạn vào</th>
                  <th className="px-4 py-3 text-right">Điều chỉnh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-neutral-500 font-mono">
                      Đang tải danh sách...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-neutral-500 font-mono">
                      Không có dữ liệu.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#111111] transition">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{u.name || "Người dùng"}</div>
                        <div className="text-[11px] font-mono text-neutral-400">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          u.packageTier === "PRO_MAX"
                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                            : u.packageTier === "PRO"
                            ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                            : "bg-neutral-800 text-neutral-400"
                        }`}>
                          {u.packageTier}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-neutral-300">
                        {u.packageTier === "FREE" ? "2 lượt/ngày" : "Không giới hạn"}
                      </td>
                      <td className="px-4 py-3 font-mono text-neutral-300">
                        {u.packageTier === "PRO_MAX"
                          ? "10 phiên/ngày (450 reqs)"
                          : u.packageTier === "PRO"
                          ? "1 phiên/ngày (150 reqs)"
                          : "Khóa (Yêu cầu PRO)"}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-mono text-neutral-400">
                        {u.planExpiresAt ? new Date(u.planExpiresAt).toLocaleDateString("vi-VN") : "Vĩnh viễn / FREE"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openMutationDialog(u)}
                          className="h-7 px-2 text-xs text-sky-400 hover:text-white hover:bg-neutral-800"
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          Đổi Gói
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mutation Dialog */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-[#0a0a0a] border border-[#222222] rounded-xl shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[#222222] pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-sky-400" />
                  Cập nhật Gói Dịch Vụ
                </h3>
                <button
                  onClick={() => setEditingUser(null)}
                  className="text-neutral-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {mutationSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2 font-mono">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{mutationSuccess}</span>
                </div>
              )}

              <form onSubmit={handleMutateTier} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-neutral-400">Tài khoản</label>
                  <div className="p-2.5 rounded bg-[#000000] border border-[#222222] text-xs font-mono text-white">
                    {editingUser.email}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-neutral-400">Chọn Gói Cấp Phép</label>
                  <select
                    value={selectedTier}
                    onChange={(e) => setSelectedTier(e.target.value)}
                    className="w-full bg-[#000000] border border-[#333333] text-white text-xs rounded-md h-9 px-3 outline-none font-mono"
                  >
                    <option value="FREE">FREE (Mặc định)</option>
                    <option value="PRO">PRO (Unlimited Scan, 1 Stress/ngày)</option>
                    <option value="PRO_MAX">PRO_MAX (Unlimited Scan, 10 Stress/ngày, APK Audit)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-neutral-400">Thời hạn kích hoạt (Ngày)</label>
                  <Input
                    type="number"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    min="1"
                    max="3650"
                    className="bg-[#000000] border-[#333333] text-white text-xs h-9 font-mono"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingUser(null)}
                    className="h-8 text-xs border-[#333333] bg-[#000000] text-neutral-300"
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    disabled={mutating}
                    size="sm"
                    className="h-8 text-xs bg-white text-black hover:bg-neutral-200 font-semibold"
                  >
                    {mutating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                    Lưu Thay Đổi
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
