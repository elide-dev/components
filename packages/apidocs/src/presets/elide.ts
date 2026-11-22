/**
 * The Elide preset: --apidocs-* tokens mapped to @elide/tokens, Elide's fonts,
 * and @elide/brand artwork. Branding lives here and in theme files only; the
 * components never name Elide.
 */
import { code, neutral, purple, status, syntax, syntaxLight } from "@elide/tokens";
import type { Theme } from "../theme";
import { logoDark, logoLight, mark } from "./elide-artwork";

const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

const MONO =
  '"JetBrains Mono Variable", "JetBrains Mono", "Apidocs Mono Fallback", var(--apidocs-font-system-mono), var(--apidocs-font-symbol), var(--apidocs-font-emoji)';

export const elide: Theme = {
  name: "elide",
  logo: { light: logoLight, dark: logoDark, alt: "Elide" },
  favicon: mark,
  // JetBrains Mono for code and for every type and member name; the reader's system fonts for prose and
  // headings. The files hold Latin only, and the unicode-range says so, so a symbol or an emoji goes straight to
  // the system font chosen for it.
  fonts: [
    { family: "JetBrains Mono Variable", asset: "fonts/jetbrains-mono-latin-wght-normal.woff2", unicodeRange: LATIN },
    { family: "JetBrains Mono Variable", asset: "fonts/jetbrains-mono-latin-wght-italic.woff2", style: "italic", unicodeRange: LATIN },
  ],
  // A local monospace font scaled to JetBrains Mono's width, for the moment before the web font is ready, so
  // text takes the same space either way.
  css: '@font-face{font-family:"Apidocs Mono Fallback";src:local("Consolas");size-adjust:109.1%}',
  tokens: {
    light: {
      "font-mono": MONO,
      // JetBrains Mono's characters are 0.6em wide. These sizes make that a whole number of pixels (7, 8, 9, 10,
      // 12, 15 and 18), so on a 1x display every character of code starts on a pixel and columns line up.
      "size-xs": "11.6667px",
      "size-sm": "13.3333px",
      "size-md": "15px",
      "size-lg": "16.6667px",
      "size-xl": "20px",
      "size-2xl": "25px",
      "size-3xl": "30px",
      // Code inside 15px prose: 13.3333px, the same 8px grid as code blocks.
      "code-scale": "0.8889em",
      bg: neutral[50],
      surface: "#ffffff",
      subtle: neutral[100],
      fg: neutral[950],
      muted: neutral[600],
      faint: neutral[550],
      rule: `color-mix(in oklab, ${neutral[950]} 10%, transparent)`,
      "rule-strong": `color-mix(in oklab, ${neutral[950]} 18%, transparent)`,
      accent: purple[700],
      "accent-soft": `color-mix(in oklab, ${purple[700]} 7%, transparent)`,
      link: purple[800],
      focus: purple[600],
      "note-api": purple[700],
      "note-api-soft": `color-mix(in oklab, ${purple[700]} 8%, transparent)`,
      "note-spec": status.infoDeep,
      "note-spec-soft": `color-mix(in oklab, ${status.info} 9%, transparent)`,
      "note-impl": neutral[600],
      "note-impl-soft": `color-mix(in oklab, ${neutral[950]} 4%, transparent)`,
      deprecated: status.dangerDeep,
      "deprecated-soft": `color-mix(in oklab, ${status.danger} 9%, transparent)`,
      nullable: status.warningDeep,
      "non-null": status.successDeep,
      "code-bg": code.lightBackground,
      "code-fg": syntaxLight.default,
      "syn-comment": syntaxLight.comment,
      "syn-keyword": syntaxLight.keyword,
      "syn-string": syntaxLight.string,
      "syn-number": syntaxLight.number,
      "syn-type": syntaxLight.type,
      "syn-function": syntaxLight.function,
      "syn-annotation": syntaxLight.param,
      "syn-param": syntaxLight.param,
    },
    dark: {
      bg: neutral[950],
      surface: neutral[900],
      subtle: neutral[800],
      fg: neutral[50],
      muted: neutral[400],
      faint: neutral[400],
      rule: `color-mix(in oklab, ${neutral[50]} 10%, transparent)`,
      "rule-strong": `color-mix(in oklab, ${neutral[50]} 18%, transparent)`,
      accent: purple[300],
      "accent-soft": `color-mix(in oklab, ${purple[400]} 12%, transparent)`,
      link: purple[300],
      focus: purple[400],
      "note-api": purple[300],
      "note-api-soft": `color-mix(in oklab, ${purple[400]} 13%, transparent)`,
      "note-spec": status.infoStrong,
      "note-spec-soft": `color-mix(in oklab, ${status.infoStrong} 12%, transparent)`,
      "note-impl": neutral[400],
      "note-impl-soft": `color-mix(in oklab, ${neutral[50]} 5%, transparent)`,
      deprecated: status.dangerStrong,
      "deprecated-soft": `color-mix(in oklab, ${status.dangerStrong} 12%, transparent)`,
      nullable: status.warningStrong,
      "non-null": status.successStrong,
      "code-bg": code.darkBackground,
      "code-fg": syntax.default,
      "syn-comment": syntax.comment,
      "syn-keyword": syntax.keyword,
      "syn-string": syntax.string,
      "syn-number": syntax.number,
      "syn-type": syntax.type,
      "syn-function": syntax.function,
      "syn-annotation": syntax.param,
      "syn-param": syntax.param,
    },
  },
};
