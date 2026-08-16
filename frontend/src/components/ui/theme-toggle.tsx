"use client";

import { MoonStar, SunMedium } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/providers/theme-provider";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { mounted, theme, toggleTheme } = useTheme();
  const isDark = mounted ? theme === "dark" : true;

  return (
    <Button
      type="button"
      variant="secondary"
      size={compact ? "icon" : "default"}
      onClick={toggleTheme}
      aria-label={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      className={compact ? "shrink-0" : "shrink-0 px-3"}
    >
      {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      {compact ? null : <span>{isDark ? "Giao diện sáng" : "Giao diện tối"}</span>}
    </Button>
  );
}
