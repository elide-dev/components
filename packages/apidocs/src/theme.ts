/**
 * Themes: branding is an input, never part of the components. A theme is JSON
 * (plus optional CSS) that names the product, supplies logo artwork, sets the
 * --apidocs-* token values for light and dark, declares fonts, adds header and
 * footer links, and gives the source-link template and an optional base URL.
 * `extends` picks a preset: "neutral" (the default, unbranded) or "elide".
 */
import { elide } from "./presets/elide";
import type { SymbolMode } from "./symbols";

export interface ThemeLink {
  label: string;
  url: string;
  /**
   * In `links.header`: this entry is the site being rendered. Header links are the sibling documentation sites
   * (a user guide, a developer guide, the API reference), shown as a switcher with the current one marked. When no
   * entry sets it, the renderer marks the entry whose URL is this site's own root: "", "./", "index.html", or the
   * theme's baseUrl.
   */
  current?: boolean;
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

/** An image for link previews (Open Graph and Twitter cards). */
export interface SocialImage {
  /** A PNG or JPEG below the renderer's assets directory (social/elide.png), copied into the site's assets/. */
  asset?: string;
  /** Or the image's absolute URL, used as given. */
  url?: string;
  /** In pixels; Open Graph expects 1200 by 630. */
  width: number;
  height: number;
  /** What the image shows, for readers who cannot see it. */
  alt: string;
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
  /**
   * `header`: the sibling documentation sites, as a switcher in the top bar (see ThemeLink.current); other links,
   * such as a repository, belong in `footer`. Relative URLs in both are resolved from the site's root.
   */
  links?: { header?: ThemeLink[]; footer?: ThemeLink[] };
  /** Text at the foot of every page, such as a copyright line. */
  footer?: string;
  /** Source links: {path}, {line} and {ref} are filled in, such as https://github.com/o/r/blob/{ref}/{path}#L{line}. */
  sourceLink?: string;
  /** The value of {ref} in sourceLink. */
  sourceRef?: string;
  /** The site's absolute URL, with a trailing slash. Enables canonical links and sitemap.xml. */
  baseUrl?: string;
  /**
   * Which symbols pages write beside words: "utf" (plain Unicode symbols, the default), "emoji", or "none".
   * Markdown pages and llms.txt use the set as text; HTML pages draw icons and offer the set where it reads well.
   */
  symbols?: SymbolMode;
  /** Whether a member's full documentation starts folded under its summary row ("collapsed", the default) or open. */
  memberDetails?: "collapsed" | "expanded";
  /**
   * The image link previews show. With one, pages carry og:image and a large Twitter card; without, neither. Both
   * presets have one; null leaves the preset's out.
   */
  socialImage?: SocialImage | null;
  /**
   * When the pages were built or last changed, as a W3C date (2026-11-21) or date-time: sitemap.xml's lastmod.
   * The renderer never reads the clock; without this, the sitemap has no lastmod.
   */
  lastModified?: string;
  /**
   * The text of llms.txt's "When to use this" section, Markdown, for an agent deciding whether to read on. Defaults
   * to a sentence built from the module's name, version and description.
   */
  whenToUse?: string;
  /** Extra CSS appended to the theme stylesheet. */
  css?: string;
}

/** The neutral preset's favicon: braces on the default accent, so a browser asking for /favicon.ico finds an icon. */
const NEUTRAL_FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0f6e7a"/><path d="M13 8.5c-2.4 0-3 1-3 3V14c0 1.3-.7 2-2 2 1.3 0 2 .7 2 2v2.5c0 2 .6 3 3 3M19 8.5c2.4 0 3 1 3 3V14c0 1.3.7 2 2 2-1.3 0-2 .7-2 2v2.5c0 2-.6 3-3 3" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const neutral: Theme = {
  name: "neutral",
  favicon: NEUTRAL_FAVICON,
  // The favicon's mark on the page color, 1200 by 630 (scripts/gen-social.ts).
  socialImage: { asset: "social/neutral.png", width: 1200, height: 630, alt: "A pair of braces on a teal square" },
};

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
    socialImage: theme.socialImage === null ? undefined : (theme.socialImage ?? base.socialImage),
    css: [base.css, theme.css].filter(Boolean).join("\n") || undefined,
  };
}

/**
 * The theme stylesheet: font faces and token values. Paths are relative to assets/. `root` is the selector the
 * tokens are set on: ":root:root" outranks the stylesheet's own :root defaults wherever the two are loaded.
 */
export function themeCss(theme: Theme, root = ":root"): string {
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
  if (light) out.push(`${root}{${light}}`);
  if (dark) {
    out.push(`@media (prefers-color-scheme:dark){${root}:not([data-theme=light]){${dark}}}`);
    out.push(`${root}[data-theme=dark]{${dark}}`);
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
