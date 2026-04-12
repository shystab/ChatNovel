import { useState, useEffect } from "react";

export type Theme = "light" | "dark" | "sepia";

export interface ThemeColors {
  bg: string;
  text: string;
  editorBg: string;
  editorText: string;
  border: string;
  cardBg: string;
}

const themes: Record<Theme, ThemeColors> = {
  light: {
    bg: "bg-white",
    text: "text-slate-900",
    editorBg: "bg-white",
    editorText: "text-slate-900",
    border: "border-slate-200",
    cardBg: "bg-slate-50",
  },
  dark: {
    bg: "bg-slate-900",
    text: "text-slate-100",
    editorBg: "bg-slate-800",
    editorText: "text-slate-100",
    border: "border-slate-700",
    cardBg: "bg-slate-800",
  },
  sepia: {
    bg: "bg-amber-50",
    text: "text-amber-900",
    editorBg: "bg-amber-100/30",
    editorText: "text-amber-900",
    border: "border-amber-200",
    cardBg: "bg-amber-100/50",
  },
};

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem("app-theme") as Theme;
    if (saved && themes[saved]) {
      setThemeState(saved);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("app-theme", newTheme);
  };

  return {
    theme,
    setTheme,
    colors: themes[theme],
  };
}
