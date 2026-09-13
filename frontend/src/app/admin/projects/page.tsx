"use client";

import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Folder, Search, RefreshCw, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminProjectsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/data/products/projects?page=${page}&limit=25&search=${encodeURIComponent(search)}`);
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tải danh sách");
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || "Lỗi tải dự án");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [page]);

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Folder className="h-5 w-5 text-emerald-400" />
              Dự án & Mục tiêu Rà quét (Targets)
            </h1>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Tổng số {total} mục tiêu được theo dõi trên PostgreSQL
            </p>
          </div>
          <Button
            onClick={fetchProjects}
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
              placeholder="Tìm kiếm theo domain..."
              className="bg-[#000000] border-[#333333] text-xs h-8 pl-9 text-white"
            />
          </div>
          <Button size="sm" onClick={() => { setPage(1); fetchProjects(); }} className="h-8 text-xs bg-white text-black hover:bg-neutral-200">
            Tìm
          </Button>
        </div>

        <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#222222] bg-[#050505] text-neutral-400 font-mono text-[11px]">
                <tr>
                  <th className="px-4 py-3">Mục tiêu (Domain)</th>
                  <th className="px-4 py-3">Tên Dự Án</th>
                  <th className="px-4 py-3">Điểm Rủi Ro</th>
                  <th className="px-4 py-3">Quét Gần Nhất</th>
                  <th className="px-4 py-3">Ngày Tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-neutral-500 font-mono">
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500 font-mono">
                      Không có dữ liệu mục tiêu nào.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.id} className="hover:bg-[#111111] transition">
                      <td className="px-4 py-3 font-mono font-bold text-white flex items-center gap-1.5">
                        {it.domain}
                      </td>
                      <td className="px-4 py-3 text-neutral-300">
                        {it.projectDetail?.title || it.domain}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          (it.projectDetail?.riskScore ?? 0) > 70
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : (it.projectDetail?.riskScore ?? 0) > 30
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}>
                          Risk Score: {it.projectDetail?.riskScore ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] font-mono text-neutral-400">
                        {it.projectDetail?.lastScanAt ? new Date(it.projectDetail.lastScanAt).toLocaleString("vi-VN") : "Chưa quét"}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-mono text-neutral-500">
                        {it.createdAt ? new Date(it.createdAt).toLocaleDateString("vi-VN") : "--"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
