import * as React from "react";
import { ThemeContext, type Theme, type ThemeContextValue } from "./theme-context";

/**
 * ThemeProvider — sets the active color theme on <html> so that both the page
 * and Base UI overlays (which portal to <body>) pick it up. Persists the choice
 * to localStorage and initializes from the stored value or the OS preference.
 */
export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Theme used until the stored/system value resolves on mount. */
  defaultTheme?: Theme;
  /** localStorage key for persistence. */
  storageKey?: string;
}

function resolveInitialTheme(defaultTheme: Theme, storageKey: string): Theme {
  if (typeof window === "undefined") return defaultTheme; // SSR
  const stored = window.localStorage.getItem(storageKey);
  if (stored === "light" || stored === "dark") return stored;
  // Honor the OS preference in both directions; fall back to defaultTheme only
  // when matchMedia is unavailable.
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (prefersDark) return prefersDark.matches ? "dark" : "light";
  return defaultTheme;
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "eld-theme",
}: ThemeProviderProps) {
  // Resolve the initial theme synchronously (stored value, else OS preference,
  // else the default) in a lazy initializer rather than a mount effect — an
  // async init effect can run after an early user interaction and clobber it.
  const [theme, setTheme] = React.useState<Theme>(() => resolveInitialTheme(defaultTheme, storageKey));

  // Reflect the theme onto <html> and persist it.
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    localStorage.setItem(storageKey, theme);
  }, [theme, storageKey]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
