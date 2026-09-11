"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Terminal,
  Globe,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Code2,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface OwnershipVerificationCardProps {
  target: string;
  verificationToken: string;
  metaTagString: string;
  verificationStatus: "UNVERIFIED" | "VERIFYING" | "VERIFIED" | "FAILED";
  verificationMessage: string;
  isVerifying: boolean;
  expiresIn?: number;
  onFetchToken: () => Promise<void>;
  onCheckVerification: () => Promise<void>;
  onResetVerification?: () => void;
}

export function OwnershipVerificationCard({
  target,
  verificationToken,
  metaTagString,
  verificationStatus,
  verificationMessage,
  isVerifying,
  expiresIn = 3600,
  onFetchToken,
  onCheckVerification,
  onResetVerification,
}: OwnershipVerificationCardProps) {
  const [copiedType, setCopiedType] = useState<"tag" | "token" | "curl" | null>(null);
  const [showPlatformHelp, setShowPlatformHelp] = useState(false);
  const [showCheckHelp, setShowCheckHelp] = useState(false);
  const [activePlatformTab, setActivePlatformTab] = useState<"html" | "nextjs_app" | "nextjs_pages" | "react_vite" | "wordpress" | "other">("nextjs_app");
  const [timeLeft, setTimeLeft] = useState<number>(expiresIn);

  const cleanTarget = target.trim().replace(/^https?:\/\//i, "").split("/")[0] || "example.com";
  const canonicalUrl = target.trim().startsWith("http") ? target.trim() : `https://${target.trim()}`;
  const effectiveMetaTag = metaTagString || (verificationToken ? `<meta name="adq-verification" content="${verificationToken}" />` : "");

  // Timer countdown
  useEffect(() => {
    if (verificationToken && verificationStatus !== "VERIFIED") {
      setTimeLeft(expiresIn);
      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [verificationToken, verificationStatus, expiresIn]);

  const copyToClipboard = async (text: string, type: "tag" | "token" | "curl") => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const isExpired = Boolean(verificationToken && timeLeft <= 0 && verificationStatus !== "VERIFIED");

  // Compact VERIFIED State View
  if (verificationStatus === "VERIFIED") {
    return (
      <div className="border border-emerald-900/60 bg-emerald-950/20 rounded-xl p-4 transition-all duration-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Đã Xác Minh Quyền Sở Hữu Mục Tiêu</span>
                <span className="text-[10px] font-mono border border-emerald-700 bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded-full">
                  VERIFIED
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5 font-mono">
                Mục tiêu: <span className="text-emerald-300 font-semibold">{canonicalUrl}</span> &bull; Bạn đã có thể bắt đầu quét an ninh.
              </p>
            </div>
          </div>
          {onResetVerification && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResetVerification}
              className="h-8 text-xs border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-md shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Xác Minh Lại
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Active Verification Challenge View
  return (
    <div className="border border-[#222222] bg-[#0a0a0a] rounded-xl p-4 sm:p-5 space-y-4 shadow-xl transition-all duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-[#1c1c1c]">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              Xác Minh Quyền Sở Hữu Mục Tiêu
            </h4>
            <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
              Đang xác minh: <span className="text-neutral-200 font-semibold">{canonicalUrl}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {verificationToken && !isExpired && (
            <span className="text-[11px] font-mono text-neutral-400 bg-neutral-900 px-2.5 py-1 rounded-md border border-neutral-800">
              Hiệu lực: <span className="text-amber-400 font-semibold">{formatTime(timeLeft)}</span>
            </span>
          )}
          {isExpired ? (
            <span className="text-[10px] font-mono border border-rose-800 bg-rose-950 text-rose-300 px-2.5 py-1 rounded-full">
              HẾT HẠN
            </span>
          ) : (
            <span className="text-[10px] font-mono border border-amber-800 bg-amber-950 text-amber-300 px-2.5 py-1 rounded-full">
              CẦN XÁC MINH
            </span>
          )}
        </div>
      </div>

      {/* If No Token Yet: Action to generate */}
      {!verificationToken && (
        <div className="py-3 text-center space-y-3">
          <p className="text-xs text-neutral-300 max-w-md mx-auto leading-relaxed">
            Để tuân thủ tiêu chuẩn an ninh và chống lạm dụng, bạn cần chứng minh quyền sở hữu bằng cách gắn một thẻ <code className="text-white bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800 font-mono text-[11px]">&lt;meta&gt;</code> vào trang chủ website mục tiêu.
          </p>
          <Button
            onClick={onFetchToken}
            disabled={isVerifying || !target.trim()}
            className="h-9 px-5 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-md transition active:scale-98"
          >
            {isVerifying ? (
              <>
                <LoaderCircle className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Đang tạo mã...
              </>
            ) : (
              <>
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-black" /> Tạo Mã Xác Minh
              </>
            )}
          </Button>
        </div>
      )}

      {/* Challenge Box & Step by step instructions */}
      {verificationToken && (
        <div className="space-y-4">
          {/* Step 1: Copy Meta Tag */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5 font-mono">
                <span className="h-4 w-4 rounded-full bg-neutral-800 text-white flex items-center justify-center text-[10px]">1</span>
                Bước 1 — Sao chép thẻ xác minh chính thức:
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(verificationToken, "token")}
                  className="h-7 text-[11px] font-mono border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-md px-2.5"
                >
                  {copiedType === "token" ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-emerald-400" /> Đã chép token
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" /> Chép Token
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(effectiveMetaTag, "tag")}
                  className="h-7 text-[11px] font-medium bg-white hover:bg-neutral-200 text-black rounded-md px-3 shadow-sm"
                >
                  {copiedType === "tag" ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-black" /> Đã sao chép thẻ
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1 text-black" /> Sao Chép Thẻ Meta
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Code Box */}
            <div className="relative group bg-[#000000] border border-[#2d2d2d] rounded-lg p-3 font-mono text-xs text-emerald-300 select-all overflow-x-auto">
              <code>{effectiveMetaTag}</code>
            </div>
          </div>

          {/* Step 2: Step-by-Step Instructions */}
          <div className="bg-neutral-950 border border-neutral-900 rounded-lg p-3.5 space-y-2 text-xs text-neutral-300">
            <span className="font-semibold text-white font-mono flex items-center gap-1.5">
              <span className="h-4 w-4 rounded-full bg-neutral-800 text-white flex items-center justify-center text-[10px]">2</span>
              Bước 2 — Các bước triển khai tiếp theo:
            </span>
            <ol className="list-decimal list-inside space-y-1.5 text-neutral-400 pl-1 leading-relaxed">
              <li>
                Dán thẻ xác minh trên vào phần <code className="text-neutral-200 bg-neutral-900 px-1 rounded">&lt;head&gt;</code> của <strong className="text-white">TRANG CHỦ</strong> website <span className="text-emerald-400 font-mono">{cleanTarget}</span>.
              </li>
              <li>
                Deploy hoặc lưu thay đổi lên máy chủ production của bạn.
              </li>
              <li>
                Mở website <span className="text-neutral-300 underline font-mono">{canonicalUrl}</span> và kiểm tra thẻ đã xuất hiện trong mã nguồn (View Source).
              </li>
              <li>
                Quay lại đây và nhấn nút <strong className="text-white">"Kiểm Tra Xác Minh"</strong> phía dưới.
              </li>
            </ol>
            <div className="pt-1.5 border-t border-neutral-900/80 text-[11px] text-amber-300/90 flex items-start gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Lưu ý quan trọng:</strong> Thẻ phải nằm trên chính domain <code className="text-white bg-neutral-900 px-1 rounded font-mono">{cleanTarget}</code> bạn muốn quét, <strong>không phải</strong> trên hệ thống ADQ.
              </span>
            </div>
          </div>

          {/* Platform Specific Help Accordion */}
          <div className="border border-neutral-900 bg-neutral-950/60 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPlatformHelp(!showPlatformHelp)}
              className="w-full flex items-center justify-between p-3 text-xs font-mono text-neutral-300 hover:text-white hover:bg-neutral-900/50 transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Code2 className="h-3.5 w-3.5 text-neutral-400" />
                Không biết đặt thẻ ở đâu? Xem hướng dẫn từng nền tảng (Next.js, React, HTML, WordPress...)
              </span>
              {showPlatformHelp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showPlatformHelp && (
              <div className="p-3.5 pt-1 border-t border-neutral-900 space-y-3">
                {/* Platform Tabs */}
                <div className="flex flex-wrap gap-1.5 border-b border-neutral-900 pb-2">
                  {[
                    { id: "nextjs_app", label: "Next.js (App Router)" },
                    { id: "nextjs_pages", label: "Next.js (Pages Router)" },
                    { id: "react_vite", label: "React / Vite / Vue" },
                    { id: "html", label: "HTML Thuần" },
                    { id: "wordpress", label: "WordPress" },
                    { id: "other", label: "Nền tảng khác" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActivePlatformTab(tab.id as any)}
                      className={`text-[11px] font-mono px-2.5 py-1 rounded-md transition cursor-pointer ${
                        activePlatformTab === tab.id
                          ? "bg-white text-black font-semibold"
                          : "bg-neutral-900 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="text-xs text-neutral-300 space-y-2">
                  {activePlatformTab === "nextjs_app" && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-neutral-400">
                        Mở file <code className="text-white bg-neutral-900 px-1 py-0.5 rounded font-mono">src/app/layout.tsx</code> (hoặc <code className="text-white bg-neutral-900 px-1 py-0.5 rounded font-mono">app/layout.tsx</code>):
                      </p>
                      <pre className="bg-[#000000] border border-neutral-800 rounded-md p-2.5 font-mono text-[11px] text-emerald-300 overflow-x-auto">
{`export const metadata = {
  title: "My Website",
  other: {
    "adq-verification": "${verificationToken}",
  },
};`}
                      </pre>
                    </div>
                  )}

                  {activePlatformTab === "nextjs_pages" && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-neutral-400">
                        Mở file <code className="text-white bg-neutral-900 px-1 py-0.5 rounded font-mono">pages/_app.tsx</code> hoặc <code className="text-white bg-neutral-900 px-1 py-0.5 rounded font-mono">pages/index.tsx</code>:
                      </p>
                      <pre className="bg-[#000000] border border-neutral-800 rounded-md p-2.5 font-mono text-[11px] text-emerald-300 overflow-x-auto">
{`import Head from "next/head";

export default function Home() {
  return (
    <>
      <Head>
        <meta name="adq-verification" content="${verificationToken}" />
      </Head>
      {/* Nội dung trang */}
    </>
  );
}`}
                      </pre>
                    </div>
                  )}

                  {activePlatformTab === "react_vite" && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-neutral-400">
                        Mở file <code className="text-white bg-neutral-900 px-1 py-0.5 rounded font-mono">index.html</code> ở thư mục gốc dự án:
                      </p>
                      <pre className="bg-[#000000] border border-neutral-800 rounded-md p-2.5 font-mono text-[11px] text-emerald-300 overflow-x-auto">
{`<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="adq-verification" content="${verificationToken}" />
    <title>Website Title</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`}
                      </pre>
                    </div>
                  )}

                  {activePlatformTab === "html" && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-neutral-400">
                        Dán trực tiếp vào phần <code className="text-white bg-neutral-900 px-1 py-0.5 rounded font-mono">&lt;head&gt;</code> của file <code className="text-white bg-neutral-900 px-1 py-0.5 rounded font-mono">index.html</code>:
                      </p>
                      <pre className="bg-[#000000] border border-neutral-800 rounded-md p-2.5 font-mono text-[11px] text-emerald-300 overflow-x-auto">
{`<head>
  <meta name="adq-verification" content="${verificationToken}" />
</head>`}
                      </pre>
                    </div>
                  )}

                  {activePlatformTab === "wordpress" && (
                    <div className="space-y-2 text-[11px] text-neutral-300">
                      <p>Bạn có thể chèn thẻ theo 2 cách đơn giản (không cần mua plugin):</p>
                      <ul className="list-disc list-inside space-y-1 text-neutral-400 pl-1">
                        <li>
                          <strong>Cách 1 (Khuyên dùng):</strong> Cài đặt plugin miễn phí <em>"WPCode"</em> hoặc <em>"Insert Headers and Footers"</em> &rarr; Thêm thẻ meta vào mục <strong>Header</strong>.
                        </li>
                        <li>
                          <strong>Cách 2:</strong> Vào <strong>Giao diện (Appearance)</strong> &rarr; <strong>Theme File Editor</strong> &rarr; Mở file <code className="text-white bg-neutral-900 px-1 font-mono">header.php</code> &rarr; Dán thẻ trước <code className="text-white bg-neutral-900 px-1 font-mono">&lt;/head&gt;</code>.
                        </li>
                      </ul>
                    </div>
                  )}

                  {activePlatformTab === "other" && (
                    <div className="text-[11px] text-neutral-300 leading-relaxed">
                      Đối với Laravel, Django, Ruby on Rails, Shopify hay bất kỳ hệ thống nào khác: Bạn chỉ cần cấu hình để mã nguồn HTML xuất ra ở trang chủ chứa thẻ <code className="text-emerald-300 font-mono bg-neutral-900 px-1 py-0.5 rounded">&lt;meta name="adq-verification" content="${verificationToken}" /&gt;</code>.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Pre-Check Terminal Command Accordion */}
          <div className="border border-neutral-900 bg-neutral-950/60 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCheckHelp(!showCheckHelp)}
              className="w-full flex items-center justify-between p-3 text-xs font-mono text-neutral-300 hover:text-white hover:bg-neutral-900/50 transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-neutral-400" />
                Kiểm tra thẻ đã hoạt động hay chưa trước khi bấm xác minh
              </span>
              {showCheckHelp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showCheckHelp && (
              <div className="p-3.5 pt-1 border-t border-neutral-900 space-y-2 text-xs text-neutral-300">
                <div className="space-y-1">
                  <p className="text-[11px] text-neutral-400 font-mono">
                    Cách 1: Mở <span className="text-neutral-200">{canonicalUrl}</span> trên trình duyệt &rarr; Bấm <strong>Ctrl + U</strong> (Xem nguồn trang) &rarr; Tìm từ khóa <code className="text-white bg-neutral-900 px-1 rounded">adq-verification</code>.
                  </p>
                </div>
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-neutral-400 font-mono">Cách 2: Chạy lệnh terminal kiểm tra nhanh:</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(`curl -s ${canonicalUrl} | grep adq-verification`, "curl")}
                      className="h-6 text-[10px] font-mono text-neutral-400 hover:text-white px-2"
                    >
                      {copiedType === "curl" ? <Check className="h-3 w-3 mr-1 text-emerald-400" /> : <Copy className="h-3 w-3 mr-1" />}
                      Sao chép lệnh
                    </Button>
                  </div>
                  <div className="bg-[#000000] border border-neutral-800 rounded-md p-2 font-mono text-[11px] text-amber-300 overflow-x-auto select-all">
                    <code>curl -s {canonicalUrl} | grep adq-verification</code>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Feedback & Failure Guidance */}
          {verificationMessage && (
            <div
              className={`p-3 rounded-lg border text-xs font-mono space-y-1.5 ${
                verificationStatus === "FAILED"
                  ? "bg-rose-950/30 border-rose-900/80 text-rose-300"
                  : "bg-neutral-900/50 border-neutral-800 text-neutral-300"
              }`}
            >
              <div className="flex items-start gap-2">
                {verificationStatus === "FAILED" ? (
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <LoaderCircle className="h-4 w-4 text-neutral-400 animate-spin shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{verificationMessage}</p>
                  {verificationStatus === "FAILED" && (
                    <div className="mt-2 text-[11px] text-neutral-300 space-y-1">
                      <p className="font-semibold text-rose-200">Nguyên nhân có thể & Gợi ý khắc phục:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-neutral-400 pl-1">
                        <li>Website chưa được deploy hoặc chưa nhận bản build mới</li>
                        <li>Thẻ được đặt ở sai domain hoặc sub-path (thay vì trang chủ)</li>
                        <li>Token trong thẻ meta không khớp chính xác với mã phía trên</li>
                        <li>Bộ nhớ đệm CDN / Cloudflare chưa xóa cache HTML</li>
                        <li>Thẻ chưa nằm trong phần &lt;head&gt; của trang chủ</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Verification Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              onClick={onCheckVerification}
              disabled={isVerifying || isExpired}
              className="h-9 px-5 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md shadow-md transition active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <LoaderCircle className="h-3.5 w-3.5 mr-1.5 animate-spin" /> ADQ đang kiểm tra thẻ trên website...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-black" />
                  {verificationStatus === "FAILED" ? "Kiểm Tra Lại" : "Kiểm Tra Xác Minh"}
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={onFetchToken}
              disabled={isVerifying}
              className="h-9 px-3.5 border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs rounded-md"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Tạo Mã Mới
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
