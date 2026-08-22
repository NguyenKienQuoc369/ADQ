"use client";

import {
  AlertTriangle,
  Clock3,
  CloudCog,
  Database,
  RefreshCcw,
  ServerCog,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

export default function MaintenancePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] px-4 py-12 text-slate-100">
      {/* background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(245,158,11,0.10),transparent_35%),radial-gradient(circle_at_15%_80%,rgba(6,182,212,0.08),transparent_30%)]" />

      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:42px_42px]" />

      <div className="relative mx-auto flex min-h-[82vh] max-w-3xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-3xl border border-amber-500/20 bg-slate-950/85 shadow-[0_35px_100px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="border-b border-slate-800/80 p-7 text-center md:p-9">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.12)]">
              <ServerCog className="h-8 w-8 text-amber-400" />
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Badge className="border border-amber-500/30 bg-amber-500/10 text-amber-300">
                HẠ TẦNG ĐANG BẢO TRÌ
              </Badge>

              <Badge className="border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                ADQ PILOT
              </Badge>
            </div>

            <h1 className="mt-5 text-2xl font-bold tracking-tight text-white md:text-3xl">
              Hệ thống tạm thời gián đoạn
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              Nhà cung cấp máy chủ của ADQ hiện đang tiến hành bảo trì
              hạ tầng VPS. Trong thời gian này, một số chức năng cần kết
              nối tới hệ thống quét, AI và Backend API có thể tạm thời
              không khả dụng.
            </p>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2 md:p-7">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <div className="flex items-center gap-3">
                <CloudCog className="h-5 w-5 text-amber-400" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    Nguyên nhân
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Bảo trì hạ tầng từ nhà cung cấp VPS.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-cyan-400" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    Thời gian khôi phục
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Phụ thuộc tiến độ bảo trì của nhà cung cấp.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    Dữ liệu
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    ADQ không thực hiện thay đổi dữ liệu người dùng trong
                    thời gian hạ tầng VPS ngừng hoạt động.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <div className="flex items-center gap-3">
                <Wrench className="h-5 w-5 text-purple-400" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    Trạng thái kỹ thuật
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Đội ngũ ADQ sẽ kiểm tra lại các dịch vụ ngay sau khi
                    VPS được nhà cung cấp khôi phục.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-5 mb-5 rounded-2xl border border-amber-500/20 bg-amber-950/15 p-4 md:mx-7 md:mb-7">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />

              <p className="text-xs leading-6 text-slate-400">
                ADQ hiện đang trong giai đoạn Pilot. Trong quá trình hoàn
                thiện sản phẩm, hạ tầng và các dịch vụ có thể được cập nhật
                hoặc bảo trì. Nếu một tác vụ đang thực hiện bị gián đoạn,
                vui lòng chạy lại sau khi hệ thống được khôi phục.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-800 bg-slate-950/70 px-6 py-5 sm:flex-row">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <RefreshCcw className="h-3.5 w-3.5" />
              Trang sẽ khả dụng trở lại sau khi chế độ bảo trì được tắt.
            </div>

            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              ADQ INFRASTRUCTURE STATUS
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
