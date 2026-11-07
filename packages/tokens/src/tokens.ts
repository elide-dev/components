/**
 * Typed token object for JS/TS consumers (charts, canvas, RN, tests, docgen).
 * Mirrors the primitive scales in tokens.css. Semantic/role tokens are theme-
 * dependent and should be read from CSS variables at runtime rather than
 * hardcoded from here.
 */

export const purple = {
  50: "#f5f3ff",
  100: "#ede9fe",
  200: "#ddd6fe",
  300: "#c4b5fd",
  400: "#a78bfa",
  500: "#8b5cf6",
  600: "#7c3aed",
  700: "#6d28d9",
  800: "#5b21b6",
  900: "#4c1d95",
  950: "#2e1065",
} as const;

export const magenta = {
  50: "#fff0fb",
  100: "#ffe4f8",
  200: "#ffc9f2",
  300: "#ff9ce4",
  400: "#ff5fd0",
  500: "#ff30bc",
  600: "#e7008c",
  700: "#d4007f",
  750: "#c30073",
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
  550: "#696969",
  600: "#525252",
  700: "#3a3a3a",
  800: "#1e1e22",
  900: "#0e0e11",
  950: "#0a0a0a",
} as const;

export const brand = {
  purple: "#662d91",
  magenta: "#e7008c",
  accentViolet: "#7c3aed",
  gradient: "linear-gradient(115deg in oklab, oklch(52% 0.19 295), oklch(52% 0.18 307) 65%, oklch(53% 0.16 345))",
  gradientFallback: "linear-gradient(115deg, #7447c8, #8443b8 65%, #a83c81)",
} as const;

/** Base hues for fills; `*Strong` is text on dark surfaces, `*Deep` text on light. */
export const status = {
  info: "#3b82f6",
  infoStrong: "#60a5fa",
  infoDeep: "#235fe5",
  success: "#22c55e",
  successStrong: "#3fb950",
  successDeep: "#117c3a",
  warning: "#eab308",
  warningStrong: "#e0a020",
  warningDeep: "#9c5e02",
  danger: "#ef4444",
  dangerStrong: "#f87171",
  dangerDeep: "#cd1b1e",
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

/** ANSI 16-color palette for terminal output on the always-dark code surface. */
export const ansi = {
  black: "#3b3b42",
  red: "#f2777a",
  green: "#7ccf8a",
  yellow: "#e5c07b",
  blue: "#6cb0ff",
  magenta: "#ff7ad9",
  cyan: "#56c8d8",
  white: "#d4d4d4",
  brightBlack: "#8a8a92",
  brightRed: "#ff9b9d",
  brightGreen: "#a5e8a0",
  brightYellow: "#f5dc8f",
  brightBlue: "#9ccbff",
  brightMagenta: "#ffaee8",
  brightCyan: "#8ee3ef",
  brightWhite: "#fafafa",
} as const;

export const radius = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 6,
  xl: 8,
  "2xl": 10,
  "3xl": 12,
  full: 9999,
} as const;

export const font = {
  sans: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  display: '"Instrument Sans Variable", "Instrument Sans", "Inter Variable", "Inter", sans-serif',
  mono: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',
} as const;

/** CSS timings for immediate press feedback and a gentler release. */
export const motion = {
  press: "80ms",
  hover: "180ms",
  settle: "240ms",
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

/** Semantic role → CSS custom-property name. Read the live value with
 *  getComputedStyle when you need the resolved (theme-aware) color. */
export const cssVar = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  subtleForeground: "--subtle-foreground",
  primary: "--primary",
  primaryHover: "--primary-hover",
  primaryForeground: "--primary-foreground",
  primaryEmphasis: "--primary-emphasis",
  primarySoft: "--primary-soft",
  infoEmphasis: "--info-emphasis",
  infoSoft: "--info-soft",
  successEmphasis: "--success-emphasis",
  successSoft: "--success-soft",
  warningEmphasis: "--warning-emphasis",
  warningSoft: "--warning-soft",
  dangerEmphasis: "--danger-emphasis",
  dangerSoft: "--danger-soft",
  border: "--border",
  ring: "--ring",
  codeBackground: "--code-background",
  codeLineHeight: "--code-line-height",
  codePrompt: "--code-prompt",
  codeCursor: "--code-cursor",
  codeTitleForeground: "--code-title-foreground",
  codeControlForeground: "--code-control-foreground",
  codeControlHover: "--code-control-hover",
  codeLineHighlight: "--code-line-highlight",
  codeLineAdd: "--code-line-add",
  codeLineRemove: "--code-line-remove",
  codeBreakpoint: "--code-breakpoint",
  codeCurrentLine: "--code-current-line",
} as const;

export const tokens = { purple, magenta, neutral, brand, status, syntax, ansi, radius, font, motion, cssVar } as const;
export default tokens;
