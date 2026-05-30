import { useCallback, useSyncExternalStore } from "react";

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

const THEME_STORAGE_KEY = "app-theme";
const THEME_CHANGE_EVENT = "app-theme-change";

const getStoredTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  return saved && themes[saved] ? saved : "light";
};

const subscribeToTheme = (onStoreChange: () => void) => {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
};

export function useTheme() {
  const theme = useSyncExternalStore<Theme>(subscribeToTheme, getStoredTheme, () => "light");

  const setTheme = useCallback((newTheme: Theme) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    }
  }, []);

  return {
    theme,
    setTheme,
    colors: themes[theme],
  };
}
