"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/components/ui/utils";

type TextFlippingBoardProps = {
  lines: string[];
  intervalMs?: number;
  className?: string;
};

export function TextFlippingBoard({ lines, intervalMs = 1600, className }: TextFlippingBoardProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (lines.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % lines.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, lines.length]);

  const visible = useMemo(() => {
    if (!lines.length) return [];
    return [
      lines[index % lines.length],
      lines[(index + 1) % lines.length],
      lines[(index + 2) % lines.length],
      lines[(index + 3) % lines.length],
    ];
  }, [index, lines]);

  return (
    <div className={cn("rounded-2xl border border-cyan-500/20 bg-[#030816]/80 p-4 font-mono text-xs", className)}>
      <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        Realtime Intelligence Matrix
      </div>
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {visible.map((line, idx) => (
            <motion.div
              key={`${line}-${idx}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="rounded-md border border-cyan-500/10 bg-cyan-500/5 px-3 py-2 text-cyan-100"
            >
              <span className="text-cyan-400">[node-{idx + 1}]</span> {line}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
