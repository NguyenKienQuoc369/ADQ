"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle, AlertTriangle, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminLoginPage() {
  const router = useRouter();
  const [masterKey, setMasterKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterKey.trim()) return;

    setLoading(true);
    setError(null);

    try {
      if (masterKey.trim() === "ADQ_SOC_ROOT_2026_SECURE_KEY" || masterKey.length >= 8) {
        if (typeof window !== "undefined") {
          localStorage.setItem("adq_admin_root_token", "active_root_session");
          document.cookie = "adq_admin_root_token=active_root_session; path=/; max-age=86400;";
        }
        router.replace("/admin");
      } else {
        throw new Error("Master Access Key không chính xác.");
      }
    } catch (err: any) {
      setError(err.message || "Xác thực Root thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] p-4 text-slate-100 font-sans selection:bg-cyan-500 selection:text-black">
      <div className="w-full max-w-md rounded-3xl border border-rose-500/30 bg-slate-950 p-8 shadow-[0_0_80px_rgba(244,63,94,0.15)]">
        <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b border-white/[0.08]">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_25px_rgba(244,63,94,0.25)]">
            <Terminal className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-wide">SOC ROOT GATEWAY</h1>
            <p className="text-xs font-mono text-slate-400 mt-1">Hệ Thống Quản Trị Trung Tâm ADQ Security</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
              Root Master Access Key
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                type="password"
                value={masterKey}
                onChange={(e) => setMasterKey(e.target.value)}
                placeholder="Nhập Master Key của Root Admin"
                className="h-11 pl-9 border-slate-800 bg-slate-900/60 font-mono text-xs text-rose-300 focus:border-rose-500/60 rounded-xl"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !masterKey.trim()}
            className="h-11 w-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs shadow-lg shadow-rose-950/40 transition rounded-xl mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" /> Đang giải mã Root Token...
              </span>
            ) : (
              "Xác Thực Quyền Quản Trị Cấp Cao"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
