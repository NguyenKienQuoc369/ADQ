"use client";

import React from "react";
import { motion } from "framer-motion";

const marqueePhrases = [
  "ADQ SECURITY",
  "AUTOMATED PENETRATION TESTING",
  "ATTACK SURFACE MAPPING",
  "AI VULNERABILITY TRIAGE",
  "CONTINUOUS CYBER DEFENSE",
  "ONE-CLICK REMEDIATION",
  "ZERO AGENT REQUIRED",
  "REAL-TIME RECONNAISSANCE",
];

export function SecurityComplianceStrip() {
  // Duplicate list to create seamless infinite loop without gaps
  const doubledPhrases = [...marqueePhrases, ...marqueePhrases];

  return (
    <div className="relative w-full overflow-hidden py-3.5 md:py-4.5 my-1 select-none border-y border-white/5 bg-[#020617]/40 backdrop-blur-sm">
      {/* Left and Right Subtle Fade Masks */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 md:w-36 bg-gradient-to-r from-[#020617] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 md:w-36 bg-gradient-to-l from-[#020617] to-transparent" />

      {/* Infinite Horizontal Running Refined Bold Text */}
      <motion.div
        animate={{
          x: ["0%", "-50%"],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: "linear",
        }}
        className="flex w-max items-center gap-6 md:gap-8 will-change-transform"
      >
        {doubledPhrases.map((phrase, idx) => (
          <div
            key={`${phrase}-${idx}`}
            className="flex items-center gap-6 md:gap-8 whitespace-nowrap"
          >
            <span className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold uppercase tracking-[0.14em] text-white/80 hover:text-cyan-300 transition-colors">
              {phrase}
            </span>

            {/* Simple Separator Dot */}
            <span className="text-xs md:text-sm font-bold text-cyan-400/50">
              •
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
