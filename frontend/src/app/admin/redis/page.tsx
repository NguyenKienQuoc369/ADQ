"use client";

import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  Radio,
  Search,
  RefreshCw,
  AlertCircle,
  Eye,
  X,
  Code,
  Layers,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PREDEFINED_NAMESPACES = [
  { label: "Tất cả Keys", prefix: "" },
  { label: "Stress Jobs", prefix: "stress_job:" },
  { label: "Stress History", prefix: "stress_history:" },
  { label: "Copilot Messages", prefix: "copilot_msgs:" },
  { label: "Copilot Convs", prefix: "copilot_convs:" },
  { label: "Scan Meta", prefix: "job_meta:" },
  { label: "Worker Heartbeats", prefix: "worker_heartbeat:" },
  { label: "APK Audit", prefix: "apk:" },
  { label: "Verifications", prefix: "target_verification:" },
];

export default function AdminRedisPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState("");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState("0");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Key detail inspection
  const [inspectingKey, setInspectingKey] = useState<any>(null);
  const [loadingKeyDetail, setLoadingKeyDetail] = useState(false);

  const fetchKeys = async (targetCursor: string = "0") => {
    setLoading(true);
    setError(null);
    try {
      const prefix = selectedNamespace || search || "";
      const params = new URLSearchParams({
        cursor: targetCursor,
        limit: "40",
        ...(prefix ? { prefix } : {}),
      });

      const res = await fetch(`/api/admin/data/redis?${params}`);
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Không thể SCAN Redis keys");

      setKeys(data.keys || []);
      setNextCursor(data.nextCursor);
      setCursor(targetCursor);
    } catch (err: any) {
      setError(err.message || "Lỗi truy vấn Redis");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys("0");
  }, [selectedNamespace]);

  const inspectKey = async (keyName: string) => {
    setLoadingKeyDetail(true);
    try {
      const res = await fetch(`/api/admin/data/redis?key=${encodeURIComponent(keyName)}`);
      const data = await res.json();
      if (data.ok) {
        setInspectingKey(data);
      }
    } catch (err) {
      console.error("Lỗi lấy giá trị key:", err);
    } finally {
      setLoadingKeyDetail(false);
    }
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Radio className="h-5 w-5 text-amber-400" />
              Redis Live State & Keyspace Explorer
            </h1>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Truy vấn phi khóa (Non-blocking SCAN) trạng thái thời gian thực • Che giấu token và bí mật
            </p>
          </div>
          <Button
            onClick={() => fetchKeys("0")}
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

        {/* Namespace Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {PREDEFINED_NAMESPACES.map((ns) => (
            <button
              key={ns.prefix}
              onClick={() => {
                setSelectedNamespace(ns.prefix);
                setSearch("");
              }}
              className={`px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap transition ${
                selectedNamespace === ns.prefix
                  ? "bg-amber-400 text-black font-bold"
                  : "bg-[#0a0a0a] border border-[#222222] text-neutral-400 hover:text-white"
              }`}
            >
              {ns.label}
            </button>
          ))}
        </div>

        {/* Search & Cursor Controls */}
        <div className="flex items-center gap-2 bg-[#0a0a0a] p-3 rounded-lg border border-[#222222]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm prefix key cụ thể (VD: stress_job:stress_...)"
              className="bg-[#000000] border-[#333333] text-xs h-8 pl-9 text-white"
            />
          </div>
          <Button
            size="sm"
            onClick={() => {
              setSelectedNamespace("");
              fetchKeys("0");
            }}
            className="h-8 text-xs bg-white text-black hover:bg-neutral-200"
          >
            SCAN
          </Button>
        </div>

        {/* Redis Keys Table */}
        <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#222222] bg-[#050505] text-neutral-400 font-mono text-[11px]">
                <tr>
                  <th className="px-4 py-3">Key Name</th>
                  <th className="px-4 py-3">Namespace</th>
                  <th className="px-4 py-3">Data Type</th>
                  <th className="px-4 py-3">TTL (Seconds)</th>
                  <th className="px-4 py-3 text-right">Xem Giá Trị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-neutral-500 font-mono">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-400" />
                      Đang thực hiện SCAN non-blocking...
                    </td>
                  </tr>
                ) : keys.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500 font-mono">
                      Không tìm thấy key nào trong namespace này.
                    </td>
                  </tr>
                ) : (
                  keys.map((k, idx) => (
                    <tr key={idx} className="hover:bg-[#111111] transition">
                      <td className="px-4 py-2.5 font-mono font-medium text-white max-w-md truncate">
                        {k.key}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-300">
                          {k.namespace}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-neutral-400 uppercase text-[10px]">
                        {k.type}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-neutral-300">
                        {k.ttl === -1 ? "Vĩnh viễn (-1)" : k.ttl === -2 ? "Hết hạn" : `${k.ttl}s`}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => inspectKey(k.key)}
                          className="h-6 px-2 text-xs text-amber-400 hover:text-white"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Xem
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* SCAN Cursor Pagination */}
          <div className="p-3 border-t border-[#222222] bg-[#050505] flex items-center justify-between text-xs font-mono text-neutral-400">
            <div>
              Cursor hiện tại: <strong className="text-white">{cursor}</strong> (Hiển thị {keys.length} keys)
            </div>
            {nextCursor && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchKeys(nextCursor)}
                className="h-7 text-xs border-[#333333] bg-[#000000] text-amber-400 hover:text-white"
              >
                SCAN Tiếp theo (Cursor: {nextCursor}) →
              </Button>
            )}
          </div>
        </div>

        {/* Key Detail Modal */}
        {inspectingKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-[#0a0a0a] border border-[#222222] rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
              <div className="p-4 border-b border-[#222222] flex items-center justify-between bg-[#050505]">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-white truncate max-w-[80%]">
                  <Code className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="truncate">{inspectingKey.key}</span>
                </div>
                <button
                  onClick={() => setInspectingKey(null)}
                  className="p-1 rounded text-neutral-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-3 font-mono text-xs">
                <div className="flex items-center gap-4 text-[11px] text-neutral-400">
                  <span>Type: <strong className="text-white">{inspectingKey.type}</strong></span>
                  <span>TTL: <strong className="text-white">{inspectingKey.ttl}s</strong></span>
                </div>
                <pre className="p-4 rounded-lg bg-[#000000] border border-[#222222] text-neutral-200 overflow-x-auto whitespace-pre-wrap">
                  {typeof inspectingKey.value === "object"
                    ? JSON.stringify(inspectingKey.value, null, 2)
                    : String(inspectingKey.value)}
                </pre>
              </div>

              <div className="p-3 border-t border-[#222222] bg-[#050505] flex justify-end">
                <Button
                  onClick={() => setInspectingKey(null)}
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
