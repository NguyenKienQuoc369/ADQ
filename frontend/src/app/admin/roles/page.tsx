"use client";

import React, { useState, useEffect } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  UserPlus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  SlidersHorizontal,
  Lock,
  Layers,
  Eye,
  Zap,
  Smartphone,
  Database,
  Radio,
  FileText,
  Trash2,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SocAdminItem {
  id: string;
  userAuthId: string;
  emailSnapshot: string | null;
  role: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
}

interface AvailableUser {
  id: string;
  email: string;
  name: string;
}

const ROLES_META: Record<
  string,
  {
    name: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    desc: string;
    level: string;
  }
> = {
  SOC_ADMIN: {
    name: "SOC Root Administrator",
    badgeBg: "bg-purple-950/50",
    badgeBorder: "border-purple-700/60",
    badgeText: "text-purple-300",
    desc: "Toàn quyền quản trị hệ thống, sửa đổi phân quyền, quan sát cơ sở dữ liệu và khôi phục khẩn cấp.",
    level: "Tối cao (Full Access)",
  },
  SOC_OPERATOR: {
    name: "SOC Operator (Tác chiến)",
    badgeBg: "bg-sky-950/50",
    badgeBorder: "border-sky-700/60",
    badgeText: "text-sky-300",
    desc: "Điều hành tiến trình quét scan, can thiệp kill job, kích hoạt dispatch và giám sát worker.",
    level: "Điều hành (Operations)",
  },
  SOC_SECURITY: {
    name: "Security & Threat Analyst",
    badgeBg: "bg-emerald-950/50",
    badgeBorder: "border-emerald-700/60",
    badgeText: "text-emerald-300",
    desc: "Phân tích lỗ hổng, rà soát kết quả CTEM/OAST, đánh giá an toàn APK và xem nhật ký audit log.",
    level: "Chuyên viên An ninh",
  },
  SOC_AUDITOR: {
    name: "Compliance Auditor (Read-Only)",
    badgeBg: "bg-amber-950/50",
    badgeBorder: "border-amber-700/60",
    badgeText: "text-amber-300",
    desc: "Quyền đọc kiểm toán, xem danh sách người dùng, báo cáo và logs mà không được thay đổi dữ liệu.",
    level: "Chỉ Đọc (Read-Only)",
  },
};

const PERMISSION_MATRIX = [
  { module: "Quản lý Phân quyền Admin (RBAC)", admin: true, operator: false, security: false, auditor: false },
  { module: "PostgreSQL Direct Database Explorer", admin: true, operator: "Chỉ đọc", security: "Chỉ đọc", auditor: "Chỉ đọc" },
  { module: "Quản lý Người dùng & Nâng cấp Gói", admin: true, operator: false, security: false, auditor: false },
  { module: "Điều hành Scan Jobs & Kill Process", admin: true, operator: true, security: "Chỉ đọc", auditor: "Chỉ đọc" },
  { module: "Stress Testing & C2 Dispatch Execution", admin: true, operator: true, security: false, auditor: false },
  { module: "APK & Mobile Reverse Engineering", admin: true, operator: true, security: true, auditor: "Chỉ đọc" },
  { module: "Audit Log & Lịch sử Hoạt động", admin: true, operator: true, security: true, auditor: true },
  { module: "Khôi phục Khẩn cấp SSH (Emergency Token)", admin: true, operator: false, security: false, auditor: false },
];

export default function AdminRolesPage() {
  const [admins, setAdmins] = useState<SocAdminItem[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add Admin Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserMode, setSelectedUserMode] = useState<"select" | "custom">("select");
  const [formUserAuthId, setFormUserAuthId] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("SOC_OPERATOR");
  const [submitting, setSubmitting] = useState(false);

  // Edit Role Modal State
  const [editingAdmin, setEditingAdmin] = useState<SocAdminItem | null>(null);
  const [editRole, setEditRole] = useState("SOC_ADMIN");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/roles");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load roles");
      setAdmins(data.admins || []);
      setAvailableUsers(data.availableUsers || []);
    } catch (err: any) {
      setError(err.message || "Lỗi tải danh sách quản trị viên");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUserAuthId.trim()) {
      setError("Vui lòng cung cấp Supabase User Auth UUID.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAuthId: formUserAuthId.trim(),
          email: formEmail.trim() || undefined,
          role: formRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi cấp quyền");

      setSuccessMsg(`Đã cấp quyền quản trị viên cho ${formEmail || formUserAuthId} thành công!`);
      setShowAddModal(false);
      setFormUserAuthId("");
      setFormEmail("");
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || "Lỗi khi cấp quyền");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleUpdate = async () => {
    if (!editingAdmin) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/roles/${editingAdmin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi cập nhật vai trò");

      setSuccessMsg(`Đã cập nhật vai trò thành ${editRole} thành công!`);
      setEditingAdmin(null);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || "Lỗi cập nhật vai trò");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (admin: SocAdminItem) => {
    if (admin.emailSnapshot === "kienquocn64@gmail.com" && admin.enabled) {
      setError("Không thể vô hiệu hóa tài khoản Quản trị viên Root tối cao (kienquocn64@gmail.com).");
      return;
    }

    const nextState = !admin.enabled;
    const confirmMsg = nextState
      ? `Bạn có chắc chắn muốn KÍCH HOẠT lại quyền quản trị cho ${admin.emailSnapshot || admin.userAuthId}?`
      : `Bạn có chắc chắn muốn VÔ HIỆU HÓA quyền quản trị của ${admin.emailSnapshot || admin.userAuthId}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/admin/roles/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi đổi trạng thái");

      setSuccessMsg(`Đã ${nextState ? "kích hoạt" : "vô hiệu hóa"} quản trị viên thành công!`);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || "Lỗi cập nhật trạng thái");
    }
  };

  const filteredAdmins = admins.filter((admin) => {
    const matchSearch =
      (admin.emailSnapshot || "").toLowerCase().includes(search.toLowerCase()) ||
      admin.userAuthId.toLowerCase().includes(search.toLowerCase()) ||
      admin.role.toLowerCase().includes(search.toLowerCase());

    const matchRole = roleFilter === "ALL" || admin.role === roleFilter;
    return matchSearch && matchRole;
  });

  const activeCount = admins.filter((a) => a.enabled).length;
  const revokedCount = admins.filter((a) => !a.enabled).length;

  return (
    <AdminShell>
      <div className="space-y-6 max-w-6xl">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-400" />
              Phân quyền & Quản trị Danh tính SOC (RBAC)
            </h1>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Quản lý danh sách nhân sự được cấp quyền SOC, phân chia vai trò và ma trận quyền hạn
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="h-8 bg-[#0a0a0a] border-[#222222] text-xs text-neutral-300 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowAddModal(true);
                if (availableUsers.length > 0) {
                  setFormUserAuthId(availableUsers[0].id);
                  setFormEmail(availableUsers[0].email);
                }
              }}
              className="h-8 bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition gap-1.5"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Thêm Quản trị viên
            </Button>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-1">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">Tổng số Quản trị viên</div>
            <div className="text-2xl font-bold text-white font-mono">{admins.length}</div>
            <p className="text-[10px] text-neutral-500 font-mono">Lưu trữ tại adq_db.soc_admins</p>
          </div>

          <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-1">
            <div className="text-[10px] font-mono text-emerald-400 uppercase">Đang Hoạt động (Active)</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">{activeCount}</div>
            <p className="text-[10px] text-neutral-500 font-mono">Được phép đăng nhập SOC</p>
          </div>

          <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-1">
            <div className="text-[10px] font-mono text-rose-400 uppercase">Đã Vô hiệu hóa</div>
            <div className="text-2xl font-bold text-rose-400 font-mono">{revokedCount}</div>
            <p className="text-[10px] text-neutral-500 font-mono">Bị chặn quyền truy cập</p>
          </div>

          <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-1">
            <div className="text-[10px] font-mono text-purple-400 uppercase">Vai trò Cấu hình</div>
            <div className="text-2xl font-bold text-purple-400 font-mono">4 Cấp độ</div>
            <p className="text-[10px] text-neutral-500 font-mono">Admin, Operator, Security, Auditor</p>
          </div>
        </div>

        {/* Filters and Table Section */}
        <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#222222] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-purple-400" />
              <h2 className="text-sm font-bold text-white">Danh sách Nhân sự Quản trị SOC</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 font-mono">
                {filteredAdmins.length} tài khoản
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <Input
                  type="text"
                  placeholder="Tìm email, UUID, vai trò..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-[#000000] border-[#222222] text-white text-xs pl-8 h-8 focus:border-neutral-500"
                />
              </div>

              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-[#000000] border border-[#222222] text-neutral-300 text-xs rounded-md h-8 px-2.5 outline-none focus:border-neutral-500"
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="SOC_ADMIN">SOC_ADMIN (Root)</option>
                <option value="SOC_OPERATOR">SOC_OPERATOR (Tác chiến)</option>
                <option value="SOC_SECURITY">SOC_SECURITY (An ninh)</option>
                <option value="SOC_AUDITOR">SOC_AUDITOR (Kiểm toán)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-[#1a1a1a]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1a1a1a] bg-[#050505] text-[10px] font-mono text-neutral-400 uppercase">
                  <th className="p-3">Quản trị viên</th>
                  <th className="p-3">Supabase Auth UUID</th>
                  <th className="p-3">Vai trò (Role)</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3">Ngày cấp</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151515]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-neutral-500 font-mono">
                      Đang tải danh sách phân quyền...
                    </td>
                  </tr>
                ) : filteredAdmins.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-neutral-500 font-mono">
                      Không tìm thấy quản trị viên nào khớp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredAdmins.map((admin) => {
                    const roleInfo = ROLES_META[admin.role] || {
                      name: admin.role,
                      badgeBg: "bg-neutral-900",
                      badgeBorder: "border-neutral-700",
                      badgeText: "text-neutral-300",
                    };
                    const isRoot = admin.emailSnapshot === "kienquocn64@gmail.com";

                    return (
                      <tr key={admin.id} className="hover:bg-[#0d0d0d] transition font-mono">
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-[10px] font-bold text-white">
                              {(admin.emailSnapshot || "AD")[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-white flex items-center gap-1.5">
                                {admin.emailSnapshot || "Chưa đặt email"}
                                {isRoot && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-800 text-purple-300">
                                    PRIMARY ROOT
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-neutral-500">ID: {admin.id}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                            <span className="truncate max-w-[140px] select-all">{admin.userAuthId}</span>
                            <button
                              onClick={() => handleCopy(admin.id, admin.userAuthId)}
                              className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition"
                              title="Copy UUID"
                            >
                              {copiedId === admin.id ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${roleInfo.badgeBg} ${roleInfo.badgeBorder} ${roleInfo.badgeText}`}
                          >
                            {admin.role}
                          </span>
                        </td>

                        <td className="p-3">
                          {admin.enabled ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              Hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-rose-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                              Vô hiệu hóa
                            </span>
                          )}
                        </td>

                        <td className="p-3 text-[11px] text-neutral-400">
                          {new Date(admin.createdAt).toLocaleDateString("vi-VN", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>

                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingAdmin(admin);
                                setEditRole(admin.role);
                              }}
                              className="h-7 px-2.5 bg-[#000000] border-[#222222] text-[11px] text-neutral-300 hover:text-white"
                            >
                              <SlidersHorizontal className="h-3 w-3 mr-1" />
                              Đổi vai trò
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isRoot && admin.enabled}
                              onClick={() => handleToggleStatus(admin)}
                              className={`h-7 px-2.5 border text-[11px] ${
                                admin.enabled
                                  ? "bg-rose-950/30 border-rose-900/50 text-rose-300 hover:bg-rose-950/60"
                                  : "bg-emerald-950/30 border-emerald-900/50 text-emerald-300 hover:bg-emerald-950/60"
                              }`}
                            >
                              {admin.enabled ? "Vô hiệu" : "Kích hoạt"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role Matrix & Description Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Roles Description */}
          <div className="lg:col-span-1 p-5 rounded-xl bg-[#0a0a0a] border border-[#222222] space-y-4">
            <div className="flex items-center gap-2 border-b border-[#222222] pb-3">
              <Layers className="h-4 w-4 text-sky-400" />
              <h3 className="text-sm font-bold text-white">Mô tả 4 Cấp bậc Vai trò SOC</h3>
            </div>

            <div className="space-y-3">
              {Object.entries(ROLES_META).map(([roleKey, meta]) => (
                <div key={roleKey} className="p-3 rounded-lg bg-[#050505] border border-[#1a1a1a] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText}`}
                    >
                      {roleKey}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400">{meta.level}</span>
                  </div>
                  <div className="text-xs font-semibold text-white">{meta.name}</div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed font-sans">{meta.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Permission Matrix */}
          <div className="lg:col-span-2 p-5 rounded-xl bg-[#0a0a0a] border border-[#222222] space-y-4">
            <div className="flex items-center gap-2 border-b border-[#222222] pb-3">
              <Lock className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Ma trận Quyền hạn Chi tiết (Permission Matrix)</h3>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#1a1a1a]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a1a] bg-[#050505] text-[10px] font-mono text-neutral-400 uppercase">
                    <th className="p-2.5">Module Hệ thống</th>
                    <th className="p-2.5 text-center text-purple-300">SOC_ADMIN</th>
                    <th className="p-2.5 text-center text-sky-300">OPERATOR</th>
                    <th className="p-2.5 text-center text-emerald-300">SECURITY</th>
                    <th className="p-2.5 text-center text-amber-300">AUDITOR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151515] font-mono text-[11px]">
                  {PERMISSION_MATRIX.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#0d0d0d] transition">
                      <td className="p-2.5 text-white font-sans">{row.module}</td>
                      <td className="p-2.5 text-center">
                        {row.admin === true ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 text-[10px]">
                            Full
                          </span>
                        ) : (
                          <span className="text-neutral-500">-</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {row.operator === true ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 text-[10px]">
                            Full
                          </span>
                        ) : row.operator === "Chỉ đọc" ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-300 text-[10px]">
                            Read
                          </span>
                        ) : (
                          <span className="text-neutral-500">-</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {row.security === true ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 text-[10px]">
                            Full
                          </span>
                        ) : row.security === "Chỉ đọc" ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-300 text-[10px]">
                            Read
                          </span>
                        ) : (
                          <span className="text-neutral-500">-</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {row.auditor === true || row.auditor === "Chỉ đọc" ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 text-[10px]">
                            Read
                          </span>
                        ) : (
                          <span className="text-neutral-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-neutral-500 font-mono">
              * Ghi chú: Mọi tác vụ cấp quyền hoặc thu hồi vai trò đều được ghi vết tự động vào bảng nhật ký kiểm toán (Audit Logs).
            </p>
          </div>
        </div>

        {/* Modal: Add New Admin */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#0a0a0a] border border-[#222222] rounded-xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-[#222222] pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-purple-400" />
                  <h3 className="text-sm font-bold text-white">Thêm Quản trị viên SOC mới</h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded text-neutral-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddAdminSubmit} className="space-y-4">
                {/* Mode Selector */}
                <div className="flex rounded-lg bg-[#000000] p-1 border border-[#222222] text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedUserMode("select")}
                    className={`flex-1 py-1.5 rounded-md font-semibold transition ${
                      selectedUserMode === "select" ? "bg-white text-black" : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    Chọn từ người dùng có sẵn
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUserMode("custom")}
                    className={`flex-1 py-1.5 rounded-md font-semibold transition ${
                      selectedUserMode === "custom" ? "bg-white text-black" : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    Nhập Supabase UUID tùy chỉnh
                  </button>
                </div>

                {selectedUserMode === "select" ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-neutral-300">CHỌN NGƯỜI DÙNG</label>
                    <select
                      value={formUserAuthId}
                      onChange={(e) => {
                        const uid = e.target.value;
                        setFormUserAuthId(uid);
                        const found = availableUsers.find((u) => u.id === uid);
                        if (found) setFormEmail(found.email);
                      }}
                      className="w-full bg-[#000000] border border-[#333333] text-white text-xs rounded-md h-10 px-3 outline-none focus:border-neutral-400"
                    >
                      {availableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.email} ({u.id.substring(0, 8)}...)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono text-neutral-300">SUPABASE AUTH UUID</label>
                      <Input
                        type="text"
                        placeholder="vd: 6fab82b0-d0d0-4474-a25a-d3f1ccb6f1a1"
                        value={formUserAuthId}
                        onChange={(e) => setFormUserAuthId(e.target.value)}
                        className="bg-[#000000] border-[#333333] text-white text-xs h-10 font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono text-neutral-300">EMAIL TÀI KHOẢN</label>
                      <Input
                        type="email"
                        placeholder="admin@example.com"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        className="bg-[#000000] border-[#333333] text-white text-xs h-10"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-neutral-300">VAI TRÒ CẤP QUYỀN</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full bg-[#000000] border border-[#333333] text-white text-xs rounded-md h-10 px-3 outline-none focus:border-neutral-400"
                  >
                    <option value="SOC_OPERATOR">SOC_OPERATOR (Điều hành tác chiến)</option>
                    <option value="SOC_SECURITY">SOC_SECURITY (Chuyên viên an ninh)</option>
                    <option value="SOC_AUDITOR">SOC_AUDITOR (Kiểm toán Read-Only)</option>
                    <option value="SOC_ADMIN">SOC_ADMIN (Toàn quyền Root)</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-[#222222] flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddModal(false)}
                    className="text-xs text-neutral-400 hover:text-white"
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting}
                    className="bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition"
                  >
                    {submitting ? "Đang xử lý..." : "Cấp quyền Quản trị"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Role */}
        {editingAdmin && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#0a0a0a] border border-[#222222] rounded-xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-[#222222] pb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-purple-400" />
                  <h3 className="text-sm font-bold text-white">Thay đổi Vai trò Quản trị viên</h3>
                </div>
                <button
                  onClick={() => setEditingAdmin(null)}
                  className="p-1 rounded text-neutral-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-[#050505] border border-[#1a1a1a] space-y-1 text-xs">
                  <div className="text-neutral-400">Tài khoản:</div>
                  <div className="font-semibold text-white">{editingAdmin.emailSnapshot || "Chưa có email"}</div>
                  <div className="text-[10px] font-mono text-neutral-500 select-all">{editingAdmin.userAuthId}</div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-neutral-300">CHỌN VAI TRÒ MỚI</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full bg-[#000000] border border-[#333333] text-white text-xs rounded-md h-10 px-3 outline-none focus:border-neutral-400"
                  >
                    <option value="SOC_ADMIN">SOC_ADMIN (Toàn quyền Root)</option>
                    <option value="SOC_OPERATOR">SOC_OPERATOR (Điều hành tác chiến)</option>
                    <option value="SOC_SECURITY">SOC_SECURITY (Chuyên viên an ninh)</option>
                    <option value="SOC_AUDITOR">SOC_AUDITOR (Kiểm toán Read-Only)</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-[#222222] flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingAdmin(null)}
                    className="text-xs text-neutral-400 hover:text-white"
                  >
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={submitting}
                    onClick={handleRoleUpdate}
                    className="bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition"
                  >
                    {submitting ? "Đang lưu..." : "Cập nhật Vai trò"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
