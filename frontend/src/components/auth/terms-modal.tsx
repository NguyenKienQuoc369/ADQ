"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, CheckCircle2, XCircle, Scale, AlertTriangle, Lock, FileText, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { maskEmail } from "@/lib/utils";

interface TermsModalProps {
  isOpen: boolean;
  onAccept: () => Promise<void> | void;
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
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAcceptClick = async () => {
    if (!agreedCheck || submitting) return;
    setSubmitting(true);
    try {
      await onAccept();
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
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-3xl rounded-lg border border-[#222222] bg-[#000000] p-6 sm:p-7 shadow-2xl flex flex-col max-h-[88vh]"
        >
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-[#222222] shrink-0">
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
              <h2 className="text-base font-semibold text-white tracking-tight">
                ĐIỀU KHOẢN SỬ DỤNG & MIỄN TRỪ TRÁCH NHIỆM PHÁP LÝ
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                {userEmail ? (
                  <span>Tài khoản xác thực: <strong className="text-white font-mono">{maskEmail(userEmail)}</strong></span>
                ) : (
                  "Thỏa thuận ràng buộc pháp lý khi sử dụng Nền tảng An ninh mạng ADQ"
                )}
              </p>
            </div>
          </div>

          {/* Nội dung Điều khoản Chi tiết */}
          <div className="flex-1 overflow-y-auto my-4 pr-3 space-y-4 text-xs text-neutral-300 leading-relaxed font-sans">
            {/* Box Cảnh báo Pháp luật */}
            <div className="p-3.5 rounded-md bg-amber-950/20 border border-amber-500/30 text-amber-300 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <span>CẢNH BÁO PHÁP LÝ & TRÁCH NHIỆM HÌNH SỰ</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-normal">
                ADQ Security là nền tảng điều phối rà quét DAST chuyên sâu, kiểm thử tải L7 (Stress Test) và kiểm toán mã độc APK. Việc sử dụng các tính năng này trên hệ thống mạng mà <strong>không có sự đồng ý bằng văn bản của chủ sở hữu</strong> là hành vi vi phạm pháp luật hình sự nghiêm trọng.
              </p>
            </div>

            {/* Điều 1: Căn cứ Pháp lý */}
            <div className="space-y-1">
              <h3 className="font-semibold text-white text-xs uppercase">
                1. Căn Cứ Pháp Lý & Hiệu Lực Thỏa Thuận
              </h3>
              <p>
                Thỏa thuận này được thiết lập dựa trên các quy định hiện hành của pháp luật Việt Nam và chuẩn mực an toàn thông tin quốc tế:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-neutral-400 text-[11px]">
                <li><strong>Luật An toàn thông tin mạng số 86/2015/QH13</strong> do Quốc hội ban hành.</li>
                <li><strong>Luật An ninh mạng số 24/2018/QH14</strong> và các văn bản hướng dẫn thi hành.</li>
                <li><strong>Bộ luật Hình sự số 100/2015/QH13</strong>: Điều 287, Điều 289, Điều 290.</li>
              </ul>
            </div>

            {/* Điều 2: Quyền hạn kiểm thử */}
            <div className="space-y-1">
              <h3 className="font-semibold text-white text-xs uppercase">
                2. Cam Kết Quyền Hạn Kiểm Thử (Authorization & Scope)
              </h3>
              <p className="text-[11px] text-neutral-400">
                Người dùng cam kết chỉ thực hiện rà quét và kiểm thử đối với hạ tầng mà mình sở hữu hợp pháp hoặc đã được ủy quyền chính thức bằng văn bản.
              </p>
            </div>

            {/* Điều 3: Giới hạn trách nhiệm */}
            <div className="space-y-1">
              <h3 className="font-semibold text-white text-xs uppercase">
                3. Bồi Thường & Trách Nhiệm Dữ Liệu
              </h3>
              <p className="text-[11px] text-neutral-400">
                Người dùng đồng ý tự chịu 100% trách nhiệm trước pháp luật cho mọi mục tiêu đưa vào hệ thống. ADQ Security ghi nhận Audit Logs đầy đủ và bảo lưu quyền phối hợp với cơ quan an ninh khi có yêu cầu.
              </p>
            </div>
          </div>

          {/* Footer & Actions */}
          <div className="pt-4 border-t border-[#222222] shrink-0 space-y-3">
            <label className="flex items-start gap-2.5 text-xs text-neutral-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedCheck}
                onChange={(e) => setAgreedCheck(e.target.checked)}
                className="h-4 w-4 mt-0.5 rounded border-[#333333] bg-[#0a0a0a] text-white focus:ring-0 accent-white cursor-pointer"
              />
              <span className="leading-snug">
                Tôi xác nhận đã đọc kỹ, hiểu rõ toàn bộ nội dung bản Thỏa thuận trên và <strong>cam kết tự chịu 100% trách nhiệm trước pháp luật</strong> cho mọi mục tiêu kiểm thử đưa vào hệ thống ADQ.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={onDecline}
                disabled={submitting}
                className="h-8 px-4 text-xs border-[#333333] bg-[#111111] hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-md transition"
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Từ Chối & Đăng Xuất
              </Button>

              <Button
                type="button"
                onClick={handleAcceptClick}
                disabled={!agreedCheck || submitting}
                className="h-8 px-5 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {submitting ? (
                  <span className="flex items-center gap-1.5 font-mono">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    Đang kích hoạt...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Chấp Thuận & Tiếp Tục
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
