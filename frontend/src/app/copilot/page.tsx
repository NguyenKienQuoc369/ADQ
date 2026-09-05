"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { getEntitlements } from "@/lib/entitlements";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { copilotAnalyze, copilotChat, copilotPatch } from "@/lib/api";
import { Bot, Check, Copy, LoaderCircle, Lock, MessageSquare, RefreshCw, Send, ShieldAlert, Sparkle, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import React, { useState, useEffect, Suspense } from "react";










function safeString(val: any): string {
  if (val === null || val === undefined) return "";

  if (typeof val === "string") {
    return val;
  }

  if (typeof val === "object") {
    return (
      val.text ||
      val.content ||
      val.message ||
      JSON.stringify(val, null, 2)
    );
  }

  return String(val);
}

type CopilotMessage = {
  id: string;
  sender: "user" | "copilot";
  text: string;
  toolResult?: {
    type: string;
    content: string;
  };
};

function CopilotContent() {
  const { user } = useAuth();
  const router = useRouter();
  const userTier = user?.packageTier || "FREE";
  const entitlements = getEntitlements(userTier);
  const isAllowedCopilot = entitlements.copilotChat;

  if (!isAllowedCopilot) {
    return (
      <DashboardShell area="dashboard">
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="w-full max-w-xl rounded-lg border border-[#222222] bg-[#000000] p-8 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900">
              <Bot className="h-6 w-6 text-white" />
            </div>

            <span className="inline-block mb-3 border border-neutral-700 bg-neutral-800 text-white text-[10px] font-mono px-2.5 py-0.5 rounded-full">
              DÀNH CHO GÓI PRO MAX
            </span>

            <h1 className="text-xl font-semibold text-white">
              Mở Khóa Trợ Lý An Ninh AI Copilot
            </h1>

            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-neutral-400">
              Tài khoản hiện tại ({userTier}) chưa được cấp quyền truy cập AI Copilot. Tính năng này dành riêng cho gói PRO MAX.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-4 text-left">
                <p className="text-[11px] font-mono uppercase text-neutral-400">FREE / PRO</p>
                <p className="mt-1 text-sm font-semibold text-white">Chưa bao gồm AI Copilot</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Các tính năng quét và phân tích tương ứng vẫn hoạt động bình thường.
                </p>
              </div>

              <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-4 text-left">
                <p className="text-[11px] font-mono uppercase text-neutral-400">PRO MAX</p>
                <p className="mt-1 text-sm font-semibold text-white">Mở khóa toàn bộ AI Copilot</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Chat bảo mật theo ngữ cảnh và tạo One-Click Patch vá lỗi tức thì.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
              <Button
                onClick={() => router.push("/dashboard/billing")}
                className="h-8 bg-white hover:bg-neutral-200 text-black font-medium text-xs rounded-md px-4 shadow-sm cursor-pointer"
              >
                Nâng cấp PRO MAX
              </Button>

              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
                className="h-8 border-[#333333] bg-[#111111] hover:bg-neutral-800 text-neutral-300 text-xs rounded-md px-4"
              >
                Quay lại Dashboard
              </Button>
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const searchParams = useSearchParams();

  const jobId = searchParams?.get("jobId");
  const target = searchParams?.get("target");
  const vulnParam = searchParams?.get("vuln");
  const endpointParam = searchParams?.get("endpoint");

  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: "init",
      sender: "copilot",
      text:
        "Xin chào! Tôi là **ADQ Security Copilot** – Trợ lý AI chuyên trách Pentest, DevSecOps và tự động sinh bản vá. Hãy chọn tác vụ nhanh hoặc đặt câu hỏi kỹ thuật bên dưới.",
    },
  ]);

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (jobId) {
      handleAutoAnalyze(jobId);
    } else if (vulnParam && endpointParam) {
      handleAutoPatch(vulnParam, endpointParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, vulnParam, endpointParam]);

  const handleAutoAnalyze = async (jid: string) => {
    const id = `analyze_${Math.random().toString(36).slice(2, 9)}`;

    setMessages((current) => [
      ...current,
      {
        id,
        sender: "user",
        text: `Phân tích chuyên sâu kết quả phiên quét ID: ${jid}`,
      },
    ]);

    setLoading(true);

    try {
      const res = await copilotAnalyze(jid);

      setMessages((current) => [
        ...current,
        {
          id: `${id}_r`,
          sender: "copilot",
          text: safeString(
            res?.analysis || "Đã phân tích xong dữ liệu quét."
          ),
        },
      ]);
    } catch (error) {
      console.error("Copilot analyze error:", error);

      setMessages((current) => [
        ...current,
        {
          id: `${id}_r`,
          sender: "copilot",
          text: "Không thể nạp dữ liệu phân tích từ Backend.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoPatch = async (
    vuln: string,
    ep: string
  ) => {
    const id = `patch_${Math.random().toString(36).slice(2, 9)}`;

    setMessages((current) => [
      ...current,
      {
        id,
        sender: "user",
        text: `Tạo mã vá One-Click cho lỗ hổng: ${vuln} tại endpoint: ${ep}`,
      },
    ]);

    setLoading(true);

    try {
      const res = await copilotPatch({
        vulnerability_type: vuln,
        endpoint: ep,
        framework: "Next.js / FastAPI",
      });

      const patchStr = safeString(res?.patch_result);

      setMessages((current) => [
        ...current,
        {
          id: `${id}_r`,
          sender: "copilot",
          text: `Đã sinh bản vá cho **${vuln}**:\n\n\`\`\`diff\n${patchStr}\n\`\`\``,
          toolResult: {
            type: "patch",
            content: patchStr,
          },
        },
      ]);
    } catch (error) {
      console.error("Copilot patch error:", error);

      setMessages((current) => [
        ...current,
        {
          id: `${id}_r`,
          sender: "copilot",
          text: "Tạo mã vá thất bại. Vui lòng thử lại.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    const query = text.trim();

    if (!query || loading) {
      return;
    }

    const id = `m_${Math.random().toString(36).slice(2, 9)}`;

    setMessages((current) => [
      ...current,
      {
        id,
        sender: "user",
        text: query,
      },
    ]);

    setText("");
    setLoading(true);

    try {
      const res = await copilotChat(query);
      const answer = safeString(res?.copilot_response);

      setMessages((current) => [
        ...current,
        {
          id: `${id}_r`,
          sender: "copilot",
          text:
            answer ||
            "Copilot đã xử lý yêu cầu nhưng không trả về nội dung.",
        },
      ]);
    } catch (error) {
      console.error("Copilot chat error:", error);

      setMessages((current) => [
        ...current,
        {
          id: `${id}_r`,
          sender: "copilot",
          text: "Không thể kết nối đến máy chủ AI Copilot.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (
    textToCopy: string,
    id: string
  ) => {
    try {
      await navigator.clipboard.writeText(textToCopy);

      setCopiedId(id);

      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch (error) {
      console.error("Clipboard copy error:", error);
    }
  };

  return (
    <DashboardShell area="dashboard">
      <div className="mx-auto max-w-5xl space-y-4 font-sans text-[#ededed]">
        <div className="rounded-lg border border-[#222222] bg-[#000000]">
          <div className="p-4 border-b border-[#222222] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <Bot className="h-4 w-4 shrink-0 text-white" />
                ADQ Security Copilot
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                AI Agentic Security: Phân tích báo cáo scan, truy vấn kỹ thuật và sinh mã sửa lỗi tự động.
              </p>
            </div>

            {target && (
              <span className="w-fit border border-neutral-700 bg-neutral-800 text-neutral-300 font-mono text-[11px] px-2.5 py-0.5 rounded-full">
                Target: {target}
              </span>
            )}
          </div>

          <div className="p-4 space-y-3">
            <div className="h-[calc(100vh-19rem)] min-h-[420px] space-y-3 overflow-y-auto rounded-lg border border-[#222222] bg-[#0a0a0a] p-4">
              {messages.map((message) => {
                const isUser = message.sender === "user";

                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      isUser
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[90%] rounded-lg p-3 text-xs leading-relaxed sm:max-w-[85%] ${
                        isUser
                          ? "bg-white text-black font-medium shadow-sm"
                          : "border border-[#222222] bg-[#000000] text-neutral-200"
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap break-words">
                          {safeString(message.text)}
                        </div>
                      ) : (
                        <MarkdownRenderer
                          content={safeString(message.text)}
                        />
                      )}

                      {message.toolResult?.content && (
                        <div className="relative mt-3 overflow-hidden rounded-md border border-[#222222] bg-[#0a0a0a] p-3 font-mono text-xs text-emerald-300">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                message.toolResult!.content,
                                message.id
                              )
                            }
                            className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded border border-[#333333] bg-[#111111] px-2 py-1 text-[10px] text-neutral-300 transition hover:bg-neutral-800"
                          >
                            {copiedId === message.id ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}

                            {copiedId === message.id
                              ? "Đã copy"
                              : "Copy patch"}
                          </button>

                          <pre className="overflow-x-auto whitespace-pre-wrap break-words pr-20 font-mono text-xs">
                            {message.toolResult.content}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-lg border border-[#222222] bg-[#000000] px-3.5 py-2.5 text-xs text-neutral-400">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin text-white" />
                    ADQ Copilot đang xử lý...
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Input
                value={text}
                onChange={(event) =>
                  setText(event.target.value)
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !loading
                  ) {
                    event.preventDefault();
                    void send();
                  }
                }}
                disabled={loading}
                placeholder="Hỏi ADQ Copilot về lỗ hổng, đề xuất mã sửa lỗi..."
                className="h-9 min-w-0 flex-1 rounded-md border-[#333333] bg-[#0a0a0a] text-xs text-white placeholder:text-neutral-500 focus:border-white focus:ring-0"
              />

              <Button
                type="button"
                onClick={() => void send()}
                disabled={loading || !text.trim()}
                className="h-9 shrink-0 rounded-md bg-white hover:bg-neutral-200 px-4 text-xs font-semibold text-black transition shadow-sm cursor-pointer"
              >
                {loading ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Gửi
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function CopilotPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#000000]" />
      }
    >
      <CopilotContent />
    </Suspense>
  );
}