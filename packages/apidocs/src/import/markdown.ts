/**
 * The Markdown importer: a documentation suite written in Markdown (a directory of .md files with YAML frontmatter,
 * the layout Astro Starlight reads) becomes apidocs/1 guides, so the suite renders with the same components, design
 * and outputs as an API reference. Build time only: the render bundle and the client bundle never import it.
 *
 * Input is the suite's files as { path, text } with paths relative to the suite's root, plus the bytes of its other
 * files (images and downloads). Output is the guides in reading order, the id of the overview guide (the root
 * index.md), the files to copy beside the pages, and diagnostics with file and line. Nothing here touches the file
 * system; src/import/files.ts reads a suite from disk.
 *
 * The Markdown is parsed into a syntax tree (mdast, through micromark with the GFM extension) and the model is built
 * from that tree. No HTML the parser could generate is used: raw HTML in the source becomes a raw node, which the
 * renderer passes through its allowlist sanitizer, and every URL passes safeUrl().
 */
import type {
  Blockquote, Definition, Html, Nodes, PhrasingContent, Root, RootContent, Table as MdTable, Text as MdText,
} from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { parseDocument } from "yaml";
import type { AdmonitionTone, Block, Guide, Heading, Image, Inline, Link, Model } from "../model";
import { tokenize } from "../sanitize";
import { SHELL_IDS } from "../site";
import { guideAnchors, inlineText, slugify } from "../structure";
import { safeUrl } from "../url";
import { imageSize } from "./images";
import { sanitizeSvg } from "./svg";

/** A Markdown file of the suite. */
export interface SuiteFile {
  /** The path below the suite's root, with / between segments: usage/running.md. */
  path: string;
  text: string;
}

/** Any other file of the suite, such as an image, that a page may show or link to. */
export interface SuiteAsset {
  path: string;
  data: Uint8Array;
}

/**
 * Where links that leave the suite go. A link's path, resolved from the suite's root (../developer/embedding/index.md
 * from a page of the user suite), that starts with `prefix` is rewritten to `target` plus the rest of the path.
 * `target` is an absolute URL or a path from the site's root. When the rest names a Markdown file, it becomes that
 * page's file in a site this importer built: index.md is index.html, a/b.md is guides/a/b.html.
 */
export interface LinkMapping {
  prefix: string;
  target: string;
}

export interface ImportOptions {
  /** The suite's id. It namespaces guide ids (guide:<suite>/<slug>) so two suites never share one. */
  suite?: string;
  /** Include pages whose frontmatter says draft: true. Off by default, as production builds leave drafts out. */
  includeDrafts?: boolean;
  /** Frontmatter keys accepted and ignored beside the known ones; a nested key is dotted (sidebar.badge). */
  extraKeys?: string[];
  links?: LinkMapping[];
  assets?: SuiteAsset[];
  /** The suite's path in its repository, for guides' source links: docs/user. */
  sourceRoot?: string;
}

export interface Diagnostic {
  file: string;
  line: number;
  severity: "error" | "warning";
  message: string;
}

/**
 * A file to write into the site: `from` below the suite's root, `to` below the site's root, and its contents (an
 * SVG's sanitized form). Writers use `data`, never a fresh read of `from`.
 */
export interface CopiedFile {
  from: string;
  to: string;
  data: Uint8Array;
}

export interface ImportResult {
  /** The guides, in reading order. */
  guides: Guide[];
  /** The id of the overview guide, the root index.md, when it is included. */
  overview?: string;
  files: CopiedFile[];
  /** Draft pages left out. */
  drafts: string[];
  diagnostics: Diagnostic[];
}

/** Where a suite's own files go in the site, below its root. */
export const SUITE_FILES = "guides/";

const KNOWN_KEYS = new Set(["title", "description", "sidebar", "draft"]);
const SIDEBAR_KEYS = new Set(["label", "order"]);
const ALERTS: Record<string, AdmonitionTone> = { NOTE: "note", TIP: "tip", IMPORTANT: "important", WARNING: "warning", CAUTION: "caution" };
const VOID_TAGS = new Set(["area", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

interface Frontmatter {
  title?: string;
  description?: string;
  label?: string;
  order?: number;
  draft: boolean;
}

interface Page {
  path: string;
  dir: string;
  /** The file name without .md. */
  name: string;
  isIndex: boolean;
  slug: string;
  id: string;
  fm: Frontmatter;
  /** The body with the frontmatter blanked out, so lines keep their numbers. */
  body: string;
  included: boolean;
  blocks?: Block[];
  /** Fragment spellings that name a heading, mapped to the anchor the renderer gives it. */
  fragments?: Map<string, string>;
}

interface PendingLink {
  link: Link;
  url: string;
  page: Page;
  line: number;
}

/** Imports a suite. Never throws on bad input: every problem is a diagnostic. */
export function importMarkdown(files: SuiteFile[], options: ImportOptions = {}): ImportResult {
  const diagnostics: Diagnostic[] = [];
  const report = (file: string, line: number, severity: Diagnostic["severity"], message: string) => diagnostics.push({ file, line, severity, message });
  const assets = new Map((options.assets ?? []).map(a => [normalizePath(a.path), a]));
  const extra = new Set(options.extraKeys ?? []);
  const copied = new Map<string, CopiedFile>();
  const pages = new Map<string, Page>();

  // ---- Read every page's frontmatter: drafts too, since a draft index still names its group.
  for (const file of [...files].sort((a, b) => compare(a.path, b.path))) {
    const path = normalizePath(file.path);
    if (path === undefined || path.startsWith("../")) {
      report(file.path, 1, "error", "the path is outside the suite");
      continue;
    }
    if (/\.mdx$/i.test(path)) {
      report(path, 1, "error", "MDX is not supported: write the page as Markdown (.md)");
      continue;
    }
    if (!/\.md$/i.test(path)) continue;
    const { fm, body } = frontmatter(path, file.text, extra, report);
    const segments = path.slice(0, -3).split("/");
    const name = segments[segments.length - 1]!;
    const slugSegments = segments.map(s => slugify(s) || "page");
    if (slugSegments.join("/") !== segments.join("/")) {
      report(path, 1, "warning", `file and directory names should be lower-case kebab-case; the page is ${SUITE_FILES}${slugSegments.join("/")}.html`);
    }
    const slug = slugSegments.join("/");
    const included = !fm.draft || !!options.includeDrafts;
    pages.set(path, {
      path, dir: segments.slice(0, -1).join("/"), name, isIndex: name === "index", slug,
      id: `guide:${options.suite ? `${options.suite}/` : ""}${slug}`, fm, body, included,
    });
  }

  // ---- Parse the included pages.
  const pending: PendingLink[] = [];
  for (const page of pages.values()) {
    if (!page.included) continue;
    const tree = parse(page, report);
    if (!tree) continue;
    const ctx: Ctx = { page, report, pending, defs: definitions(tree), image: (url, alt, title, line) => image(url, alt, title, line, page) };
    page.blocks = blocks(tree.children, ctx);
    page.fragments = fragments(page.blocks);
  }

  // ---- Resolve links now that every page's headings are known.
  for (const { link, url, page, line } of pending) {
    const at = classify(url, page.path);
    switch (at.kind) {
      case "absolute": {
        const safe = safeUrl(url);
        if (safe) link.url = safe;
        else report(page.path, line, "error", `unsafe link URL left out: ${JSON.stringify(url)}`);
        break;
      }
      case "suite": {
        const target = targetPage(at.path, page, line);
        if (target === "asset") {
          const to = copy(at.path, page, line);
          if (to) link.url = fromPage(page, to) + (at.fragment !== undefined ? `#${encodeURIComponent(at.fragment)}` : "");
          break;
        }
        if (!target) break;
        const section = at.fragment !== undefined && at.fragment !== "" ? sectionOf(target, at.fragment, page, line) : undefined;
        if (section === null) break;
        link.target = { id: target.id, ...(section ? { section } : {}) };
        break;
      }
      case "outside": {
        const mapped = mapLink(at.path, at.fragment, options.links);
        if (mapped) link.url = fromPage(page, mapped);
        else report(page.path, line, "error", `links outside the suite to ${at.path}; add a link mapping for it, or use an absolute URL`);
        break;
      }
    }
  }

  // ---- Reading order and groups.
  const guides = order(pages, report).map(({ page, group }) => guide(page, group, options));
  const root = pages.get("index.md");
  if (!root) report("index.md", 1, "warning", "the suite has no index.md, so the overview page lists the guides");
  else if (!root.included) report("index.md", 1, "warning", "index.md is a draft, so the overview page lists the guides");
  return {
    guides,
    ...(root?.included ? { overview: root.id } : {}),
    files: [...copied.values()],
    drafts: [...pages.values()].filter(p => !p.included).map(p => p.path),
    diagnostics,
  };

  /** The page a suite path names, "asset" for another file of the suite, or undefined (reported) when there is none. */
  function targetPage(path: string, from: Page, line: number): Page | "asset" | undefined {
    const candidates = path === "" || path.endsWith("/") ? [`${path}index.md`] : [path, ...(/\.[a-z0-9]+$/i.test(path) ? [] : [`${path}/index.md`, `${path}.md`])];
    for (const candidate of candidates) {
      const target = pages.get(candidate);
      if (target && !target.included) {
        report(from.path, line, "warning", `links to ${candidate}, a draft this build leaves out; the link shows as text`);
        return undefined;
      }
      if (target) return target;
      if (assets.has(candidate)) return "asset";
    }
    if (/\.mdx$/i.test(path)) report(from.path, line, "error", `links to ${path}, an MDX page, which is not supported`);
    else report(from.path, line, "error", `links to ${path}, which is not in the suite`);
    return undefined;
  }

  /** The anchor a fragment names on a page; undefined for none, null when it names no heading (reported). */
  function sectionOf(target: Page, fragment: string, from: Page, line: number): string | undefined | null {
    const anchor = target.fragments?.get(fragment) ?? target.fragments?.get(fragment.toLowerCase());
    if (anchor) return anchor;
    report(from.path, line, "error", `links to #${fragment} in ${target.path}, which has no such heading`);
    return null;
  }

  /**
   * Copies an asset into the site and returns its URL from the site's root; undefined (reported) for a file the site
   * must not serve. Only the image types in COPYABLE are copied, an SVG rebuilt by sanitizeSvg; the bytes are the
   * ones read with the suite, never read again.
   */
  function copy(path: string, from: Page, line: number): string | undefined {
    const done = copied.get(path);
    if (done) return urlOf(path);
    const refused = refusal(path);
    if (refused) {
      report(from.path, line, "error", `${path} is not copied into the site: ${refused}`);
      return undefined;
    }
    const asset = assets.get(path)!;
    let data = asset.data;
    if (/\.svg$/i.test(path)) {
      const clean = sanitizeSvg(new TextDecoder().decode(asset.data));
      if (!clean.ok) {
        report(from.path, line, "error", `${path} is not copied into the site: the SVG cannot be made safe, because ${clean.reason}`);
        return undefined;
      }
      data = new TextEncoder().encode(clean.svg);
    }
    copied.set(path, { from: path, to: SUITE_FILES + path, data });
    return urlOf(path);
  }

  function image(url: string, alt: string, title: string | null | undefined, line: number, page: Page): Inline {
    const text = alt.replace(/\s+/g, " ").trim();
    if (!text) report(page.path, line, "error", `the image ${url} has no alternative text; describe it in the brackets: ![what it shows](${url})`);
    const at = classify(url, page.path);
    const node = (src: string, size?: { width: number; height: number }): Image => ({
      kind: "image", src, alt: text, ...(title ? { title } : {}), ...(size ? { width: size.width, height: size.height } : {}),
    });
    switch (at.kind) {
      case "absolute": {
        const safe = safeUrl(url);
        if (safe) return node(safe);
        report(page.path, line, "error", `unsafe image URL left out: ${JSON.stringify(url)}`);
        return { kind: "text", text };
      }
      case "outside": {
        const mapped = mapLink(at.path, undefined, options.links);
        if (mapped) return node(mapped);
        report(page.path, line, "error", `the image ${at.path} is outside the suite; add a link mapping for it, or use an absolute URL`);
        return { kind: "text", text };
      }
      case "suite": {
        if (!assets.has(at.path)) {
          report(page.path, line, "error", `the image ${at.path} is not in the suite`);
          return { kind: "text", text };
        }
        const src = copy(at.path, page, line);
        if (!src) return { kind: "text", text };
        return node(src, imageSize(copied.get(at.path)!.data));
      }
    }
  }
}

/**
 * The files a suite may ship beside its pages: images only, since a page shows them and nothing else needs to be
 * served. Anything else could run on the site's origin when opened directly (HTML, XHTML, XML with a stylesheet,
 * MHT and the like), so it is never copied. SVG is copied only through sanitizeSvg.
 */
export const COPYABLE = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"]);

/** Extensions a browser may treat as a document, refused anywhere in a file name: x.html.png is refused. */
const ACTIVE = /\.(x?html?|shtml|xht|xml|xsl|xslt|mht|mhtml|svgz|php|aspx?|jsp|js|mjs|css|swf)(\.|$)/i;

/** Why a suite file is not copied, or undefined when it may be. */
function refusal(path: string): string | undefined {
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (/[. ]$/.test(name)) return "its name ends with a dot or a space";
  const ext = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase();
  if (!ext || !COPYABLE.has(ext)) return `only images (${[...COPYABLE].join(", ")}) are copied beside the pages`;
  if (ACTIVE.test(name.slice(0, -ext.length - 1))) return "its name has a second, document-like extension";
  return undefined;
}

/** A copied file's URL from the site's root. */
function urlOf(path: string): string {
  return SUITE_FILES + path.split("/").map(encodeURIComponent).join("/");
}

/**
 * A link URL from the site's root as the page needs it: a link's url is relative to its page (an image's src is
 * relative to the site's root). The overview is the root's index.html; every other page is guides/<slug>.html.
 */
function fromPage(page: Page, url: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//")) return url;
  return (page.path === "index.md" ? "" : "../".repeat(page.slug.split("/").length)) + url;
}

/** Formats a diagnostic as file:line: message, with "warning: " before a warning's message. */
export function formatDiagnostic(d: Diagnostic, root = ""): string {
  return `${root}${d.file}:${d.line}: ${d.severity === "warning" ? "warning: " : ""}${d.message}`;
}

/** A guides-only model from an import: the suite's title and version, its guides and its overview. */
export function guidesModel(result: ImportResult, module: { name: string; version?: string }): Model {
  return {
    schema: "apidocs/1",
    module: {
      name: module.name,
      ...(module.version ? { version: module.version } : {}),
      ...(result.guides.length ? { guides: result.guides } : {}),
      ...(result.overview ? { overview: result.overview } : {}),
    },
  };
}

// ---- Frontmatter.

function frontmatter(path: string, text: string, extra: Set<string>, report: (file: string, line: number, severity: Diagnostic["severity"], message: string) => void): { fm: Frontmatter; body: string } {
  const fm: Frontmatter = { draft: false };
  const source = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const match = /^---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/.exec(source);
  if (!match) {
    report(path, 1, "error", "the page has no frontmatter: start it with ---, a title and a description, then ---");
    return { fm, body: source };
  }
  // The frontmatter becomes blank lines, so the parser's line numbers are the file's.
  const body = "\n".repeat(match[0].split("\n").length - 1) + source.slice(match[0].length);
  const yaml = match[1] ?? "";
  const doc = parseDocument(yaml, { uniqueKeys: true });
  if (doc.errors.length) {
    const error = doc.errors[0]!;
    report(path, 1 + (error.linePos?.[0]?.line ?? 0), "error", `the frontmatter is not valid YAML: ${error.message.split("\n")[0]!.replace(/ at line \d+, column \d+:?$/, "")}`);
    return { fm, body };
  }
  const data: unknown = doc.toJS();
  if (data === null || data === undefined) {
    report(path, 1, "error", "the frontmatter is empty: give the page a title and a description");
    return { fm, body };
  }
  if (typeof data !== "object" || Array.isArray(data)) {
    report(path, 2, "error", "the frontmatter must be a map of keys to values");
    return { fm, body };
  }
  const lineOf = (key: string) => {
    const at = yaml.split("\n").findIndex(l => new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`).test(l));
    return at < 0 ? 1 : at + 2;
  };
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (!KNOWN_KEYS.has(key)) {
      if (!extra.has(key)) report(path, lineOf(key), "error", `unknown frontmatter key ${JSON.stringify(key)}; the importer reads title, description, sidebar.label, sidebar.order and draft`);
      continue;
    }
    switch (key) {
      case "title":
      case "description":
        if (typeof value === "string" && value.trim()) fm[key] = value.replace(/\s+/g, " ").trim();
        else report(path, lineOf(key), "error", `${key} must be text`);
        break;
      case "draft":
        if (typeof value === "boolean") fm.draft = value;
        else report(path, lineOf(key), "error", "draft must be true or false");
        break;
      case "sidebar":
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          report(path, lineOf(key), "error", "sidebar must be a map with label and order");
          break;
        }
        for (const [sub, v] of Object.entries(value as Record<string, unknown>)) {
          if (!SIDEBAR_KEYS.has(sub)) {
            if (!extra.has(`sidebar.${sub}`)) report(path, lineOf(sub), "error", `unknown frontmatter key "sidebar.${sub}"; the importer reads sidebar.label and sidebar.order`);
          } else if (sub === "label") {
            if (typeof v === "string" && v.trim()) fm.label = v.replace(/\s+/g, " ").trim();
            else report(path, lineOf(sub), "error", "sidebar.label must be text");
          } else if (typeof v === "number" && Number.isFinite(v)) {
            fm.order = v;
          } else {
            report(path, lineOf(sub), "error", "sidebar.order must be a number");
          }
        }
        break;
    }
  }
  if (!fm.title) report(path, 1, "error", "the frontmatter has no title");
  if (!fm.description && !doc.errors.length) report(path, 1, "warning", "the frontmatter has no description, which listings, search and llms.txt show");
  return { fm, body };
}

// ---- Parsing and conversion.

function parse(page: Page, report: (file: string, line: number, severity: Diagnostic["severity"], message: string) => void): Root | undefined {
  try {
    return fromMarkdown(page.body, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  } catch (error) {
    report(page.path, 1, "error", `could not parse the Markdown: ${(error as Error).message}`);
    return undefined;
  }
}

interface Ctx {
  page: Page;
  report: (file: string, line: number, severity: Diagnostic["severity"], message: string) => void;
  pending: PendingLink[];
  defs: Map<string, Definition>;
  image: (url: string, alt: string, title: string | null | undefined, line: number) => Inline;
}

function definitions(tree: Root): Map<string, Definition> {
  const defs = new Map<string, Definition>();
  const visit = (node: Nodes) => {
    if (node.type === "definition" && !defs.has(node.identifier.toLowerCase())) defs.set(node.identifier.toLowerCase(), node);
    if ("children" in node) for (const child of node.children) visit(child);
  };
  visit(tree);
  return defs;
}

const lineOf = (node: Nodes) => node.position?.start.line ?? 1;

function blocks(nodes: RootContent[], ctx: Ctx): Block[] {
  const out: Block[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph": {
        const children = inlines(node.children, ctx);
        if (children.length) out.push({ kind: "paragraph", children });
        break;
      }
      case "heading": {
        const { children, anchor } = explicitAnchor(node.children);
        out.push({ kind: "heading", level: node.depth, children: inlines(children, ctx), ...(anchor ? { anchor } : {}) });
        break;
      }
      case "thematicBreak": out.push({ kind: "raw", html: "<hr>", text: "---" }); break;
      case "blockquote": out.push(quote(node, ctx)); break;
      case "list":
        out.push({
          kind: "list",
          ...(node.ordered ? { ordered: true } : {}),
          items: node.children.map(item => {
            const body = blocks(item.children, ctx);
            if (typeof item.checked !== "boolean") return body;
            const check: Inline = { kind: "check", ...(item.checked ? { checked: true } : {}) };
            const first = body[0];
            if (first?.kind === "paragraph") return [{ ...first, children: [check, ...(first.children ?? [])] }, ...body.slice(1)];
            return [{ kind: "paragraph", children: [check] }, ...body];
          }),
        });
        break;
      case "code": out.push({ kind: "code", language: node.lang?.toLowerCase() || "text", text: node.value }); break;
      case "html": {
        const html = withoutComments(node.value);
        if (html.trim()) out.push({ kind: "raw", html, text: htmlText(html) });
        break;
      }
      case "table": out.push(table(node, ctx)); break;
      case "definition": break;
      case "footnoteDefinition":
        ctx.report(ctx.page.path, lineOf(node), "error", "footnotes are not supported; put the note in the text or in a callout");
        break;
      default:
        ctx.report(ctx.page.path, lineOf(node), "warning", `unsupported Markdown (${node.type}) left out`);
    }
  }
  return out;
}

/** A heading's text without a trailing {#id}, and that id. */
function explicitAnchor(children: PhrasingContent[]): { children: PhrasingContent[]; anchor?: string } {
  const last = children[children.length - 1];
  if (last?.type !== "text") return { children };
  const match = /\s*\{#([^\s{}]+)\}\s*$/.exec(last.value);
  if (!match) return { children };
  const rest = last.value.slice(0, match.index);
  return { children: [...children.slice(0, -1), ...(rest ? [{ ...last, value: rest } as MdText] : [])], anchor: match[1]! };
}

/** A block quote, or a GitHub alert (> [!NOTE] and the other four) as an admonition. */
function quote(node: Blockquote, ctx: Ctx): Block {
  const first = node.children[0];
  const lead = first?.type === "paragraph" ? first.children[0] : undefined;
  const match = lead?.type === "text" ? /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/i.exec(lead.value) : null;
  if (!match || first?.type !== "paragraph" || lead?.type !== "text") return { kind: "quote", children: blocks(node.children, ctx) };
  const rest = lead.value.slice(match[0].length);
  const paragraph = { ...first, children: [...(rest ? [{ ...lead, value: rest }] : []), ...first.children.slice(1)] };
  // A line break right after the marker would start the text with an empty line.
  if (paragraph.children[0]?.type === "break") paragraph.children.shift();
  const children = blocks([...(paragraph.children.length ? [paragraph] : []), ...node.children.slice(1)], ctx);
  return { kind: "admonition", tone: ALERTS[match[1]!.toUpperCase()]!, children };
}

function table(node: MdTable, ctx: Ctx): Block {
  const rows = node.children.map(row => row.children.map(cell => {
    const children = inlines(cell.children, ctx);
    return children.length ? [{ kind: "paragraph" as const, children }] : [];
  }));
  return { kind: "table", head: rows.slice(0, 1), rows: rows.slice(1) };
}

function inlines(nodes: PhrasingContent[], ctx: Ctx): Inline[] {
  const out: Inline[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    switch (node.type) {
      case "text": if (node.value) out.push({ kind: "text", text: node.value }); break;
      case "inlineCode": out.push({ kind: "code", text: node.value }); break;
      case "emphasis": out.push({ kind: "emphasis", children: inlines(node.children, ctx) }); break;
      case "strong": out.push({ kind: "strong", children: inlines(node.children, ctx) }); break;
      case "delete": out.push({ kind: "strikethrough", children: inlines(node.children, ctx) }); break;
      case "break": out.push({ kind: "break" }); break;
      case "link": out.push(link(node.url, node.children, lineOf(node), ctx)); break;
      case "linkReference": {
        const def = ctx.defs.get(node.identifier.toLowerCase());
        out.push(def ? link(def.url, node.children, lineOf(node), ctx) : { kind: "text", text: phrasingText(node.children) });
        break;
      }
      case "image": out.push(ctx.image(node.url, node.alt ?? "", node.title, lineOf(node))); break;
      case "imageReference": {
        const def = ctx.defs.get(node.identifier.toLowerCase());
        out.push(def ? ctx.image(def.url, node.alt ?? "", def.title, lineOf(node)) : { kind: "text", text: node.alt ?? "" });
        break;
      }
      case "footnoteReference":
        ctx.report(ctx.page.path, lineOf(node), "error", "footnotes are not supported; put the note in the text or in a callout");
        out.push({ kind: "text", text: `[^${node.label ?? node.identifier}]` });
        break;
      case "html": {
        const html = withoutComments(node.value);
        if (!html.trim()) break;
        // An element written inline arrives as an opening tag, its content and a closing tag: kept together, so the
        // sanitizer sees the element whole.
        const open = /^<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>$/s.exec(html.trim());
        const name = open?.[1]!.toLowerCase();
        const close = name && !VOID_TAGS.has(name) && !html.trim().endsWith("/>") ? closing(nodes, i, name) : -1;
        if (close > i) {
          const inner = nodes.slice(i + 1, close);
          out.push({ kind: "raw", html: html + serialize(inner) + (nodes[close] as Html).value, text: phrasingText(inner) });
          i = close;
        } else {
          out.push({ kind: "raw", html, text: htmlText(html) });
        }
        break;
      }
    }
  }
  return out;
}

function link(url: string, children: PhrasingContent[], line: number, ctx: Ctx): Link {
  const node: Link = { kind: "link", children: inlines(children, ctx) };
  ctx.pending.push({ link: node, url, page: ctx.page, line });
  return node;
}

/** The index of the html node that closes the element opened at `at`, or -1. */
function closing(nodes: PhrasingContent[], at: number, name: string): number {
  let depth = 0;
  for (let j = at + 1; j < nodes.length; j++) {
    const node = nodes[j]!;
    if (node.type !== "html") continue;
    const value = node.value.trim();
    if (new RegExp(`^<${name}\\b[^>]*[^/]>$|^<${name}>$`, "i").test(value)) depth++;
    else if (new RegExp(`^</${name}\\s*>$`, "i").test(value)) {
      if (depth === 0) return j;
      depth--;
    }
  }
  return -1;
}

/** Phrasing content inside raw HTML, as HTML for the sanitizer: text escaped, URLs only when absolute and safe. */
function serialize(nodes: PhrasingContent[]): string {
  return nodes.map(node => {
    switch (node.type) {
      case "text": return escapeHtml(node.value);
      case "inlineCode": return `<code>${escapeHtml(node.value)}</code>`;
      case "emphasis": return `<em>${serialize(node.children)}</em>`;
      case "strong": return `<strong>${serialize(node.children)}</strong>`;
      case "delete": return `<s>${serialize(node.children)}</s>`;
      case "break": return "<br>";
      case "html": return withoutComments(node.value);
      case "link": {
        const safe = /^[a-z][a-z0-9+.-]*:/i.test(node.url) ? safeUrl(node.url) : undefined;
        return safe ? `<a href="${escapeHtml(safe).replace(/"/g, "&quot;")}">${serialize(node.children)}</a>` : serialize(node.children);
      }
      case "linkReference": return serialize(node.children);
      case "image":
      case "imageReference": return escapeHtml(node.alt ?? "");
      default: return "";
    }
  }).join("");
}

function phrasingText(nodes: PhrasingContent[]): string {
  return nodes.map(node => {
    switch (node.type) {
      case "text":
      case "inlineCode": return node.value;
      case "html": return htmlText(node.value);
      case "break": return " ";
      case "image":
      case "imageReference": return node.alt ?? "";
      case "footnoteReference": return "";
      default: return phrasingText(node.children);
    }
  }).join("");
}

function withoutComments(html: string): string {
  return html.replace(/<!--[\s\S]*?(?:-->|$)/g, "");
}

/** The text of an HTML fragment, as the sanitizer reads it, for Markdown twins and search. */
function htmlText(html: string): string {
  return tokenize(html).map(t => (t.kind === "text" ? t.text : "")).join("").replace(/\s+/g, " ").trim();
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---- Links.

type Located =
  | { kind: "absolute" }
  | { kind: "suite"; path: string; fragment?: string }
  | { kind: "outside"; path: string; fragment?: string };

/** Where a URL written in a page points: an absolute URL, a path in the suite, or a path outside it. */
function classify(url: string, from: string): Located {
  // A browser drops leading controls and spaces, and tabs and newlines anywhere, before it reads a scheme: so does this.
  // eslint-disable-next-line no-control-regex
  const bare = url.replace(/^[\u0000- ]+/, "").replace(/[\t\n\r]/g, "");
  if (/^[a-z][a-z0-9+.-]*:/i.test(bare) || bare.startsWith("//") || bare.startsWith("/") || bare.startsWith("\\")) return { kind: "absolute" };
  const hash = url.indexOf("#");
  const fragment = hash < 0 ? undefined : decode(url.slice(hash + 1));
  const rest = (hash < 0 ? url : url.slice(0, hash)).replace(/\?.*$/, "");
  if (rest === "") return { kind: "suite", path: from, ...(fragment !== undefined ? { fragment } : {}) };
  const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  const joined = normalizePath(dir + decode(rest), true) ?? "";
  const located = { path: joined + (rest.endsWith("/") && joined && !joined.endsWith("/") ? "/" : ""), ...(fragment !== undefined ? { fragment } : {}) };
  return joined.startsWith("../") || joined === ".." ? { kind: "outside", ...located } : { kind: "suite", ...located };
}

/** A link that leaves the suite, through the first mapping whose prefix it starts with (the longest prefix first). */
export function mapLink(path: string, fragment: string | undefined, mappings: LinkMapping[] | undefined): string | undefined {
  const mapping = [...(mappings ?? [])].sort((a, b) => b.prefix.length - a.prefix.length).find(m => path === m.prefix.replace(/\/$/, "") || path.startsWith(m.prefix));
  if (!mapping) return undefined;
  let rest = path.slice(mapping.prefix.length).replace(/^\//, "");
  if (/\.md$/i.test(rest)) {
    const segments = rest.slice(0, -3).split("/").map(s => slugify(s) || "page");
    rest = segments.join("/") === "index" ? "index.html" : `${SUITE_FILES}${segments.join("/")}.html`;
  } else if (rest === "" || rest.endsWith("/")) {
    rest += "index.html";
  }
  const url = mapping.target + (mapping.target === "" || mapping.target.endsWith("/") ? "" : "/") + rest + (fragment ? `#${encodeURIComponent(fragment)}` : "");
  return safeUrl(url) ? url : undefined;
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** A path with "." and ".." segments resolved and / separators; keepUp keeps leading ".." segments, else undefined for them. */
function normalizePath(path: string, keepUp = false): string | undefined {
  const out: string[] = [];
  for (const segment of path.replace(/\\/g, "/").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (out.length && out[out.length - 1] !== "..") out.pop();
      else if (keepUp) out.push("..");
      else return undefined;
    } else out.push(segment);
  }
  return out.join("/");
}

/** Every spelling of a fragment that names a heading: the renderer's anchor, the author's {#id}, GitHub's slug. */
function fragments(body: Block[]): Map<string, string> {
  const { anchors } = guideAnchors(body, SHELL_IDS);
  const map = new Map<string, string>();
  const github = new Map<string, number>();
  for (const [heading, anchor] of anchors) {
    const text = inlineText(heading.children);
    let slug = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "").replace(/ /g, "-");
    const seen = github.get(slug) ?? 0;
    github.set(slug, seen + 1);
    if (seen) slug = `${slug}-${seen}`;
    for (const key of [anchor, slug, (heading as Heading).anchor]) if (key && !map.has(key)) map.set(key, anchor);
  }
  return map;
}

// ---- Order and groups.

/**
 * Pages in reading order, each with its group: the root's index.md (the overview), the root's other pages, then
 * each directory as a group: its index.md first, its pages, then its subdirectories as groups of their own, named
 * "Parent › Child". Pages sort by sidebar.order, then by file name; directories by their index's sidebar.order,
 * then by name. Only included pages count, but a draft index still names its directory's group.
 */
function order(pages: Map<string, Page>, report: (file: string, line: number, severity: Diagnostic["severity"], message: string) => void): { page: Page; group?: string }[] {
  const included = [...pages.values()].filter(p => p.included);
  const dirs = new Set<string>();
  for (const page of included) {
    const parts = page.dir ? page.dir.split("/") : [];
    for (let n = 1; n <= parts.length; n++) dirs.add(parts.slice(0, n).join("/"));
  }
  const rank = (o: number | undefined) => (o === undefined ? Infinity : o);
  const byOrder = (a: { order?: number; name: string }, b: { order?: number; name: string }) => rank(a.order) - rank(b.order) || compare(a.name, b.name);
  const out: { page: Page; group?: string }[] = [];
  const emit = (dir: string, group: string | undefined) => {
    const index = pages.get(dir ? `${dir}/index.md` : "index.md");
    if (index?.included) out.push({ page: index, ...(group ? { group } : {}) });
    const own = included.filter(p => p.dir === dir && !p.isIndex).map(p => ({ page: p, order: p.fm.order, name: p.name })).sort(byOrder);
    for (const { page } of own) out.push({ page, ...(group ? { group } : {}) });
    const children = [...dirs].filter(d => (dir ? d.startsWith(`${dir}/`) && !d.slice(dir.length + 1).includes("/") : !d.includes("/")));
    const named = children.map(d => {
      const childIndex = pages.get(`${d}/index.md`);
      const name = d.slice(d.lastIndexOf("/") + 1);
      if (!childIndex) report(`${d}/`, 1, "warning", `the directory has no index.md to introduce it and name its group; the group is named ${JSON.stringify(titleCase(name))}`);
      return { dir: d, name, order: childIndex?.fm.order, title: childIndex?.fm.title ?? titleCase(name) };
    }).sort(byOrder);
    for (const child of named) emit(child.dir, group ? `${group} › ${child.title}` : child.title);
  };
  emit("", undefined);
  return out;
}

function guide(page: Page, group: string | undefined, options: ImportOptions): Guide {
  const title = page.fm.title ?? titleCase(page.name === "index" ? page.dir.split("/").pop() || "Overview" : page.name);
  // A directory's index is its group's first entry: "Overview" in the navigator unless sidebar.label says otherwise.
  const navTitle = page.fm.label ?? (page.isIndex ? "Overview" : undefined);
  const root = options.sourceRoot?.replace(/\/+$/, "");
  return {
    id: page.id,
    slug: page.slug,
    title,
    ...(navTitle && navTitle !== title ? { navTitle } : {}),
    ...(page.fm.description ? { summary: [{ kind: "text" as const, text: page.fm.description }] } : {}),
    ...(group ? { group } : {}),
    ...(page.blocks?.length ? { body: page.blocks } : {}),
    source: { path: root ? `${root}/${page.path}` : page.path, line: 1 },
  };
}

function titleCase(name: string): string {
  const words = name.replace(/[-_]+/g, " ").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : name;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
