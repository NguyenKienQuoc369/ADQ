"use client";

import React, { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProjectWorkspaceShell } from "@/components/project-workspace-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { getEntitlements } from "@/lib/entitlements";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import {
  copilotChat,
  copilotPatch,
  getCopilotConversations,
  getCopilotConversation,
  deleteCopilotConversation,
  getScanJob,
  getStressJob,
  ScanJobDetails,
  StressJobState,
} from "@/lib/api";
import {
  AlertCircle,
  Bot,
  Check,
  Code2,
  Copy,
  ExternalLink,
  LoaderCircle,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  StopCircle,
  Trash2,
  Zap,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "copilot";
  text: string;
  timestamp?: number;
  toolResult?: {
    type: string;
    content: string;
  };
}

interface ConversationMeta {
  id: string;
  title: string;
  scan_job_id?: string;
  stress_job_id?: string;
  updated_at: number;
}

function CopilotContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const userTier = user?.packageTier || "FREE";
  const entitlements = getEntitlements(userTier);
  const isAllowedCopilot = entitlements.copilotChat || userTier === "PRO_MAX";

  // URL Query Parameters
  const paramJobId = searchParams?.get("jobId");
  const paramStressId = searchParams?.get("stressJobId");
  const paramTarget = searchParams?.get("target") || "";
  const paramVuln = searchParams?.get("vuln");
  const paramEndpoint = searchParams?.get("endpoint");

  // Conversation & Chat State
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showContextPanel, setShowContextPanel] = useState(true);

  // Context Data State
  const [activeScanId, setActiveScanId] = useState<string | null>(paramJobId || null);
  const [activeStressId, setActiveStressId] = useState<string | null>(paramStressId || null);
  const [scanContextData, setScanContextData] = useState<ScanJobDetails | null>(null);
  const [stressContextData, setStressContextData] = useState<StressJobState | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Load conversation list
  const refreshConversations = async () => {
    if (!isAllowedCopilot) return;
    try {
      const res = await getCopilotConversations();
      if (res?.ok && res.conversations) {
        setConversations(res.conversations);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  useEffect(() => {
    if (isAllowedCopilot) {
      void refreshConversations();
    }
  }, [isAllowedCopilot]);

  // Load Scan Context if present
  useEffect(() => {
    if (!activeScanId) return;
    let isMounted = true;
    const loadScan = async () => {
      try {
        const data = await getScanJob(activeScanId);
        if (isMounted && data) {
          setScanContextData(data);
        }
      } catch (err) {
        console.error("Failed to load scan context:", err);
      }
    };
    void loadScan();
    return () => {
      isMounted = false;
    };
  }, [activeScanId]);

  // Load Stress Context if present
  useEffect(() => {
    if (!activeStressId) return;
    let isMounted = true;
    const loadStress = async () => {
      try {
        const data = await getStressJob(activeStressId);
        if (isMounted && data) {
          setStressContextData(data);
        }
      } catch (err) {
        console.error("Failed to load stress context:", err);
      }
    };
    void loadStress();
    return () => {
      isMounted = false;
    };
  }, [activeStressId]);

  // Handle auto-trigger from URL parameters
  useEffect(() => {
    if (!isAllowedCopilot) return;

    if (paramVuln && paramEndpoint) {
      void handleAutoPatch(paramVuln, paramEndpoint);
    } else if (paramJobId && messages.length === 0) {
      void handleSendMessage(`Phân tích kết quả phiên scan ${paramJobId} cho mục tiêu ${paramTarget || "này"}`);
    } else if (paramStressId && messages.length === 0) {
      void handleSendMessage(`Phân tích hiệu năng phiên Stress Test ${paramStressId} cho mục tiêu ${paramTarget || "này"}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllowedCopilot, paramJobId, paramStressId, paramVuln, paramEndpoint]);

  // Switch or load conversation
  const selectConversation = async (convId: string) => {
    setActiveConvId(convId);
    try {
      const res = await getCopilotConversation(convId);
      if (res?.ok && res.conversation) {
        setMessages(
          res.conversation.messages.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            timestamp: m.timestamp,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load conversation messages:", err);
    }
  };

  // Start New Chat
  const startNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setInputText("");
    router.push("/copilot");
  };

  // Delete Conversation
  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await deleteCopilotConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        startNewChat();
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  // Send message
  const handleSendMessage = async (promptOverride?: string) => {
    const prompt = (promptOverride || inputText).trim();
    if (!prompt || isLoading) return;

    const userMsgId = `msg_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      text: prompt,
      timestamp: Date.now() / 1000,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!promptOverride) setInputText("");
    setIsLoading(true);

    try {
      const res = await copilotChat({
        prompt,
        conv_id: activeConvId || undefined,
        scan_job_id: activeScanId || undefined,
        stress_job_id: activeStressId || undefined,
      });

      if (res?.conv_id && res.conv_id !== activeConvId) {
        setActiveConvId(res.conv_id);
        void refreshConversations();
      }

      const asstMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        role: "copilot",
        text: res?.copilot_response || "Copilot đã ghi nhận yêu cầu nhưng không có phản hồi.",
        timestamp: Date.now() / 1000,
      };

      setMessages((prev) => [...prev, asstMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "copilot",
          text: `Không thể kết nối đến máy chủ AI Copilot: ${err?.message || "Lỗi không xác định"}`,
          timestamp: Date.now() / 1000,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // One-Click Patch handler
  const handleAutoPatch = async (vuln: string, ep: string) => {
    const userMsgId = `patch_req_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        text: `Tạo mã vá One-Click cho lỗ hổng: ${vuln} tại endpoint: ${ep}`,
      },
    ]);
    setIsLoading(true);

    try {
      const res = await copilotPatch({
        vulnerability_type: vuln,
        endpoint: ep,
        framework: "Next.js / FastAPI",
      });

      const patchStr = res?.patch_result || "Không có nội dung bản vá.";
      setMessages((prev) => [
        ...prev,
        {
          id: `patch_res_${Date.now()}`,
          role: "copilot",
          text: `Đã sinh bản vá mã nguồn cho lỗ hổng **${vuln}**:\n\n\`\`\`diff\n${patchStr}\n\`\`\``,
          toolResult: {
            type: "patch",
            content: patchStr,
          },
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "copilot",
          text: `Tạo mã vá thất bại: ${err?.message || "Lỗi xử lý"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  // Non-PRO_MAX Locked Screen
  if (!isAllowedCopilot) {
    return (
      <ProjectWorkspaceShell activeTab="copilot">
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="w-full max-w-xl rounded-lg border border-[#242424] bg-[#0A0A0A] p-8 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#242424] bg-[#050505]">
              <Bot className="h-6 w-6 text-white" />
            </div>

            <Badge className="mb-3 border-neutral-700 bg-[#111111] text-white text-[10px] font-mono px-2.5 py-0.5">
              DÀNH CHO GÓI PRO MAX
            </Badge>

            <h1 className="text-xl font-semibold text-white">Mở Khóa Trợ Lý An Ninh AI Copilot</h1>

            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-neutral-400">
              Tài khoản hiện tại ({userTier}) chưa được cấp quyền tương tác với AI Copilot. Tính năng này dành riêng cho gói PRO MAX.
            </p>

            <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
              <Button
                onClick={() => router.push("/dashboard/billing")}
                className="h-9 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md px-4 shadow cursor-pointer"
              >
                Nâng cấp PRO MAX
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
                className="h-9 border-[#242424] bg-[#050505] hover:bg-[#151515] text-neutral-300 text-xs rounded-md px-4"
              >
                Quay lại Dashboard
              </Button>
            </div>
          </div>
        </div>
      </ProjectWorkspaceShell>
    );
  }

  return (
    <ProjectWorkspaceShell
      activeTab="copilot"
      targetUrlOverride={paramTarget || scanContextData?.targetDomain || stressContextData?.target_url}
    >
      <div className="w-full h-[calc(100vh-13rem)] min-h-[600px] flex flex-col font-sans text-[#F5F5F5]">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#242424] pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-white" />
            <h1 className="text-base font-bold text-white">ADQ SECURITY COPILOT</h1>
            <Badge className="bg-[#111111] text-[10px] text-neutral-400 border border-[#242424]">
              Gói PRO MAX
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Active Context Indicators */}
            {activeScanId && (
              <Badge className="bg-[#0A0A0A] border border-[#242424] text-[11px] font-mono text-neutral-300 gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                Scan: #{activeScanId.slice(-6)}
              </Badge>
            )}

            {activeStressId && (
              <Badge className="bg-[#0A0A0A] border border-[#242424] text-[11px] font-mono text-neutral-300 gap-1">
                <Zap className="h-3 w-3 text-amber-400" />
                Stress: #{activeStressId.slice(-6)}
              </Badge>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowContextPanel(!showContextPanel)}
              className="h-8 border-[#242424] bg-[#0A0A0A] hover:bg-[#151515] text-xs text-neutral-300 gap-1"
            >
              {showContextPanel ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Ngữ Cảnh</span>
            </Button>
          </div>
        </div>

        {/* 3-Column Split Layout */}
        <div className="flex-1 min-h-0 flex gap-4 pt-3">
          {/* Left: Conversation History Sidebar */}
          <div className="w-60 shrink-0 hidden md:flex flex-col rounded-lg border border-[#242424] bg-[#0A0A0A] overflow-hidden">
            <div className="p-3 border-b border-[#242424]">
              <Button
                onClick={startNewChat}
                className="w-full h-8 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded gap-1.5 shadow"
              >
                <Plus className="h-3.5 w-3.5" />
                Hội Thoại Mới
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <p className="text-[10px] font-mono text-neutral-500 uppercase px-2 py-1">Lịch sử trò chuyện</p>
              {conversations.length === 0 ? (
                <p className="text-xs text-neutral-500 px-2 py-3">Chưa có hội thoại nào.</p>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    className={`group flex items-center justify-between px-2.5 py-2 rounded text-xs cursor-pointer transition ${
                      activeConvId === conv.id
                        ? "bg-[#1A1A1A] text-white font-medium"
                        : "text-neutral-400 hover:bg-[#111111] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{conv.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded transition"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Center: Main Chat Messages Area */}
          <div className="flex-1 flex flex-col rounded-lg border border-[#242424] bg-[#0A0A0A] overflow-hidden">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                /* Empty State with Suggested Prompts */
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <div className="h-10 w-10 rounded-full bg-[#050505] border border-[#242424] flex items-center justify-center">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">Bạn cần hỗ trợ gì về An ninh & Hiệu năng?</h2>
                    <p className="text-xs text-neutral-400 mt-1 max-w-md">
                      Copilot có thể giải thích các finding bảo mật, phân tích nguyên nhân tăng latency trong Stress Test hoặc đề xuất mã vá lỗ hổng.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 max-w-lg w-full pt-2">
                    {[
                      "Phân tích scan gần nhất",
                      "Tại sao p95 latency tăng khi tải cao?",
                      "Giải thích cấu hình CORS an toàn",
                      "Đề xuất mã vá One-Click cho lỗ hổng",
                    ].map((promptText) => (
                      <button
                        key={promptText}
                        type="button"
                        onClick={() => handleSendMessage(promptText)}
                        className="p-2.5 rounded border border-[#242424] bg-[#050505] hover:bg-[#111111] text-xs text-left text-neutral-300 hover:text-white transition"
                      >
                        {promptText}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed ${
                          isUser
                            ? "bg-white text-black font-medium shadow"
                            : "border border-[#242424] bg-[#050505] text-neutral-200"
                        }`}
                      >
                        {isUser ? (
                          <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                        ) : (
                          <div className="space-y-2">
                            <MarkdownRenderer content={msg.text} />

                            {/* Patch Code Box with Copy */}
                            {msg.toolResult?.content && (
                              <div className="relative mt-3 overflow-hidden rounded-md border border-[#242424] bg-[#0A0A0A] p-3 font-mono text-xs text-emerald-300">
                                <button
                                  type="button"
                                  onClick={() => handleCopy(msg.toolResult!.content, msg.id)}
                                  className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded border border-[#333333] bg-[#111111] px-2 py-1 text-[10px] text-neutral-300 hover:bg-[#222222]"
                                >
                                  {copiedId === msg.id ? (
                                    <Check className="h-3 w-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                  {copiedId === msg.id ? "Đã copy" : "Copy Patch"}
                                </button>
                                <pre className="overflow-x-auto whitespace-pre-wrap break-words pr-20 font-mono text-xs">
                                  {msg.toolResult.content}
                                </pre>
                              </div>
                            )}

                            {/* Message actions */}
                            <div className="pt-2 flex items-center gap-2 text-[10px] text-neutral-500 border-t border-[#1F1F1F]">
                              <button
                                type="button"
                                onClick={() => handleCopy(msg.text, msg.id)}
                                className="flex items-center gap-1 hover:text-white transition"
                              >
                                <Copy className="h-3 w-3" />
                                {copiedId === msg.id ? "Đã copy" : "Copy"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-lg border border-[#242424] bg-[#050505] px-3.5 py-2.5 text-xs text-neutral-400">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin text-white" />
                    ADQ Copilot đang phân tích dữ liệu...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer Input Bar */}
            <div className="p-3 border-t border-[#242424] bg-[#070707] flex gap-2">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                    e.preventDefault();
                    void handleSendMessage();
                  }
                }}
                disabled={isLoading}
                placeholder="Hỏi về scan, finding, Stress Test hoặc cách xử lý..."
                className="h-9 min-w-0 flex-1 rounded border-[#242424] bg-[#050505] text-xs text-white placeholder:text-neutral-500 focus:border-white focus:ring-0"
              />

              <Button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={isLoading || !inputText.trim()}
                className="h-9 shrink-0 rounded bg-white hover:bg-neutral-200 px-4 text-xs font-semibold text-black transition shadow cursor-pointer"
              >
                {isLoading ? (
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

          {/* Right: Context Summary Drawer */}
          {showContextPanel && (
            <div className="w-72 shrink-0 hidden lg:flex flex-col rounded-lg border border-[#242424] bg-[#0A0A0A] overflow-hidden">
              <div className="p-3 border-b border-[#242424] flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Ngữ Cảnh Kỹ Thuật</span>
                <Badge className="bg-[#111111] text-[10px] text-neutral-400 border border-[#242424]">
                  Sanitized
                </Badge>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs text-neutral-300">
                {/* Scan Context Card */}
                {scanContextData ? (
                  <div className="p-3 rounded border border-[#242424] bg-[#050505] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                        Scan Kết Nối
                      </span>
                      <button
                        onClick={() => router.push(`/scan?jobId=${activeScanId}`)}
                        className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-0.5"
                      >
                        Xem <ExternalLink className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    <p className="font-mono text-[11px] text-neutral-400 truncate">{scanContextData.targetDomain}</p>
                    <div className="text-[11px] text-neutral-400 space-y-0.5">
                      <div>Status: <span className="text-white font-mono">{scanContextData.status}</span></div>
                      <div>Lỗ hổng: <span className="text-white font-mono">{scanContextData.vulnerabilities?.length || 0}</span></div>
                      <div>Hosts: <span className="text-white font-mono">{scanContextData.liveHosts?.length || 0}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded border border-[#1A1A1A] bg-[#050505] text-[11px] text-neutral-500">
                    Chưa kết nối phiên Scan nào.
                  </div>
                )}

                {/* Stress Context Card */}
                {stressContextData ? (
                  <div className="p-3 rounded border border-[#242424] bg-[#050505] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-amber-400" />
                        Stress Test Kết Nối
                      </span>
                      <button
                        onClick={() => router.push(`/stress-test?jobId=${activeStressId}`)}
                        className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-0.5"
                      >
                        Xem <ExternalLink className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    <p className="font-mono text-[11px] text-neutral-400 truncate">{stressContextData.target_url}</p>
                    <div className="text-[11px] text-neutral-400 space-y-0.5">
                      <div>RPS: <span className="text-white font-mono">{stressContextData.metrics?.rps || 0}</span></div>
                      <div>p95: <span className="text-white font-mono">{stressContextData.metrics?.p95_latency || "0ms"}</span></div>
                      <div>Error Rate: <span className="text-white font-mono">{stressContextData.metrics?.error_rate || 0}%</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded border border-[#1A1A1A] bg-[#050505] text-[11px] text-neutral-500">
                    Chưa kết nối phiên Stress Test nào.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProjectWorkspaceShell>
  );
}

export default function CopilotPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <CopilotContent />
    </Suspense>
  );
}