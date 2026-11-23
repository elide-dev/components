/**
 * The colors the stylesheet and the presets write as oklch() are their former sRGB hex colors exactly: each converts
 * back to the same 8-bit color, so pages draw the same pixels and every contrast ratio is what it was.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { code, neutral, purple, status, syntax, syntaxLight } from "@elide/tokens";
import { contrast, oklch, parseHex, parseOklch } from "../src/color";
import { elide } from "../src/presets/elide";

/** apidocs.css's neutral defaults as they were in hex and rgb(), light then dark: the colors converted. */
const NEUTRAL_LIGHT: Record<string, string> = {
  bg: "#fbfcfd", surface: "#ffffff", subtle: "#f2f4f7", fg: "#161a21", muted: "#4f5766", faint: "#5f6775", rule: "#e1e4ea",
  "rule-strong": "#c7ccd6", accent: "#0f6e7a", link: "#0c5f6b", focus: "#0f6e7a", "note-api": "#0f6e7a", "note-spec": "#2d55a8",
  "note-impl": "#5f6775", deprecated: "#a8321f", nullable: "#8a5300", "non-null": "#2b6b3a", "code-bg": "#f3f5f8", "code-fg": "#1d2430",
  "syn-comment": "#5f6775", "syn-keyword": "#7a3196", "syn-string": "#1c6d45", "syn-number": "#9a4a00", "syn-type": "#0c5f6b",
  "syn-function": "#2b4db3", "syn-annotation": "#8a5300", "syn-param": "#8c1f4f",
};
const NEUTRAL_DARK: Record<string, string> = {
  bg: "#0f1216", surface: "#151920", subtle: "#1a1f27", fg: "#e6e8ec", muted: "#a3abb8", faint: "#8f98a6", rule: "#262c35",
  "rule-strong": "#3a414d", accent: "#5cc6d0", link: "#6fd0d9", focus: "#5cc6d0", "note-api": "#5cc6d0", "note-spec": "#8fb0f0",
  "note-impl": "#8f98a6", deprecated: "#f08a78", nullable: "#e3b25c", "non-null": "#7cc98d", "code-bg": "#141920", "code-fg": "#d9dde3",
  "syn-comment": "#8a93a1", "syn-keyword": "#d09be6", "syn-string": "#8fd1a6", "syn-number": "#f0b47a", "syn-type": "#6fd0d9",
  "syn-function": "#9ab5ff", "syn-annotation": "#e3b25c", "syn-param": "#f09ac0",
};

/** The largest difference, in 8-bit steps, between an oklch() string and a hex color. */
function delta(css: string, hex: string): number {
  const a = parseOklch(css).rgb;
  const b = parseHex(hex).rgb;
  return Math.max(...a.map((v, i) => Math.abs(v - b[i]!) * 255));
}

const css = readFileSync(new URL("../src/styles/apidocs.css", import.meta.url), "utf8");
/**
 * The :root defaults' color tokens in one scheme: a token is one oklch() color, the same in both, or
 * light-dark(light, dark), which gives each its own.
 */
function tokens(block: string, scheme: "light" | "dark"): Record<string, string> {
  const color = "oklch\\([^)]*\\)";
  const out: Record<string, string> = {};
  for (const m of block.matchAll(new RegExp(`--apidocs-([a-z0-9-]+): (?:light-dark\\((${color}), (${color})\\)|(${color}));`, "g"))) {
    out[m[1]!] = m[4] ?? (scheme === "light" ? m[2]! : m[3]!);
  }
  return out;
}
const root = css.slice(css.indexOf(":root {"), css.indexOf("/* ---- Base ---- */"));
const light = tokens(root, "light");
const dark = tokens(root, "dark");

describe("the conversion", () => {
  test("is within half an 8-bit step on a random sample of sRGB", () => {
    let worst = 0;
    for (let i = 0; i < 20_000; i++) {
      const hex = `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, "0")}`;
      worst = Math.max(worst, delta(oklch(hex), hex));
    }
    expect(worst).toBeLessThan(0.5);
  });
  test("writes a gray's hue as none", () => {
    expect(oklch("#ffffff")).toBe("oklch(100% 0 none)");
    expect(oklch("#000000", 0.28)).toBe("oklch(0% 0 none / 0.28)");
  });
});

describe("apidocs.css's neutral defaults", () => {
  for (const [name, table, values] of [["light", NEUTRAL_LIGHT, light], ["dark", NEUTRAL_DARK, dark]] as const) {
    test(`${name}: every color token is its former hex color, within a tenth of a step`, () => {
      for (const [token, hex] of Object.entries(table)) expect([token, delta(values[token]!, hex) < 0.1]).toEqual([token, true]);
    });
    test(`${name}: contrast ratios of text on the page are unchanged`, () => {
      for (const fg of ["fg", "muted", "faint", "accent", "link", "deprecated", "nullable", "non-null"]) {
        const before = contrast(parseHex(table[fg]!).rgb, parseHex(table.bg!).rgb);
        const after = contrast(parseOklch(values[fg]!).rgb, parseOklch(values.bg!).rgb);
        expect(Math.abs(after - before)).toBeLessThan(0.01);
      }
    });
  }
});

describe("the Elide preset", () => {
  const hexes = [neutral, purple, status, syntax, syntaxLight, code].flatMap(scale => Object.values(scale) as string[]);
  const byOklch = new Map(hexes.map(hex => [oklch(hex), hex]));
  test("every token color is an @elide/tokens color, converted exactly", () => {
    for (const mode of ["light", "dark"] as const) {
      for (const [token, value] of Object.entries(elide.tokens![mode]!)) {
        for (const color of value.match(/oklch\([^)]*\)/g) ?? []) {
          const hex = byOklch.get(color) ?? (color === oklch("#ffffff") ? "#ffffff" : undefined);
          expect([token, hex !== undefined && delta(color, hex) < 0.1]).toEqual([token, true]);
        }
        expect([token, /#[0-9a-f]{3,8}\b/i.test(value)]).toEqual([token, false]);
      }
    }
  });
});
