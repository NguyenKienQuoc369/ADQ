"use client";

import React, { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
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
  getScanResults,
  getStressHistory,
  ScanJobDetails,
  StressJobState,
  ScanResult,
} from "@/lib/api";
import {
  AlertCircle,
  Bot,
  Check,
  Code2,
  Copy,
  ExternalLink,
  HelpCircle,
  History,
  Info,
  LoaderCircle,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  StopCircle,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  context_type?: "PRODUCT_HELP" | "SCAN" | "STRESS";
  context_id?: string;
  target?: string;
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

  // Context Selector Modal State
  const [showContextModal, setShowContextModal] = useState(false);
  const [modalTab, setModalTab] = useState<"scan" | "stress">("scan");
  const [availableScans, setAvailableScans] = useState<ScanResult[]>([]);
  const [availableStress, setAvailableStress] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        setConversations(res.conversations as any);
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
    if (!activeScanId) {
      setScanContextData(null);
      return;
    }
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
    if (!activeStressId) {
      setStressContextData(null);
      return;
    }
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

  // Load sessions for context modal
  const openContextSelector = async () => {
    setShowContextModal(true);
    setLoadingSessions(true);
    try {
      const [scansRes, stressRes] = await Promise.allSettled([
        getScanResults(),
        getStressHistory(),
      ]);
      if (scansRes.status === "fulfilled" && Array.isArray(scansRes.value)) {
        setAvailableScans(scansRes.value);
      }
      if (stressRes.status === "fulfilled" && (stressRes.value as any)?.history) {
        setAvailableStress((stressRes.value as any).history);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Switch or load conversation
  const selectConversation = async (conv: ConversationMeta) => {
    setActiveConvId(conv.id);
    setActiveScanId(conv.scan_job_id || null);
    setActiveStressId(conv.stress_job_id || null);

    try {
      const res = await getCopilotConversation(conv.id);
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

  // Start New Chat in Product Help mode
  const startProductHelpChat = () => {
    setActiveConvId(null);
    setActiveScanId(null);
    setActiveStressId(null);
    setScanContextData(null);
    setStressContextData(null);
    setMessages([]);
    setInputText("");
    router.push("/copilot");
  };

  // Attach a Scan session
  const attachScanSession = (scan: ScanResult) => {
    setActiveScanId(scan.id);
    setActiveStressId(null);
    setStressContextData(null);
    setActiveConvId(null);
    setMessages([]);
    setShowContextModal(false);
  };

  // Attach a Stress session
  const attachStressSession = (stress: any) => {
    setActiveStressId(stress.job_id);
    setActiveScanId(null);
    setScanContextData(null);
    setActiveConvId(null);
    setMessages([]);
    setShowContextModal(false);
  };

  // Delete Conversation
  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await deleteCopilotConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        startProductHelpChat();
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

      if (res?.ok === false || !res?.copilot_response) {
        const errorMsg = (res as any)?.error || "Máy chủ AI Copilot không trả về nội dung. Vui lòng thử lại.";
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: "copilot",
            text: `⚠️ **Không thể hoàn tất phản hồi:** ${errorMsg}\n\nVui lòng thử lại câu hỏi của bạn.`,
            timestamp: Date.now() / 1000,
          },
        ]);
        return;
      }

      const asstMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        role: "copilot",
        text: res.copilot_response,
        timestamp: Date.now() / 1000,
      };

      setMessages((prev) => [...prev, asstMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "copilot",
          text: `⚠️ **Không thể kết nối đến máy chủ AI Copilot:** ${err?.message || "Lỗi không xác định"}`,
          timestamp: Date.now() / 1000,
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
      <DashboardShell area="dashboard">
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="w-full max-w-xl rounded-lg border border-neutral-200 dark:border-[#242424] bg-white dark:bg-[#0A0A0A] p-8 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 dark:border-[#242424] bg-neutral-100 dark:bg-[#050505]">
              <Bot className="h-6 w-6 text-neutral-900 dark:text-white" />
            </div>

            <Badge className="mb-3 border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-[#111111] text-neutral-900 dark:text-white text-[10px] font-mono px-2.5 py-0.5">
              DÀNH CHO GÓI PRO MAX
            </Badge>

            <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">Mở Khóa Trợ Lý An Ninh AI Copilot</h1>

            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
              Tài khoản hiện tại ({userTier}) chưa được cấp quyền tương tác với AI Copilot. Tính năng này dành riêng cho gói PRO MAX.
            </p>

            <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
              <Button
                onClick={() => router.push("/dashboard/billing")}
                className="h-9 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black font-semibold text-xs rounded-md px-4 shadow cursor-pointer"
              >
                Nâng cấp PRO MAX
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
                className="h-9 border-neutral-300 dark:border-[#242424] bg-neutral-50 dark:bg-[#050505] hover:bg-neutral-100 dark:hover:bg-[#151515] text-neutral-700 dark:text-neutral-300 text-xs rounded-md px-4"
              >
                Quay lại Dashboard
              </Button>
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  // Filter conversations by groups
  const productHelpConvs = conversations.filter(
    (c) => !c.scan_job_id && !c.stress_job_id
  );
  const scanConvs = conversations.filter((c) => !!c.scan_job_id);
  const stressConvs = conversations.filter((c) => !!c.stress_job_id);

  // Active Context Title
  const activeContextLabel = activeScanId
    ? `Scan: ${scanContextData?.target || activeScanId}`
    : activeStressId
    ? `Stress Test: ${stressContextData?.target_url || activeStressId}`
    : "Hướng dẫn ADQ";

  return (
    <DashboardShell area="dashboard">
      <div className="flex flex-col h-[calc(100vh-6rem)] w-full gap-4">
        {/* Top Context Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 dark:border-[#222222] bg-white dark:bg-[#000000] px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider font-mono">
              Ngữ cảnh:
            </span>

            {/* Mode Switchers */}
            <button
              type="button"
              onClick={startProductHelpChat}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5",
                !activeScanId && !activeStressId
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold shadow-sm"
                  : "bg-neutral-100 dark:bg-[#0a0a0a] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-neutral-200 dark:border-[#222222]"
              )}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Hướng dẫn ADQ</span>
            </button>

            <button
              type="button"
              onClick={openContextSelector}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5",
                activeScanId || activeStressId
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold shadow-sm"
                  : "bg-neutral-100 dark:bg-[#0a0a0a] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-neutral-200 dark:border-[#222222]"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{activeScanId || activeStressId ? "Đổi dữ liệu phân tích" : "+ Chọn dữ liệu phân tích"}</span>
            </button>

            {/* Attached Session Badge */}
            {(activeScanId || activeStressId) && (
              <div className="flex items-center gap-2 pl-2 border-l border-neutral-200 dark:border-[#222222]">
                <span className="text-xs font-mono text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-[#0a0a0a] px-2.5 py-1 rounded border border-neutral-200 dark:border-[#222222] flex items-center gap-1.5">
                  {activeScanId ? <Shield className="h-3 w-3 text-emerald-500" /> : <Zap className="h-3 w-3 text-amber-500" />}
                  <span>Đang dùng: <strong>{activeContextLabel}</strong></span>
                </span>
                <button
                  type="button"
                  onClick={startProductHelpChat}
                  title="Gỡ dữ liệu / Về Hướng dẫn ADQ"
                  className="p-1 text-neutral-400 hover:text-rose-500 transition cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Right toggle inspector */}
          <button
            type="button"
            onClick={() => setShowContextPanel(!showContextPanel)}
            className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-neutral-200 dark:border-[#222222] bg-neutral-50 dark:bg-[#0a0a0a] transition cursor-pointer"
          >
            {showContextPanel ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            <span>{showContextPanel ? "Ẩn bảng chi tiết" : "Hiện bảng chi tiết"}</span>
          </button>
        </div>

        {/* Main Workspace 3-column / 2-column flex */}
        <div className="flex flex-1 overflow-hidden rounded-lg border border-neutral-200 dark:border-[#222222] bg-white dark:bg-[#000000] shadow-sm">
          {/* Left Column: Context-Grouped Chat History */}
          <div className="w-64 border-r border-neutral-200 dark:border-[#222222] bg-neutral-50/50 dark:bg-[#050505] flex flex-col justify-between hidden md:flex shrink-0">
            <div className="p-3 border-b border-neutral-200 dark:border-[#222222] flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-neutral-500" /> Lịch sử hội thoại
              </span>
              <button
                type="button"
                onClick={startProductHelpChat}
                className="p-1 rounded text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition cursor-pointer"
                title="Tạo đoạn chat mới"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Conversation Group List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-4 text-xs">
              {/* Group 1: Product Help */}
              <div className="space-y-1">
                <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold">
                  HƯỚNG DẪN ADQ
                </p>
                {productHelpConvs.length === 0 ? (
                  <p className="px-2 text-[11px] text-neutral-400 italic">Chưa có hội thoại</p>
                ) : (
                  productHelpConvs.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => selectConversation(conv)}
                      className={cn(
                        "group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition select-none",
                        activeConvId === conv.id
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold shadow-sm"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                      )}
                    >
                      <span className="truncate flex-1">{conv.title || "Hướng dẫn ADQ"}</span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-rose-500 transition ml-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Group 2: Scan Context Sessions */}
              {scanConvs.length > 0 && (
                <div className="space-y-1">
                  <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
                    PHÂN TÍCH SCAN
                  </p>
                  {scanConvs.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => selectConversation(conv)}
                      className={cn(
                        "group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition select-none",
                        activeConvId === conv.id
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold shadow-sm"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                      )}
                    >
                      <span className="truncate flex-1">{conv.target ? `${conv.target} · ${conv.title}` : conv.title}</span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-rose-500 transition ml-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Group 3: Stress Test Context Sessions */}
              {stressConvs.length > 0 && (
                <div className="space-y-1">
                  <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold">
                    PHÂN TÍCH STRESS TEST
                  </p>
                  {stressConvs.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => selectConversation(conv)}
                      className={cn(
                        "group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition select-none",
                        activeConvId === conv.id
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold shadow-sm"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                      )}
                    >
                      <span className="truncate flex-1">{conv.target ? `${conv.target} · ${conv.title}` : conv.title}</span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-rose-500 transition ml-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-2.5 border-t border-neutral-200 dark:border-[#222222]">
              <Button
                variant="outline"
                size="sm"
                onClick={startProductHelpChat}
                className="w-full text-xs h-8 justify-center gap-1.5 cursor-pointer border-neutral-200 dark:border-[#262626]"
              >
                <Plus className="h-3.5 w-3.5" /> <span>Đoạn chat mới</span>
              </Button>
            </div>
          </div>

          {/* Middle Column: Chat Workspace */}
          <div className="flex-1 flex flex-col justify-between overflow-hidden bg-white dark:bg-[#000000]">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
                  <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-[#222222] flex items-center justify-center mb-4">
                    <Bot className="h-6 w-6 text-neutral-800 dark:text-white" />
                  </div>
                  <h2 className="text-base font-bold text-neutral-900 dark:text-white mb-1">
                    ADQ Security Copilot
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6 leading-relaxed">
                    {!activeScanId && !activeStressId
                      ? "Chế độ Hướng dẫn ADQ đang sẵn sàng. Hỏi bất kỳ câu hỏi nào về cách xác minh target, chạy scan, cấu hình stress test hoặc kiểm tra gói cước."
                      : `Đang gắn dữ liệu phân tích: ${activeContextLabel}. Bạn có thể đặt câu hỏi chi tiết về các lỗ hổng hoặc hiệu năng ghi nhận.`}
                  </p>

                  {/* Suggested Prompts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full text-left">
                    {!activeScanId && !activeStressId ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSendMessage("Làm sao xác minh target bằng thẻ meta?")}
                          className="p-3 rounded-lg border border-neutral-200 dark:border-[#222222] bg-neutral-50 dark:bg-[#0a0a0a] hover:border-neutral-400 dark:hover:border-neutral-600 transition text-xs text-neutral-700 dark:text-neutral-300"
                        >
                          📌 Làm sao xác minh target?
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendMessage("Stress Test khác Scan như thế nào?")}
                          className="p-3 rounded-lg border border-neutral-200 dark:border-[#222222] bg-neutral-50 dark:bg-[#0a0a0a] hover:border-neutral-400 dark:hover:border-neutral-600 transition text-xs text-neutral-700 dark:text-neutral-300"
                        >
                          ⚡ Stress Test khác Scan thế nào?
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendMessage("Nhập Redeem Code ở đâu để nâng cấp gói?")}
                          className="p-3 rounded-lg border border-neutral-200 dark:border-[#222222] bg-neutral-50 dark:bg-[#0a0a0a] hover:border-neutral-400 dark:hover:border-neutral-600 transition text-xs text-neutral-700 dark:text-neutral-300"
                        >
                          🔑 Nhập Redeem Code ở đâu?
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendMessage("Ma trận 19 nhóm kiểm soát an ninh là gì?")}
                          className="p-3 rounded-lg border border-neutral-200 dark:border-[#222222] bg-neutral-50 dark:bg-[#0a0a0a] hover:border-neutral-400 dark:hover:border-neutral-600 transition text-xs text-neutral-700 dark:text-neutral-300"
                        >
                          🛡️ 19 Nhóm kiểm soát an ninh là gì?
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSendMessage("Tổng hợp các phát hiện an ninh quan trọng nhất của phiên này.")}
                          className="p-3 rounded-lg border border-neutral-200 dark:border-[#222222] bg-neutral-50 dark:bg-[#0a0a0a] hover:border-neutral-400 dark:hover:border-neutral-600 transition text-xs text-neutral-700 dark:text-neutral-300"
                        >
                          🔍 Tổng hợp phát hiện an ninh quan trọng
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendMessage("Giải thích nguyên nhân các control bị FAIL hoặc cảnh báo.")}
                          className="p-3 rounded-lg border border-neutral-200 dark:border-[#222222] bg-neutral-50 dark:bg-[#0a0a0a] hover:border-neutral-400 dark:hover:border-neutral-600 transition text-xs text-neutral-700 dark:text-neutral-300"
                        >
                          ⚠️ Giải thích các control bị FAIL
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col gap-1 w-full",
                      msg.role === "user" ? "ml-auto items-end max-w-xl" : "mr-auto items-start max-w-3xl lg:max-w-4xl"
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 px-1">
                      <span>{msg.role === "user" ? "Bạn" : "ADQ Security Copilot"}</span>
                    </div>

                    <div
                      className={cn(
                        "rounded-lg px-4 py-3 text-xs leading-relaxed shadow-sm relative group",
                        msg.role === "user"
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-black font-medium"
                          : "bg-neutral-100 text-neutral-900 dark:bg-[#0f0f0f] dark:text-neutral-100 border border-neutral-200 dark:border-[#222222] w-full"
                      )}
                    >
                      {msg.role === "copilot" ? (
                        <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed space-y-2">
                          <MarkdownRenderer content={msg.text} />
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      )}

                      {/* Copy button */}
                      {msg.role === "copilot" && (
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.text, msg.id)}
                          className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 p-1 rounded bg-white/80 dark:bg-black/60 border border-neutral-200 dark:border-[#333333] text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition"
                          title="Sao chép câu trả lời"
                        >
                          {copiedId === msg.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}

              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 py-2">
                  <LoaderCircle className="h-4 w-4 animate-spin text-neutral-600 dark:text-neutral-300" />
                  <span>ADQ Copilot đang phân tích và chuẩn bị phản hồi...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer Input Area */}
            <div className="p-3 sm:p-4 border-t border-neutral-200 dark:border-[#222222] bg-neutral-50/50 dark:bg-[#050505]">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    !activeScanId && !activeStressId
                      ? "Hỏi về cách dùng ADQ, xác minh target, chạy scan..."
                      : `Hỏi về dữ liệu ${activeContextLabel}...`
                  }
                  disabled={isLoading}
                  className="flex-1 bg-white dark:bg-[#0a0a0a] border-neutral-300 dark:border-[#222222] text-xs h-10 rounded-md focus-visible:ring-1"
                />
                <Button
                  type="submit"
                  disabled={!inputText.trim() || isLoading}
                  className="h-10 px-4 bg-neutral-900 text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 text-xs font-semibold rounded-md shadow transition cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>

          {/* Right Column: Collapsible Context Inspector */}
          {showContextPanel && (
            <div className="w-80 border-l border-neutral-200 dark:border-[#222222] bg-neutral-50/50 dark:bg-[#050505] p-4 overflow-y-auto space-y-4 hidden lg:block shrink-0 text-xs">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#222222] pb-2">
                <span className="font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-neutral-500" /> Chi tiết Ngữ cảnh
                </span>
                <span className="text-[10px] font-mono text-neutral-400">
                  {activeScanId ? "SCAN" : activeStressId ? "STRESS" : "HELP"}
                </span>
              </div>

              {/* Inspector Content based on Active Mode */}
              {!activeScanId && !activeStressId ? (
                <div className="space-y-3">
                  <div className="rounded-md border border-neutral-200 dark:border-[#222222] bg-white dark:bg-[#0a0a0a] p-3 space-y-1.5">
                    <p className="font-semibold text-neutral-900 dark:text-white">Chế độ Hướng dẫn ADQ</p>
                    <p className="text-neutral-500 dark:text-neutral-400 text-[11px] leading-relaxed">
                      AI Copilot sẵn sàng giải đáp về mọi tính năng trong nền tảng: Quản lý Dự án, Rà quét DAST, Bắn tải Layer 7, APK Audit, Báo cáo và Gói cước.
                    </p>
                  </div>
                  <div className="rounded-md border border-neutral-200 dark:border-[#222222] bg-white dark:bg-[#0a0a0a] p-3 space-y-2">
                    <p className="font-semibold text-neutral-900 dark:text-white text-[11px]">Phân tích phiên cụ thể?</p>
                    <p className="text-neutral-500 dark:text-neutral-400 text-[11px] leading-relaxed">
                      Bấm vào nút <strong>+ Chọn dữ liệu phân tích</strong> ở thanh phía trên để đính kèm phiên Scan hoặc Stress Test.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={openContextSelector}
                      className="w-full text-xs h-7 gap-1 border-neutral-300 dark:border-[#262626]"
                    >
                      <Plus className="h-3 w-3" /> Chọn phiên phân tích
                    </Button>
                  </div>
                </div>
              ) : activeScanId ? (
                <div className="space-y-3">
                  <div className="rounded-md border border-neutral-200 dark:border-[#222222] bg-white dark:bg-[#0a0a0a] p-3 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-emerald-600 dark:text-emerald-400 font-semibold">
                      Phiên Scan An Ninh
                    </span>
                    <p className="font-mono text-xs text-neutral-900 dark:text-white font-bold truncate">
                      {scanContextData?.target || activeScanId}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                      <span>Trạng thái:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{scanContextData?.status || "COMPLETED"}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-neutral-500">
                      <span>Lỗ hổng:</span>
                      <strong className="text-neutral-900 dark:text-white font-mono">{scanContextData?.vulnerabilities?.length || 0}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-neutral-500">
                      <span>Subdomain sống:</span>
                      <strong className="text-neutral-900 dark:text-white font-mono">{scanContextData?.liveSubdomains?.length || 0}</strong>
                    </div>
                  </div>

                  {/* Failed controls sample */}
                  {scanContextData?.assurance_matrix?.controls && (
                    <div className="rounded-md border border-neutral-200 dark:border-[#222222] bg-white dark:bg-[#0a0a0a] p-3 space-y-2">
                      <p className="font-semibold text-neutral-900 dark:text-white text-[11px]">Nhóm kiểm soát cần lưu ý</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {scanContextData.assurance_matrix.controls
                          .filter((c: any) => c.status === "FAIL" || c.status === "WARNING")
                          .slice(0, 5)
                          .map((c: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-300">
                              <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                              <span className="truncate">{c.title_vi || c.title}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-md border border-neutral-200 dark:border-[#222222] bg-white dark:bg-[#0a0a0a] p-3 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-amber-600 dark:text-amber-400 font-semibold">
                      Phiên Stress Test
                    </span>
                    <p className="font-mono text-xs text-neutral-900 dark:text-white font-bold truncate">
                      {stressContextData?.target_url || activeStressId}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                      <span>Trạng thái:</span>
                      <strong className="text-amber-600 dark:text-amber-400 font-mono">{stressContextData?.status || "COMPLETED"}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-neutral-500">
                      <span>RPS đạt được:</span>
                      <strong className="text-neutral-900 dark:text-white font-mono">{stressContextData?.metrics?.rps || 0}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-neutral-500">
                      <span>Độ trễ p95:</span>
                      <strong className="text-neutral-900 dark:text-white font-mono">{stressContextData?.metrics?.p95_latency || "0ms"}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-neutral-500">
                      <span>Tỉ lệ lỗi:</span>
                      <strong className="text-neutral-900 dark:text-white font-mono">{stressContextData?.metrics?.error_rate || "0%"}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Context Selector Modal */}
      {showContextModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-lg border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#222222] pb-3">
              <h3 className="font-semibold text-sm text-neutral-900 dark:text-white">
                Chọn phiên dữ liệu cần phân tích
              </h3>
              <button
                type="button"
                onClick={() => setShowContextModal(false)}
                className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-[#222222] pb-2">
              <button
                type="button"
                onClick={() => setModalTab("scan")}
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium transition cursor-pointer",
                  modalTab === "scan"
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                Phiên Scan ({availableScans.length})
              </button>
              <button
                type="button"
                onClick={() => setModalTab("stress")}
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium transition cursor-pointer",
                  modalTab === "stress"
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                Phiên Stress Test ({availableStress.length})
              </button>
            </div>

            {/* List */}
            <div className="max-h-64 overflow-y-auto space-y-2 text-xs">
              {loadingSessions ? (
                <div className="py-8 text-center text-neutral-400 flex items-center justify-center gap-2">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Đang tải danh sách phiên...
                </div>
              ) : modalTab === "scan" ? (
                availableScans.length === 0 ? (
                  <p className="py-8 text-center text-neutral-400">Không tìm thấy phiên Scan nào.</p>
                ) : (
                  availableScans.map((scan) => (
                    <div
                      key={scan.id}
                      onClick={() => attachScanSession(scan)}
                      className="p-3 rounded border border-neutral-200 dark:border-[#222222] hover:border-neutral-400 dark:hover:border-neutral-500 bg-neutral-50 dark:bg-[#111111] cursor-pointer transition flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-neutral-900 dark:text-white">{scan.target}</p>
                        <p className="text-[11px] font-mono text-neutral-500">
                          {new Date(scan.startedAt).toLocaleString("vi-VN")} &bull; {scan.vulnerabilities?.length || 0} lỗ hổng
                        </p>
                      </div>
                      <Badge className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30">
                        {scan.status}
                      </Badge>
                    </div>
                  ))
                )
              ) : availableStress.length === 0 ? (
                <p className="py-8 text-center text-neutral-400">Không tìm thấy phiên Stress Test nào.</p>
              ) : (
                availableStress.map((stress) => (
                  <div
                    key={stress.job_id}
                    onClick={() => attachStressSession(stress)}
                    className="p-3 rounded border border-neutral-200 dark:border-[#222222] hover:border-neutral-400 dark:hover:border-neutral-500 bg-neutral-50 dark:bg-[#111111] cursor-pointer transition flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-neutral-900 dark:text-white">{stress.target_url}</p>
                      <p className="text-[11px] font-mono text-neutral-500">
                        RPS: {stress.metrics?.rps || 0} &bull; p95: {stress.metrics?.p95_latency || "0ms"}
                      </p>
                    </div>
                    <Badge className="text-[10px] font-mono bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30">
                      {stress.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default function CopilotPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white dark:bg-[#000000]" />}>
      <CopilotContent />
    </Suspense>
  );
}