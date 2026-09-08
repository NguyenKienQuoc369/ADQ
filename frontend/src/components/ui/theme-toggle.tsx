"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = true }: ThemeToggleProps) {
  const { theme, setTheme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <div className={cn("h-8 rounded-md border border-[#222222] bg-[#0a0a0a] opacity-50", className)} />
    );
  }

  const isLight = theme === "light";

  if (!showLabel) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        title={isLight ? "Chuyển sang Giao diện Tối" : "Chuyển sang Giao diện Sáng"}
        aria-label="Toggle theme"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md border border-[#333333] bg-[#0a0a0a] hover:bg-[#111111] transition cursor-pointer text-neutral-300 hover:text-white",
          className
        )}
      >
        {isLight ? (
          <Sun className="h-4 w-4 text-amber-500" />
        ) : (
          <Moon className="h-4 w-4 text-neutral-300" />
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center rounded-md border border-[#222222] bg-[#0a0a0a] p-0.5",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-sm text-xs font-medium transition cursor-pointer select-none",
          isLight
            ? "bg-white text-black font-semibold shadow-sm"
            : "text-neutral-400 hover:text-white"
        )}
      >
        <Sun className={cn("h-3.5 w-3.5", isLight ? "text-amber-500" : "text-neutral-400")} />
        <span>Sáng</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-sm text-xs font-medium transition cursor-pointer select-none",
          !isLight
            ? "bg-white text-black font-semibold shadow-sm"
            : "text-neutral-400 hover:text-white"
        )}
      >
        <Moon className={cn("h-3.5 w-3.5", !isLight ? "text-black" : "text-neutral-400")} />
        <span>Tối</span>
      </button>
    </div>
  );
}

