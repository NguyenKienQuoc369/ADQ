"use client";

import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  Lock,
  RefreshCw,
  AlertCircle,
  Users,
  ShieldAlert,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminSupabasePage() {
  const [activeTab, setActiveTab] = useState<"users" | "reconciliation">("users");
  const [usersData, setUsersData] = useState<any>(null);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/data/supabase?view=users&page=${page}&limit=25`);
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Không thể tải danh sách Supabase users");
      setUsersData(data);
    } catch (err: any) {
      setError(err.message || "Lỗi kết nối Supabase Auth");
    } finally {
      setLoading(false);
    }
  };

  const fetchReconciliation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/data/supabase?view=reconciliation");
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Không thể đối soát dữ liệu");
      setReconciliation(data);
    } catch (err: any) {
      setError(err.message || "Lỗi đối soát dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers();
    } else {
      fetchReconciliation();
    }
  }, [activeTab, page]);

  const users = usersData?.users || [];
  const totalUsers = usersData?.total || 0;
  const totalPages = Math.ceil(totalUsers / 25) || 1;

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Lock className="h-5 w-5 text-sky-400" />
              Supabase Auth & Định danh Người dùng
            </h1>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Quản lý tài khoản Auth và đối soát tính nhất quán giữa Supabase Auth và cơ sở dữ liệu PostgreSQL
            </p>
          </div>
          <Button
            onClick={() => (activeTab === "users" ? fetchUsers() : fetchReconciliation())}
            variant="outline"
            size="sm"
            disabled={loading}
            className="h-8 gap-2 border-[#333333] bg-[#0a0a0a] text-xs text-neutral-300 hover:text-white"
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

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-[#222222] pb-1">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-3 py-1.5 text-xs font-mono font-semibold transition border-b-2 ${
              activeTab === "users"
                ? "border-white text-white"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Danh sách Auth Users ({totalUsers})
          </button>
          <button
            onClick={() => setActiveTab("reconciliation")}
            className={`px-3 py-1.5 text-xs font-mono font-semibold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === "reconciliation"
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Đối soát & Phát hiện Lệch dữ liệu
            {reconciliation?.anomaliesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                {reconciliation.anomaliesCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Auth Users */}
        {activeTab === "users" && (
          <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#222222] bg-[#050505] text-neutral-400 font-mono text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Auth UUID</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Xác thực Email</th>
                    <th className="px-4 py-3">Đăng nhập gần nhất</th>
                    <th className="px-4 py-3">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-neutral-500 font-mono">
                        Đang tải danh sách Supabase Auth...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-neutral-500 font-mono">
                        Không có dữ liệu người dùng.
                      </td>
                    </tr>
                  ) : (
                    users.map((u: any) => (
                      <tr key={u.id} className="hover:bg-[#111111] transition">
                        <td className="px-4 py-3 font-mono text-[11px] text-neutral-400">{u.id}</td>
                        <td className="px-4 py-3 font-medium text-white">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-300">
                            {u.appMetadata?.provider || "email"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 font-mono text-[11px] ${
                            u.confirmedAt ? "text-emerald-400" : "text-amber-400"
                          }`}>
                            {u.confirmedAt ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" /> Đã xác nhận
                              </>
                            ) : (
                              "Chưa xác nhận"
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] font-mono text-neutral-400">
                          {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString("vi-VN") : "Chưa đăng nhập"}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-mono text-neutral-500">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "--"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t border-[#222222] bg-[#050505] flex items-center justify-between text-xs font-mono text-neutral-400">
              <div>
                Trang <strong className="text-white">{page}</strong> / <strong className="text-white">{totalPages}</strong>
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
        )}

        {/* Tab 2: Reconciliation */}
        {activeTab === "reconciliation" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222]">
                <div className="text-[10px] font-mono text-neutral-400 uppercase">Tổng tài khoản Supabase Auth</div>
                <div className="text-xl font-bold text-sky-400 mt-1 font-mono">{reconciliation?.totalAuthUsers ?? 0}</div>
              </div>
              <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222]">
                <div className="text-[10px] font-mono text-neutral-400 uppercase">Hồ sơ PostgreSQL (admin_users)</div>
                <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">{reconciliation?.totalDbUsers ?? 0}</div>
              </div>
              <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222]">
                <div className="text-[10px] font-mono text-neutral-400 uppercase">Số lượng Bất thường</div>
                <div className={`text-xl font-bold mt-1 font-mono ${
                  (reconciliation?.anomaliesCount ?? 0) > 0 ? "text-amber-400" : "text-emerald-400"
                }`}>
                  {reconciliation?.anomaliesCount ?? 0}
                </div>
              </div>
            </div>

            {/* Anomalies List */}
            <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] p-4 space-y-3">
              <div className="text-xs font-bold text-white uppercase font-mono">
                Chi tiết Bất thường & Lệch dữ liệu
              </div>

              {reconciliation?.anomaliesCount === 0 ? (
                <div className="p-6 text-center text-xs text-emerald-400 font-mono flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                  <span>Dữ liệu giữa Supabase Auth và PostgreSQL hoàn toàn đồng bộ, không có lệch thông tin.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {reconciliation?.missingInDb?.map((m: any, idx: number) => (
                    <div key={idx} className="p-3 rounded bg-[#000000] border border-amber-500/30 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white">{m.email}</div>
                        <div className="text-[11px] font-mono text-neutral-400">{m.authUserId}</div>
                      </div>
                      <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        {m.anomaly}
                      </span>
                    </div>
                  ))}

                  {reconciliation?.tierMismatches?.map((tm: any, idx: number) => (
                    <div key={idx} className="p-3 rounded bg-[#000000] border border-amber-500/30 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white">{tm.email}</div>
                        <div className="text-[11px] font-mono text-neutral-400">
                          Auth Metadata: {tm.authMetadataTier} ↔ Postgres: {tm.postgresTier}
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        {tm.anomaly}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
