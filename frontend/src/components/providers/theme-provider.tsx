"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "dark";

type ThemeContextValue = {
  theme: "dark";
  mounted: boolean;
  setTheme: (theme: string) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function enforceDarkTheme() {
  if (typeof document === "undefined") return;
  try {
    localStorage.removeItem("adq_theme");
  } catch {
    // ignore
  }
  document.documentElement.dataset.theme = "dark";
  document.documentElement.classList.remove("light");
  document.documentElement.classList.add("dark");
  document.documentElement.style.colorScheme = "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    enforceDarkTheme();
    setMounted(true);
  }, []);

  const setTheme = useCallback((_nextTheme: string) => {
    enforceDarkTheme();
  }, []);

  const toggleTheme = useCallback(() => {
    enforceDarkTheme();
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: "dark",
      mounted,
      setTheme,
      toggleTheme,
    }),
    [mounted, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme phải được dùng bên trong ThemeProvider.");
  }

  return context;
}
