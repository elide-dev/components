/**
 * WCAG 2.x contrast gate for the semantic text/surface pairings in tokens.css,
 * in both themes. Translucent surfaces (`color-mix(..., transparent)`) are
 * composited over each opaque surface they are used on.
 * `CONTRAST_REPORT=1 bun test` prints the worst ratio per text token.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { magenta, neutral, status, syntax } from "../src/tokens";

type RGBA = [number, number, number, number];

const css = readFileSync(new URL("../src/tokens.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function block(selector: RegExp): Map<string, string> {
  const m = selector.exec(css);
  if (!m) throw new Error(`no block for ${selector}`);
  const body = css.slice(m.index + m[0].length, css.indexOf("}", m.index));
  return new Map([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]));
}

const light = block(/:root\s*\{/);
const themes = {
  light,
  dark: new Map([...light, ...block(/\.dark,\s*\[data-theme="dark"\]\s*\{/)]),
};
type Theme = keyof typeof themes;

function hex(value: string): RGBA {
  const h = value.slice(1);
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`unsupported color ${value}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).concat(1) as RGBA;
}

function resolve(theme: Theme, value: string): RGBA {
  const v = value.trim();
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  if (ref) {
    const next = themes[theme].get(ref[1]);
    if (next === undefined) throw new Error(`undefined token ${ref[1]} (${theme})`);
    return resolve(theme, next);
  }
  // color-mix with transparent keeps the color and scales alpha in any space.
  const mix = /^color-mix\(in \w+,\s*(.+?)\s+([\d.]+)%,\s*transparent\)$/.exec(v);
  if (mix) {
    const [r, g, b, a] = resolve(theme, mix[1]);
    return [r, g, b, (a * Number(mix[2])) / 100];
  }
  return hex(v);
}

const over = ([r, g, b, a]: RGBA, [br, bg, bb]: RGBA): RGBA => [
  r * a + br * (1 - a),
  g * a + bg * (1 - a),
  b * a + bb * (1 - a),
  1,
];

const luminance = ([r, g, b]: RGBA) => {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const ratio = (a: RGBA, b: RGBA) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Contrast of `text` over `surface`, each optionally translucent, laid over `base`. */
function contrast(theme: Theme, text: string, surface: string, base = "--background"): number {
  const ground = over(resolve(theme, `var(${surface})`), resolve(theme, `var(${base})`));
  return ratio(over(resolve(theme, `var(${text})`), ground), ground);
}

const AA = 4.5;
const OPAQUE = ["--background", "--card", "--popover", "--muted"];
/** Translucent surfaces sit on the page-level surfaces, not on --muted. */
const BASES = ["--background", "--card", "--popover"];
const NEUTRAL_TEXT = ["--foreground", "--muted-foreground", "--subtle-foreground", "--primary-emphasis"];
const STATUS = ["info", "success", "warning", "danger"];
const SYNTAX = [...css.matchAll(/(--eld-syntax-[\w-]+)\s*:/g)].map(([, k]) => k);

type Case = [text: string, surface: string, base: string];
const on = (text: string, tints: string[]): Case[] => [
  ...OPAQUE.map((s): Case => [text, s, s]),
  ...tints.flatMap((s) => BASES.map((b): Case => [text, s, b])),
];
const cases: Case[] = [
  ...NEUTRAL_TEXT.flatMap((t) => on(t, ["--hover", "--primary-soft"])),
  ...STATUS.flatMap((h) => on(`--${h}-emphasis`, ["--hover", `--${h}-soft`])),
  ["--card-foreground", "--card", "--card"],
  ["--popover-foreground", "--popover", "--popover"],
  ["--accent-foreground", "--accent", "--accent"],
  ["--primary-foreground", "--primary", "--primary"],
  ["--destructive-foreground", "--destructive", "--destructive"],
  ...SYNTAX.flatMap((t) => ["--code-background", "--code-background-elev"].map((s): Case => [t, s, s])),
];

if (process.env.CONTRAST_REPORT) {
  for (const theme of Object.keys(themes) as Theme[]) {
    const worst = new Map<string, [number, string]>();
    for (const [t, s, b] of cases) {
      const r = contrast(theme, t, s, b);
      if (!worst.has(t) || r < worst.get(t)![0]) worst.set(t, [r, s === b ? s : `${s}/${b}`]);
    }
    console.log(theme, [...worst].map(([t, [r, s]]) => `${t} ${r.toFixed(2)} ${s}`).join("\n"));
  }
}

for (const theme of Object.keys(themes) as Theme[]) {
  describe(`${theme} theme meets WCAG AA (${AA}:1)`, () => {
    test.each(cases)("%s on %s over %s", (text, surface, base) => {
      expect(contrast(theme, text, surface, base)).toBeGreaterThanOrEqual(AA);
    });
  });
}

describe("tokens.ts mirrors tokens.css primitives", () => {
  const camel = (s: string) => s.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
  const scales: [string, Record<string, string>][] = [
    ["magenta", magenta],
    ["neutral", neutral],
    ["syntax", syntax],
    ["status", status],
  ];
  test.each(scales)("%s", (name, scale) => {
    const fromCss = Object.fromEntries(
      [...light]
        .filter(([k]) => (name === "status" ? /^--eld-(info|success|warning|danger)/ : new RegExp(`^--eld-${name}-`)).test(k))
        .map(([k, v]) => [camel(k.replace(name === "status" ? "--eld-" : `--eld-${name}-`, "")), v]),
    );
    expect(Object.fromEntries(Object.entries(scale).map(([k, v]) => [String(k), v]))).toEqual(fromCss);
  });
});
