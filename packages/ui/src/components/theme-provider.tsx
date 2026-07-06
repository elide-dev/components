import * as React from "react";

/**
 * ThemeProvider — sets the active color theme on <html> so that both the page
 * and Base UI overlays (which portal to <body>) pick it up. Persists the choice
 * to localStorage and initializes from the stored value or the OS preference.
 */
export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

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
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : defaultTheme;
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

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
