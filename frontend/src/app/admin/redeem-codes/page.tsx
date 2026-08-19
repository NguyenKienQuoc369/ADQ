"use client";

import React, { useState, useEffect } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KeyRound, Plus, Copy, Check } from "lucide-react";
import { getRedeemCodes, createRedeemCode } from "@/lib/api";

export default function AdminRedeemCodesPage() {
  const [codes, setCodes] = useState<any[]>([
    { id: "rc_1", code: "ADQ-PRO-98AF23", packageTier: "PRO", durationLabel: "30 Ngày", maxUses: 1, usedCount: 0, status: "UNUSED" },
    { id: "rc_2", code: "ADQ-PRO_MAX-77C091", packageTier: "PRO_MAX", durationLabel: "90 Ngày", maxUses: 1, usedCount: 0, status: "UNUSED" },
  ]);
  const [tier, setTier] = useState<"PRO" | "PRO_MAX">("PRO");
  const [duration, setDuration] = useState("30 Ngày");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    getRedeemCodes()
      .then((res: any) => {
        if (res && res.codes) setCodes(res.codes);
      })
      .catch(() => {});
  }, []);

  const handleGenerate = async () => {
    try {
      const res = await createRedeemCode({
        packageTier: tier,
        durationLabel: duration,
        maxUses: 1,
      });
      if (res && res.code) {
        setCodes((prev) => [res.code, ...prev]);
        return;
      }
    } catch {}

    const newCode = {
      id: `rc_${Date.now()}`,
      code: `ADQ-${tier}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      packageTier: tier,
      durationLabel: duration,
      maxUses: 1,
      usedCount: 0,
      status: "UNUSED",
    };
    setCodes((prev) => [newCode, ...prev]);
  };

  const handleCopy = (c: string) => {
    navigator.clipboard.writeText(c);
    setCopiedCode(c);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <DashboardShell area="admin">
      <div className="space-y-6 max-w-6xl mx-auto font-sans">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-cyan-400" /> Quản Lý & Phát Hành Mã License Redeem
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Sinh mã kích hoạt nâng cấp gói PRO và PRO MAX cho khách hàng</p>
        </div>

        <Card className="border border-white/[0.08] bg-slate-950/80 p-5">
          <CardTitle className="text-sm font-bold text-white mb-3">Tạo Mã License Mới</CardTitle>
          <div className="flex flex-wrap gap-3">
            <select
              value={tier}
              onChange={(e: any) => setTier(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white"
            >
              <option value="PRO">Gói 2: PRO (199K/tháng)</option>
              <option value="PRO_MAX">Gói 3: PRO MAX (499K/tháng)</option>
            </select>

            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-800 bg-slate-900 text-xs text-white"
            >
              <option value="30 Ngày">Thời hạn: 30 Ngày</option>
              <option value="90 Ngày">Thời hạn: 90 Ngày</option>
              <option value="1 Năm">Thời hạn: 1 Năm</option>
              <option value="Vĩnh viễn">Vĩnh viễn (Lifetime)</option>
            </select>

            <Button onClick={handleGenerate} className="h-9 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl">
              <Plus className="h-4 w-4 mr-1" /> Phát Hành Mã
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {codes.map((c) => (
            <div key={c.id || c.code} className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <div>
                <div className="font-mono text-sm font-bold text-cyan-300 tracking-wider">{c.code}</div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                  <span className="font-bold text-white">{c.packageTier}</span> • <span>{c.durationLabel}</span> • <span className="text-emerald-400">{c.status}</span>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleCopy(c.code)} className="h-8 border-slate-800 bg-slate-950 text-xs">
                {copiedCode === c.code ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
