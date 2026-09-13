"use client";

import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ShieldAlert, Search, RefreshCw, AlertCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminScansPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScans = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/data/products/scans?page=${page}&limit=25&search=${encodeURIComponent(search)}`);
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tải danh sách");
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || "Lỗi tải phiên quét");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScans();
  }, [page]);

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-emerald-400" />
              Phiên Rà quét An ninh (Scan Jobs)
            </h1>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Tổng số {total} phiên quét DAST, Recon, Port Scan, Secret Hunter
            </p>
          </div>
          <Button
            onClick={fetchScans}
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
              placeholder="Tìm kiếm theo domain hoặc Scan ID..."
              className="bg-[#000000] border-[#333333] text-xs h-8 pl-9 text-white"
            />
          </div>
          <Button size="sm" onClick={() => { setPage(1); fetchScans(); }} className="h-8 text-xs bg-white text-black hover:bg-neutral-200">
            Tìm
          </Button>
        </div>

        <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#222222] bg-[#050505] text-neutral-400 font-mono text-[11px]">
                <tr>
                  <th className="px-4 py-3">Mục tiêu (Target)</th>
                  <th className="px-4 py-3">Scan ID</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Lỗ hổng</th>
                  <th className="px-4 py-3">Hosts / Endpoints</th>
                  <th className="px-4 py-3">Thời gian Tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-neutral-500 font-mono">
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-neutral-500 font-mono">
                      Không có phiên quét nào.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.scanId} className="hover:bg-[#111111] transition">
                      <td className="px-4 py-3 font-mono font-bold text-white">
                        {it.targetDomain}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-neutral-400">
                        {it.scanId}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          it.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : it.status === "RUNNING"
                            ? "bg-sky-500/10 text-sky-400 border border-sky-500/20 animate-pulse"
                            : "bg-neutral-800 text-neutral-400"
                        }`}>
                          {it.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-rose-400">
                        {it._count?.vulnerabilities ?? 0}
                      </td>
                      <td className="px-4 py-3 font-mono text-neutral-300">
                        {it._count?.liveHosts ?? 0} hosts • {it._count?.endpoints ?? 0} endpoints
                      </td>
                      <td className="px-4 py-3 text-[11px] font-mono text-neutral-500">
                        {it.createdAt ? new Date(it.createdAt).toLocaleString("vi-VN") : "--"}
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
