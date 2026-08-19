"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, KeyRound, LoaderCircle, AlertTriangle, Terminal, Lock, ArrowRight, ShieldAlert, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";

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

    // Giả lập độ trễ xác thực an ninh mật mã 0.6s
    await new Promise((resolve) => setTimeout(resolve, 600));

    if (masterKey.trim() === "@sisiniki123") {
      if (typeof window !== "undefined") {
        localStorage.setItem("adq_admin_root_token", "soc_root_authorized_session");
        document.cookie = "adq_admin_root_token=soc_root_authorized_session; path=/; max-age=86400;";
      }
      router.replace("/admin");
    } else {
      setError("Mã Access Key không chính xác. Yêu cầu quyền truy cập Root bị từ chối.");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#020617] text-slate-100 font-sans selection:bg-rose-500 selection:text-white overflow-hidden px-4">
      {/* Background Cyber Grid & Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg rounded-3xl border border-rose-500/30 bg-slate-950/90 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_0_80px_rgba(244,63,94,0.15)]">
        {/* Header Console */}
        <div className="flex items-center justify-between pb-6 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
              <Terminal className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-wide">SOC ROOT GATEWAY</h1>
                <span className="px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/40 text-[10px] font-mono text-rose-300">
                  ISOLATED
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-0.5">ADQ Security Operations Center</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/[0.06] text-[11px] font-mono text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            NODE-01 LIVE
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-5 p-3 rounded-xl bg-slate-900/60 border border-white/[0.06] text-xs text-slate-400 font-mono flex items-center gap-2.5">
          <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
          <span>Khu vực giới hạn thẩm quyền. Mọi thao tác truy cập đều được ghi log bảo mật.</span>
        </div>

        {/* Form Đăng Nhập */}
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-300 flex items-center gap-2 animate-shake">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold uppercase text-slate-300 font-mono tracking-wider">
                Root Master Access Key
              </label>
              <span className="text-[11px] text-slate-500 font-mono">Authentication Layer</span>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-400" />
              <Input
                type="password"
                value={masterKey}
                onChange={(e) => setMasterKey(e.target.value)}
                placeholder="Nhập mã truy cập..."
                className="h-12 pl-10 pr-4 border-slate-800 bg-slate-900/90 font-mono text-sm text-rose-300 placeholder:text-slate-600 focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/30 rounded-xl transition"
                autoFocus
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !masterKey.trim()}
            className="h-12 w-full bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs shadow-lg shadow-rose-950/50 rounded-xl transition active:scale-[0.98] mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2 font-mono">
                <LoaderCircle className="h-4 w-4 animate-spin" /> Đang giải mã Root Token...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2 font-mono uppercase tracking-wider">
                Mở Bảng Điều Khiển SOC <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>

        {/* Footer Meta */}
        <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>Target Cluster: VPS-163</span>
          <span>FastAPI / Next.js SOC</span>
        </div>
      </div>
    </div>
  );
}
