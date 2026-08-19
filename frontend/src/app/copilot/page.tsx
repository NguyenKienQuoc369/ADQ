"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Check, Copy, LoaderCircle, Lock, Send, Sparkles } from "lucide-react";
import {
  copilotChat,
  copilotAnalyze,
  copilotPatch,
} from "@/lib/api";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

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
  const userTier = (user?.packageTier || "FREE").toUpperCase();
  const isAllowedCopilot = userTier === "PRO_MAX" || userTier === "ENTERPRISE";

  if (!isAllowedCopilot) {
    return (
      <DashboardShell area="dashboard">
        <div className="flex flex-col items-center justify-center min-h-[75vh] p-6 text-center max-w-lg mx-auto">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 mb-4 shadow-lg shadow-purple-950/50">
            <Bot className="h-8 w-8" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300 text-xs font-mono mb-3">
            <Sparkles className="h-3.5 w-3.5" /> TÍNH NĂNG DÀNH RIÊNG CHO GÓI PRO MAX
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Mở Khóa Trợ Lý An Ninh AI Copilot</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Tài khoản hiện tại (<span className="text-cyan-400 font-bold font-mono">{userTier}</span>) chưa được cấp quyền truy cập AI Copilot. Nâng cấp lên gói <span className="text-purple-300 font-bold">PRO MAX</span> để chat hỏi đáp bảo mật chuyên sâu, phân tích lỗ hổng theo ngữ cảnh và sinh bản vá tự động.
          </p>
          <Button
            onClick={() => router.push("/dashboard/billing")}
            className="h-10 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-950/50 cursor-pointer"
          >
            Nâng Cấp PRO MAX Ngay
          </Button>
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
      <div className="mx-auto max-w-6xl space-y-4 font-sans">
        <Card className="border border-white/[0.08] bg-slate-950/85 shadow-2xl backdrop-blur-xl">
          <CardHeader className="border-b border-white/[0.06] pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-white sm:text-xl">
                  <Bot className="h-5 w-5 shrink-0 text-cyan-400" />
                  ADQ Security Copilot
                </CardTitle>

                <CardDescription className="mt-0.5 text-xs text-slate-400">
                  AI Agentic Security: Phân tích báo cáo scan, truy vấn kỹ
                  thuật và sinh mã sửa lỗi tự động.
                </CardDescription>
              </div>

              {target && (
                <Badge
                  variant="muted"
                  className="w-fit max-w-full border border-cyan-500/40 bg-cyan-950/40 font-mono text-xs text-cyan-300"
                >
                  <span className="truncate">
                    Target: {target}
                  </span>
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-3">
            <div className="h-[calc(100vh-18rem)] min-h-[400px] space-y-3.5 overflow-y-auto rounded-2xl border border-white/[0.06] bg-slate-900/60 p-3 sm:p-4">
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
                      className={`max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed shadow-lg sm:max-w-[88%] sm:p-4 sm:text-sm ${
                        isUser
                          ? "bg-gradient-to-r from-cyan-600 to-emerald-600 font-semibold text-slate-950"
                          : "border border-white/[0.08] bg-slate-950/90 text-slate-200"
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
                        <div className="relative mt-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-emerald-300">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                message.toolResult!.content,
                                message.id
                              )
                            }
                            className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300 transition hover:bg-slate-700"
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

                          <pre className="overflow-x-auto whitespace-pre-wrap break-words pr-20">
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
                  <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-slate-950/90 px-4 py-3 text-xs text-slate-400 sm:text-sm">
                    <LoaderCircle className="h-4 w-4 animate-spin text-cyan-400" />
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
                className="h-11 min-w-0 flex-1 rounded-xl border-slate-800 bg-slate-900/80 text-xs text-slate-100 placeholder:text-slate-500 sm:text-sm"
              />

              <Button
                type="button"
                onClick={() => void send()}
                disabled={loading || !text.trim()}
                className="h-11 shrink-0 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 text-xs font-bold text-slate-950 transition sm:px-5"
              >
                {loading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-1.5 h-4 w-4" />
                    Gửi
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

export default function CopilotPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#020617]" />
      }
    >
      <CopilotContent />
    </Suspense>
  );
}
