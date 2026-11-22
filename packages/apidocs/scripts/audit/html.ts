/**
 * What the agent-readiness checks read from a page's raw HTML, with no
 * JavaScript run: its text, headings, head metadata, JSON-LD, landmarks and
 * controls. Uses node-html-parser, which is fast enough for multi-megabyte
 * type pages.
 */
import { type HTMLElement, type Node, NodeType, parse } from "node-html-parser";

export interface Control {
  tag: string;
  /** The accessible name as far as raw HTML gives one, or "" when it has none. */
  name: string;
  native: boolean;
  /** A short description for the report: tag, id and class. */
  label: string;
}

export interface PageFacts {
  bytes: number;
  lang?: string;
  title?: string;
  meta: Map<string, string>;
  links: { rel: string; type?: string; href: string }[];
  /** Text of the body with scripts, styles and templates removed, whitespace collapsed. */
  bodyText: string;
  /** Text of <main>, or of the body when there is no main. */
  mainText: string;
  headings: { level: number; text: string }[];
  h1: number;
  /** The largest jump between consecutive heading levels (h2 to h4 is 2). */
  maxHeadingSkip: number;
  landmarks: { header: number; nav: number; main: number; footer: number };
  jsonLd: { raw: string; value?: unknown; error?: string }[];
  inlineScripts: string[];
  metaRefresh: boolean;
  controls: Control[];
  /** Form fields (input, select, textarea) that are not hidden, and whether each has a label. */
  fields: { label: string; labelled: boolean }[];
  /** Text a reader cannot see (aria-label, title, visually hidden, hidden) that reads like an instruction to an agent. */
  injection: string[];
  ids: Set<string>;
}

const SKIP = new Set(["script", "style", "template", "svg"]);
const INSTRUCTION = /\b(ignore (all |any )?(previous|prior|above) instructions|you are (an? )?(ai|assistant|language model)|as an ai|system prompt|disregard (the|all|previous)|do not tell the user)\b/i;

export function readPage(html: string): PageFacts {
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: true, pre: true, textarea: true } });
  const doc = root.querySelector("html") ?? root;
  const head = root.querySelector("head");
  const body = root.querySelector("body") ?? root;
  const meta = new Map<string, string>();
  for (const m of head?.querySelectorAll("meta") ?? []) {
    const key = m.getAttribute("name") ?? m.getAttribute("property") ?? m.getAttribute("http-equiv");
    if (key) meta.set(key.toLowerCase(), m.getAttribute("content") ?? "");
  }
  const links = (head?.querySelectorAll("link") ?? []).map(l => ({ rel: (l.getAttribute("rel") ?? "").toLowerCase(), type: l.getAttribute("type"), href: l.getAttribute("href") ?? "" }));
  const jsonLd = root.querySelectorAll('script[type="application/ld+json"]').map(s => {
    const raw = s.rawText;
    try {
      return { raw, value: JSON.parse(raw) as unknown };
    } catch (e) {
      return { raw, error: (e as Error).message };
    }
  });
  const inlineScripts = root.querySelectorAll("script")
    .filter(s => !s.getAttribute("src") && /^(|text\/javascript|module)$/.test(s.getAttribute("type") ?? ""))
    .map(s => s.rawText);
  const headings = body.querySelectorAll("h1, h2, h3, h4, h5, h6").map(h => ({ level: Number(h.tagName[1]), text: collapse(textOf(h)) }));
  let maxHeadingSkip = 0;
  for (let i = 1; i < headings.length; i++) maxHeadingSkip = Math.max(maxHeadingSkip, headings[i]!.level - headings[i - 1]!.level);
  if (headings[0] && headings[0].level > 1) maxHeadingSkip = Math.max(maxHeadingSkip, headings[0].level - 1);
  const main = body.querySelector("main");
  const ids = new Set(root.querySelectorAll("[id]").map(e => e.id));
  const labelFor = new Set(root.querySelectorAll("label[for]").map(l => l.getAttribute("for")!));
  const labelText = new Map(root.querySelectorAll("label[for]").map(l => [l.getAttribute("for")!, collapse(textOf(l))]));

  const nameOf = (el: HTMLElement): string => {
    const aria = el.getAttribute("aria-label");
    if (aria?.trim()) return aria.trim();
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const text = by.split(/\s+/).map(id => root.querySelector(`#${cssEscape(id)}`)).map(e => (e ? collapse(textOf(e)) : "")).join(" ").trim();
      if (text) return text;
    }
    if (el.id && labelText.get(el.id)) return labelText.get(el.id)!;
    const text = collapse(textOf(el));
    if (text) return text;
    const img = el.querySelector("img[alt]");
    if (img?.getAttribute("alt")?.trim()) return img.getAttribute("alt")!.trim();
    if (el.tagName === "INPUT" && /^(submit|button|reset)$/i.test(el.getAttribute("type") ?? "")) return el.getAttribute("value") ?? "";
    return el.getAttribute("title")?.trim() ?? el.getAttribute("placeholder")?.trim() ?? "";
  };

  const controls: Control[] = [];
  const fields: { label: string; labelled: boolean }[] = [];
  const injection: string[] = [];
  for (const el of body.querySelectorAll("*")) {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role");
    const hidden = el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true";
    const label = describe(el);
    for (const attr of ["aria-label", "title", "alt", "aria-description"]) {
      const value = el.getAttribute(attr);
      if (value && INSTRUCTION.test(value)) injection.push(`${label} [${attr}]: ${value.slice(0, 100)}`);
    }
    if ((hidden || /\b(visually-hidden|sr-only)\b/.test(el.classNames)) && INSTRUCTION.test(textOf(el))) injection.push(`${label}: ${collapse(textOf(el)).slice(0, 100)}`);
    if (hidden) continue;
    const nativeControl = (tag === "a" && el.hasAttribute("href")) || tag === "button" || tag === "select" || tag === "textarea" || tag === "summary" || (tag === "input" && el.getAttribute("type") !== "hidden");
    // A focusable <pre> or region (tabindex="0" so keyboards can scroll it) is not a control.
    const focusableBox = el.hasAttribute("tabindex") && Number(el.getAttribute("tabindex")) >= 0 && /^(div|span|li|td|p|img)$/.test(tag) && !role;
    const ariaControl = !nativeControl && (/^(button|link|tab|menuitem|checkbox|switch|option|radio|combobox|slider)$/.test(role ?? "") || focusableBox || el.hasAttribute("onclick"));
    if (nativeControl || ariaControl) controls.push({ tag, name: nameOf(el), native: nativeControl, label });
    if ((tag === "input" && el.getAttribute("type") !== "hidden") || tag === "select" || tag === "textarea") {
      const labelled = !!(el.getAttribute("aria-label")?.trim() || el.getAttribute("aria-labelledby") || (el.id && labelFor.has(el.id)) || closest(el, "label"));
      fields.push({ label, labelled });
    }
  }

  return {
    bytes: Buffer.byteLength(html),
    lang: doc.getAttribute?.("lang") ?? undefined,
    title: root.querySelector("title")?.text,
    meta,
    links,
    bodyText: collapse(textOf(body)),
    mainText: collapse(textOf(main ?? body)),
    headings,
    h1: headings.filter(h => h.level === 1).length,
    maxHeadingSkip,
    landmarks: {
      header: body.querySelectorAll('header, [role="banner"]').filter(e => !closest(e, "main, article, section, aside, nav")).length,
      nav: body.querySelectorAll('nav, [role="navigation"]').length,
      main: body.querySelectorAll('main, [role="main"]').length,
      footer: body.querySelectorAll('footer, [role="contentinfo"]').filter(e => !closest(e, "main, article, section, aside, nav")).length,
    },
    jsonLd,
    inlineScripts,
    metaRefresh: (head?.querySelectorAll("meta") ?? []).some(m => (m.getAttribute("http-equiv") ?? "").toLowerCase() === "refresh"),
    controls,
    fields,
    injection,
    ids,
  };
}

/** Text of a node, skipping scripts, styles, templates and SVG. Block elements end with a space. */
export function textOf(node: Node): string {
  if (node.nodeType === NodeType.TEXT_NODE) return decode(node.rawText);
  if (node.nodeType !== NodeType.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  if (SKIP.has(el.rawTagName?.toLowerCase())) return "";
  let out = "";
  for (const child of el.childNodes) out += textOf(child);
  return /^(p|div|li|tr|td|th|dd|dt|h[1-6]|pre|section|article|br|table|ul|ol|dl)$/i.test(el.rawTagName ?? "") ? out + " " : out;
}

function closest(el: HTMLElement, selector: string): HTMLElement | null {
  const tags = selector.split(",").map(s => s.trim().toUpperCase());
  for (let p = el.parentNode as HTMLElement | null; p && p.tagName; p = p.parentNode as HTMLElement | null) if (tags.includes(p.tagName)) return p;
  return null;
}

function describe(el: HTMLElement): string {
  const cls = el.classNames ? "." + el.classNames.trim().split(/\s+/).join(".") : "";
  return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls}`;
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k === "amp") return "&";
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    if (k === "nbsp") return " ";
    const code = k.startsWith("#x") ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  });
}

function cssEscape(id: string): string {
  return id.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}
