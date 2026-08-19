"use client";

import React, { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;

  // Tách khối Code (```...```) và nội dung văn bản
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed text-slate-200 font-sans">
      {parts.map((part, index) => {
        if (part.startsWith("```")) {
          const lines = part.slice(3, -3).trim().split("\n");
          const language = lines[0].trim().match(/^[a-zA-Z0-9_-]+$/) ? lines[0].trim() : "";
          const code = language ? lines.slice(1).join("\n") : lines.join("\n");

          return <CodeBlock code="{code}" key="{index}" language="{language}"/>;
        }

        return <TextBlock key="{index}" text="{part}"/>;
      })}
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-md">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 text-[11px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5 text-cyan-400">
          <Terminal className="h-3.5 w-3.5"/>
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-slate-200 transition text-[10px] bg-slate-800/80 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700 text-slate-300"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400"/> : <Copy className="h-3 w-3"/>}
          <span>{copied ? "Đã copy" : "Sao chép"}</span>
        </button>
      </div>
      <pre className="p-3 text-xs font-mono text-cyan-300 overflow-x-auto leading-normal">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function TextBlock({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5">
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lIdx} className="h-0.5" />;

        // 1. Tiêu đề H3 (###)
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={lIdx} className="text-xs sm:text-sm font-bold text-cyan-300 pt-2 pb-0.5 tracking-wide flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              {parseInlineMarkdown(trimmed.slice(4))}
            </h4>
          );
        }

        // 2. Tiêu đề H2 (##)
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={lIdx} className="text-sm font-bold text-white pt-2.5 pb-1 border-b border-white/[0.06] tracking-wide">
              {parseInlineMarkdown(trimmed.slice(3))}
            </h3>
          );
        }

        // 3. Tiêu đề H1 (#)
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={lIdx} className="text-base font-extrabold text-white pt-3 pb-1 tracking-wide">
              {parseInlineMarkdown(trimmed.slice(2))}
            </h2>
          );
        }

        // 4. Danh sách có số thứ tự (1. 2. 3.)
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={lIdx} className="flex items-start gap-2 pl-1.5 py-0.5">
              <span className="font-mono text-cyan-400 font-bold text-xs shrink-0 mt-0.5">{numMatch[1]}.</span>
              <div className="flex-1 text-slate-200">{parseInlineMarkdown(numMatch[2])}</div>
            </div>
          );
        }

        // 5. Danh sách dấu gạch / bullet (- hoặc *)
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={lIdx} className="flex items-start gap-2 pl-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0 mt-2 shadow-[0_0_6px_#22d3ee]" />
              <div className="flex-1 text-slate-200">{parseInlineMarkdown(trimmed.slice(2))}</div>
            </div>
          );
        }

        // 6. Đoạn văn bản thông thường
        return (
          <p key={lIdx} className="text-slate-200 leading-relaxed">
            {parseInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

function parseInlineMarkdown(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);

  return tokens.map((token, i) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={i} className="font-bold text-white tracking-wide">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code key={i} className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-cyan-300">
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith("*") && token.endsWith("*")) {
      return (
        <em key={i} className="italic text-slate-300">
          {token.slice(1, -1)}
        </em>
      );
    }
    return token;
  });
}
