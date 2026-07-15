import * as React from "react";

/**
 * Theme context + `useTheme`. Kept out of theme-provider.tsx so that file
 * exports only components and Fast Refresh can preserve state on edit.
 */
export type Theme = "light" | "dark";

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
