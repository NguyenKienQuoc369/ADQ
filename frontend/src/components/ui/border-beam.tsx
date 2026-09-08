"use client";

import React from "react";
import { motion } from "framer-motion";

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
}

export function BorderBeam({
  className = "",
  size = 200,
  duration = 12,
  borderWidth = 1.5,
  colorFrom = "#22d3ee",
  colorTo = "#3b82f6",
}: BorderBeamProps) {
  return (
    <div
      style={
        {
          "--size": size,
          "--duration": `${duration}s`,
          "--border-width": `${borderWidth}px`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
        } as React.CSSProperties
      }
      className={`pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)] ${className}`}
    >
      <motion.div
        animate={{
          offsetDistance: ["0%", "100%"],
        }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration,
        }}
        style={{
          offsetPath: `rect(0 auto auto 0 round calc(var(--size) * 1px))`,
        }}
        className="absolute aspect-square w-[calc(var(--size)*1px)] bg-gradient-to-l from-[var(--color-from)] via-[var(--color-to)] to-transparent"
      />
    </div>
  );
}

