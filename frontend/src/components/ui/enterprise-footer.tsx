"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUp,
  ChevronRight,
  FileText,
  Lock,
  Radar,
  Rocket,
  Scale,
  Server,
  Shield,
  ShieldAlert,
  Sparkles,
  Terminal,
  X,
  Zap,
} from "lucide-react";

export function EnterpriseFooter() {
  const [modalTab, setModalTab] = useState<"terms" | "privacy" | "security" | null>(null);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative border-t border-cyan-500/20 bg-[#020617] text-slate-400">
      {/* Glow ambient background */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-32 w-96 -translate-x-1/2 rounded-full bg-cyan-500/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 md:px-8">
        {/* MAIN 4-COLUMN GRID */}
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* COLUMN 1: BRAND IDENTITY & INSTITUTION */}
          <div className="space-y-4 lg:pr-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                <Shield className="h-5 w-5" />
              </div>
              <span className="font-mono text-lg font-bold tracking-wider text-white">
                ADQ SECURITY
              </span>
            </div>

            <p className="text-xs leading-relaxed text-slate-400">
              Nền tảng rà soát bề mặt tấn công tự động DAST, thẩm định WAF Evasion và phân tích rủi ro an ninh mạng bằng AI.
            </p>

            <div className="border-t border-white/[0.06] pt-3 text-[11px] text-slate-500 font-mono">
              <p>Hạ tầng Bảo mật vận hành 24/7</p>
              <p className="text-emerald-400 flex items-center gap-1 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                OPERATIONAL 99.99% UPTIME
              </p>
            </div>
          </div>

          {/* COLUMN 2: SẢN PHẨM & CÔNG CỤ */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white font-mono">
              Sản phẩm & Công cụ
            </p>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => scrollToSection("platform")}
                  className="hover:text-cyan-300 transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronRight className="h-3 w-3 text-cyan-500" />
                  Rà quét DAST tự động
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection("platform")}
                  className="hover:text-cyan-300 transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronRight className="h-3 w-3 text-cyan-500" />
                  Kiểm thử tải L7 Stress Test
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection("platform")}
                  className="hover:text-cyan-300 transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronRight className="h-3 w-3 text-cyan-500" />
                  Kiểm toán mã nguồn APK Audit
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection("platform")}
                  className="hover:text-cyan-300 transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronRight className="h-3 w-3 text-cyan-500" />
                  Trợ lý AI Copilot Triage
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection("pricing")}
                  className="hover:text-cyan-300 transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronRight className="h-3 w-3 text-cyan-500" />
                  Bảng giá & Gói dịch vụ
                </button>
              </li>
            </ul>
          </div>

          {/* COLUMN 3: TIÊU CHUẨN & PHÁP LÝ */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white font-mono">
              Pháp lý & Bảo mật
            </p>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => setModalTab("terms")}
                  className="hover:text-cyan-300 transition flex items-center gap-1 cursor-pointer text-slate-300"
                >
                  <Scale className="h-3.5 w-3.5 text-cyan-400" />
                  Điều khoản dịch vụ & Ủy quyền
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setModalTab("privacy")}
                  className="hover:text-cyan-300 transition flex items-center gap-1 cursor-pointer text-slate-300"
                >
                  <Lock className="h-3.5 w-3.5 text-cyan-400" />
                  Chính sách bảo mật dữ liệu
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setModalTab("security")}
                  className="hover:text-cyan-300 transition flex items-center gap-1 cursor-pointer text-slate-300"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" />
                  Báo cáo lỗ hổng Safe Harbor
                </button>
              </li>
            </ul>
          </div>

          {/* COLUMN 4: KHỦNG CỦA HỆ THỐNG & TRUY CẬP */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white font-mono">
              Security Console
            </p>
            <p className="text-xs leading-relaxed text-slate-400">
              Truy cập ngay vào Console để bắt đầu quản lý các chiến dịch đánh giá an toàn thông tin.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 transition cursor-pointer"
              >
                <Terminal className="h-3.5 w-3.5" />
                Đăng nhập Security Console
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 hover:opacity-90 transition cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                <Rocket className="h-3.5 w-3.5" />
                Tạo tài khoản mới
              </Link>
            </div>
          </div>
        </div>

        {/* BOTTOM COPYRIGHT STRIP */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.08] pt-8 text-xs text-slate-500 md:flex-row">
          <p>© 2026 ADQ SECURITY. All rights reserved.</p>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-slate-400">
              <Lock className="h-3 w-3 text-cyan-400" />
              AES-256 ENCRYPTED
            </span>
            <button
              onClick={scrollToTop}
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-200 transition cursor-pointer"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              Lên đầu trang
            </button>
          </div>
        </div>
      </div>

      {/* POPUP MODAL CHO PHÁP LÝ & BẢO MẬT */}
      {modalTab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-2xl rounded-3xl border border-cyan-500/30 bg-[#020617] p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                  {modalTab === "terms" && "Điều Khoản Dịch Vụ & Ủy Quyền Rà Quét"}
                  {modalTab === "privacy" && "Chính Sách Bảo Mật Dữ Liệu & Quyền Riêng Tư"}
                  {modalTab === "security" && "Chính Sách Báo Cáo Lỗ Hổng (Safe Harbor)"}
                </h3>
              </div>
              <button
                onClick={() => setModalTab(null)}
                className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed pr-2">
              {modalTab === "terms" && (
                <div className="space-y-4 font-sans">
                  <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-200 space-y-2">
                    <h4 className="font-bold text-amber-300 text-xs uppercase flex items-center gap-1.5 font-mono">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                      <span>CẢNH BÁO PHÁP LÝ & TRÁCH NHIỆM HÌNH SỰ SỐ 86/2015 & 24/2018</span>
                    </h4>
                    <p className="text-[11px] leading-normal text-amber-200/90">
                      Công cụ <strong>ADQ (Autonomous Cyber Security Testing & Load Platform)</strong> được thiết kế duy nhất phục vụ mục đích kiểm thử bảo mật có văn bản ủy quyền hợp pháp. Việc sử dụng các tính năng rà quét DAST hoặc Stress Test trên hệ thống không được đồng ý bằng văn bản là hành vi vi phạm pháp luật hình sự nghiêm trọng.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="font-bold text-white text-xs uppercase tracking-wide font-mono">
                      1. Căn Cứ Pháp Lý & Quy Định Hiện Hành
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Người dùng tuân thủ nghiêm ngặt các quy định của pháp luật Việt Nam và chuẩn mực an toàn thông tin quốc tế:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-300 text-[11px]">
                      <li><strong>Luật An toàn thông tin mạng số 86/2015/QH13</strong> do Quốc hội ban hành.</li>
                      <li><strong>Luật An ninh mạng số 24/2018/QH14</strong> và các văn bản hướng dẫn thi hành.</li>
                      <li><strong>Bộ luật Hình sự số 100/2015/QH13</strong>: Điều 287 (Cản trở/phá hoại mạng), Điều 289 (Xâm nhập trái phép), Điều 290.</li>
                    </ul>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="font-bold text-white text-xs uppercase tracking-wide font-mono">
                      2. Miễn Trừ Trách Nhiệm Tác Giả & Nhà Phát Triển
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      Tác giả (<strong>Nguyễn Kiến Quốc</strong>), các nhà đóng góp (Contributors) và tổ chức phát triển ADQ Security <strong>không chịu bất kỳ trách nhiệm pháp lý, dân sự hoặc hình sự nào</strong> đối với tổn thất dữ liệu, gián đoạn dịch vụ hoặc vi phạm pháp luật do người dùng gây ra. Người dùng chịu 100% trách nhiệm cá nhân trước cơ quan pháp luật.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="font-bold text-white text-xs uppercase tracking-wide font-mono">
                      3. Cảnh Báo Đặc Biệt Về Tấn Công Chịu Tải (Layer 7 Stress Testing)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Tính năng Stress Test có khả năng phát hàng trăm ngàn đến hàng triệu request. Việc thực thi đối với các mục tiêu không ủy quyền có thể gây sập dịch vụ (DoS/DDoS), Billing Shock chi phí cloud và bị truy cứu trách nhiệm hình sự theo CFAA / Luật An ninh mạng.
                    </p>
                  </div>
                </div>
              )}

              {modalTab === "privacy" && (
                <div className="space-y-4 font-sans">
                  <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/40 text-slate-200 space-y-2">
                    <h4 className="font-bold text-cyan-300 text-xs uppercase font-mono">
                      Cam Kết Bảo Mật Tuyệt Đối Dữ Liệu Khách Hàng
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      ADQ Security cam kết bảo vệ dữ liệu tài sản số và kết quả đánh giá an ninh của tổ chức với tiêu chuẩn mã hóa cao nhất.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="font-bold text-white text-xs uppercase font-mono">
                      1. Mã hóa cấp độ doanh nghiệp (AES-256)
                    </h4>
                    <p className="text-slate-300 text-[11px]">
                      Toàn bộ dữ liệu mục tiêu quét, danh sách subdomain, lỗ hổng phát hiện và các bằng chứng kỹ thuật (PoC) đều được mã hóa bằng thuật toán AES-256 ngay khi lưu trữ trong cơ sở dữ liệu PostgreSQL.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="font-bold text-white text-xs uppercase font-mono">
                      2. Bảo vệ thông tin xác thực & Secrets
                    </h4>
                    <p className="text-slate-300 text-[11px]">
                      Hệ thống tuyệt đối không lưu trữ mật khẩu ở dạng rõ (plain text). Mật khẩu tài khoản được băm một chiều bằng chuẩn Argon2/Bcrypt kết hợp Salt động độc lập.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="font-bold text-white text-xs uppercase font-mono">
                      3. Quyền xóa dữ liệu vĩnh viễn (Right to Erasure)
                    </h4>
                    <p className="text-slate-300 text-[11px]">
                      Người dùng có toàn quyền xóa vĩnh viễn dự án, lịch sử kiểm thử và kết quả rà soát khỏi toàn bộ cụm máy chủ ADQ bất kỳ lúc nào thông qua trang quản trị Dashboard.
                    </p>
                  </div>
                </div>
              )}

              {modalTab === "security" && (
                <div className="space-y-4 font-sans">
                  <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/40 text-purple-200 space-y-2">
                    <h4 className="font-bold text-purple-300 text-xs uppercase font-mono">
                      Chính Sách Tiếp Nhận & Xử Lý Lỗ Hổng Safe Harbor
                    </h4>
                    <p className="text-[11px] text-purple-200/90">
                      ADQ hoan nghênh và cam kết bảo vệ các nhà nghiên cứu an ninh mạng tuân thủ nguyên tắc thử nghiệm thiện chí (Good-faith Research).
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="font-bold text-white text-xs uppercase font-mono">
                      1. Cam kết bảo hộ Safe Harbor
                    </h4>
                    <p className="text-slate-300 text-[11px]">
                      ADQ Security cam kết không khởi kiện hoặc khiếu nại pháp lý đối với các nhà nghiên cứu an ninh mạng tuân thủ nguyên tắc thử nghiệm thiện chí, không xâm phạm dữ liệu người dùng và không làm gián đoạn hạ tầng dịch vụ.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="font-bold text-white text-xs uppercase font-mono">
                      2. Kênh tiếp nhận & Thời gian xử lý
                    </h4>
                    <p className="text-slate-300 text-[11px]">
                      Vui lòng gửi chi tiết kỹ thuật kèm mã PoC an toàn về hòm thư đại diện tác giả. Nhóm kỹ thuật cam kết phản hồi trong 24h và triển khai bản vá bảo mật trong 72h đối với lỗi mức độ Critical/High.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-white/10 pt-4 shrink-0">
              <button
                type="button"
                onClick={() => setModalTab(null)}
                className="cursor-pointer rounded-xl bg-cyan-500/20 px-5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition font-mono"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}

