"use client";

import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { FileText, Search, RefreshCw, AlertCircle, Eye, X, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminAuditLogsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectingLog, setInspectingLog] = useState<any>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/data/products/audit-logs?page=${page}&limit=25&search=${encodeURIComponent(search)}`);
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tải nhật ký");
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || "Lỗi tải nhật ký audit");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-400" />
              Nhật ký Hoạt động Quản trị (Admin Audit Logs)
            </h1>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Ghi vết toàn bộ hành vi quản trị viên, thay đổi cấu hình, tạo mã license, xác thực SOC
            </p>
          </div>
          <Button
            onClick={fetchLogs}
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

        <div className="flex items-center gap-2 bg-[#0a0a0a] p-3 rounded-lg border border-[#222222]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm theo hành động (VD: SOC_LOGIN, ROLE_UPDATE)..."
              className="bg-[#000000] border-[#333333] text-xs h-8 pl-9 text-white"
            />
          </div>
          <Button size="sm" onClick={() => { setPage(1); fetchLogs(); }} className="h-8 text-xs bg-white text-black hover:bg-neutral-200">
            Tìm
          </Button>
        </div>

        <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#222222] bg-[#050505] text-neutral-400 font-mono text-[11px]">
                <tr>
                  <th className="px-4 py-3">Hành Động</th>
                  <th className="px-4 py-3">Admin Thực Hiện</th>
                  <th className="px-4 py-3">Đối Tượng Tác Động</th>
                  <th className="px-4 py-3">Thời Gian</th>
                  <th className="px-4 py-3 text-right">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-neutral-500 font-mono">
                      Đang tải nhật ký...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500 font-mono">
                      Chưa có ghi vết hành động nào.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.id} className="hover:bg-[#111111] transition">
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-800 text-neutral-200">
                          {it.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-neutral-300">
                        {it.adminAuthUserId || "soc-system"}
                      </td>
                      <td className="px-4 py-3 font-mono text-neutral-400">
                        {it.targetAdminUserId || "--"}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-mono text-neutral-500">
                        {it.createdAt ? new Date(it.createdAt).toLocaleString("vi-VN") : "--"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInspectingLog(it)}
                          className="h-6 px-1.5 text-xs text-neutral-400 hover:text-white"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {inspectingLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-xl bg-[#0a0a0a] border border-[#222222] rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
              <div className="p-4 border-b border-[#222222] flex items-center justify-between bg-[#050505]">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-white">
                  <Code className="h-4 w-4 text-emerald-400" />
                  Ghi vết chi tiết: {inspectingLog.action}
                </div>
                <button
                  onClick={() => setInspectingLog(null)}
                  className="p-1 rounded text-neutral-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto font-mono text-xs">
                <pre className="p-4 rounded-lg bg-[#000000] border border-[#222222] text-neutral-200 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(inspectingLog, null, 2)}
                </pre>
              </div>

              <div className="p-3 border-t border-[#222222] bg-[#050505] flex justify-end">
                <Button
                  onClick={() => setInspectingLog(null)}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-[#333333] bg-[#000000] text-neutral-300"
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
