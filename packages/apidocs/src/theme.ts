/**
 * Themes: branding is an input, never part of the components. A theme is JSON
 * (plus optional CSS) that names the product, supplies logo artwork, sets the
 * --apidocs-* token values for light and dark, declares fonts, adds header and
 * footer links, and gives the source-link template and an optional base URL.
 * `extends` picks a preset: "neutral" (the default, unbranded) or "elide".
 */
import { elide } from "./presets/elide";

export interface ThemeLink {
  label: string;
  url: string;
}

export interface FontFace {
  family: string;
  /** The font file, a path below the renderer's assets directory (fonts/inter.woff2). */
  asset: string;
  weight?: string;
  style?: string;
  unicodeRange?: string;
  /** Whether pages preload the file. Defaults to true for upright faces, which first paint needs. */
  preload?: boolean;
}

export interface Theme {
  /** A preset to start from. */
  extends?: "neutral" | "elide";
  /** The theme's own name, for diagnostics. */
  name?: string;
  /** The product the pages belong to; shown in the header. Defaults to the module's name. */
  productName?: string;
  /** Logo artwork as SVG markup, for light and dark surfaces. */
  logo?: { light?: string; dark?: string; alt?: string };
  /** A small square mark used as the favicon, as SVG markup. */
  favicon?: string;
  /** Token values without the --apidocs- prefix: { light: { accent: "#..." }, dark: { ... } }. */
  tokens?: { light?: Record<string, string>; dark?: Record<string, string> };
  /** Font files the pages load. Families are set through the font-* tokens. */
  fonts?: FontFace[];
  links?: { header?: ThemeLink[]; footer?: ThemeLink[] };
  /** Text at the foot of every page, such as a copyright line. */
  footer?: string;
  /** Source links: {path}, {line} and {ref} are filled in, such as https://github.com/o/r/blob/{ref}/{path}#L{line}. */
  sourceLink?: string;
  /** The value of {ref} in sourceLink. */
  sourceRef?: string;
  /** The site's absolute URL, with a trailing slash. Enables canonical links and sitemap.xml. */
  baseUrl?: string;
  /** Extra CSS appended to the theme stylesheet. */
  css?: string;
}

export const neutral: Theme = { name: "neutral" };

const presets: Record<string, Theme> = { neutral, elide };

/** A theme with its preset applied: the input's values win, token maps and links merge. */
export function resolveTheme(input: Theme | undefined): Theme {
  const theme = input ?? {};
  const base = theme.extends ? presets[theme.extends] : neutral;
  if (!base) throw new Error(`Unknown theme preset "${theme.extends}"; use "neutral" or "elide"`);
  return {
    ...base,
    ...theme,
    logo: theme.logo ?? base.logo,
    tokens: {
      light: { ...base.tokens?.light, ...theme.tokens?.light },
      dark: { ...base.tokens?.dark, ...theme.tokens?.dark },
    },
    fonts: theme.fonts ?? base.fonts,
    links: {
      header: theme.links?.header ?? base.links?.header,
      footer: theme.links?.footer ?? base.links?.footer,
    },
    css: [base.css, theme.css].filter(Boolean).join("\n") || undefined,
  };
}

/** The theme stylesheet: font faces and token values. Paths are relative to assets/. */
export function themeCss(theme: Theme): string {
  const out: string[] = [];
  for (const face of theme.fonts ?? []) {
    out.push(
      `@font-face{font-family:${JSON.stringify(face.family)};font-style:${face.style ?? "normal"};` +
        `font-display:optional;font-weight:${face.weight ?? "100 900"};src:url(${JSON.stringify(face.asset)}) format("woff2");` +
        (face.unicodeRange ? `unicode-range:${face.unicodeRange};` : "") +
        "}",
    );
  }
  const block = (tokens: Record<string, string> | undefined) =>
    Object.entries(tokens ?? {}).map(([k, v]) => `--apidocs-${k}:${v};`).join("");
  const light = block(theme.tokens?.light);
  const dark = block(theme.tokens?.dark);
  if (light) out.push(`:root{${light}}`);
  if (dark) {
    out.push(`@media (prefers-color-scheme:dark){:root:not([data-theme=light]){${dark}}}`);
    out.push(`:root[data-theme=dark]{${dark}}`);
  }
  if (theme.css) out.push(theme.css);
  return out.join("\n") + "\n";
}

/** A source link for a file and line, or undefined without a template. */
export function sourceUrl(theme: Theme, path: string, line: number): string | undefined {
  if (!theme.sourceLink) return undefined;
  return theme.sourceLink
    .replaceAll("{path}", path)
    .replaceAll("{line}", String(line))
    .replaceAll("{ref}", theme.sourceRef ?? "main");
}
