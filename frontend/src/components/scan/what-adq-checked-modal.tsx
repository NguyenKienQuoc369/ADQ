"use client";

import React, { useState } from "react";
import { ScopeLimitation, EvaluatedSecurityControl } from "@/lib/api";
import { 
  X, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  BookOpen, 
  Info,
  Terminal,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface WhatADQCheckedModalProps {
  isOpen: boolean;
  onClose: () => void;
  controls: EvaluatedSecurityControl[];
  scopeLimitations: ScopeLimitation[];
}

export function WhatADQCheckedModal({
  isOpen,
  onClose,
  controls,
  scopeLimitations,
}: WhatADQCheckedModalProps) {
  const [activeTab, setActiveTab] = useState<"controls" | "limitations">("controls");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div 
        className="relative w-full max-w-4xl max-h-[85vh] rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Danh Mục Kiểm Soát An Ninh & Giới Hạn Kỹ Thuật
              </h3>
              <p className="text-xs text-slate-400">
                Minh bạch toàn diện về phương pháp kiểm thử và phạm vi rà quét của ADQ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 gap-4">
          <button
            onClick={() => setActiveTab("controls")}
            className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "controls"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Danh mục Kiểm soát ({controls.length} Controls)
          </button>
          <button
            onClick={() => setActiveTab("limitations")}
            className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "limitations"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Giới hạn Kỹ thuật & Phạm vi ({scopeLimitations.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === "controls" ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg border border-cyan-900/30 bg-cyan-950/20 text-xs text-slate-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p>
                  ADQ kiểm tra các mục tiêu theo tiêu chuẩn bảo mật quốc tế (OWASP Top 10, CWE). Mỗi kiểm soát được gán mã định danh chuẩn và ánh xạ trực tiếp đến từng giai đoạn kiểm thử.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {controls.map((ctrl) => (
                  <div
                    key={ctrl.id}
                    className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between space-y-2"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-cyan-400">
                          {ctrl.code}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {ctrl.stage_name}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-white">
                        {ctrl.title_vi || ctrl.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {ctrl.description_vi || ctrl.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-500 flex items-center justify-between">
                      <span>OWASP: {ctrl.owasp_category.split("-")[0]}</span>
                      <span>Tier: {ctrl.minimum_tier}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-lg border border-amber-900/30 bg-amber-950/20 text-xs text-slate-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  Để đảm bảo an toàn tuyệt đối cho hệ thống đang vận hành (Production), ADQ tuân thủ nghiêm ngặt các nguyên tắc giới hạn kiểm thử có trách nhiệm.
                </p>
              </div>

              <div className="space-y-3">
                {scopeLimitations.map((lim) => (
                  <div
                    key={lim.id}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-1.5"
                  >
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      {lim.title_vi || lim.title}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed pl-3.5">
                      {lim.description_vi || lim.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-800 p-4 bg-slate-950/60 flex items-center justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}

