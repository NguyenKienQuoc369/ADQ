"use client";

import React, { useEffect, useState, useRef } from "react";

export function CyberAuroraBackground() {
  const [isClient, setIsClient] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Ensure video plays smoothly if browser pauses autoplay
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay policy handled silently
      });
    }
  }, [isClient]);

  if (!isClient) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      {/* 1. Deep Space OLED Dark Base */}
      <div className="absolute inset-0 bg-[#020617]" />

      {/* 2. ADQ Live Dynamic Video Background (Preserving User Preferred Full Brightness) */}
      <div className="absolute inset-0 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover opacity-75 md:opacity-85 transition-opacity duration-1000 contrast-[1.1] saturate-[1.2]"
        >
          <source src="/videos/adqbackground-web.mp4" type="video/mp4" />
          <source src="/videos/adqbackground.mp4" type="video/mp4" />
        </video>
      </div>

      {/* 3. Smooth Edge Vignette to Calmly Anchor Content */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/40 via-transparent to-[#020617]/70" />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: "radial-gradient(circle at 50% 40%, transparent 50%, #020617 90%)",
        }}
      />
    </div>
  );
}
