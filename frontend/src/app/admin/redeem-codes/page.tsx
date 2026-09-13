"use client";

import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  KeyRound,
  Plus,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  X,
  History,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminRedeemCodesPage() {
  const [codes, setCodes] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Creation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTier, setNewTier] = useState("PRO");
  const [durationDays, setDurationDays] = useState("30");
  const [maxUses, setMaxUses] = useState("1");
  const [customCode, setCustomCode] = useState("");
  const [createdCodeResult, setCreatedCodeResult] = useState<string | null>(null);

  const fetchCodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resCodes, resRedemptions] = await Promise.all([
        fetch("/api/admin/redeem-codes"),
        fetch("/api/admin/data/postgres?table=redeem_code_redemptions&limit=20"),
      ]);

      if (resCodes.status === 401 || resCodes.status === 403) {
        window.location.href = "/admin/login";
        return;
      }

      const dataCodes = await resCodes.json();
      const dataRedemptions = await resRedemptions.json();

      setCodes(dataCodes.codes || []);
      setRedemptions(dataRedemptions.rows || []);
    } catch (err: any) {
      setError(err.message || "Lỗi tải danh sách mã");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/redeem-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageTier: newTier,
          durationDays: Number.parseInt(durationDays, 10) || 30,
          maxUses: Number.parseInt(maxUses, 10) || 1,
          code: customCode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tạo mã");

      setCreatedCodeResult(data.code?.code || "Tạo thành công");
      fetchCodes();
    } catch (err: any) {
      setError(err.message || "Lỗi tạo mã");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-purple-400" />
              Mã Kích hoạt License Redeem
            </h1>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Phát hành và quản lý mã CSPRNG 128-bit kích hoạt gói PRO và PRO_MAX
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setShowCreateModal(true);
                setCreatedCodeResult(null);
              }}
              size="sm"
              className="h-8 gap-1.5 bg-white text-black hover:bg-neutral-200 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Tạo Mã Mới
            </Button>
            <Button
              onClick={fetchCodes}
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

        {/* Redeem Codes Table */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-white uppercase font-mono tracking-wider">
            Danh sách Mã License ({codes.length})
          </div>

          <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#222222] bg-[#050505] text-neutral-400 font-mono text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Mã License</th>
                    <th className="px-4 py-3">Gói Áp Dụng</th>
                    <th className="px-4 py-3">Thời hạn</th>
                    <th className="px-4 py-3">Số lượt Đã dùng / Tối đa</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Ngày tạo</th>
                    <th className="px-4 py-3 text-right">Sao chép</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-neutral-500 font-mono">
                        Đang tải danh sách mã...
                      </td>
                    </tr>
                  ) : codes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-neutral-500 font-mono">
                        Chưa có mã nào được tạo.
                      </td>
                    </tr>
                  ) : (
                    codes.map((c) => (
                      <tr key={c.id} className="hover:bg-[#111111] transition">
                        <td className="px-4 py-3 font-mono font-bold text-white tracking-wider">
                          {c.code}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                            c.packageTier === "PRO_MAX"
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                          }`}>
                            {c.packageTier}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-neutral-300">
                          {c.durationLabel}
                        </td>
                        <td className="px-4 py-3 font-mono text-neutral-300">
                          {c.usedCount} / {c.maxUses}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            c.status === "UNUSED"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : c.status === "PARTIAL"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-neutral-800 text-neutral-500"
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] font-mono text-neutral-400">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString("vi-VN") : "--"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(c.code, c.id)}
                            className="h-7 px-2 text-xs text-neutral-300 hover:text-white"
                          >
                            {copiedId === c.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Redemption History */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
            <History className="h-4 w-4 text-emerald-400" />
            Lịch sử Kích hoạt Gần nhất
          </div>

          <div className="rounded-lg border border-[#222222] bg-[#0a0a0a] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#222222] bg-[#050505] text-neutral-400 font-mono text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Email Kích Hoạt</th>
                    <th className="px-4 py-3">User Auth ID</th>
                    <th className="px-4 py-3">Mã License ID</th>
                    <th className="px-4 py-3">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {redemptions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-neutral-500 font-mono">
                        Chưa có lịch sử kích hoạt nào.
                      </td>
                    </tr>
                  ) : (
                    redemptions.map((r) => (
                      <tr key={r.id} className="hover:bg-[#111111] transition">
                        <td className="px-4 py-2.5 font-medium text-white">{r.userEmail}</td>
                        <td className="px-4 py-2.5 font-mono text-neutral-400">{r.userAuthId}</td>
                        <td className="px-4 py-2.5 font-mono text-neutral-400">{r.redeemCodeId}</td>
                        <td className="px-4 py-2.5 font-mono text-neutral-500 text-[11px]">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString("vi-VN") : "--"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Creation Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-[#0a0a0a] border border-[#222222] rounded-xl shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[#222222] pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-purple-400" />
                  Phát hành Mã License CSPRNG
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-neutral-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {createdCodeResult ? (
                <div className="space-y-4 py-2">
                  <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-center space-y-2">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto" />
                    <div className="text-xs text-emerald-300">Mã đã được tạo thành công:</div>
                    <div className="text-base font-mono font-bold text-white tracking-widest bg-black p-2 rounded border border-emerald-500/40 select-all">
                      {createdCodeResult}
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setCreatedCodeResult(null);
                      setShowCreateModal(false);
                    }}
                    className="w-full bg-white text-black hover:bg-neutral-200 text-xs font-semibold"
                  >
                    Hoàn tất
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleCreateCode} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-neutral-400">Gói Dịch Vụ</label>
                    <select
                      value={newTier}
                      onChange={(e) => setNewTier(e.target.value)}
                      className="w-full bg-[#000000] border border-[#333333] text-white text-xs rounded-md h-9 px-3 outline-none font-mono"
                    >
                      <option value="PRO">PRO</option>
                      <option value="PRO_MAX">PRO_MAX</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-neutral-400">Thời hạn (Ngày)</label>
                    <Input
                      type="number"
                      value={durationDays}
                      onChange={(e) => setDurationDays(e.target.value)}
                      min="1"
                      className="bg-[#000000] border-[#333333] text-white text-xs h-9 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-neutral-400">Số lượt kích hoạt tối đa</label>
                    <Input
                      type="number"
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      min="1"
                      className="bg-[#000000] border-[#333333] text-white text-xs h-9 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-neutral-400">Mã tùy chỉnh (Bỏ trống để tự động sinh CSPRNG 128-bit)</label>
                    <Input
                      value={customCode}
                      onChange={(e) => setCustomCode(e.target.value)}
                      placeholder="VD: ADQ-PRO-2026-VIP"
                      className="bg-[#000000] border-[#333333] text-white text-xs h-9 font-mono uppercase"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateModal(false)}
                      className="h-8 text-xs border-[#333333] bg-[#000000] text-neutral-300"
                    >
                      Hủy
                    </Button>
                    <Button
                      type="submit"
                      disabled={creating}
                      size="sm"
                      className="h-8 text-xs bg-white text-black hover:bg-neutral-200 font-semibold"
                    >
                      {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                      Phát Hành Mã
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
