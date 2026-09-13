"use client";

import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Shield,
  CreditCard,
  Calendar,
  Activity,
  AlertCircle,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [packageFilter, setPackageFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User 360 Modal State
  const [selectedUser360, setSelectedUser360] = useState<any>(null);
  const [loading360, setLoading360] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
        role: roleFilter,
        packageTier: packageFilter,
      });
      const res = await fetch(`/api/admin/users?${params}`);
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tải danh sách");
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || "Lỗi tải dữ liệu người dùng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, packageFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const openUser360 = async (idOrEmail: string) => {
    setLoading360(true);
    try {
      const res = await fetch(`/api/admin/data/user-360/${encodeURIComponent(idOrEmail)}`);
      const json = await res.json();
      if (json.ok && json.user) {
        setSelectedUser360(json);
      }
    } catch (err) {
      console.error("Lỗi tải User 360:", err);
    } finally {
      setLoading360(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-400" />
              Quản lý Tài khoản & Hồ sơ Người dùng
            </h1>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Tổng số {total} tài khoản đồng bộ từ PostgreSQL và Supabase Auth
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

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-[#0a0a0a] p-3 rounded-lg border border-[#222222]">
          <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm theo email, tên, UUID..."
                className="bg-[#000000] border-[#333333] text-xs h-8 pl-9 text-white focus-visible:ring-emerald-500/40"
              />
            </div>
            <Button type="submit" size="sm" className="h-8 text-xs bg-white text-black hover:bg-neutral-200">
              Tìm
            </Button>
          </form>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Package Tier Filter */}
            <select
              value={packageFilter}
              onChange={(e) => {
                setPackageFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#000000] border border-[#333333] text-neutral-300 text-xs rounded-md h-8 px-2.5 outline-none font-mono"
            >
              <option value="ALL">Tất cả Gói</option>
              <option value="FREE">FREE</option>
              <option value="PRO">PRO</option>
              <option value="PRO_MAX">PRO_MAX</option>
            </select>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#000000] border border-[#333333] text-neutral-300 text-xs rounded-md h-8 px-2.5 outline-none font-mono"
            >
              <option value="ALL">Tất cả Quyền</option>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#222222] bg-[#050505] text-neutral-400 font-mono text-[11px]">
                <tr>
                  <th className="px-4 py-3">Người dùng / Email</th>
                  <th className="px-4 py-3">Gói dịch vụ</th>
                  <th className="px-4 py-3">Phân quyền</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Hạn mức / Ngày</th>
                  <th className="px-4 py-3">Ngày tạo</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-neutral-500 font-mono">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-400" />
                      Đang tải danh sách tài khoản...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-neutral-500 font-mono">
                      Không tìm thấy tài khoản nào phù hợp.
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
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          u.role === "ADMIN"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold"
                            : "text-neutral-400"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 text-[11px] font-mono ${
                          u.status === "ACTIVE" ? "text-emerald-400" : "text-rose-400"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            u.status === "ACTIVE" ? "bg-emerald-400" : "bg-rose-400"
                          }`} />
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-neutral-300">
                        {u.scansToday || 0} / {u.dailyLimit === 999999 ? "∞" : u.dailyLimit}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-mono text-neutral-400">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "--"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openUser360(u.id)}
                          className="h-7 px-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          User 360
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 border-t border-[#222222] bg-[#050505] flex items-center justify-between text-xs font-mono text-neutral-400">
            <div>
              Trang <strong className="text-white">{page}</strong> / <strong className="text-white">{totalPages}</strong> (Tổng {total} bản ghi)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage(page - 1)}
                className="h-7 px-2 border-[#333333] bg-[#000000] text-xs text-neutral-300"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(page + 1)}
                className="h-7 px-2 border-[#333333] bg-[#000000] text-xs text-neutral-300"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* User 360 Drawer / Modal */}
        {selectedUser360 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-3xl max-h-[90vh] bg-[#0a0a0a] border border-[#222222] rounded-xl shadow-2xl flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="p-4 border-b border-[#222222] flex items-center justify-between bg-[#050505]">
                <div className="flex items-center gap-2.5">
                  <UserCheck className="h-5 w-5 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Hồ sơ Toàn diện User 360</h3>
                    <p className="text-[11px] font-mono text-neutral-400">{selectedUser360.user?.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser360(null)}
                  className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                {/* 1. Identity & Auth Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-[#000000] border border-[#1f1f1f]">
                    <div className="text-[10px] font-mono text-neutral-500 uppercase">Auth UUID</div>
                    <div className="text-xs font-mono text-neutral-300 mt-1 truncate">
                      {selectedUser360.user?.authUserId || "N/A"}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#000000] border border-[#1f1f1f]">
                    <div className="text-[10px] font-mono text-neutral-500 uppercase">Gói Hiện tại</div>
                    <div className="text-xs font-mono font-bold text-amber-400 mt-1">
                      {selectedUser360.user?.packageTier}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#000000] border border-[#1f1f1f]">
                    <div className="text-[10px] font-mono text-neutral-500 uppercase">Phân quyền</div>
                    <div className="text-xs font-mono text-neutral-300 mt-1">
                      {selectedUser360.user?.role}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#000000] border border-[#1f1f1f]">
                    <div className="text-[10px] font-mono text-neutral-500 uppercase">Đăng nhập gần nhất</div>
                    <div className="text-xs font-mono text-neutral-300 mt-1">
                      {selectedUser360.user?.lastLoginAt
                        ? new Date(selectedUser360.user.lastLoginAt).toLocaleDateString("vi-VN")
                        : "Chưa có"}
                    </div>
                  </div>
                </div>

                {/* 2. Correlated Product Activities */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                    Hoạt động Sản phẩm & Lịch sử Khai thác
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-md bg-[#000000] border border-[#1f1f1f] text-center">
                      <div className="text-lg font-bold font-mono text-white">
                        {selectedUser360.activity?.scansCount ?? 0}
                      </div>
                      <div className="text-[10px] font-mono text-neutral-400 mt-0.5">Phiên Rà quét</div>
                    </div>
                    <div className="p-3 rounded-md bg-[#000000] border border-[#1f1f1f] text-center">
                      <div className="text-lg font-bold font-mono text-white">
                        {selectedUser360.activity?.stressJobsCount ?? 0}
                      </div>
                      <div className="text-[10px] font-mono text-neutral-400 mt-0.5">Stress Tests</div>
                    </div>
                    <div className="p-3 rounded-md bg-[#000000] border border-[#1f1f1f] text-center">
                      <div className="text-lg font-bold font-mono text-white">
                        {selectedUser360.activity?.copilotConversationsCount ?? 0}
                      </div>
                      <div className="text-[10px] font-mono text-neutral-400 mt-0.5">Copilot Chats</div>
                    </div>
                    <div className="p-3 rounded-md bg-[#000000] border border-[#1f1f1f] text-center">
                      <div className="text-lg font-bold font-mono text-white">
                        {selectedUser360.activity?.redeemRedemptionsCount ?? 0}
                      </div>
                      <div className="text-[10px] font-mono text-neutral-400 mt-0.5">Mã Redeem đã dùng</div>
                    </div>
                  </div>
                </div>

                {/* 3. Recent Stress Jobs */}
                {selectedUser360.activity?.recentStressJobs?.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-neutral-300 font-mono">Stress Test gần nhất:</div>
                    <div className="space-y-1.5">
                      {selectedUser360.activity.recentStressJobs.slice(0, 3).map((st: any) => (
                        <div key={st.jobId} className="p-2 rounded bg-[#000000] border border-[#1f1f1f] flex items-center justify-between text-xs">
                          <span className="font-mono text-neutral-300 truncate max-w-[280px]">{st.targetUrl}</span>
                          <span className="font-mono text-[10px] text-neutral-400">{st.status} • {st.targetRps} RPS</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[#222222] bg-[#050505] flex justify-end">
                <Button
                  onClick={() => setSelectedUser360(null)}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-[#333333] bg-[#000000] text-neutral-300"
                >
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
