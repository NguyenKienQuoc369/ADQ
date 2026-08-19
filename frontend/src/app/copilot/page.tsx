"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Sparkles, Wrench, ShieldAlert, Check, Copy, LoaderCircle } from "lucide-react";
import { copilotChat, copilotAnalyze, copilotPatch } from "@/lib/api";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

function safeString(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    return val.text || val.content || val.message || JSON.stringify(val);
  }
  return String(val);
}

function CopilotContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams?.get("jobId");
  const target = searchParams?.get("target");
  const vulnParam = searchParams?.get("vuln");
  const endpointParam = searchParams?.get("endpoint");

  const [messages, setMessages] = useState<{ id: string; sender: "user" | "copilot"; text: string; toolResult?: any }[]>([
    {
      id: "init",
      sender: "copilot",
      text: "Xin chào! Tôi là **ADQ Security Copilot** – Trợ lý AI chuyên trách Pentest, DevSecOps và tự động sinh bản vá. Hãy chọn tác vụ nhanh hoặc đặt câu hỏi kỹ thuật bên dưới.",
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
  }, [jobId, vulnParam, endpointParam]);

  const handleAutoAnalyze = async (jid: string) => {
    const id = "analyze_" + Math.random().toString(36).slice(2, 9);
    setMessages((s) => [
      ...s,
      { id, sender: "user", text: `Phân tích chuyên sâu kết quả phiên quét ID: ${jid}` },
    ]);
    setLoading(true);
    try {
      const res = await copilotAnalyze(jid);
      setMessages((s) => [
        ...s,
        { id: id + "_r", sender: "copilot", text: safeString(res.analysis || "Đã phân tích xong dữ liệu quét.") },
      ]);
    } catch {
      setMessages((s) => [
        ...s,
        { id: id + "_r", sender: "copilot", text: "Không thể nạp dữ liệu phân tích từ Backend." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoPatch = async (vuln: string, ep: string) => {
    const id = "patch_" + Math.random().toString(36).slice(2, 9);
    setMessages((s) => [
      ...s,
      { id, sender: "user", text: `Tạo mã vá One-Click cho lỗ hổng: ${vuln} tại endpoint: ${ep}` },
    ]);
    setLoading(true);
    try {
      const res = await copilotPatch({ vulnerability_type: vuln, endpoint: ep, framework: "Next.js / FastAPI" });
      const patchStr = safeString(res.patch_result);
      setMessages((s) => [
        ...s,
        {
          id: id + "_r",
          sender: "copilot",
          text: `Đã sinh bản vá cho **${vuln}**:\n\n\`\`\`diff\n${patchStr}\n\`\`\``,
          toolResult: { type: "patch", content: patchStr },
        },
      ]);
    } catch {
      setMessages((s) => [
        ...s,
        { id: id + "_r", sender: "copilot", text: "Tạo mã vá thất bại. Vui lòng thử lại." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!text.trim() || loading) return;
    const id = "m_" + Math.random().toString(36).slice(2, 9);
    const query = text.trim();
    setMessages((s) => [...s, { id, sender: "user", text: query }]);
    setText("");
    setLoading(true);

    try {
      const res = await copilotChat(query);
      const answer = safeString(res.copilot_response);
      setMessages((s) => [
        ...s,
        { id: id + "_r", sender: "copilot", text: answer },
      ]);
    } catch {
      setMessages((s) => [
        ...s,
        { id: id + "_r", sender: "copilot", text: "Không thể kết nối đến máy chủ AI Copilot." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const runQuickAction = async (action: string) => {
    if (action === "patch") {
      await handleAutoPatch("CORS Misconfiguration & Exposed Endpoints", "/api/v1/user/profile");
      return;
    }
    if (action === "deep-scan") {
      setText("Hãy giải thích các bước kiểm tra lỗ hổng IDOR và Race Condition trong ứng dụng web?");
      return;
    }
    if (action === "stress") {
      setText("Làm thế nào để cấu hình k6 stress test 5000 RPS mà không bị Cloudflare block?");
      return;
    }
  };

  const handleCopy = (textToCopy: string, id: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-4 max-w-6xl mx-auto font-sans">
        <Card className="border border-white/[0.08] bg-slate-950/85 backdrop-blur-xl shadow-2xl">
          <CardHeader className="pb-3 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold text-white">
                  <Bot className="h-5 w-5 text-cyan-400"/> ADQ Security Copilot
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">
                  AI Agentic Security: Phân tích báo cáo scan, truy vấn kỹ thuật và sinh mã sửa lỗi tự động.
                </CardDescription>
              </div>
              {target ? (
                <Badge className="border-cyan-500/40 bg-cyan-950/40 text-cyan-300 text-xs font-mono" variant="outline">
                  Target: {target}
                </Badge>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-3">
            {/* Vùng hiển thị Chat */}
            <div className="h-[calc(100vh-18rem)] min-h-[400px] overflow-y-auto space-y-3.5 rounded-2xl border border-white/[0.06] bg-slate-900/60 p-4 scrollbar-thin scrollbar-thumb-slate-800">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                      m.sender === "user"
                        ? "bg-gradient-to-r from-cyan-600 to-emerald-600 text-slate-950 font-semibold shadow-md"
                        : "bg-slate-950/90 border border-white/[0.08] text-slate-200 shadow-lg"
                    }`}
                  >
                    {m.sender === "user" ? (
                      <div className="whitespace-pre-wrap">{safeString(m.text)}</div>
                    ) : (
                      <MarkdownRenderer content="{safeString(m.text)}"/>
                    )}

                    {m.toolResult?.content ? (
                      <div className="mt-3 relative rounded-xl bg-slate-950 p-3 font-mono text-xs text-emerald-300 border border-slate-800">
                        <button
                          type="button"
                          onClick={() => handleCopy(m.toolResult.content, m.id)}
                          className="absolute top-2 right-2 flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700 transition"
                        >
                          {copiedId === m.id ? <Check className="h-3 w-3 text-emerald-400"/> : <Copy className="h-3 w-3"/>}
                          {copiedId === m.id ? "Đã copy" : "Copy patch"}
                        </button>
                        <pre className="whitespace-pre-wrap">{m.toolResult.content}</pre>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {loading ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-white/[0.08] bg-slate-950/90 px-4 py-3 text-xs text-cyan-300 flex items-center gap-2 shadow-md">
                    <LoaderCircle className="h-4 w-4 animate-spin text-cyan-400"/>
                    <span>Copilot đang phân tích dữ liệu bảo mật...</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Khung nhập Prompt */}
            <div className="flex gap-2">
              <Input onChange="{(e)" value="{text}"> setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                disabled={loading}
                placeholder="Hỏi ADQ Copilot về lỗ hổng, đề xuất mã sửa lỗi, cấu hình WAF..."
                className="h-11 border-slate-800 bg-slate-900/80 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/60 rounded-xl"
              />
              <Button !text.trim()} className="h-11 px-5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition active:scale-98" disabled="{loading" onClick="{send}" ||>
                <Send className="h-4 w-4 mr-1.5"/> Gửi
              </Button>
            </div>

            {/* Các nút Prompt tác vụ nhanh */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick="{()" size="sm" variant="outline"> runQuickAction("stress")}
                className="h-7 px-2.5 border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-[11px] text-orange-300 rounded-lg"
              >
                <ShieldAlert className="mr-1 h-3 w-3 text-orange-400"/> Tư vấn Stress Test k6
              </Button>
              <Button onClick="{()" size="sm" variant="outline"> runQuickAction("deep-scan")}
                className="h-7 px-2.5 border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-[11px] text-emerald-300 rounded-lg"
              >
                <Sparkles className="mr-1 h-3 w-3 text-emerald-400"/> Phương pháp test Logic Flaw
              </Button>
              <Button onClick="{()" size="sm" variant="outline"> runQuickAction("patch")}
                className="h-7 px-2.5 border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-[11px] text-rose-300 rounded-lg"
              >
                <Wrench className="mr-1 h-3 w-3 text-rose-400"/> Sinh mã vá One-Click Patch
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
    <Suspense className="flex min-h-screen items-center justify-center bg-[#020617] text-slate-400" fallback="{<div">Đang tải AI Copilot...</div>}>
      <CopilotContent/>
    </Suspense>
  );
}
