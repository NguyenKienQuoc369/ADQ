"use client";

import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Cpu, Wifi } from "lucide-react";

interface Holographic3DCardProps {
  children: React.ReactNode;
  className?: string;
  tier?: "free" | "pro" | "promax";
  cardId?: string;
  chipColor?: "silver" | "gold" | "cyan";
  beamEffect?: React.ReactNode;
}

export function Holographic3DCard({
  children,
  className = "",
  tier = "pro",
  cardId = "ADQ-SEC // TIER-02",
  chipColor = "cyan",
  beamEffect,
}: Holographic3DCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Pronounced 3D card tilt angle: up to 14 degrees
    const rX = ((y - centerY) / centerY) * -12;
    const rY = ((x - centerX) / centerX) * 12;

    setRotateX(rX);
    setRotateY(rY);

    // Track percentage for holographic sheen glare reflection
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    setMousePos({ x: xPercent, y: yPercent });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  // Card themes with clean ultra-clear liquid glass
  const themeStyles = {
    free: "border-white/[0.12] hover:border-white/30 bg-slate-950/20 shadow-[0_20px_50px_rgba(0,0,0,0.4)]",
    pro: "border-cyan-400/35 hover:border-cyan-400/70 bg-slate-950/25 shadow-[0_25px_60px_rgba(6,182,212,0.18)]",
    promax: "border-purple-400/35 hover:border-purple-400/70 bg-slate-950/25 shadow-[0_25px_60px_rgba(168,85,247,0.18)]",
  }[tier];

  return (
    <div
      style={{ perspective: 1100 }}
      className="relative flex h-full w-full flex-col transition-transform duration-300"
    >
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        animate={{
          rotateX,
          rotateY,
          scale: isHovered ? 1.03 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20,
        }}
        style={{
          transformStyle: "preserve-3d",
          boxShadow: "inset 0 1px 1px 0 rgba(255, 255, 255, 0.2)",
        }}
        className={`group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-3xl border p-6 md:p-7 backdrop-blur-md transition-shadow duration-500 ${themeStyles} ${className}`}
      >
        {/* Optional Border Beam Laser running along card edge */}
        {beamEffect}

        {/* 1. Holographic Foil Dynamic Glare Reflection (Tracks mouse coordinates) */}
        <div
          className="pointer-events-none absolute inset-0 z-30 transition-opacity duration-300 rounded-[inherit]"
          style={{
            opacity: isHovered ? 0.75 : 0,
            background: `radial-gradient(550px circle at ${mousePos.x}% ${mousePos.y}%, rgba(255,255,255,0.18), rgba(34,211,238,0.1) 30%, transparent 60%)`,
          }}
        />

        {/* 2. Cyber Security Card Top Header Layer (Chip & NFC) - translateZ(35px) */}
        <div
          style={{ transform: "translateZ(35px)" }}
          className="relative z-20 flex items-center justify-between border-b border-white/[0.08] pb-4"
        >
          {/* Holographic Security EMV Microchip Graphic */}
          <div className="flex items-center gap-3">
            <div
              className={`relative flex h-8 w-11 items-center justify-center rounded-lg border shadow-sm ${
                chipColor === "gold"
                  ? "border-amber-400/60 bg-gradient-to-br from-amber-300/30 via-yellow-500/20 to-amber-600/30 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                  : chipColor === "cyan"
                  ? "border-cyan-400/60 bg-gradient-to-br from-cyan-300/30 via-sky-500/20 to-cyan-600/30 shadow-[0_0_12px_rgba(34,211,238,0.3)]"
                  : "border-slate-500/50 bg-gradient-to-br from-slate-300/20 via-slate-500/15 to-slate-700/20"
              }`}
            >
              {/* Chip Circuit lines */}
              <div className="absolute inset-1 rounded border border-white/20" />
              <Cpu
                className={`h-4 w-4 ${
                  chipColor === "gold"
                    ? "text-amber-300"
                    : chipColor === "cyan"
                    ? "text-cyan-300"
                    : "text-slate-300"
                }`}
              />
            </div>

            {/* NFC Contactless Wave */}
            <Wifi className="h-3.5 w-3.5 rotate-90 text-slate-500 group-hover:text-cyan-300 transition-colors" />
          </div>

          {/* Card Serial Watermark */}
          <span className="font-mono text-[10px] tracking-wider text-slate-400/80 uppercase">
            {cardId}
          </span>
        </div>

        {/* 3. Main Content Layer with 3D Depth (Children) */}
        <div style={{ transform: "translateZ(45px)" }} className="relative z-20 mt-4 flex flex-1 flex-col justify-between">
          {children}
        </div>

        {/* 4. Bottom Watermark & Security Hologram Strip - translateZ(25px) */}
        <div
          style={{ transform: "translateZ(25px)" }}
          className="relative z-20 mt-6 flex items-center justify-between border-t border-white/[0.06] pt-3 font-mono text-[9px] text-slate-400"
        >
          <span className="tracking-widest uppercase">ADQ QUANTUM PASS</span>
          <span className="text-cyan-400/80 font-bold uppercase">VERIFIED PROTOCOL</span>
        </div>
      </motion.div>
    </div>
  );
}

