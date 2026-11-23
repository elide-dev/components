/**
 * The Mermaid DiagramRenderer: one headless Chromium page (Playwright) that holds the pinned Mermaid bundle from
 * node_modules and never reaches the network. Mermaid lays text out with the browser, so it cannot run in render.js;
 * the guides command draws each diagram here at import time and stores the SVG in the model.
 *
 * Mermaid draws with a placeholder palette. Afterwards every element's computed style is written back as
 * presentation attributes, Mermaid's stylesheet, inline styles, classes and fonts are removed, and each color becomes
 * a d-* class naming the token it stands for (see PALETTE); apidocs.css colors those classes. So one SVG follows the
 * light and dark schemes and any theme. Labels are plain SVG text, laid out in JetBrains Mono, the monospace font
 * the page sets them in.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { DiagramRenderer, DrawResult } from "./diagrams";

/** Token roles and their placeholder colors: distinct values that Mermaid's own palette never produces. */
export const PALETTE = {
  surface: "#fefefe",
  subtle: "#f1f1f1",
  "accent-soft": "#e8f1f3",
  fg: "#111111",
  muted: "#555555",
  rule: "#dddddd",
  "rule-strong": "#bbbbbb",
  accent: "#0b6b7a",
} as const;

/** The roles a fill, a stroke and a text fill may take; a color maps to the nearest of its kind's roles. */
const FILL_ROLES = ["surface", "subtle", "accent-soft", "fg", "muted", "rule", "rule-strong", "accent"] as const;
const STROKE_ROLES = ["fg", "muted", "rule", "rule-strong", "accent"] as const;
const TEXT_ROLES = ["fg", "muted", "accent"] as const;

/** The font labels are measured in: the family name the page's monospace stack starts with in the Elide preset. */
const FONT_FAMILY = "JetBrains Mono Variable";

const THEME_VARIABLES = {
  fontFamily: `"${FONT_FAMILY}", monospace`,
  background: PALETTE.surface,
  mainBkg: PALETTE.surface,
  primaryColor: PALETTE.surface,
  secondaryColor: PALETTE.subtle,
  tertiaryColor: PALETTE["accent-soft"],
  clusterBkg: PALETTE.subtle,
  clusterBorder: PALETTE.rule,
  primaryTextColor: PALETTE.fg,
  secondaryTextColor: PALETTE.fg,
  tertiaryTextColor: PALETTE.fg,
  textColor: PALETTE.fg,
  titleColor: PALETTE.fg,
  lineColor: PALETTE.muted,
  primaryBorderColor: PALETTE["rule-strong"],
  secondaryBorderColor: PALETTE["rule-strong"],
  tertiaryBorderColor: PALETTE["rule-strong"],
  nodeBorder: PALETTE["rule-strong"],
  edgeLabelBackground: PALETTE.surface,
  noteBkgColor: PALETTE["accent-soft"],
  noteTextColor: PALETTE.fg,
  noteBorderColor: PALETTE.accent,
  actorBkg: PALETTE.surface,
  actorBorder: PALETTE["rule-strong"],
  actorTextColor: PALETTE.fg,
  actorLineColor: PALETTE.muted,
  signalColor: PALETTE.muted,
  signalTextColor: PALETTE.fg,
  labelBoxBkgColor: PALETTE.subtle,
  labelBoxBorderColor: PALETTE["rule-strong"],
  labelTextColor: PALETTE.fg,
  loopTextColor: PALETTE.fg,
  activationBkgColor: PALETTE.subtle,
  activationBorderColor: PALETTE["rule-strong"],
  sequenceNumberColor: PALETTE.surface,
  classText: PALETTE.fg,
  labelColor: PALETTE.fg,
  stateLabelColor: PALETTE.fg,
  stateBkg: PALETTE.surface,
  altBackground: PALETTE.subtle,
  compositeBackground: PALETTE.subtle,
  compositeTitleBackground: PALETTE.subtle,
  innerEndBackground: PALETTE.fg,
  specialStateColor: PALETTE.fg,
  transitionColor: PALETTE.muted,
  transitionLabelColor: PALETTE.fg,
  errorBkgColor: PALETTE["accent-soft"],
  errorTextColor: PALETTE.fg,
};

const require = createRequire(import.meta.url);

/** Starts Chromium with Mermaid loaded. Throws Playwright's error when no Chromium is installed. */
export async function mermaidRenderer(): Promise<DiagramRenderer> {
  const mermaid = readFileSync(require.resolve("mermaid/dist/mermaid.min.js"), "utf8");
  const font = readFileSync(require.resolve("@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2"));
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ javaScriptEnabled: true, offline: true });
    const page = await context.newPage();
    await page.route("**/*", route => route.abort());
    const face = `@font-face{font-family:"${FONT_FAMILY}";src:url(data:font/woff2;base64,${font.toString("base64")}) format("woff2");font-weight:100 800}`;
    await page.setContent(`<!doctype html><html><head><style>${face}</style></head><body><div id="host"></div></body></html>`);
    await page.addScriptTag({ content: mermaid });
    await page.evaluate(async family => { await document.fonts.load(`16px "${family}"`); }, FONT_FAMILY);
    return {
      draw: (source, seed) => page.evaluate(drawInPage, { source, seed, themeVariables: THEME_VARIABLES, palette: PALETTE, roles: { fill: FILL_ROLES, stroke: STROKE_ROLES, text: TEXT_ROLES } }) as Promise<DrawResult>,
      close: () => browser.close(),
    };
  } catch (failure) {
    await browser.close();
    throw failure;
  }
}

interface DrawArgs {
  source: string;
  seed: string;
  themeVariables: Record<string, string>;
  palette: Record<string, string>;
  roles: { fill: readonly string[]; stroke: readonly string[]; text: readonly string[] };
}

/** Runs in the page: draws one diagram and rewrites its SVG. Self-contained, as page.evaluate requires. */
async function drawInPage({ source, seed, themeVariables, palette, roles }: DrawArgs): Promise<DrawResult> {
  const mermaid = (globalThis as unknown as { mermaid: { initialize(c: object): void; render(id: string, text: string): Promise<{ svg: string }> } }).mermaid;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619) >>> 0;
  const id = `d${hash.toString(36)}`;
  mermaid.initialize({
    startOnLoad: false, securityLevel: "strict", deterministicIds: true, deterministicIDSeed: seed, htmlLabels: false,
    look: "classic", markdownAutoWrap: false, flowchart: { htmlLabels: false, wrappingWidth: 400 }, class: { htmlLabels: false }, state: { htmlLabels: false }, theme: "base",
    themeVariables, fontFamily: themeVariables.fontFamily,
  });
  let markup: string;
  try {
    markup = (await mermaid.render(id, source)).svg;
  } catch (error) {
    document.getElementById(id)?.remove();
    document.getElementById(`d${id}`)?.remove();
    return { error: error instanceof Error ? error.message : String(error) };
  }
  const host = document.getElementById("host")!;
  host.innerHTML = markup;
  const svg = host.querySelector("svg")!;

  const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const parse = (value: string): { rgb: number[]; alpha: number } | undefined => {
    const m = /rgba?\(([^)]+)\)/.exec(value);
    if (!m) return undefined;
    const parts = m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number);
    return { rgb: parts.slice(0, 3), alpha: parts.length > 3 ? parts[3]! : 1 };
  };
  const nearest = (color: number[], kinds: readonly string[]) => {
    let best = kinds[0]!, distance = Infinity;
    for (const role of kinds) {
      const d = rgb(palette[role]!).reduce((sum, c, i) => sum + (c - color[i]!) ** 2, 0);
      if (d < distance) { best = role; distance = d; }
    }
    return best;
  };
  const DRAWING = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan"]);
  const DEFAULTS: Record<string, string> = {
    "stroke-width": "1px", "stroke-dasharray": "none", "stroke-linecap": "butt", "stroke-linejoin": "miter",
    opacity: "1", "fill-opacity": "1", "stroke-opacity": "1", "font-weight": "400", "font-style": "normal",
    "text-anchor": "start", "dominant-baseline": "auto",
  };
  const elements = [svg, ...svg.querySelectorAll("*")];
  // getComputedStyle is live: read every value before any class or style is removed, or later elements lose the
  // rules that matched them through their ancestors' classes.
  const READ = ["fill", "stroke", "font-size", ...Object.keys(DEFAULTS)];
  const computed = elements.map(el => {
    const live = getComputedStyle(el);
    const values = new Map(READ.map(p => [p, live.getPropertyValue(p)]));
    return { getPropertyValue: (p: string) => values.get(p) ?? "", fontSize: values.get("font-size") ?? "" };
  });
  elements.forEach((el, i) => {
    const style = computed[i]!;
    const tag = el.tagName.toLowerCase();
    const classes: string[] = [];
    if (DRAWING.has(tag)) {
      const isText = tag === "text" || tag === "tspan";
      for (const property of ["fill", "stroke"] as const) {
        const color = parse(style.getPropertyValue(property));
        if (!color || color.alpha === 0) { el.setAttribute(property, "none"); continue; }
        const role = nearest(color.rgb, isText && property === "fill" ? roles.text : property === "fill" ? roles.fill : roles.stroke);
        classes.push(`d-${isText && property === "fill" ? "text" : property}-${role}`);
        el.removeAttribute(property);
        if (color.alpha < 1) el.setAttribute(`${property}-opacity`, String(color.alpha));
      }
      if (isText) el.setAttribute("font-size", style.fontSize);
      for (const [property, initial] of Object.entries(DEFAULTS)) {
        const value = style.getPropertyValue(property);
        // A dash pattern with no gaps is a solid line.
        if (property === "stroke-dasharray" && value.split(/[\s,]+/).every((part, n, all) => all.length === 1 ? parseFloat(part) === 0 : n % 2 === 0 || parseFloat(part) === 0)) continue;
        if (property === "stroke-width" && value === "0px" && el.getAttribute("stroke") === "none") continue;
        if (value && value !== initial && !el.hasAttribute(property)) el.setAttribute(property, value);
      }
    }
    el.removeAttribute("style");
    el.removeAttribute("font-family");
    if (el === svg) finishRoot(el as SVGSVGElement);
    else if (classes.length) el.setAttribute("class", classes.join(" "));
    else el.removeAttribute("class");
  });
  function finishRoot(root: SVGSVGElement) {
    root.removeAttribute("class");
    root.removeAttribute("width");
    const box = root.viewBox.baseVal;
    if (box && box.width) {
      root.setAttribute("width", String(Math.ceil(box.width)));
      root.setAttribute("height", String(Math.ceil(box.height)));
    }
    root.setAttribute("role", "img");
  }
  for (const style of svg.querySelectorAll("style")) style.remove();

  const title = svg.querySelector(":scope > title")?.textContent?.trim() || undefined;
  const description = svg.querySelector(":scope > desc")?.textContent?.trim() || undefined;
  const out = new XMLSerializer().serializeToString(svg);
  host.innerHTML = "";
  return { svg: out, ...(title ? { title } : {}), ...(description ? { description } : {}) };
}
