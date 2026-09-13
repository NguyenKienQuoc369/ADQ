"use client";

import React, { useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  ShieldCheck,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminSecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRotatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setErrorMsg("Vui lòng điền đầy đủ mật khẩu hiện tại và mật khẩu mới.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg("Mật khẩu mới phải có độ dài tối thiểu 8 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Xác nhận mật khẩu mới không trùng khớp.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/admin/auth/rotate-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Không thể cập nhật mật khẩu");
      }

      setSuccessMsg("Mật khẩu quản trị SOC đã được cập nhật thành công và lưu băm scrypt bền vững.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi xử lý yêu cầu đổi mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell>
      <div className="space-y-6 max-w-4xl">
        <div className="border-b border-[#222222] pb-5">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Cấu hình An toàn & Quản trị Mật khẩu SOC
          </h1>
          <p className="text-xs text-neutral-400 mt-1 font-mono">
            Thiết lập bảo mật phiên làm việc, chính sách giới hạn tần suất đăng nhập và xoay vòng mật khẩu
          </p>
        </div>

        {/* Security Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-1.5">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">Thuật toán Băm Mật khẩu</div>
            <div className="text-sm font-bold text-white font-mono">scrypt (N=16384, r=8, p=1)</div>
            <p className="text-[11px] text-neutral-500">
              Kháng phần cứng ASIC, sử dụng muối ngẫu nhiên CSPRNG 16 bytes.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-1.5">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">Thời hạn Phiên SOC</div>
            <div className="text-sm font-bold text-emerald-400 font-mono">8 Giờ (HttpOnly, Strict)</div>
            <p className="text-[11px] text-neutral-500">
              Ký chữ ký HMAC-SHA256, tự động hủy phiên khi logout.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] space-y-1.5">
            <div className="text-[10px] font-mono text-neutral-400 uppercase">Brute-force Guard</div>
            <div className="text-sm font-bold text-sky-400 font-mono">Tối đa 5 lần thử / 15 phút</div>
            <p className="text-[11px] text-neutral-500">
              Khóa tạm thời theo địa chỉ IP khi nhập sai liên tiếp.
            </p>
          </div>
        </div>

        {/* Password Rotation Card */}
        <div className="p-6 rounded-xl bg-[#0a0a0a] border border-[#222222] space-y-5">
          <div className="flex items-center gap-2 border-b border-[#222222] pb-3">
            <KeyRound className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white">Xoay Vòng Mật khẩu Quản trị SOC (Password Rotation)</h2>
          </div>

          {successMsg && (
            <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2 font-mono">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleRotatePassword} className="space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-neutral-300">Mật khẩu Hiện tại</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu SOC hiện tại..."
                className="bg-[#000000] border-[#333333] text-white text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-neutral-300">Mật khẩu Mới</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)..."
                className="bg-[#000000] border-[#333333] text-white text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-neutral-300">Xác nhận Mật khẩu Mới</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                className="bg-[#000000] border-[#333333] text-white text-xs h-9"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="bg-white text-black hover:bg-neutral-200 text-xs font-semibold h-9 px-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Đang băm và cập nhật mật khẩu...
                  </>
                ) : (
                  "Cập nhật Mật khẩu Mới"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}
