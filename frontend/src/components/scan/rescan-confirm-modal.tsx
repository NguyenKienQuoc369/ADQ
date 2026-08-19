"use client";

import React, { useState } from "react";
import { AlertTriangle, PlusCircle, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RescanConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (dontShowAgain: boolean) => void;
  onCreateNewSession: () => void;
}

export function RescanConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  onCreateNewSession,
}: RescanConfirmModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans">
      <div className="relative w-full max-w-lg rounded-2xl border border-rose-500/30 bg-slate-950 p-6 shadow-2xl shadow-rose-950/40 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Nút đóng */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Tiêu đề & Icon cảnh báo */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Ghi đè dữ liệu phiên quét</h3>
            <p className="text-xs text-rose-300/80 font-mono mt-0.5">WARNING: DATA OVERWRITE HAZARD</p>
          </div>
        </div>

        {/* Nội dung cảnh báo */}
        <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-300">
          <p>
            Dữ liệu và kết quả của phiên hiện tại (bao gồm phát hiện lỗ hổng, khuyến nghị AI, Stress Test và APK) sẽ bị <strong className="text-rose-400">ghi đè và làm mới</strong> khi bạn kích hoạt lượt quét mới trên cùng phiên này.
          </p>
          <p className="text-slate-400">
            Nếu bạn muốn lưu giữ các kết quả này để đối chiếu, hãy chọn <strong className="text-cyan-300">Tạo phiên quét mới</strong>.
          </p>
        </div>

        {/* Tùy chọn Không bao giờ hiện lại */}
        <div className="mt-5 flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <input
            id="dont-show-again"
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-950 cursor-pointer accent-cyan-500"
          />
          <label
            htmlFor="dont-show-again"
            className="text-xs text-slate-300 cursor-pointer select-none"
          >
            Không bao giờ hiển thị lại thông báo này
          </label>
        </div>

        {/* Các nút hành động */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="w-full sm:w-auto h-9 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
          >
            Hủy bỏ
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateNewSession}
            className="w-full sm:w-auto h-9 text-xs border-cyan-500/40 bg-cyan-950/50 text-cyan-300 hover:bg-cyan-900/60 flex items-center gap-1.5"
          >
            <PlusCircle className="h-3.5 w-3.5" /> Tạo phiên quét mới
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onConfirm(dontShowAgain)}
            className="w-full sm:w-auto h-9 text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium flex items-center gap-1.5 shadow-lg shadow-rose-950"
          >
            <Play className="h-3.5 w-3.5" /> Vẫn quét và ghi đè
          </Button>
        </div>
      </div>
    </div>
  );
}
