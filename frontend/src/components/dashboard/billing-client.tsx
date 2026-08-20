"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Gift,
  LoaderCircle,
  Check,
  X,
  Sparkles,
  Crown,
  Headphones,
  Mail,
  Building2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redeemCode } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

const redeemSchema = z.object({
  code: z.string().min(4, "Vui lòng nhập mã kích hoạt hợp lệ."),
});

export function BillingClient() {
  const { user, updateUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [selectedPlanUpgrade, setSelectedPlanUpgrade] = useState<string | null>(null);

  const form = useForm<z.infer<typeof redeemSchema>>({
    resolver: zodResolver(redeemSchema),
    defaultValues: { code: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setMessage(null);
    try {
      const nextUser = await redeemCode(values.code.trim().toUpperCase());
      updateUser(nextUser);
      setMessage({
        type: "success",
        text: `Kích hoạt thành công! Tài khoản của bạn đã được nâng cấp lên gói ${nextUser.packageTier.replace("_", " ")}.`,
      });
      form.reset();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Mã kích hoạt không hợp lệ hoặc đã được sử dụng.",
      });
    } finally {
      setSubmitting(false);
    }
  });

  const currentTier = user?.packageTier || "FREE";

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 max-w-7xl mx-auto font-sans text-slate-100 selection:bg-cyan-500 selection:text-black">
        {/* Header giống PlansModal */}
        <div className="text-center space-y-2 border-b border-slate-800 pb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            <Sparkles className="h-3.5 w-3.5" /> QUẢN LÝ GÓI DỊCH VỤ & GIẤY PHÉP SOC
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Nâng Tầm Năng Lực Bảo Mật Cùng ADQ Security
          </h1>
          <p className="text-xs text-slate-400 max-w-xl mx-auto">
            Lựa chọn gói dịch vụ tối ưu cho nhu cầu rà quét lỗ hổng DAST, kiểm thử an ninh hạ tầng và AI Copilot.
          </p>
        </div>

        {/* 4 Cột Gói Cước (Free, Pro, Pro Max, Enterprise) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* GÓI 1: FREE */}
          <div className={`rounded-2xl border p-5 flex flex-col justify-between transition ${
            currentTier === "FREE"
              ? "border-cyan-500/50 bg-slate-900/80 shadow-lg shadow-cyan-950/30"
              : "border-white/[0.08] bg-slate-900/50 hover:border-slate-700"
          }`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-slate-400 uppercase">Gói 1</span>
                {currentTier === "FREE" && <Badge variant="success" className="text-[10px]">Đang dùng</Badge>}
              </div>
              <h3 className="text-base font-bold text-white mt-1">Dùng Thử Miễn Phí</h3>
              <div className="text-xl font-extrabold text-slate-200 mt-2">0 VNĐ</div>
              <p className="text-[11px] text-slate-400 mt-1">Dành cho trải nghiệm thử nghiệm</p>
              <div className="border-t border-white/[0.06] my-4" />
              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span><strong>2 lượt quét DAST / ngày</strong></span>
                </li>
                <li className="flex items-center gap-2 text-slate-500">
                  <X className="h-4 w-4 text-slate-600 shrink-0" />
                  <span>Không có phân tích AI</span>
                </li>
                <li className="flex items-center gap-2 text-slate-500">
                  <X className="h-4 w-4 text-slate-600 shrink-0" />
                  <span>Khóa tính năng Stress Test</span>
                </li>
                <li className="flex items-center gap-2 text-slate-500">
                  <X className="h-4 w-4 text-slate-600 shrink-0" />
                  <span>Khóa AI Copilot Chat</span>
                </li>
              </ul>
            </div>
            <Button
              variant="outline"
              disabled={currentTier === "FREE"}
              className="mt-6 h-9 w-full border-slate-800 bg-slate-950 text-xs text-slate-300 rounded-xl cursor-default"
            >
              {currentTier === "FREE" ? "Gói Hiện Tại" : "Miễn Phí"}
            </Button>
          </div>

          {/* GÓI 2: PRO */}
          <div className={`relative rounded-2xl border p-5 flex flex-col justify-between shadow-[0_0_30px_rgba(6,182,212,0.12)] transition ${
            currentTier === "PRO"
              ? "border-cyan-400 bg-cyan-950/40 shadow-cyan-950/60"
              : "border-cyan-500/50 bg-gradient-to-b from-cyan-950/30 to-slate-950 hover:border-cyan-400"
          }`}>
            <div className="absolute -top-2.5 right-4 bg-cyan-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
              PHỔ BIẾN
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-cyan-400 uppercase">Gói 2</span>
                {currentTier === "PRO" && <Badge variant="success" className="text-[10px]">Đang dùng</Badge>}
              </div>
              <h3 className="text-base font-bold text-white mt-1">Chuyên Nghiệp (PRO)</h3>
              <div className="text-xl font-extrabold text-cyan-300 mt-2">
                199.000 <span className="text-xs text-slate-400 font-normal">/ tháng</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Tối ưu cho Pentester & DevSecOps</p>
              <div className="border-t border-cyan-500/20 my-4" />
              <ul className="space-y-2.5 text-xs text-slate-200">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span><strong>Quét DAST không giới hạn</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span><strong>Phân tích lỗ hổng chuyên sâu với AI</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>Stress Test L7 (<strong>1 lượt/ngày</strong>)</span>
                </li>
                <li className="flex items-center gap-2 text-slate-500">
                  <X className="h-4 w-4 text-slate-600 shrink-0" />
                  <span>Khóa AI Copilot Chat</span>
                </li>
              </ul>
            </div>
            {currentTier === "PRO" ? (
              <Button disabled variant="outline" className="mt-6 h-9 w-full border-cyan-500/40 bg-cyan-950/30 text-cyan-300 text-xs font-bold rounded-xl">
                Gói Hiện Tại
              </Button>
            ) : (
              <Button
                onClick={() => setSelectedPlanUpgrade("PRO")}
                className="mt-6 h-9 w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md rounded-xl transition active:scale-98 cursor-pointer"
              >
                Nâng Cấp Gói PRO
              </Button>
            )}
          </div>

          {/* GÓI 3: PRO MAX */}
          <div className={`rounded-2xl border p-5 flex flex-col justify-between transition ${
            currentTier === "PRO_MAX"
              ? "border-purple-400 bg-purple-950/40 shadow-purple-950/60"
              : "border-purple-500/40 bg-gradient-to-b from-purple-950/20 to-slate-950 hover:border-purple-500/60"
          }`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-purple-400 uppercase">Gói 3</span>
                {currentTier === "PRO_MAX" && <Badge variant="success" className="text-[10px]">Đang dùng</Badge>}
              </div>
              <h3 className="text-base font-bold text-white mt-1">Cao Cấp (PRO MAX)</h3>
              <div className="text-xl font-extrabold text-purple-300 mt-2">
                499.000 <span className="text-xs text-slate-400 font-normal">/ tháng</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Toàn quyền hạ tầng và Agentic AI</p>
              <div className="border-t border-purple-500/20 my-4" />
              <ul className="space-y-2.5 text-xs text-slate-200">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-400 shrink-0" />
                  <span><strong>Quét DAST không giới hạn + AI</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-400 shrink-0" />
                  <span><strong>Mở khóa toàn bộ AI Copilot Chat</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-400 shrink-0" />
                  <span>Stress Test L7 (<strong>10 lượt/ngày</strong>)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-purple-400 shrink-0" />
                  <span>Sinh bản vá One-Click Patch tự động</span>
                </li>
              </ul>
            </div>
            {currentTier === "PRO_MAX" ? (
              <Button disabled variant="outline" className="mt-6 h-9 w-full border-purple-500/40 bg-purple-950/30 text-purple-300 text-xs font-bold rounded-xl">
                Gói Hiện Tại
              </Button>
            ) : (
              <Button
                onClick={() => setSelectedPlanUpgrade("PRO_MAX")}
                className="mt-6 h-9 w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md rounded-xl transition active:scale-98 cursor-pointer"
              >
                Nâng Cấp PRO MAX
              </Button>
            )}
          </div>

          {/* GÓI 4: ENTERPRISE (DOANH NGHIỆP - LIÊN HỆ) */}
          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-950/20 to-slate-950 p-5 flex flex-col justify-between hover:border-amber-500/60 transition">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-amber-400 uppercase">Doanh Nghiệp</span>
                <Crown className="h-4 w-4 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-white mt-1">Gói Doanh Nghiệp</h3>
              <div className="text-xl font-extrabold text-amber-300 mt-2">Liên hệ</div>
              <p className="text-[11px] text-slate-400 mt-1">Hạ tầng SOC riêng & SLA Cam kết</p>
              <div className="border-t border-amber-500/20 my-4" />
              <ul className="space-y-2.5 text-xs text-slate-200">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-amber-400 shrink-0" />
                  <span><strong>Dedicated SOC Nodes & IP riêng</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-amber-400 shrink-0" />
                  <span><strong>Stress Test Distributed 50,000+ RPS</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Tích hợp CI/CD & SIEM Webhook</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Hỗ trợ kỹ thuật 24/7 từ Lead Developer</span>
                </li>
              </ul>
            </div>
            <Button
              onClick={() => setSelectedPlanUpgrade("ENTERPRISE")}
              className="mt-6 h-9 w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md rounded-xl transition active:scale-98 cursor-pointer"
            >
              Liên Hệ Doanh Nghiệp
            </Button>
          </div>
        </div>

        {/* Khung Thông Tin & Redeem Code */}
        <div className="grid gap-6 md:grid-cols-2 pt-4">
          {/* Card Trạng Thái Thuê Bao */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl shadow-xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400">Tài khoản hiện tại</p>
              <h3 className="text-xl font-bold text-white mt-0.5">{currentTier.replace("_", " ")}</h3>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400">
                  {currentTier === "FREE" ? "Lượt quét miễn phí:" : "Lượt quét DAST:"}
                </span>
                <span className="font-mono text-xs font-bold text-cyan-300">
                  {currentTier === "FREE"
                    ? `${user?.scansToday ?? 0} / 2 lượt trọn đời`
                    : "Không giới hạn"}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400">Thời hạn giấy phép:</span>
                <span className="font-mono text-xs text-slate-200">
                  {user?.planExpiresAt ? formatDateTime(user.planExpiresAt) : "Vĩnh viễn (Chưa hết hạn)"}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400">Trạng thái xác thực:</span>
                <Badge variant="success" className="text-[10px]">
                  {user?.status || "ACTIVE"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Card Kích Hoạt Mã License (Redeem Code) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Gift className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Kích Hoạt Mã License</h3>
                <p className="text-[11px] text-slate-400">Nhập Redeem Code để nâng cấp gói tức thì</p>
              </div>
            </div>

            {message && (
              <div
                className={`p-3 rounded-xl flex items-center gap-2 text-xs border ${
                  message.type === "success"
                    ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                    : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                }`}
              >
                {message.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="redeem-code" className="text-xs font-semibold uppercase text-slate-400">
                  Mã License / Voucher
                </Label>
                <Input
                  id="redeem-code"
                  placeholder="VD: PRO-MAX-2026-VIP"
                  {...form.register("code")}
                  className="h-10 border-slate-800 bg-slate-950/80 font-mono uppercase text-xs text-white focus:border-cyan-500/60 rounded-xl"
                />
                {form.formState.errors.code && (
                  <p className="text-[11px] text-rose-400">{form.formState.errors.code.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/50"
              >
                {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                {submitting ? "Đang xác thực mã..." : "Kích Hoạt Ngay"}
              </Button>
            </form>
          </div>
        </div>

        {/* Modal Hỗ Trợ Nâng Cấp Gói Trực Tiếp */}
        {selectedPlanUpgrade && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setSelectedPlanUpgrade(null)} />
            <div className="relative z-10 w-full max-w-md rounded-2xl border border-cyan-500/40 bg-slate-900 p-6 shadow-2xl space-y-5 text-slate-100">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                    <Headphones className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-base text-white">Yêu Cầu Nâng Cấp Gói</h3>
                </div>
                <button onClick={() => setSelectedPlanUpgrade(null)} className="text-slate-400 hover:text-white p-1">
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                  <p className="text-[10px] font-mono uppercase text-slate-500">Gói đã chọn</p>
                  <p className="font-bold text-sm text-cyan-300">
                    {selectedPlanUpgrade === "ENTERPRISE"
                      ? "Gói ENTERPRISE (Doanh Nghiệp)"
                      : selectedPlanUpgrade === "PRO_MAX"
                      ? "Gói PRO MAX (499.000 VNĐ / tháng)"
                      : "Gói PRO (199.000 VNĐ / tháng)"}
                  </p>
                  <p className="text-slate-400">
                    Tài khoản yêu cầu: <span className="font-mono text-white">{user?.email}</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Người phụ trách duyệt:</span>
                    <span className="font-semibold text-white">Nguyễn Kiến Quốc (Lead Developer)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Email xử lý:</span>
                    <a href="mailto:kienquocn64@gmail.com" className="font-mono text-cyan-400 hover:underline">
                      kienquocn64@gmail.com
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Thời gian cấp key:</span>
                    <span className="text-emerald-400 font-semibold">Ngay sau khi xác nhận</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <a
                  href={`mailto:kienquocn64@gmail.com?subject=[ADQ License] Yêu cầu nâng cấp gói ${selectedPlanUpgrade}&body=Xin chào Developer Nguyễn Kiến Quốc, tôi muốn đăng ký gói ${selectedPlanUpgrade} cho tài khoản email: ${user?.email}`}
                  className="flex-1 h-10 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-950/60"
                >
                  <Mail className="h-4 w-4" /> Gửi Yêu Cầu Nâng Cấp
                </a>
                <Button variant="outline" onClick={() => setSelectedPlanUpgrade(null)} className="h-10 border-slate-800 text-xs">
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
