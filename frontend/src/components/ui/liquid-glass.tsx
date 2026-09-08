"use client";

import React, { useState, useRef } from "react";
import { motion, HTMLMotionProps } from "framer-motion";

interface LiquidGlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glowColor?: "cyan" | "purple" | "emerald";
  borderGlow?: boolean;
}

export function LiquidGlassCard({
  children,
  className = "",
  glowColor = "cyan",
  borderGlow = true,
  ...props
}: LiquidGlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const glowColors = {
    cyan: "rgba(34, 211, 238, 0.22)",
    purple: "rgba(168, 85, 247, 0.2)",
    emerald: "rgba(16, 185, 129, 0.22)",
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setMousePos({ x: -1000, y: -1000 });
      }}
      className={`group relative overflow-hidden rounded-3xl border border-white/[0.12] bg-slate-950/20 hover:border-cyan-400/40 hover:bg-slate-950/30 backdrop-blur-md transition-all duration-300 ${
        borderGlow ? "hover:shadow-[0_20px_50px_-15px_rgba(6,182,212,0.25)]" : ""
      } ${className}`}
      style={{
        boxShadow:
          "inset 0 1px 1px 0 rgba(255, 255, 255, 0.18), 0 20px 40px -15px rgba(0, 0, 0, 0.5)",
      }}
      {...props}
    >
      {/* 1. Microscopic Specular Rim Glint along top curvature */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-80" />

      {/* 2. Liquid Caustic Sheen following cursor */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(350px circle at ${mousePos.x}px ${mousePos.y}px, ${glowColors[glowColor]}, rgba(99, 102, 241, 0.08) 40%, transparent 75%)`,
        }}
      />

      {/* 3. Subtle Liquid Horizon Internal Ambient Light */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/[0.04] to-transparent" />

      {/* 4. Child Content Container */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

interface LiquidGlassButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
}

export function LiquidGlassButton({
  children,
  className = "",
  variant = "primary",
  ...props
}: LiquidGlassButtonProps) {
  const isPrimary = variant === "primary";

  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl font-medium cursor-pointer transition-all duration-300 ${
        isPrimary
          ? "border border-cyan-300/60 bg-gradient-to-r from-cyan-400 via-cyan-300 to-sky-400 text-slate-950 shadow-[0_8px_30px_rgba(34,211,238,0.4)] hover:shadow-[0_12px_40px_rgba(34,211,238,0.6)]"
          : "border border-white/20 bg-white/[0.06] text-white backdrop-blur-xl hover:border-cyan-400/50 hover:bg-white/[0.1] shadow-inner"
      } ${className}`}
      style={
        isPrimary
          ? {
              boxShadow:
                "inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.6), inset 0 -2px 3px 0 rgba(0, 0, 0, 0.25), 0 10px 30px rgba(6, 182, 212, 0.4)",
            }
          : {
              boxShadow:
                "inset 0 1px 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 2px 0 rgba(0, 0, 0, 0.5)",
            }
      }
      {...props}
    >
      {/* Top Liquid Reflection Rim */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/70 to-transparent" />

      {/* Fluid Mercury Ripple Glint on hover */}
      <div className="pointer-events-none absolute -inset-full top-0 block h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-all duration-700 group-hover:left-full group-hover:opacity-100" />

      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.button>
  );
}

