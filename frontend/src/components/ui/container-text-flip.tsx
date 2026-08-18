"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

type ContainerTextFlipProps = {
  words: string[];
  intervalMs?: number;
  className?: string;
};

export function ContainerTextFlip({ words, intervalMs = 2200, className }: ContainerTextFlipProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, words.length]);

  return (
    <span className={className}>
      <AnimatePresence mode="wait">
        <motion.span
          key={words[index]}
          initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
          transition={{ duration: 0.38, ease: "easeOut" }}
          className="inline-block bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
