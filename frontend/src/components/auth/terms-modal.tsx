"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, CheckCircle2, XCircle, FileText, Lock, Scale, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TermsModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  isMandatoryOnboarding?: boolean;
}

export function TermsModal({
  isOpen,
  onAccept,
  onDecline,
  isMandatoryOnboarding = false,
}: TermsModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [agreedCheck, setAgreedCheck] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 40) {
      setHasScrolledToBottom(true);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md font-sans text-slate-100">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-2xl rounded-2xl border border-cyan-500/30 bg-slate-950 p-6 shadow-[0_0_60px_rgba(6,182,212,0.15)] flex flex-col max-h-[88vh]"
        >
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-white/[0.08] shrink-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                ĐIỀU KHOẢN DỊCH VỤ & TUYÊN BỐ MIỄN TRỪ TRÁCH NHIỆM
              </h2>
              <p className="text-xs text-slate-400">
                Thỏa thuận ràng buộc pháp lý khi sử dụng Nền tảng An ninh mạng ADQ Security
              </p>
            </div>
          </div>

          {/* Nội dung Điều khoản & Miễn trừ trách nhiệm */}
          <div
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto my-4 pr-2 space-y-4 text-xs text-slate-300 leading-relaxed font-sans scrollbar-thin scrollbar-thumb-slate-800"
          >
            {/* Cảnh báo quan trọng */}
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-300 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <span>CẢNH BÁO QUAN TRỌNG VỀ TÍNH PHÁP LÝ</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-normal">
                Nền tảng ADQ Security chứa các công cụ rà quét DAST, Stress Test Layer 7 và Reverse Engineering có khả năng phát hiện lỗ hổng và tác động đến hạ tầng mạng. Bạn bắt buộc phải tuân thủ nghiêm ngặt các điều khoản dưới đây.
              </p>
            </div>

            {/* Điều 1: Phạm vi sử dụng */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-cyan-400 text-xs uppercase flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                1. Mục đích Sử dụng & Quyền Hạn Kiểm Thử
              </h3>
              <p>
                Người dùng cam kết chỉ sử dụng nền tảng ADQ Security cho mục đích: (a) Đánh giá an ninh nội bộ hệ thống do chính Người dùng sở hữu, hoặc (b) Thực hiện kiểm thử thâm nhập (Penetration Testing) khi đã có <strong>văn bản chấp thuận / hợp đồng ủy quyền hợp pháp</strong> từ chủ sở hữu hệ thống mục tiêu.
              </p>
            </div>

            {/* Điều 2: Nghiêm cấm hành vi phá hoại */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-cyan-400 text-xs uppercase flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                2. Nghiêm cấm Hành vi Xâm Nhập & Tấn Công Trái Phép
              </h3>
              <p>
                Tuyệt đối nghiêm cấm Người dùng sử dụng các công cụ rà quét, bóc tách API, bắn tải (Stress Test) hoặc khai thác lỗ hổng nhằm mục đích: tấn công từ chối dịch vụ (DDoS), đánh cắp dữ liệu, tống tiền, phá hoại hệ thống thông tin hoặc bất kỳ hành vi nào vi phạm <strong>Luật An toàn thông tin mạng 2015</strong> và <strong>Luật An ninh mạng Việt Nam (Luật số 24/2018/QH14)</strong> cũng như pháp luật quốc tế sở tại.
              </p>
            </div>

            {/* Điều 3: Tuyên bố Miễn trừ Trách nhiệm Hoàn toàn */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <h3 className="font-bold text-rose-400 text-xs uppercase flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
                3. Tuyên Bố Miễn Trừ Trách Nhiệm Pháp Lý Của ADQ Security
              </h3>
              <p className="text-slate-300">
                <strong>ADQ Security, đội ngũ phát triển và các đơn vị liên kết ĐƯỢC MIỄN TRỪ HOÀN TOÀN</strong> khỏi mọi trách nhiệm hình sự, dân sự, khiếu nại hoặc bất kỳ tổn thất, thiệt hại trực tiếp hay gián tiếp nào phát sinh do:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
                <li>Hành vi Người dùng cố ý hoặc vô ý quét/bắn tải vào các mục tiêu không được cấp phép.</li>
                <li>Sự cố sập máy chủ, gián đoạn dịch vụ hoặc mất mát dữ liệu của bên thứ ba trong quá trình kiểm thử.</li>
                <li>Việc Người dùng để lộ lọt mã Bypass Secret, API Key, Token hoặc kết quả quét an ninh.</li>
              </ul>
              <p className="text-slate-300 mt-1">
                Người dùng đồng ý tự chịu <strong>100% trách nhiệm trước pháp luật</strong> cho mọi hành vi thao tác và mục tiêu được đưa vào hệ thống.
              </p>
            </div>

            {/* Điều 4: Quyền khóa và chấm dứt tài khoản */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-cyan-400 text-xs uppercase flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                4. Giám Sát Lạm Dụng & Chấm Dứt Quyền Sử Dụng
              </h3>
              <p>
                ADQ Security bảo lưu toàn quyền theo dõi các hành vi bất thường, tự động tạm ngưng hoặc xóa vĩnh viễn tài khoản mà không cần báo trước nếu phát hiện có dấu hiệu lạm dụng công cụ để tấn công phá hoại hạ tầng mạng.
              </p>
            </div>
          </div>

          {/* Footer & Action Buttons */}
          <div className="pt-3 border-t border-white/[0.08] shrink-0 space-y-3">
            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedCheck}
                onChange={(e) => setAgreedCheck(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-400 accent-cyan-500 cursor-pointer"
              />
              <span>
                Tôi đã đọc kỹ, hiểu rõ và cam đoan tuân thủ toàn bộ các điều khoản & quy định miễn trừ trách nhiệm trên.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={onDecline}
                className="h-9 px-4 text-xs border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-rose-950/30 hover:border-rose-500/40 hover:text-rose-300 transition rounded-xl"
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Từ Chối & Thoát
              </Button>

              <Button
                type="button"
                onClick={onAccept}
                disabled={!agreedCheck}
                className="h-9 px-5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.2)] disabled:opacity-50 disabled:cursor-not-allowed transition rounded-xl"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-slate-950" />
                Chấp Thuận & Tiếp Tục
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
