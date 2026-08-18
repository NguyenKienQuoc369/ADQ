"use client";

import { motion } from "framer-motion";

type TextHoverEffectProps = {
  text: string;
  className?: string;
};

export function TextHoverEffect({ text, className }: TextHoverEffectProps) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0.8 }}
      whileHover={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <span className="bg-gradient-to-r from-slate-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent transition-all duration-300 hover:drop-shadow-[0_0_16px_rgba(6,182,212,0.45)]">
        {text}
      </span>
    </motion.span>
  );
}
