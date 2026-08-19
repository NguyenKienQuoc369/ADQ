"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Gift,
  LoaderCircle,
  ShieldCheck,
  Zap,
  Crown,
  Check,
  Headphones,
  Mail,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPackagePlans, redeemCode } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

const redeemSchema = z.object({
  code: z.string().min(4, "Vui lòng nhập mã kích hoạt hợp lệ."),
});

export function BillingClient() {
  const { user, updateUser } = useAuth();
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof getPackagePlans>>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [selectedPlanUpgrade, setSelectedPlanUpgrade] = useState<string | null>(null);

  const form = useForm<z.infer<typeof redeemSchema>>({
    resolver: zodResolver(redeemSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    getPackagePlans().then(setPlans).catch(() => {});
  }, []);

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
      <div className="space-y-6 max-w-7xl mx-auto font-sans text-slate-100">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-400" />
              <h1 className="text-2xl font-bold tracking-tight text-white">Gói Dịch Vụ & License Quét SOC</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Quản lý quyền hạn quét DAST, Stress Testing, kiểm toán mã độc và nâng cấp hạn mức hệ thống.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setSelectedPlanUpgrade("PRO_MAX")}
            className="h-10 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-950/60 cursor-pointer flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" /> Liên hệ Nâng cấp Doanh nghiệp
          </Button>
        </div>

        {/* Nội dung 2 Cột */}
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          {/* CỘT TRÁI: BẢNG SO SÁNH GÓI */}
          <div className="space-y-6">
            <div className="grid gap-5 md:grid-cols-3">
              {plans.map((plan) => {
                const isActive = currentTier === plan.tier;
                const isProMax = plan.tier === "PRO_MAX";
                const isPro = plan.tier === "PRO";

                return (
                  <div
                    key={plan.tier}
                    className={`relative flex flex-col justify-between rounded-2xl border p-5 backdrop-blur-xl transition-all duration-200 ${
                      isActive
                        ? "border-cyan-500/60 bg-gradient-to-b from-cyan-950/40 via-slate-900/80 to-slate-950 shadow-xl shadow-cyan-950/50"
                        : isProMax
                        ? "border-amber-500/30 bg-slate-900/60 hover:border-amber-500/50"
                        : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                    }`}
                  >
                    {isProMax && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-950 shadow-md">
                        Khuyên Dùng Cho SOC
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Tiêu đề gói */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isProMax ? (
                            <Crown className="h-5 w-5 text-amber-400" />
                          ) : isPro ? (
                            <Zap className="h-5 w-5 text-cyan-400" />
                          ) : (
                            <ShieldCheck className="h-5 w-5 text-slate-400" />
                          )}
                          <h3 className="font-bold text-base text-white">{plan.name}</h3>
                        </div>
                        {isActive ? (
                          <Badge variant="success" className="text-[10px] font-bold">
                            Đang dùng
                          </Badge>
                        ) : (
                          <Badge variant="muted" className="text-[10px]">
                            Khả dụng
                          </Badge>
                        )}
                      </div>

                      {/* Giá */}
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                        <p className="text-xl font-bold text-white font-mono">{plan.priceLabel}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{plan.description}</p>
                      </div>

                      {/* Danh sách tính năng */}
                      <div className="space-y-2 pt-2">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Đặc quyền bao gồm:</p>
                        {plan.features.map((feat) => (
                          <div key={feat} className="flex items-start gap-2 text-xs text-slate-300">
                            <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Nút hành động */}
                    <div className="mt-6 pt-4 border-t border-slate-800">
                      {isActive ? (
                        <Button
                          disabled
                          variant="outline"
                          className="w-full h-9 border-cyan-500/40 bg-cyan-950/30 text-cyan-300 text-xs font-bold rounded-xl cursor-default"
                        >
                          Gói Hiện Tại Của Bạn
                        </Button>
                      ) : (
                        <Button
                          onClick={() => setSelectedPlanUpgrade(plan.tier)}
                          className={`w-full h-9 text-xs font-bold rounded-xl cursor-pointer transition ${
                            isProMax
                              ? "bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950"
                              : "bg-cyan-600 hover:bg-cyan-500 text-white"
                          }`}
                        >
                          Nâng Cấp Gói Này
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bảng so sánh chi tiết tính năng */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
              <h3 className="font-bold text-sm text-white mb-3">So Sánh Chi Tiết Hạn Mức Tính Năng</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                      <th className="pb-2 font-semibold">Tính năng</th>
                      <th className="pb-2 font-semibold text-center">Gói Free</th>
                      <th className="pb-2 font-semibold text-center text-cyan-400">Gói Pro</th>
                      <th className="pb-2 font-semibold text-center text-amber-400">Gói Pro Max</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    <tr>
                      <td className="py-2.5">Lượt quét DAST hàng ngày</td>
                      <td className="py-2.5 text-center font-mono">3 lượt</td>
                      <td className="py-2.5 text-center font-mono text-cyan-300">30 lượt</td>
                      <td className="py-2.5 text-center font-mono text-amber-300 font-bold">Không giới hạn</td>
                    </tr>
                    <tr>
                      <td className="py-2.5">Quét tải / Stress Testing (RPS)</td>
                      <td className="py-2.5 text-center text-slate-500">Giới hạn thấp</td>
                      <td className="py-2.5 text-center text-slate-200">1,000 RPS</td>
                      <td className="py-2.5 text-center text-amber-300 font-bold">10,000+ RPS Distributed</td>
                    </tr>
                    <tr>
                      <td className="py-2.5">Kiểm toán APK & Reverse Engine</td>
                      <td className="py-2.5 text-center text-slate-500">Cơ bản</td>
                      <td className="py-2.5 text-center text-emerald-400">Toàn diện</td>
                      <td className="py-2.5 text-center text-amber-300 font-bold">Chuyên sâu + Dynamic Hooking</td>
                    </tr>
                    <tr>
                      <td className="py-2.5">AI Copilot SOC tự động gợi ý vá</td>
                      <td className="py-2.5 text-center text-slate-500">Tiêu chuẩn</td>
                      <td className="py-2.5 text-center text-emerald-400">Ưu tiên</td>
                      <td className="py-2.5 text-center text-amber-300 font-bold">Dedicated Real-time AI</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: TRẠNG THÁI HIỆN TẠI & NHẬP REDEEM CODE */}
          <div className="space-y-6">
            {/* Card Trạng Thái Thuê Bao */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl shadow-xl space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400">Tài khoản hiện tại</p>
                <h3 className="text-xl font-bold text-white mt-0.5">{currentTier.replace("_", " ")}</h3>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-xs text-slate-400">Lượt quét hôm nay:</span>
                  <span className="font-mono text-xs font-bold text-cyan-300">
                    {user?.scansToday ?? 0} / {user?.dailyLimit ?? 0} lượt
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
                  <p className="text-[11px] text-slate-400">Nhập Redeem Code để nâng cấp gói</p>
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
                    {selectedPlanUpgrade === "PRO_MAX" ? "Gói PRO MAX Doanh Nghiệp" : "Gói PRO Tiêu Chuẩn"}
                  </p>
                  <p className="text-slate-400">
                    Tài khoản yêu cầu: <span className="font-mono text-white">{user?.email}</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Người phụ trách duyệt:</span>
                    <span className="font-semibold text-white">Nguyễn Kiến Quốc (Admin)</span>
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
                  href={`mailto:kienquocn64@gmail.com?subject=[ADQ License] Yêu cầu nâng cấp gói ${selectedPlanUpgrade}&body=Xin chào Developer Nguyễn Kiến Quốc, tôi muốn kích hoạt gói ${selectedPlanUpgrade} cho tài khoản email: ${user?.email}`}
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
