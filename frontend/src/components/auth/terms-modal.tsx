"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, CheckCircle2, XCircle, Scale, AlertTriangle, Building, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TermsModalProps {
  isOpen: boolean;
  onAccept: (extraData?: { company?: string }) => Promise<void> | void;
  onDecline: () => void;
  userEmail?: string;
}

export function TermsModal({
  isOpen,
  onAccept,
  onDecline,
  userEmail,
}: TermsModalProps) {
  const [agreedCheck, setAgreedCheck] = useState(false);
  const [company, setCompany] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAcceptClick = async () => {
    if (!agreedCheck || submitting) return;
    setSubmitting(true);
    try {
      await onAccept({ company: company.trim() || undefined });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md font-sans text-slate-100">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-2xl rounded-2xl border border-cyan-500/30 bg-slate-950 p-6 shadow-[0_0_60px_rgba(6,182,212,0.15)] flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-white/[0.08] shrink-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                ĐIỀU KHOẢN SỬ DỤNG & TUYÊN BỐ MIỄN TRỪ TRÁCH NHIỆM
              </h2>
              <p className="text-xs text-slate-400">
                {userEmail ? (
                  <span>Tài khoản: <strong className="text-cyan-400">{userEmail}</strong></span>
                ) : (
                  "Thỏa thuận ràng buộc pháp lý khi sử dụng Nền tảng An ninh mạng ADQ"
                )}
              </p>
            </div>
          </div>

          {/* Nội dung Điều khoản */}
          <div className="flex-1 overflow-y-auto my-3 pr-2 space-y-3.5 text-xs text-slate-300 leading-relaxed font-sans scrollbar-thin scrollbar-thumb-slate-800">
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-300 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <span>QUY ĐỊNH BẮT BUỘC TRƯỚC KHI TRUY CẬP HỆ THỐNG</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-normal">
                Nền tảng ADQ Security cung cấp các công cụ rà quét DAST chuyên sâu, kiểm thử tải L7 và dịch ngược APK. Để kích hoạt phiên làm việc, bạn bắt buộc phải đọc và cam kết tuân thủ các quy định pháp luật dưới đây.
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-cyan-400 text-xs uppercase flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                1. Quyền Hạn Kiểm Thử & Phạm Vi Sử Dụng
              </h3>
              <p>
                Người dùng cam đoan chỉ thực hiện rà quét trên các hệ thống/tên miền mà Người dùng <strong>có quyền sở hữu hợp pháp</strong> hoặc đã nhận được <strong>văn bản chấp thuận / hợp đồng kiểm thử an ninh (Penetration Testing) có chữ ký ủy quyền</strong> của chủ sở hữu hệ thống mục tiêu.
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-cyan-400 text-xs uppercase flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                2. Nghiêm Cấm Hành Vi Tấn Công Phá Hoại
              </h3>
              <p>
                Tuyệt đối không sử dụng công cụ để phá hoại, gây gián đoạn dịch vụ trái phép (DDoS), tống tiền hoặc khai thác dữ liệu trái pháp luật. Mọi hành vi vi phạm sẽ bị xử lý theo <strong>Luật An toàn thông tin mạng 2015</strong> và <strong>Luật An ninh mạng (Luật số 24/2018/QH14)</strong>.
              </p>
            </div>

            <div className="space-y-1 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <h3 className="font-bold text-rose-400 text-xs uppercase flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
                3. Tuyên Bố Miễn Trừ Trách Nhiệm Của ADQ Security
              </h3>
              <p className="text-slate-300">
                <strong>ADQ Security và đội ngũ vận hành ĐƯỢC MIỄN TRỪ HOÀN TOÀN</strong> khỏi mọi trách nhiệm dân sự, hình sự hoặc bất kỳ khiếu nại, bồi thường thiệt hại nào phát sinh từ việc Người dùng đưa các mục tiêu không được ủy quyền vào hệ thống. Người dùng đồng ý tự chịu <strong>100% trách nhiệm trước pháp luật</strong> cho mọi hành vi thao tác của mình.
              </p>
            </div>

            {/* Ô Bổ sung Tên Công ty / Tổ chức cho tài khoản mới */}
            <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 space-y-1.5">
              <label className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-cyan-400" />
                Tên Đơn vị / Doanh nghiệp / Tổ chức của bạn (Tùy chọn):
              </label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="VD: Security Lab, FinTech Corp, Freelance..."
                className="h-8 border-slate-800 bg-slate-950 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/60"
              />
            </div>
          </div>

          {/* Footer & Actions */}
          <div className="pt-3 border-t border-white/[0.08] shrink-0 space-y-2.5">
            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedCheck}
                onChange={(e) => setAgreedCheck(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-400 accent-cyan-500 cursor-pointer"
              />
              <span>
                Tôi đã đọc kỹ, hiểu rõ và cam kết tuân thủ toàn bộ các điều khoản & quy định miễn trừ trách nhiệm trên.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={onDecline}
                disabled={submitting}
                className="h-9 px-4 text-xs border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-rose-950/30 hover:border-rose-500/40 hover:text-rose-300 transition rounded-xl"
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Từ Chối & Đăng Xuất
              </Button>

              <Button
                type="button"
                onClick={handleAcceptClick}
                disabled={!agreedCheck || submitting}
                className="h-9 px-5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.2)] disabled:opacity-50 transition rounded-xl"
              >
                {submitting ? (
                  <span className="flex items-center gap-1.5">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    Đang kích hoạt...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Chấp Thuận & Vào Console
                  </span>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
