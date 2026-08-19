"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, CheckCircle2, XCircle, Scale, AlertTriangle, Lock, FileText, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl font-sans text-slate-100 selection:bg-cyan-500 selection:text-black">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative w-full max-w-3xl rounded-3xl border border-cyan-500/30 bg-slate-950 p-6 sm:p-8 shadow-[0_0_80px_rgba(6,182,212,0.18)] flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center gap-3.5 pb-4 border-b border-white/[0.08] shrink-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
              <Scale className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                ĐIỀU KHOẢN SỬ DỤNG & TUYÊN BỐ MIỄN TRỪ TRÁCH NHIỆM PHÁP LÝ
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {userEmail ? (
                  <span>Tài khoản xác thực: <strong className="text-cyan-400 font-mono">{userEmail}</strong></span>
                ) : (
                  "Thỏa thuận ràng buộc pháp lý khi sử dụng Nền tảng An ninh mạng ADQ Security"
                )}
              </p>
            </div>
          </div>

          {/* Nội dung Điều khoản Chi tiết */}
          <div className="flex-1 overflow-y-auto my-4 pr-3 space-y-4 text-xs text-slate-300 leading-relaxed font-sans scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950">
            {/* Box Cảnh báo Pháp luật */}
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-300 space-y-1.5 shadow-[inset_0_1px_0_0_rgba(245,158,11,0.2)]">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <span>CẢNH BÁO QUAN TRỌNG VỀ TÍNH PHÁP LÝ & TRÁCH NHIỆM HÌNH SỰ</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-normal">
                ADQ Security là nền tảng điều phối rà quét DAST chuyên sâu, kiểm thử tải L7 (Stress Test) và kiểm toán mã độc APK. Việc sử dụng các tính năng này trên hệ thống mạng mà <strong>không có sự đồng ý bằng văn bản của chủ sở hữu</strong> là hành vi vi phạm pháp luật hình sự nghiêm trọng.
              </p>
            </div>

            {/* Điều 1: Căn cứ Pháp lý */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-cyan-400 text-xs uppercase flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                1. Căn Cứ Pháp Lý & Hiệu Lực Thỏa Thuận
              </h3>
              <p>
                Thỏa thuận này được thiết lập dựa trên các quy định hiện hành của pháp luật Việt Nam và chuẩn mực an toàn thông tin quốc tế, bao gồm nhưng không giới hạn ở:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-400 text-[11px]">
                <li><strong>Luật An toàn thông tin mạng số 86/2015/QH13</strong> do Quốc hội ban hành.</li>
                <li><strong>Luật An ninh mạng số 24/2018/QH14</strong> và các văn bản hướng dẫn thi hành.</li>
                <li><strong>Bộ luật Hình sự số 100/2015/QH13 (sửa đổi, bổ sung 2017)</strong>: Đặc biệt tại Điều 287 (Tội cản trở hoặc gây rối loạn hoạt động của mạng máy tính, mạng viễn thông), Điều 289 (Tội xâm nhập trái phép vào mạng máy tính), Điều 290 (Tội sử dụng mạng máy tính chiếm đoạt tài sản).</li>
              </ul>
            </div>

            {/* Điều 2: Quyền hạn kiểm thử */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-cyan-400 text-xs uppercase flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                2. Cam Kết Quyền Hạn Kiểm Thử (Authorization & Scope of Engagement)
              </h3>
              <p>
                Bằng việc nhấn "Chấp thuận", Người dùng khẳng định và cam đoan:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-400 text-[11px]">
                <li>Người dùng là chủ sở hữu hợp pháp của Domain/IP/Endpoint mục tiêu được đưa vào hệ thống, HOẶC;</li>
                <li>Người dùng đã được chủ sở hữu hệ thống mục tiêu <strong>ủy quyền hợp pháp bằng văn bản</strong> để thực hiện các nghiệp vụ đánh giá an ninh, rà quét lỗ hổng và kiểm tra tải.</li>
                <li>Người dùng chỉ thực hiện kiểm thử trong đúng phạm vi thời gian, địa chỉ IP và giới hạn tài nguyên đã được thỏa thuận với chủ sở hữu.</li>
              </ul>
            </div>

            {/* Điều 3: Các hành vi bị nghiêm cấm */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-cyan-400 text-xs uppercase flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                3. Các Hành Vi Bị Nghiêm Cấm Tuyệt Đối
              </h3>
              <p>
                Người dùng không được phép sử dụng bất kỳ công cụ hoặc API nào của ADQ Security vào các mục đích:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-400 text-[11px]">
                <li>Tấn công từ chối dịch vụ (DDoS) nhằm làm sập hoặc gián đoạn hoạt động kinh doanh của bên thứ ba.</li>
                <li>Khai thác lỗ hổng nhằm đánh cắp dữ liệu cá nhân, bí mật kinh doanh, tống tiền hoặc cài cắm mã độc.</li>
                <li>Quét và thu thập dữ liệu trái phép các cổng thông tin chính phủ, tổ chức tài chính, ngân hàng mà không có thẩm quyền.</li>
              </ul>
            </div>

            {/* Điều 4: Tuyên bố Miễn trừ Trách nhiệm Toàn diện */}
            <div className="space-y-2 p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-slate-300">
              <h3 className="font-bold text-rose-400 text-xs uppercase flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
                4. Tuyên Bố Miễn Trừ Trách Nhiệm Tuyệt Đối Của ADQ Security
              </h3>
              <p className="leading-normal">
                <strong>ADQ Security, đội ngũ phát triển và các đơn vị cung cấp hạ tầng ĐƯỢC MIỄN TRỪ HOÀN TOÀN</strong> khỏi mọi trách nhiệm pháp lý, hình sự, dân sự hoặc bất kỳ nghĩa vụ bồi thường nào đối với:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-400">
                <li>Mọi hành vi Người dùng cố ý hoặc vô ý quét/bắn tải vào các mục tiêu trái phép hoặc vượt quá phạm vi ủy quyền.</li>
                <li>Bất kỳ sự cố gián đoạn dịch vụ, suy giảm hiệu năng hoặc mất mát dữ liệu nào xảy ra trên hệ thống của mục tiêu trong quá trình kiểm thử tải.</li>
                <li>Việc Người dùng làm lộ lọt Token, API Key, mã Bypass hoặc báo cáo lỗ hổng an ninh ra ngoài.</li>
              </ul>
              <p className="font-semibold text-slate-200 mt-1">
                Người dùng đồng ý tự chịu <strong>100% trách nhiệm trước pháp luật</strong> cho mọi hành vi và hậu quả phát sinh từ việc sử dụng tài khoản của mình.
              </p>
            </div>

            {/* Điều 5: Cam kết bồi hoàn & Hợp tác điều tra */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-cyan-400 text-xs uppercase flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                5. Cam Kết Bồi Hoàn & Hợp Tác Với Cơ Quan Điều Tra
              </h3>
              <p className="text-[11px] text-slate-400">
                Người dùng đồng ý bảo vệ, bồi thường và giữ cho ADQ Security không phải chịu tổn thất đối với bất kỳ khiếu nại, kiện tụng nào từ bên thứ ba liên quan đến hành vi của Người dùng. Hệ thống tự động ghi nhật ký truy vết (Audit Logs) và bảo lưu quyền cung cấp dữ liệu cho cơ quan an ninh có thẩm quyền khi phát hiện hành vi tấn công phá hoại.
              </p>
            </div>
          </div>

          {/* Footer & Actions */}
          <div className="pt-4 border-t border-white/[0.08] shrink-0 space-y-3">
            <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedCheck}
                onChange={(e) => setAgreedCheck(e.target.checked)}
                className="h-4 w-4 mt-0.5 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-400 accent-cyan-500 cursor-pointer"
              />
              <span className="leading-snug">
                Tôi xác nhận rằng tôi đã đọc kỹ, hiểu rõ toàn bộ nội dung bản Thỏa thuận trên và <strong>cam kết tự chịu 100% trách nhiệm trước pháp luật</strong> cho mọi mục tiêu kiểm thử đưa vào hệ thống ADQ Security.
              </span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={onDecline}
                disabled={submitting}
                className="h-10 px-5 text-xs border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-rose-950/30 hover:border-rose-500/40 hover:text-rose-300 transition rounded-xl"
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                Từ Chối & Đăng Xuất
              </Button>

              <Button
                type="button"
                onClick={handleAcceptClick}
                disabled={!agreedCheck || submitting}
                className="h-10 px-6 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-[0_0_25px_rgba(6,182,212,0.25)] disabled:opacity-40 disabled:cursor-not-allowed transition rounded-xl"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Đang kích hoạt quyền truy cập...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
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
