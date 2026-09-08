"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useInView } from "framer-motion";

interface CyberScrambleTextProps {
  text: string;
  className?: string;
  triggerOnHover?: boolean;
  triggerInView?: boolean;
  duration?: number;
}

const CYBER_CHARS = "01#@*&$%!<>/{}[];:+=~_アイウエオカキクケコ";

export function CyberScrambleText({
  text,
  className = "",
  triggerOnHover = false,
  triggerInView = true,
  duration = 600,
}: CyberScrambleTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const containerRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-40px" });
  const isAnimatingRef = useRef(false);
  const hasTriggeredRef = useRef(false);

  const startScramble = useCallback(() => {
    if (isAnimatingRef.current || hasTriggeredRef.current) return;
    isAnimatingRef.current = true;
    hasTriggeredRef.current = true;

    const originalText = text;
    const length = originalText.length;
    let startTime: number | null = null;

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Number of solved characters from start
      const solvedCount = Math.floor(progress * length);

      let scrambled = "";
      for (let i = 0; i < length; i++) {
        const char = originalText[i];
        if (char === " " || char === "\n") {
          scrambled += char;
        } else if (i < solvedCount) {
          scrambled += char;
        } else {
          scrambled += CYBER_CHARS[Math.floor(Math.random() * CYBER_CHARS.length)];
        }
      }

      setDisplayText(scrambled);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayText(originalText);
        isAnimatingRef.current = false;
      }
    };

    requestAnimationFrame(animate);
  }, [text, duration]);

  useEffect(() => {
    if (triggerInView && isInView && !hasTriggeredRef.current) {
      startScramble();
    }
  }, [isInView, triggerInView, startScramble]);

  const handleMouseEnter = () => {
    if (triggerOnHover && !hasTriggeredRef.current) {
      startScramble();
    }
  };

  return (
    <span
      ref={containerRef}
      onMouseEnter={triggerOnHover ? handleMouseEnter : undefined}
      className={`inline-block select-none font-inherit ${className}`}
    >
      {displayText}
    </span>
  );
}
