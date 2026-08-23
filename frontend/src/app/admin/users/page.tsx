"use client";

import React, { useState, useEffect } from "react";
import { SocSessionGuard } from "@/components/admin/soc-session-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search } from "lucide-react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users?page=1&limit=25", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data.users) ? data.users : []);
      }
    } catch {}
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(search.toLowerCase()) || 
    u.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpgradeTier = (userId: string, newTier: string) => {
    setUsers(users.map(u => u.id === userId ? { ...u, packageTier: newTier } : u));
  };

  return (
    <SocSessionGuard>
      <AdminShell>
      <div className="space-y-6 max-w-7xl mx-auto font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-rose-400" /> Quản Lý Danh Sách & Phân Quyền Người Dùng
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Kiểm soát hạn ngạch quét, nâng cấp gói cước và trạng thái tài khoản</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <Input
              placeholder="Tìm email hoặc tên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs border-slate-800 bg-slate-900/80 rounded-xl"
            />
          </div>
        </div>

        <Card className="border border-white/[0.08] bg-slate-950/80 shadow-2xl">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono bg-slate-900/30">
                    <th className="p-3.5">Họ Tên / Email</th>
                    <th className="p-3.5">Phân Quyền</th>
                    <th className="p-3.5">Gói Cước</th>
                    <th className="p-3.5">Hạn Ngạch Quét</th>
                    <th className="p-3.5">Trạng Thái</th>
                    <th className="p-3.5 text-right">Điều Chỉnh Gói</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-900/40">
                      <td className="p-3.5">
                        <div className="font-semibold text-white">{u.name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{u.email}</div>
                      </td>
                      <td className="p-3.5">
                        <Badge variant="muted" className="text-[10px] font-mono">
                          {u.role}
                        </Badge>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                          u.packageTier === "PRO_MAX" 
                            ? "bg-purple-950 text-purple-300 border-purple-500/40" 
                            : u.packageTier === "PRO" 
                            ? "bg-cyan-950 text-cyan-300 border-cyan-500/40" 
                            : "bg-slate-900 text-slate-400 border-slate-700"
                        }`}>
                          {u.packageTier}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">
                        {u.scansToday} / {u.dailyLimit} scans
                      </td>
                      <td className="p-3.5">
                        <Badge variant={u.status === "ACTIVE" ? "success" : "danger"} className="text-[10px] font-mono">
                          {u.status}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => handleUpgradeTier(u.id, "PRO")} className="h-6 px-2 text-[10px] border-slate-800 bg-slate-900">
                            Set PRO
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleUpgradeTier(u.id, "PRO_MAX")} className="h-6 px-2 text-[10px] border-purple-800/50 bg-purple-950/40 text-purple-300">
                            Set MAX
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      </AdminShell>
    </SocSessionGuard>
  );
}
