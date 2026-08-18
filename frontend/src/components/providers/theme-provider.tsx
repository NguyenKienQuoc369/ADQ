"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark";

type ThemeContextValue = {
  theme: Theme;
  mounted: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.add("dark");
}

function getInitialTheme(): Theme {
  return "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    applyTheme(theme);
    setMounted(true);
  }, [theme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState("dark");
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mounted,
      setTheme,
      toggleTheme: () => setTheme("dark"),
    }),
    [mounted, setTheme, theme],
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
