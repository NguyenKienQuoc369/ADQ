"use client";

import React, { useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function CopilotPage() {
  const [messages, setMessages] = useState<{ id: string; sender: "user" | "copilot"; text: string; toolResult?: any }[]>([]);
  const [text, setText] = useState("");

  const send = async () => {
    if (!text.trim()) return;
    const id = "m_" + Math.random().toString(36).slice(2, 9);
    setMessages((s) => [...s, { id, sender: "user", text }]);
    setText("");
    // placeholder: POST /api/v1/copilot/chat
    setTimeout(() => {
      setMessages((s) => [...s, { id: id + "_r", sender: "copilot", text: "Simulated response from ADQ Copilot. Use action buttons to run quick tasks." }]);
    }, 600);
  };

  const runQuickAction = (action: string) => {
    const id = "t_" + Math.random().toString(36).slice(2, 9);
    // simulate tool execution and render a function-calling card
    if (action === 'stress') {
      const result = { metrics: { actualRps: 4892, p95LatencyMs: 420, status200: '35%', status403: '15%', status429: '20%', status500: '30%' } };
      setMessages((s) => [...s, { id, sender: 'copilot', text: `Stress test executed: ${result.metrics.actualRps} RPS`, toolResult: result }]);
      return;
    }
    if (action === 'deep-scan') {
      const result = { summary: { subdomains: 12, vulns: 25 }, topFindings: [{ title: 'Exposed Admin Panel', severity: 'CRITICAL' }] };
      setMessages((s) => [...s, { id, sender: 'copilot', text: `Deep scan finished. ${result.summary.vulns} vulns found.`, toolResult: result }]);
      return;
    }
    if (action === 'idor') {
      const result = { evidence: '/api/user?id=123 -> returned other user data', risk: 'HIGH' };
      setMessages((s) => [...s, { id, sender: 'copilot', text: `IDOR test completed. Risk: ${result.risk}`, toolResult: result }]);
      return;
    }
    if (action === 'patch') {
      const result = { patch: '--- a/src/routes/api.js\n+++ b/src/routes/api.js\n@@\n- insecureCall();\n+ safeCall();' };
      setMessages((s) => [...s, { id, sender: 'copilot', text: `Generated patch (preview)`, toolResult: result }]);
      return;
    }
  };

  return (
    <DashboardShell area="dashboard">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>ADQ Security Copilot</CardTitle>
            <CardDescription>Chat with the security copilot, request actions and get patch suggestions. Function-calling cards render results directly.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="rounded-lg border p-4 h-64 overflow-auto bg-white">
                {messages.length === 0 ? <div className="text-sm text-zinc-500">No messages yet. Ask something like "Deep scan /admin" or use quick actions.</div> : null}
                {messages.map((m) => (
                  <div key={m.id} className={`mb-3 flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`rounded-lg px-3 py-2 ${m.sender === 'user' ? 'bg-sky-500 text-white' : 'bg-zinc-100 text-zinc-800'}`}>
                      <div>{m.text}</div>
                      {m.toolResult ? (
                        <div className="mt-2 rounded border bg-white p-2 text-xs">
                          <pre className="whitespace-pre-wrap">{JSON.stringify(m.toolResult, null, 2)}</pre>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Hỏi ADQ Copilot..." />
                <Button onClick={send}>Gửi</Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => runQuickAction('stress')}>Stress Test Target</Button>
                <Button variant="outline" onClick={() => runQuickAction('deep-scan')}>Deep Scan Path</Button>
                <Button variant="outline" onClick={() => runQuickAction('idor')}>Test IDOR</Button>
                <Button variant="destructive" onClick={() => runQuickAction('patch')}>Generate Patch</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
