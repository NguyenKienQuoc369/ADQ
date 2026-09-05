"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Lock, User, AtSign, Eye, EyeOff, LoaderCircle, KeyRound, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { maskEmail } from "@/lib/utils";

interface GoogleSetupModalProps {
  isOpen: boolean;
  userEmail: string;
  defaultName: string;
  onComplete: (data: { name: string; username: string; password: string }) => Promise<void>;
}

export function GoogleSetupModal({
  isOpen,
  userEmail,
  defaultName,
  onComplete,
}: GoogleSetupModalProps) {
  const [name, setName] = useState(defaultName || "");
  const [username, setUsername] = useState(userEmail ? userEmail.split("@")[0] : "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanName || !cleanUsername || !cleanPassword) {
      setErrorMessage("Vui lòng điền đầy đủ các thông tin bắt buộc.");
      return;
    }

    if (cleanPassword.length < 8) {
      setErrorMessage("Mật khẩu dự phòng phải có tối thiểu 8 ký tự.");
      return;
    }

    if (cleanPassword !== confirmPassword.trim()) {
      setErrorMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await onComplete({
        name: cleanName,
        username: cleanUsername,
        password: cleanPassword,
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Không thể lưu thông tin dự phòng. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans text-[#ededed] selection:bg-white selection:text-black">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-md rounded-lg border border-[#222222] bg-[#000000] p-6 shadow-xl"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-[#222222]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#222222] bg-[#000000] p-1">
              <Image
                src="/logo.png"
                alt="ADQ logo"
                width={32}
                height={32}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">Thiết Lập Mật Khẩu Dự Phòng</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Dùng để đăng nhập khi gặp sự cố với Google {userEmail ? `(${maskEmail(userEmail)})` : ""}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3 font-sans">
            {errorMessage && (
              <div className="p-3 rounded-md bg-rose-950/20 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="flex-1 leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider">Họ và Tên</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  className="h-9 pl-9 border-[#333333] bg-[#0a0a0a] text-xs text-white placeholder:text-neutral-500 focus:border-white focus:ring-0 rounded-md"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider">Tên Đăng Nhập (Username)</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={submitting}
                  className="h-9 pl-9 border-[#333333] bg-[#0a0a0a] text-xs text-white font-mono focus:border-white focus:ring-0 rounded-md"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider">Mật Khẩu Dự Phòng (Tối thiểu 8 ký tự)</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  placeholder="••••••••••••"
                  className="h-9 pl-9 pr-9 border-[#333333] bg-[#0a0a0a] text-xs text-white placeholder:text-neutral-500 focus:border-white focus:ring-0 rounded-md"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider">Xác Nhận Mật Khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={submitting}
                  placeholder="••••••••••••"
                  className="h-9 pl-9 pr-9 border-[#333333] bg-[#0a0a0a] text-xs text-white placeholder:text-neutral-500 focus:border-white focus:ring-0 rounded-md"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="h-9 w-full bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm transition active:scale-[0.99] cursor-pointer mt-3"
            >
              {submitting ? (
                <span className="flex items-center gap-1.5 font-mono">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Đang lưu cấu hình...
                </span>
              ) : (
                "Hoàn Tất & Tiếp Tục"
              )}
            </Button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
