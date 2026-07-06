/**
 * Typed token object for JS/TS consumers (charts, canvas, RN, tests, docgen).
 * Mirrors the primitive scales in tokens.css. Semantic/role tokens are theme-
 * dependent and should be read from CSS variables at runtime rather than
 * hardcoded from here.
 */

export const magenta = {
  50: "#fff0fb",
  100: "#ffe4f8",
  200: "#ffc9f2",
  300: "#ff9ce4",
  400: "#ff5fd0",
  500: "#ff30bc",
  600: "#e7008c",
  700: "#d4007f",
  800: "#b00469",
  900: "#920959",
  950: "#5b0035",
} as const;

export const neutral = {
  50: "#fafcfa",
  100: "#f5f5f5",
  200: "#d4d4d4",
  300: "#c0c0c0",
  400: "#9a9a9a",
  500: "#737373",
  600: "#525252",
  700: "#3a3a3a",
  800: "#1e1e22",
  900: "#0e0e11",
  950: "#0a0a0a",
} as const;

export const brand = {
  purple: "#662d91",
  magenta: "#e7008c",
  accentViolet: "#9747ff",
  gradient: "linear-gradient(135deg, #8a3bd4, #e7008c)",
} as const;

export const status = {
  info: "#3b82f6",
  success: "#22c55e",
  successStrong: "#3fb950",
  warning: "#eab308",
  warningStrong: "#e0a020",
  danger: "#ef4444",
} as const;

export const syntax = {
  default: "#d4d4d4",
  comment: "#6a9955",
  keyword: "#569cd6",
  string: "#ce9178",
  number: "#b5cea8",
  function: "#dcdcaa",
  type: "#4ec9b0",
  param: "#9cdcfe",
  lineNumber: "#858585",
} as const;

export const radius = {
  xs: 2,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  "2xl": 18,
  "3xl": 22,
  full: 9999,
} as const;

export const font = {
  sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  display: '"Instrument Sans", "Inter", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',
} as const;

/** Semantic role → CSS custom-property name. Read the live value with
 *  getComputedStyle when you need the resolved (theme-aware) color. */
export const cssVar = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  primaryEmphasis: "--primary-emphasis",
  border: "--border",
  ring: "--ring",
  codeBackground: "--code-background",
} as const;

export const tokens = { magenta, neutral, brand, status, syntax, radius, font, cssVar } as const;
export default tokens;
