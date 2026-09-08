"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

export function RocketScrollIndicator() {
  const [scrollPercent, setScrollPercent] = useState(0);
  const [direction, setDirection] = useState<"up" | "down">("down");
  const [isScrolling, setIsScrolling] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollYRef = useRef(0);

  // Sync scroll listener for normal page scroll
  useEffect(() => {
    const handleScroll = () => {
      if (isDraggingRef.current) return;

      const currentScrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(Math.max(currentScrollY / docHeight, 0), 1) : 0;

      setScrollPercent(progress);

      // Detect scroll direction with threshold
      if (currentScrollY > lastScrollYRef.current + 2) {
        setDirection("down");
      } else if (currentScrollY < lastScrollYRef.current - 2) {
        setDirection("up");
      }

      lastScrollYRef.current = currentScrollY;
      setIsScrolling(true);

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Keep engine thrusters burning for 300ms after scroll stops
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 300);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Real-time instant drag update (smooth & responsive swipe)
  const updateScrollInstant = useCallback((clientY: number) => {
    if (!trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const clickY = clientY - rect.top;
    const progress = Math.min(Math.max(clickY / rect.height, 0), 1);

    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return;

    const targetY = progress * docHeight;

    if (targetY > window.scrollY) {
      setDirection("down");
    } else if (targetY < window.scrollY) {
      setDirection("up");
    }

    // Direct DOM scroll for instant, zero-lag swipe response
    document.documentElement.scrollTop = targetY;
    document.body.scrollTop = targetY;
    window.scrollTo(0, targetY);
    setScrollPercent(progress);
    setIsScrolling(true);
  }, []);

  // Click on track to jump smoothly
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) return;
    if (!trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const progress = Math.min(Math.max(clickY / rect.height, 0), 1);
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return;

    window.scrollTo({
      top: progress * docHeight,
      behavior: "smooth",
    });
  };

  // Mouse Drag Handlers on Rocket
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    isDraggingRef.current = true;
    setIsDragging(true);

    // Disable CSS smooth scroll during drag to enable fluid 60fps swipe
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    updateScrollInstant(e.clientY);
  };

  // Touch Swipe Handlers for mobile & touchscreen devices
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!e.touches[0]) return;

    isDraggingRef.current = true;
    setIsDragging(true);

    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.userSelect = "none";

    updateScrollInstant(e.touches[0].clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      updateScrollInstant(e.clientY);
    };

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      setIsScrolling(false);

      // Restore CSS smooth scroll
      document.documentElement.style.scrollBehavior = "";
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || !e.touches[0]) return;
      updateScrollInstant(e.touches[0].clientY);
    };

    const handleTouchEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      setIsScrolling(false);

      document.documentElement.style.scrollBehavior = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: false });
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [updateScrollInstant]);

  const handleLaunchToTop = (e: React.MouseEvent) => {
    if (isDragging) return;
    e.stopPropagation();

    setIsLaunching(true);
    setDirection("up");
    setIsScrolling(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    setTimeout(() => {
      setIsLaunching(false);
      setIsScrolling(false);
    }, 900);
  };

  const percentInt = Math.round(scrollPercent * 100);
  const isFlameActive = isScrolling || isDragging || isLaunching;

  return (
    <div
      aria-label="Interactive Rocket Scroll Indicator"
      className="fixed right-2 md:right-4 top-24 bottom-14 z-50 flex flex-col items-center select-none pointer-events-none"
    >
      {/* 1. Track Hit Area & Rail: Click to jump anywhere */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        title="Bấm hoặc vuốt thanh trượt để cuộn trang"
        className="group/track relative h-full w-8 flex justify-center cursor-pointer pointer-events-auto"
      >
        {/* Visible Visual Rail */}
        <div className="relative h-full w-1.5 rounded-full bg-slate-800/80 border border-cyan-500/30 shadow-inner transition-all group-hover/track:w-2 group-hover/track:border-cyan-400/60">
          {/* Glowing Fill Bar */}
          <div
            className="absolute top-0 left-0 w-full rounded-full bg-gradient-to-b from-cyan-400 via-sky-400 to-emerald-400 shadow-[0_0_10px_rgba(6,182,212,0.85)] transition-all duration-75"
            style={{ height: `${scrollPercent * 100}%` }}
          />

          {/* Guide Markers */}
          <div className="absolute top-[25%] left-1/2 -translate-x-1/2 h-1 w-2.5 rounded-full bg-white/20" />
          <div className="absolute top-[50%] left-1/2 -translate-x-1/2 h-1 w-2.5 rounded-full bg-white/20" />
          <div className="absolute top-[75%] left-1/2 -translate-x-1/2 h-1 w-2.5 rounded-full bg-white/20" />
        </div>
      </div>

      {/* 2. Interactive Rocket Vehicle (Draggable Scroll Thumb / Vuốt Tên Lửa) */}
      <div
        className={`absolute left-1/2 pointer-events-auto transition-[top,transform] ease-out ${
          isDragging ? "duration-0 cursor-grabbing" : "duration-75 cursor-grab"
        }`}
        style={{
          top: `${scrollPercent * 100}%`,
          transform: `translate(-50%, -${scrollPercent * 100}%)`,
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleLaunchToTop}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDragStart={(e) => e.preventDefault()}
        draggable={false}
        title="Kéo vuốt tên lửa hoặc nhấp đúp để lên đầu trang"
      >

        {/* Rotatable Rocket Body + Tail Flame */}
        <motion.div
          animate={{
            rotate: direction === "down" ? 180 : 0,
            scale: isDragging ? 1.25 : isHovered ? 1.15 : 1,
          }}
          transition={{
            type: "spring",
            stiffness: 280,
            damping: 22,
          }}
          className="relative flex flex-col items-center"
        >
          {/* Rocket Image */}
          <div className="relative h-12 w-9 md:h-14 md:w-10 drop-shadow-[0_0_15px_rgba(34,211,238,0.6)] transition-all select-none">
            <Image
              src="/images/rocket.png"
              alt="Rocket Scroll Thumb"
              fill
              draggable={false}
              className="object-contain pointer-events-none select-none"
              sizes="40px"
              priority
            />
          </div>

          {/* Engine Exhaust Flame (At the tail of the rocket) */}
          <div
            className={`pointer-events-none -mt-1.5 flex flex-col items-center transition-all duration-200 ${
              isFlameActive
                ? "opacity-100 scale-100"
                : "opacity-30 scale-75"
            }`}
          >
            {/* Outer Flame Cone */}
            <div
              className={`w-3.5 rounded-b-full bg-gradient-to-b from-amber-300 via-orange-500 to-rose-600 shadow-[0_0_24px_rgba(249,115,22,0.9)] transition-all duration-100 ${
                isFlameActive ? "h-8 animate-pulse" : "h-3"
              }`}
            >
              {/* Inner Core Plasma Fire */}
              <div
                className={`mx-auto w-1.5 rounded-b-full bg-gradient-to-b from-white via-cyan-200 to-amber-300 shadow-[0_0_10px_rgba(255,255,255,0.9)] ${
                  isFlameActive ? "h-5 animate-ping" : "h-1.5"
                }`}
              />
            </div>

            {/* Trailing Flame Glow */}
            {isFlameActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{
                  opacity: [0.6, 1, 0.4],
                  scaleY: [1, 1.4, 0.9],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 0.18,
                  ease: "easeInOut",
                }}
                className="-mt-1 h-3.5 w-2 rounded-full bg-orange-400 blur-[2px]"
              />
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
