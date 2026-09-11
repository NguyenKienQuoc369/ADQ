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
  Crown,
  Mail,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redeemCode } from "@/lib/api";
import { formatDateTime, maskEmail } from "@/lib/utils";

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
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await redeemCode(values.code.trim().toUpperCase());
      updateUser(res.user);
      const tierLabel = (res.user.packageTier || "PRO").replace("_", " ");
      setMessage({
        type: "success",
        text: res.message || `Kích hoạt ${tierLabel} thành công.`,
      });
      form.reset();
    } catch (err: any) {
      let errorText = err?.message || "Mã kích hoạt không tồn tại hoặc không hợp lệ.";
      const code = err?.code;
      if (code === "INVALID_CODE") {
        errorText = "Mã kích hoạt không tồn tại hoặc không hợp lệ.";
      } else if (code === "EXPIRED_CODE") {
        errorText = "Mã kích hoạt đã hết hạn sử dụng.";
      } else if (code === "REVOKED") {
        errorText = "Mã kích hoạt này đã bị vô hiệu hóa.";
      } else if (code === "ALREADY_USED") {
        errorText = "Mã kích hoạt đã được sử dụng hết số lượt.";
      } else if (code === "UNAUTHORIZED") {
        errorText = "Vui lòng đăng nhập lại để thực hiện kích hoạt.";
      }
      setMessage({
        type: "error",
        text: errorText,
      });
    } finally {
      setSubmitting(false);
    }
  });

  const isPlanExpired = user?.planExpiresAt
    ? new Date(user.planExpiresAt).getTime() <= Date.now()
    : false;
  const currentTier = isPlanExpired ? "FREE" : (user?.packageTier || "FREE");

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6 max-w-7xl mx-auto font-sans text-[#ededed]">
        {/* Header */}
        <div className="space-y-2 border-b border-[#222222] pb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Gói Dịch Vụ & Giấy Phép
          </h1>
          <p className="text-xs text-neutral-400 max-w-xl">
            Kích hoạt tính năng và nâng cấp hạn ngạch rà quét an ninh DAST, kiểm thử hạ tầng L7 và AI Copilot qua Redeem Code.
          </p>
        </div>

        {/* 3 Cột Gói Cước Chính (FREE, PRO, PRO MAX) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* GÓI 1: FREE */}
          <div
            className={`rounded-lg border p-5 flex flex-col justify-between transition bg-[#000000] ${
              currentTier === "FREE"
                ? "border-white"
                : "border-[#222222] hover:border-neutral-700"
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase text-neutral-500">Mặc Định</span>
                {currentTier === "FREE" && (
                  <span className="px-2 py-0.5 rounded-full border border-neutral-700 bg-neutral-800 text-[10px] font-mono text-white">
                    Đang dùng
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold text-white mt-1">Dùng Thử Miễn Phí (FREE)</h3>
              <div className="text-lg font-bold font-mono text-white mt-2">0 VNĐ <span className="text-xs text-neutral-500 font-normal">/ Trọn đời</span></div>
              <p className="text-[11px] text-neutral-500 mt-1">Trải nghiệm rà quét DAST cơ bản</p>
              <div className="border-t border-[#1f1f1f] my-4" />
              <ul className="space-y-2.5 text-xs text-neutral-300 font-sans">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-white shrink-0" />
                  <span>2 lượt quét DAST trọn đời</span>
                </li>
                <li className="flex items-center gap-2 text-neutral-600">
                  <X className="h-3.5 w-3.5 text-neutral-700 shrink-0" />
                  <span>Không có phân tích AI</span>
                </li>
                <li className="flex items-center gap-2 text-neutral-600">
                  <X className="h-3.5 w-3.5 text-neutral-700 shrink-0" />
                  <span>Khóa tính năng Stress Test</span>
                </li>
                <li className="flex items-center gap-2 text-neutral-600">
                  <X className="h-3.5 w-3.5 text-neutral-700 shrink-0" />
                  <span>Khóa AI Copilot & APK Audit</span>
                </li>
              </ul>
            </div>
            <Button
              variant="outline"
              disabled
              className="mt-6 h-8 w-full border-[#333333] bg-[#111111] text-xs text-neutral-400 rounded-md cursor-default"
            >
              {currentTier === "FREE" ? "Gói Hiện Tại" : "Miễn Phí"}
            </Button>
          </div>

          {/* GÓI 2: PRO */}
          <div
            className={`rounded-lg border p-5 flex flex-col justify-between transition bg-[#000000] ${
              currentTier === "PRO"
                ? "border-white"
                : "border-[#222222] hover:border-neutral-700"
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase text-neutral-500">Professional</span>
                {currentTier === "PRO" && (
                  <span className="px-2 py-0.5 rounded-full border border-neutral-700 bg-neutral-800 text-[10px] font-mono text-white">
                    Đang dùng
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold text-white mt-1">Chuyên Nghiệp (PRO)</h3>
              <div className="text-lg font-bold font-mono text-white mt-2">
                License Key <span className="text-xs text-neutral-500 font-normal">/ Kích hoạt</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">Tối ưu cho Pentester & DevSecOps</p>
              <div className="border-t border-[#1f1f1f] my-4" />
              <ul className="space-y-2.5 text-xs text-neutral-300 font-sans">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-white shrink-0" />
                  <span>Quét DAST không giới hạn</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-white shrink-0" />
                  <span>Phân tích lỗ hổng chuyên sâu với AI</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-white shrink-0" />
                  <span>Stress Test L7 (1 lượt/ngày)</span>
                </li>
                <li className="flex items-center gap-2 text-neutral-600">
                  <X className="h-3.5 w-3.5 text-neutral-700 shrink-0" />
                  <span>Khóa AI Copilot Chat & APK Audit</span>
                </li>
              </ul>
            </div>
            {currentTier === "PRO" ? (
              <Button disabled variant="outline" className="mt-6 h-8 w-full border-[#333333] bg-[#111111] text-white text-xs rounded-md">
                Gói Hiện Tại
              </Button>
            ) : (
              <Button
                onClick={() => setSelectedPlanUpgrade("PRO")}
                className="mt-6 h-8 w-full bg-white hover:bg-neutral-200 text-black font-medium text-xs rounded-md transition cursor-pointer"
              >
                Yêu Cầu Cấp Key PRO
              </Button>
            )}
          </div>

          {/* GÓI 3: PRO MAX */}
          <div
            className={`rounded-lg border p-5 flex flex-col justify-between transition bg-[#000000] ${
              currentTier === "PRO_MAX"
                ? "border-white"
                : "border-[#222222] hover:border-neutral-700"
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase text-neutral-500">Enterprise Ready</span>
                {currentTier === "PRO_MAX" && (
                  <span className="px-2 py-0.5 rounded-full border border-neutral-700 bg-neutral-800 text-[10px] font-mono text-white">
                    Đang dùng
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold text-white mt-1">Cao Cấp (PRO MAX)</h3>
              <div className="text-lg font-bold font-mono text-white mt-2">
                License Key <span className="text-xs text-neutral-500 font-normal">/ Kích hoạt</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">Toàn quyền hạ tầng & Agentic AI Copilot</p>
              <div className="border-t border-[#1f1f1f] my-4" />
              <ul className="space-y-2.5 text-xs text-neutral-300 font-sans">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-white shrink-0" />
                  <span>Quét DAST không giới hạn + AI</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-white shrink-0" />
                  <span>Mở khóa toàn bộ AI Copilot Chat</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-white shrink-0" />
                  <span>Stress Test L7 (10 lượt/ngày)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-white shrink-0" />
                  <span>Sinh bản vá One-Click Patch & APK Audit</span>
                </li>
              </ul>
            </div>
            {currentTier === "PRO_MAX" ? (
              <Button disabled variant="outline" className="mt-6 h-8 w-full border-[#333333] bg-[#111111] text-white text-xs rounded-md">
                Gói Hiện Tại
              </Button>
            ) : (
              <Button
                onClick={() => setSelectedPlanUpgrade("PRO_MAX")}
                className="mt-6 h-8 w-full bg-white hover:bg-neutral-200 text-black font-medium text-xs rounded-md transition cursor-pointer"
              >
                Yêu Cầu Cấp Key PRO MAX
              </Button>
            )}
          </div>
        </div>

        {/* Khung Hạ Tầng Doanh Nghiệp Tùy Biến (Custom Deployment) */}
        <div className="rounded-lg border border-[#222222] bg-[#000000] p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-neutral-300" />
              <h3 className="text-sm font-semibold text-white">Hạ Tầng Doanh Nghiệp & Tùy Biến (Custom Deployment)</h3>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Dành cho tổ chức cần triển khai cụm Worker phân tán, Node rà quét chuyên dụng (Dedicated SOC Nodes & IP riêng), Stress Test 50,000+ RPS, tích hợp SIEM/Webhook nội bộ và cam kết SLA hỗ trợ 24/7 từ Lead Developer.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setSelectedPlanUpgrade("ENTERPRISE")}
            className="shrink-0 h-8 border border-[#333333] hover:border-neutral-500 bg-[#111111] hover:bg-neutral-900 text-white font-medium text-xs rounded-md px-4 transition cursor-pointer"
          >
            Liên Hệ Doanh Nghiệp
          </Button>
        </div>

        {/* Khung Thông Tin & Redeem Code */}
        <div className="grid gap-6 md:grid-cols-2 pt-2">
          {/* Card Trạng Thái Tài Khoản */}
          <div className="rounded-lg border border-[#222222] bg-[#000000] p-5 space-y-4">
            <div className="border-b border-[#222222] pb-3">
              <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">Tài khoản hiện tại</p>
              <div className="flex items-center gap-2 mt-0.5">
                <h3 className="text-lg font-semibold text-white">{currentTier.replace("_", " ")}</h3>
                {isPlanExpired && user?.packageTier !== "FREE" && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/40 border border-rose-800 text-rose-300">
                    Gói {user?.packageTier.replace("_", " ")} đã hết hạn
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-3 rounded-md bg-[#0a0a0a] border border-[#222222]">
                <span className="text-neutral-400">
                  {currentTier === "FREE" ? "Lượt quét miễn phí:" : "Lượt quét DAST:"}
                </span>
                <span className="font-mono font-medium text-white">
                  {currentTier === "FREE"
                    ? `${user?.scansToday ?? 0} / 2 lượt trọn đời`
                    : "Không giới hạn"}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-[#0a0a0a] border border-[#222222]">
                <span className="text-neutral-400">Thời hạn giấy phép:</span>
                <span className={`font-mono ${isPlanExpired ? "text-rose-400 font-semibold" : "text-neutral-300"}`}>
                  {user?.planExpiresAt
                    ? isPlanExpired
                      ? `Đã hết hạn (${formatDateTime(user.planExpiresAt)})`
                      : formatDateTime(user.planExpiresAt)
                    : "Vĩnh viễn"}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-[#0a0a0a] border border-[#222222]">
                <span className="text-neutral-400">Trạng thái xác thực:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {user?.status || "ACTIVE"}
                </span>
              </div>
            </div>
          </div>

          {/* Card Kích Hoạt Mã License (Redeem Code) */}
          <div className="rounded-lg border border-[#222222] bg-[#000000] p-5 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-[#222222] pb-3">
              <Gift className="h-4 w-4 text-white" />
              <div>
                <h3 className="font-semibold text-sm text-white">Kích Hoạt Mã License</h3>
                <p className="text-[11px] text-neutral-500">Nhập Redeem Code để nâng cấp gói tức thì</p>
              </div>
            </div>

            {message && (
              <div
                className={`p-3 rounded-md flex items-center gap-2 text-xs border ${
                  message.type === "success"
                    ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                    : "bg-rose-950/20 border-rose-500/40 text-rose-300"
                }`}
              >
                {message.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="redeem-code" className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 font-mono">
                  Mã License / Voucher
                </Label>
                <Input
                  id="redeem-code"
                  placeholder="VD: PRO-MAX-2026-VIP"
                  {...form.register("code")}
                  className="h-9 border-[#333333] bg-[#0a0a0a] font-mono uppercase text-xs text-white focus:border-white focus:ring-0 rounded-md"
                />
                {form.formState.errors.code && (
                  <p className="text-[11px] text-rose-400">{form.formState.errors.code.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-8 bg-white hover:bg-neutral-200 text-black font-medium text-xs rounded-md flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                {submitting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
                {submitting ? "Đang xác thực mã..." : "Kích Hoạt Ngay"}
              </Button>
            </form>
          </div>
        </div>

        {/* Modal Hỗ Trợ Cấp Mã License Trực Tiếp */}
        {selectedPlanUpgrade && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedPlanUpgrade(null)} />
            <div className="relative z-10 w-full max-w-md rounded-xl border border-[#262626] bg-[#0a0a0a] p-6 shadow-2xl space-y-4 text-[#ededed]">
              <div className="flex items-center justify-between border-b border-[#222222] pb-3">
                <h3 className="font-semibold text-sm text-white">Yêu Cầu Cấp Mã License</h3>
                <button onClick={() => setSelectedPlanUpgrade(null)} className="text-neutral-500 hover:text-white p-1">
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-md bg-[#000000] border border-[#222222] space-y-1">
                  <p className="text-[10px] font-mono uppercase text-neutral-500">Mục yêu cầu</p>
                  <p className="font-semibold text-sm text-white">
                    {selectedPlanUpgrade === "ENTERPRISE"
                      ? "Hạ Tầng Doanh Nghiệp (Custom Deployment)"
                      : selectedPlanUpgrade === "PRO_MAX"
                      ? "Gói PRO MAX (Mã Kích Hoạt License)"
                      : "Gói PRO (Mã Kích Hoạt License)"}
                  </p>
                  <p className="text-neutral-400">
                    Tài khoản yêu cầu: <span className="font-mono text-white">{maskEmail(user?.email)}</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-md bg-[#000000] border border-[#222222] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Người phụ trách duyệt:</span>
                    <span className="font-medium text-white">Nguyễn Kiến Quốc (Lead Developer)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Email xử lý:</span>
                    <a href="mailto:kienquocn64@gmail.com" className="font-mono text-white hover:underline">
                      kienquocn64@gmail.com
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Thời gian cấp key:</span>
                    <span className="text-emerald-400 font-medium">Ngay sau khi xác nhận</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <a
                  href={`mailto:kienquocn64@gmail.com?subject=[ADQ License] Yêu cầu mã kích hoạt ${selectedPlanUpgrade}&body=Xin chào Developer Nguyễn Kiến Quốc, tôi muốn yêu cầu mã kích hoạt cho mục ${selectedPlanUpgrade} cho tài khoản email: ${user?.email}`}
                  className="flex-1 h-8 bg-white hover:bg-neutral-200 text-black font-medium text-xs rounded-md flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Mail className="h-3.5 w-3.5" /> Gửi Yêu Cầu Cấp Mã
                </a>
                <Button variant="outline" onClick={() => setSelectedPlanUpgrade(null)} className="h-8 border-[#333333] text-xs rounded-md">
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
