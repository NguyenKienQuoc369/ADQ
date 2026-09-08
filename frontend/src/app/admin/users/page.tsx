"use client";

import React, { useState, useEffect } from "react";
import { SocSessionGuard } from "@/components/admin/soc-session-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search } from "lucide-react";
import { maskEmail } from "@/lib/utils";

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
      <div className="space-y-6 max-w-7xl mx-auto font-sans text-[#ededed]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-white" /> Quản Lý Danh Sách & Phân Quyền Người Dùng
            </h1>
            <p className="text-xs text-neutral-400 mt-1">Kiểm soát hạn ngạch quét, nâng cấp gói cước và trạng thái tài khoản.</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            <Input
              placeholder="Tìm email hoặc tên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs border-[#333333] bg-[#0a0a0a] text-white placeholder:text-neutral-500 focus:border-white focus:ring-0 rounded-md"
            />
          </div>
        </div>

        <div className="rounded-lg border border-[#222222] bg-[#000000]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#222222] text-neutral-500 font-mono bg-[#0a0a0a]">
                  <th className="p-3.5">Họ Tên / Email</th>
                  <th className="p-3.5">Phân Quyền</th>
                  <th className="p-3.5">Gói Cước</th>
                  <th className="p-3.5">Hạn Ngạch Quét</th>
                  <th className="p-3.5">Trạng Thái</th>
                  <th className="p-3.5 text-right">Điều Chỉnh Gói</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222222] font-sans">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-900/40">
                    <td className="p-3.5">
                      <div className="font-medium text-white">{u.name}</div>
                      <div className="text-[11px] font-mono text-neutral-400">{maskEmail(u.email)}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="border border-neutral-700 bg-neutral-800 text-neutral-300 font-mono text-[10px] px-2 py-0.5 rounded-full">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="border border-neutral-700 bg-neutral-800 text-white font-mono text-[10px] px-2 py-0.5 rounded-full">
                        {u.packageTier}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-neutral-300">
                      {u.scansToday} / {u.dailyLimit} scans
                    </td>
                    <td className="p-3.5">
                      <span className="border border-neutral-700 bg-neutral-800 text-white font-mono text-[10px] px-2 py-0.5 rounded-full">
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpgradeTier(u.id, "PRO")}
                          className="h-7 px-2.5 text-xs border-[#333333] hover:bg-neutral-800 text-white rounded-md"
                        >
                          Set PRO
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpgradeTier(u.id, "PRO_MAX")}
                          className="h-7 px-2.5 text-xs border-[#333333] hover:bg-neutral-800 text-white rounded-md"
                        >
                          Set MAX
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </AdminShell>
    </SocSessionGuard>
  );
}
