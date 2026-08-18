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

function CopilotContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const target = searchParams.get("target");
  const vulnParam = searchParams.get("vuln");
  const endpointParam = searchParams.get("endpoint");

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

  // Tự động phân tích khi có context từ trang kết quả chuyển sang
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
        { id: id + "_r", sender: "copilot", text: res.analysis || "Đã phân tích xong dữ liệu quét." },
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
      setMessages((s) => [
        ...s,
        {
          id: id + "_r",
          sender: "copilot",
          text: `Đã sinh bản vá cho **${vuln}**:\n\n\`\`\`diff\n${res.patch_result}\n\`\`\``,
          toolResult: { type: "patch", content: res.patch_result },
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
      setMessages((s) => [
        ...s,
        { id: id + "_r", sender: "copilot", text: res.copilot_response },
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
      <div className="space-y-6">
        <Card className="border border-[color:var(--line)] bg-[color:var(--background-elevated)]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl text-[var(--foreground)]">
                  <Bot className="h-6 w-6 text-cyan-400" /> NQ SECURITY Copilot
                </CardTitle>
                <CardDescription className="text-sm text-[var(--foreground-muted)]">
                  AI Agentic Security: Phân tích báo cáo scan, truy vấn kỹ thuật và sinh mã sửa lỗi tự động.
                </CardDescription>
              </div>
              {target ? <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">Target: {target}</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[480px] overflow-y-auto space-y-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-muted)] p-5">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                      m.sender === "user"
                        ? "bg-cyan-600 text-white"
                        : "bg-[color:var(--background-elevated)] border border-[color:var(--line)] text-[var(--foreground)]"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.text}</div>

                    {m.toolResult?.content ? (
                      <div className="mt-3 relative rounded-xl bg-slate-950 p-3 font-mono text-xs text-emerald-300 border border-slate-800">
                        <button
                          onClick={() => handleCopy(m.toolResult.content, m.id)}
                          className="absolute top-2 right-2 flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700"
                        >
                          {copiedId === m.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
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
                  <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-elevated)] px-4 py-3 text-sm text-[var(--foreground-muted)] flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin text-cyan-400" /> Copilot đang xử lý câu hỏi của bạn...
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Hỏi ADQ Copilot về lỗ hổng, đề xuất mã sửa lỗi, cấu hình WAF..."
                className="h-12 border-[color:var(--line)] bg-transparent"
              />
              <Button onClick={send} disabled={loading || !text.trim()} className="h-12 px-5 bg-cyan-600 hover:bg-cyan-500 text-white">
                <Send className="h-4 w-4 mr-2" /> Gửi
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => runQuickAction("stress")} className="border-[color:var(--line)] text-xs">
                <ShieldAlert className="mr-1 h-3.5 w-3.5 text-orange-400" /> Tư vấn Stress Test k6
              </Button>
              <Button variant="outline" size="sm" onClick={() => runQuickAction("deep-scan")} className="border-[color:var(--line)] text-xs">
                <Sparkles className="mr-1 h-3.5 w-3.5 text-emerald-400" /> Phương pháp test Logic Flaw
              </Button>
              <Button variant="outline" size="sm" onClick={() => runQuickAction("patch")} className="border-[color:var(--line)] text-xs text-rose-400 hover:text-rose-300">
                <Wrench className="mr-1 h-3.5 w-3.5" /> Sinh mã vá One-Click Patch
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
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Đang tải AI Copilot...</div>}>
      <CopilotContent />
    </Suspense>
  );
}
