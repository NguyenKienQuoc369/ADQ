"use client";

import React, { useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  ShieldCheck,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Terminal,
  UserCheck,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminSecurityPage() {
  return (
    <AdminShell>
      <div className="space-y-6 max-w-4xl">
        <div className="border-b border-[#222222] pb-5">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Cấu hình An toàn & Phân quyền Identity SOC
          </h1>
          <p className="text-xs text-neutral-400 mt-1 font-mono">
            Quản trị danh tính bảo mật, chính sách phân quyền UUID và cơ chế khôi phục khẩn cấp SSH
          </p>
        </div>

        {/* Security Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-1.5">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">Mô hình Xác thực</div>
            <div className="text-sm font-bold text-white font-mono">Supabase Identity (UUID)</div>
            <p className="text-[11px] text-neutral-500">
              Ủy quyền dựa trên Supabase Auth UUID cố định, độc lập với gói người dùng.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-1.5">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">Thời hạn Phiên SOC</div>
            <div className="text-sm font-bold text-emerald-400 font-mono">8 Giờ (HttpOnly, Secure)</div>
            <p className="text-[11px] text-neutral-500">
              Ký HMAC-SHA256 v2 token, tự động kiểm tra trạng thái enabled ở database.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-1.5">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">Khôi phục Khẩn cấp</div>
            <div className="text-sm font-bold text-amber-400 font-mono">SSH One-Time Token</div>
            <p className="text-[11px] text-neutral-500">
              Mã CSPRNG 256-bit sử dụng 1 lần duy nhất, thời hạn 5 phút sinh từ server CLI.
            </p>
          </div>
        </div>

        {/* Identity Authorization Policy */}
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#222222] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#222222] pb-3">
            <UserCheck className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Chính sách Phân quyền Quản trị (Identity Policy)</h2>
          </div>

          <div className="space-y-3 text-xs text-neutral-300 font-mono leading-relaxed">
            <div className="p-3 rounded-lg bg-[#050505] border border-[#1a1a1a] flex items-center justify-between">
              <div>
                <div className="text-white font-bold">Authoritative SOC Admin (Root)</div>
                <div className="text-neutral-500 text-[11px]">kienquocn64@gmail.com</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/60 border border-emerald-800/80 text-emerald-400">
                ROLE: SOC_ADMIN (ENABLED)
              </span>
            </div>

            <p className="text-neutral-400 text-[11px]">
              Tài khoản trên được ủy quyền truy cập toàn bộ tính năng quan sát cơ sở dữ liệu, quản lý người dùng, rà soát scan và cấu hình hệ thống trên <span className="text-white">adq-soc.click</span>. Mọi thay đổi về phân quyền đều được ghi vết tại nhật ký kiểm toán.
            </p>
          </div>
        </div>

        {/* Emergency Recovery Documentation */}
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#222222] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#222222] pb-3">
            <Terminal className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">Quy trình Khôi phục Khẩn cấp qua SSH (Emergency Access)</h2>
          </div>

          <div className="space-y-3 text-xs text-neutral-300 leading-relaxed font-mono">
            <p className="text-neutral-400 text-[11px]">
              Trong trường hợp xảy ra sự cố xác thực OAuth, người quản trị có quyền SSH trực tiếp vào máy chủ VPS để tạo mã truy cập khẩn cấp dùng 1 lần:
            </p>
            <div className="p-3.5 rounded-lg bg-[#000000] border border-[#222222] text-emerald-300 text-xs select-all">
              ssh root@163.44.193.25 "docker exec adq_dashboard npx tsx scripts/generate_soc_recovery_token.ts"
            </div>
            <p className="text-[11px] text-neutral-500">
              Lệnh trên sẽ tạo một URL khôi phục có chữ ký ngẫu nhiên 256-bit với thời hạn 5 phút. Khi được kích hoạt, token lập tức bị vô hiệu hóa để bảo đảm an toàn tuyệt đối.
            </p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
