"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  CloudCog,
  Database,
  Home,
  ServerCog,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const OUTAGE_BYPASS_KEY = "adq:vps-outage-acknowledged";

export default function MaintenancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const fullMaintenance =
    searchParams.get("mode") === "full";

  const continueToApp = () => {
    if (fullMaintenance) return;

    sessionStorage.setItem(
      OUTAGE_BYPASS_KEY,
      "true"
    );

    router.replace("/");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] px-4 py-12 text-slate-100">
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
                {fullMaintenance
                  ? "HỆ THỐNG ĐANG BẢO TRÌ"
                  : "VPS ĐANG BẢO TRÌ"}
              </Badge>

              <Badge className="border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                ADQ PILOT
              </Badge>
            </div>

            <h1 className="mt-5 text-2xl font-bold tracking-tight text-white md:text-3xl">
              {fullMaintenance
                ? "ADQ đang tạm thời bảo trì"
                : "Một số tính năng đang tạm thời gián đoạn"}
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              {fullMaintenance ? (
                <>
                  ADQ hiện đang thực hiện bảo trì hệ thống.
                  Trong thời gian này, quyền truy cập vào
                  các chức năng của nền tảng được tạm thời
                  giới hạn cho đến khi quá trình bảo trì
                  hoàn tất.
                </>
              ) : (
                <>
                  Nhà cung cấp VPS của ADQ hiện đang tiến
                  hành bảo trì hạ tầng. Các chức năng phụ
                  thuộc Backend có thể tạm thời không hoạt
                  động, nhưng anh vẫn có thể tiếp tục truy
                  cập giao diện và những phần không phụ
                  thuộc máy chủ VPS.
                </>
              )}
            </p>
          </div>

          {!fullMaintenance && (
            <div className="grid gap-3 p-5 sm:grid-cols-2 md:p-7">
              {[
                {
                  icon: CloudCog,
                  title: "Security Scan",
                  text: "Có thể tạm thời không khởi chạy được.",
                  tone: "text-amber-400",
                },
                {
                  icon: Wrench,
                  title: "Stress Test",
                  text: "Cần kết nối trực tiếp tới Backend VPS.",
                  tone: "text-amber-400",
                },
                {
                  icon: ShieldCheck,
                  title: "AI & Analysis",
                  text: "Một số tác vụ xử lý phía máy chủ có thể gián đoạn.",
                  tone: "text-cyan-400",
                },
                {
                  icon: Database,
                  title: "Frontend & tài khoản",
                  text: "Các phần không phụ thuộc VPS vẫn có thể truy cập.",
                  tone: "text-emerald-400",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${item.tone}`} />

                      <div>
                        <p className="text-sm font-semibold text-white">
                          {item.title}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {item.text}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mx-5 mb-5 rounded-2xl border border-amber-500/20 bg-amber-950/15 p-4 md:mx-7 md:mb-7">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />

              <p className="text-xs leading-6 text-slate-400">
                {fullMaintenance
                  ? "Quyền truy cập sẽ tự động được khôi phục sau khi đội ngũ ADQ kết thúc chế độ bảo trì."
                  : "Nếu một tác vụ yêu cầu Backend báo lỗi hoặc không phản hồi, vui lòng thử lại sau khi nhà cung cấp VPS hoàn tất bảo trì."}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-800 bg-slate-950/70 px-6 py-5">
            {fullMaintenance ? (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <Clock3 className="h-4 w-4" />
                Đang chờ hệ thống được khôi phục
              </div>
            ) : (
              <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <div className="text-[11px] leading-5 text-slate-500">
                  Anh vẫn có thể tiếp tục sử dụng những
                  phần đang khả dụng của ADQ.
                </div>

                <Button
                  onClick={continueToApp}
                  className="border border-cyan-300/60 bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 text-slate-950"
                >
                  <Home className="h-4 w-4" />
                  Tiếp tục sử dụng ADQ
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
