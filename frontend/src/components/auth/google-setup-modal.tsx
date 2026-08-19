"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Lock, User, AtSign, Eye, EyeOff, LoaderCircle, KeyRound, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl font-sans text-slate-100">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md rounded-2xl border border-cyan-500/30 bg-slate-950 p-6 sm:p-7 shadow-[0_0_60px_rgba(6,182,212,0.18)]"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-white/[0.08]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Thiết Lập Mật Khẩu Dự Phòng</h3>
              <p className="text-[11px] text-slate-400">Đăng nhập tài khoản khi gặp sự cố với Google</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="flex-1">{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Họ và Tên</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  className="h-9 pl-9 border-slate-800 bg-slate-900/60 text-xs text-slate-100 focus:border-cyan-500/60 rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Tên Đăng Nhập (Username)</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={submitting}
                  className="h-9 pl-9 border-slate-800 bg-slate-900/60 text-xs text-cyan-300 font-mono focus:border-cyan-500/60 rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Mật Khẩu Dự Phòng (Tối thiểu 8 ký tự)</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  placeholder="••••••••••••"
                  className="h-9 pl-9 pr-9 border-slate-800 bg-slate-900/60 text-xs text-slate-100 focus:border-cyan-500/60 rounded-xl"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Xác Nhận Mật Khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={submitting}
                  placeholder="••••••••••••"
                  className="h-9 pl-9 border-slate-800 bg-slate-900/60 text-xs text-slate-100 focus:border-cyan-500/60 rounded-xl"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="h-9 w-full bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.2)] transition rounded-xl mt-2"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Đang lưu thiết lập...
                </span>
              ) : (
                "Hoàn Tất Thiết Lập & Vào Console"
              )}
            </Button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
