"use client";

import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  Database,
  Search,
  RefreshCw,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Code,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminPostgresPage() {
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState("admin_users");
  const [tableData, setTableData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Row Inspection Modal
  const [inspectingRow, setInspectingRow] = useState<any>(null);

  // Fetch Tables Registry
  useEffect(() => {
    const loadTables = async () => {
      try {
        const res = await fetch("/api/admin/data/postgres");
        if (res.status === 401 || res.status === 403) {
          window.location.href = "/admin/login";
          return;
        }
        const data = await res.json();
        if (data.ok && data.tables) {
          setTables(data.tables);
        }
      } catch {}
    };
    loadTables();
  }, []);

  const fetchTableData = async () => {
    if (!selectedTable) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        table: selectedTable,
        page: String(page),
        limit: String(limit),
        sortOrder,
        ...(sortBy ? { sortBy } : {}),
        ...(search ? { search } : {}),
      });

      const res = await fetch(`/api/admin/data/postgres?${params}`);
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Không thể truy vấn bảng");
      setTableData(data);
    } catch (err: any) {
      setError(err.message || "Lỗi truy vấn cơ sở dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    setSortBy("");
  }, [selectedTable]);

  useEffect(() => {
    fetchTableData();
  }, [selectedTable, page, limit, sortBy, sortOrder]);

  const rows = tableData?.rows || [];
  const schema = tableData?.schema;
  const total = tableData?.total || 0;
  const totalPages = tableData?.totalPages || 1;

  // Extract columns dynamically from rows or schema
  const columnKeys = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-400" />
              PostgreSQL Data Explorer (Read-Only)
            </h1>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Quan sát an toàn 12 bảng nghiệp vụ chính • Tự động mã hóa và che giấu dữ liệu nhạy cảm
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="bg-[#0a0a0a] border border-[#333333] text-white text-xs rounded-md h-8 px-3 outline-none font-mono font-bold"
            >
              {tables.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.category})
                </option>
              ))}
            </select>
            <Button
              onClick={fetchTableData}
              variant="outline"
              size="sm"
              disabled={loading}
              className="h-8 gap-1.5 border-[#333333] bg-[#0a0a0a] text-xs text-neutral-300 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Table Description Banner */}
        {schema && (
          <div className="p-3 rounded-lg bg-[#0a0a0a] border border-[#222222] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-bold text-white font-mono">{schema.displayName}</span>
              <p className="text-neutral-400 text-[11px] mt-0.5">{schema.description}</p>
            </div>
            <div className="text-[11px] font-mono text-neutral-500 shrink-0">
              Tổng số bản ghi: <strong className="text-emerald-400">{total}</strong>
            </div>
          </div>
        )}

        {/* Controls: Search & Page Limit */}
        <div className="flex items-center gap-2 bg-[#0a0a0a] p-3 rounded-lg border border-[#222222]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Tìm kiếm trong ${selectedTable}...`}
              className="bg-[#000000] border-[#333333] text-xs h-8 pl-9 text-white"
            />
          </div>
          <Button size="sm" onClick={() => { setPage(1); fetchTableData(); }} className="h-8 text-xs bg-white text-black hover:bg-neutral-200">
            Tìm
          </Button>

          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="bg-[#000000] border border-[#333333] text-neutral-300 text-xs rounded-md h-8 px-2 outline-none font-mono"
          >
            <option value="25">25 dòng/trang</option>
            <option value="50">50 dòng/trang</option>
            <option value="100">100 dòng/trang</option>
          </select>
        </div>

        {/* Dynamic Data Table */}
        <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] overflow-hidden">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#222222] bg-[#050505] text-neutral-400 font-mono text-[11px] sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center">#</th>
                  {columnKeys.map((col) => (
                    <th
                      key={col}
                      onClick={() => {
                        if (schema?.allowSortColumns.includes(col)) {
                          if (sortBy === col) {
                            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                          } else {
                            setSortBy(col);
                            setSortOrder("desc");
                          }
                        }
                      }}
                      className={`px-3 py-2.5 whitespace-nowrap ${
                        schema?.allowSortColumns.includes(col) ? "cursor-pointer hover:text-white" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span>{col}</span>
                        {sortBy === col && (
                          <span className="text-emerald-400 text-[10px]">
                            {sortOrder === "asc" ? "▲" : "▼"}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right w-16">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {loading ? (
                  <tr>
                    <td colSpan={columnKeys.length + 2} className="px-4 py-12 text-center text-neutral-500 font-mono">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-400" />
                      Đang đọc dữ liệu bảng...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={columnKeys.length + 2} className="px-4 py-8 text-center text-neutral-500 font-mono">
                      Không có dòng dữ liệu nào trong bảng này.
                    </td>
                  </tr>
                ) : (
                  rows.map((r: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[#111111] transition">
                      <td className="px-3 py-2 text-center font-mono text-[10px] text-neutral-500">
                        {(page - 1) * limit + idx + 1}
                      </td>
                      {columnKeys.map((col) => {
                        const val = r[col];
                        const isObject = typeof val === "object" && val !== null;
                        const isRedacted = String(val).includes("[REDACTED]");

                        return (
                          <td key={col} className="px-3 py-2 whitespace-nowrap font-mono text-[11px] max-w-xs truncate">
                            {isRedacted ? (
                              <span className="text-rose-400 font-bold">[REDACTED]</span>
                            ) : isObject ? (
                              <span className="text-neutral-500">{JSON.stringify(val).slice(0, 30)}...</span>
                            ) : typeof val === "boolean" ? (
                              <span className={val ? "text-emerald-400" : "text-neutral-500"}>
                                {String(val)}
                              </span>
                            ) : val === null || val === undefined ? (
                              <span className="text-neutral-600">null</span>
                            ) : (
                              <span className="text-neutral-300">{String(val)}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInspectingRow(r)}
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

        {/* Row Detail Inspection Modal */}
        {inspectingRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-[#0a0a0a] border border-[#222222] rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
              <div className="p-4 border-b border-[#222222] flex items-center justify-between bg-[#050505]">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-white">
                  <Code className="h-4 w-4 text-emerald-400" />
                  Bản ghi chi tiết: {selectedTable}
                </div>
                <button
                  onClick={() => setInspectingRow(null)}
                  className="p-1 rounded text-neutral-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto font-mono text-xs">
                <pre className="p-4 rounded-lg bg-[#000000] border border-[#222222] text-neutral-200 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(inspectingRow, null, 2)}
                </pre>
              </div>

              <div className="p-3 border-t border-[#222222] bg-[#050505] flex justify-end">
                <Button
                  onClick={() => setInspectingRow(null)}
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
