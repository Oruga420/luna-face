"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "dark" | "light" | "unicorn";

type ThemeCtx = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  cycleTheme: () => void;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = "arena-theme";

function normalizeTheme(v: unknown): ThemeMode {
  if (v === "dark" || v === "light" || v === "unicorn") return v;
  return "dark";
}

export function ThemeProvider(props: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    const saved = normalizeTheme(localStorage.getItem(STORAGE_KEY));
    setThemeState(saved);

    // Allow non-React code (public/face.js) to drive theme changes.
    const onExternal = (e: Event) => {
      const ce = e as CustomEvent;
      const next = normalizeTheme(ce.detail);
      setThemeState(next);
    };

    window.addEventListener("lunaface-theme", onExternal as EventListener);
    return () => window.removeEventListener("lunaface-theme", onExternal as EventListener);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  const value = useMemo<ThemeCtx>(
    () => ({
      theme,
      setTheme: (t) => setThemeState(t),
      cycleTheme: () => {
        setThemeState((prev) => (prev === "dark" ? "light" : prev === "light" ? "unicorn" : "dark"));
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
