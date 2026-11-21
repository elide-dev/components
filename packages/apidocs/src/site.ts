/**
 * The site's structure, computed once per render: every page's path, where
 * each model id lands, and the relative links between pages. Pages are named by
 * their path without an extension ("fixture/java/Shape"); the HTML page adds
 * ".html" and its Markdown twin ".md". Every link is relative and names its
 * file, so the output works from file://, from any path prefix and inside a jar.
 */
import type { Guide, Heading, Member, Model, Package, Ref, Token, Type } from "./model";
import { guideAnchors, type GuideSection, inlineText, slugify } from "./structure";
import { safeUrl } from "./url";

/** Where an id lands: its page and, for a member, the anchor on that page. */
export interface Target {
  page: string;
  anchor?: string;
  label: string;
}

export interface TypeEntry {
  type: Type;
  pkg: Package;
  page: string;
  /** Nested types, in name order. */
  nested: Type[];
  /** Types in this model that extend or implement this one. */
  subtypes: Type[];
}

/** A guide with its page, its sections and the anchors of its headings. */
export interface GuideEntry {
  guide: Guide;
  page: string;
  /** The group it is listed under, or undefined. */
  group: string | undefined;
  sections: GuideSection[];
  anchors: Map<Heading, string>;
}

export interface Site {
  model: Model;
  packages: Package[];
  types: Map<string, TypeEntry>;
  targets: Map<string, Target>;
  /** Guides in reading order: ungrouped first, then by group (see orderGuides). */
  guides: GuideEntry[];
  /** The default language for code blocks: the module's first. */
  language: string;
}

export const INDEX = "index";

export function packagePage(pkg: Package): string {
  return pkg.name ? `${pkg.name.split(".").join("/")}/index` : "default-package/index";
}

export function typePage(pkg: Package, type: Type): string {
  return `${packagePage(pkg).slice(0, -"index".length)}${type.name}`;
}

export function buildSite(model: Model): Site {
  const packages = model.packages ?? [];
  const types = new Map<string, TypeEntry>();
  const targets = new Map<string, Target>();
  for (const pkg of packages) {
    targets.set(pkg.id, { page: packagePage(pkg), label: pkg.name || "(default package)" });
    for (const type of pkg.types ?? []) {
      const page = typePage(pkg, type);
      types.set(type.id, { type, pkg, page, nested: [], subtypes: [] });
      targets.set(type.id, { page, label: type.name });
      for (const member of type.members ?? []) {
        targets.set(member.id, { page, anchor: member.anchor, label: memberLabel(member) });
      }
    }
    for (const fn of [...(pkg.functions ?? []), ...(pkg.properties ?? [])]) {
      targets.set(fn.id, { page: packagePage(pkg), anchor: fn.anchor, label: memberLabel(fn) });
    }
    for (const alias of pkg.typeAliases ?? []) {
      targets.set(alias.id, { page: packagePage(pkg), anchor: alias.name, label: alias.name });
    }
  }
  const guides = guideEntries(model.module.guides, targets, model.module.overview);
  for (const entry of types.values()) {
    const outer = entry.type.enclosing && types.get(entry.type.enclosing);
    if (outer) outer.nested.push(entry.type);
    const supers = [entry.type.superclass, ...(entry.type.interfaces ?? [])];
    for (const tokens of supers) {
      const ref = tokens?.find(t => t.kind === "type")?.ref;
      const parent = ref && types.get(ref);
      if (parent) parent.subtypes.push(entry.type);
    }
  }
  return { model, packages, types, targets, guides, language: model.module.languages?.[0] ?? "java" };
}

// ---- Guides.

/** Ids the page shell uses; a guide heading never takes one of them. */
export const SHELL_IDS = [
  "content", "apidocs-nav", "apidocs-nav-toggle", "apidocs-nav-filter", "apidocs-search", "apidocs-results", "apidocs-toc-filter",
  "guide-body", "guides", "packages", "all-types",
];

/**
 * Guides in reading order: ungrouped guides first, then each group in the order of its first guide in the
 * model. Inside each, guides with an order come first, lowest first; the rest keep the model's order.
 */
export function orderGuides(guides: Guide[] | undefined): Guide[] {
  const groups = new Map<string | undefined, Guide[]>([[undefined, []]]);
  for (const guide of guides ?? []) {
    const key = guide.group || undefined;
    let list = groups.get(key);
    if (!list) groups.set(key, (list = []));
    list.push(guide);
  }
  const rank = (g: Guide) => (typeof g.order === "number" && Number.isFinite(g.order) ? g.order : Infinity);
  return [...groups.values()].flatMap(list => list.map((g, i) => [g, i] as const).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([g]) => g));
}

/**
 * The page path of a guide. The slug is untrusted (it becomes a file path), so each segment is slugified,
 * empty and dot segments are dropped, and a slug with nothing left falls back to the id.
 */
export function guidePage(guide: Guide): string {
  const segments = guide.slug.split("/").map(slugify).filter(Boolean);
  if (!segments.length) segments.push(slugify(guide.id) || "guide");
  return `guides/${segments.join("/")}`;
}

function guideEntries(guides: Guide[] | undefined, targets: Map<string, Target>, overview: string | undefined): GuideEntry[] {
  if (!guides?.length) return [];
  // Pages already taken, compared without case as a case-insensitive file system would.
  const taken = new Set([...targets.values()].map(t => t.page.toLowerCase()));
  const entries: GuideEntry[] = [];
  let overviewPlaced = false;
  for (const guide of orderGuides(guides)) {
    // The overview guide is the index page itself; only the first guide with that id takes it.
    const isOverview: boolean = !overviewPlaced && overview !== undefined && guide.id === overview;
    overviewPlaced ||= isOverview;
    const base = isOverview ? INDEX : guidePage(guide);
    let page = base;
    if (!isOverview) for (let n = 2; taken.has(page.toLowerCase()); n++) page = `${base}-${n}`;
    taken.add(page.toLowerCase());
    const { anchors, sections } = guideAnchors(guide.body, SHELL_IDS);
    entries.push({ guide, page, group: guide.group || undefined, sections, anchors });
    // A declaration with the same id keeps it, and so does an earlier guide.
    if (!targets.has(guide.id)) targets.set(guide.id, { page, label: guide.title });
  }
  return entries;
}

/** The guide that is the overview page (index.html), when the model names one. */
export function overviewGuide(site: Site): GuideEntry | undefined {
  return site.guides.find(entry => entry.page === INDEX);
}

/** One guide in a list, linked from a page. */
export interface GuideLink {
  id: string;
  title: string;
  /** The navigator's label: the guide's navTitle, else its title. */
  label: string;
  /** The link from the page the list is on. */
  href: string;
  /** The guide's summary as plain text, or empty. */
  summary: string;
  /** Whether this is the page being rendered. */
  current: boolean;
}

export interface GuideGroup {
  /** The group's name; undefined for the ungrouped guides, which come first. */
  title: string | undefined;
  guides: GuideLink[];
}

/** What a navigator or an overview shows of the guides, from a page: groups in reading order, and the neighbors of the current guide. */
export interface GuideNav {
  groups: GuideGroup[];
  /** The current page's guide, when the page is a guide. */
  current?: GuideLink;
  prev?: GuideLink;
  next?: GuideLink;
}

/** The guides as seen from a page, for the navigator, the overview and the previous and next links. Empty groups when the model has no guides. */
export function guideNav(site: Site, page: string): GuideNav {
  const link = (entry: GuideEntry): GuideLink => ({
    id: entry.guide.id,
    title: entry.guide.title,
    label: entry.guide.navTitle || entry.guide.title,
    href: relative(page, entry.page, ".html"),
    summary: inlineSummary(entry.guide),
    current: entry.page === page,
  });
  const groups: GuideGroup[] = [];
  for (const entry of site.guides) {
    const last = groups[groups.length - 1];
    if (last && last.title === entry.group) last.guides.push(link(entry));
    else groups.push({ title: entry.group, guides: [link(entry)] });
  }
  const at = site.guides.findIndex(entry => entry.page === page);
  if (at < 0) return { groups };
  const prev = site.guides[at - 1];
  const next = site.guides[at + 1];
  return { groups, current: link(site.guides[at]!), ...(prev ? { prev: link(prev) } : {}), ...(next ? { next: link(next) } : {}) };
}

/**
 * A guide's breadcrumbs: the module, its group, itself. A group crumb links to the group's first guide when that
 * guide has the group's title (a section's introduction, as a Markdown suite's index.md is); on that guide the
 * group crumb is left out. Ungrouped guides sit under "Guides" beside an API reference; on a guides-only site
 * they sit right under the module. The overview guide has none.
 */
export function guideCrumbs(site: Site, entry: GuideEntry): { label: string; page?: string }[] {
  if (entry.page === INDEX) return [];
  const m = site.model.module;
  const self = { label: entry.guide.title };
  if (!entry.group) return site.packages.length > 0 ? [{ label: m.name, page: INDEX }, { label: "Guides" }, self] : [{ label: m.name, page: INDEX }, self];
  const first = site.guides.find(other => other.group === entry.group);
  const intro = first && first.guide.title === entry.group ? first : undefined;
  if (intro === entry) return [{ label: m.name, page: INDEX }, self];
  return [{ label: m.name, page: INDEX }, intro ? { label: entry.group, page: intro.page } : { label: entry.group }, self];
}

function inlineSummary(guide: Guide): string {
  return inlineText(guide.summary).replace(/\s+/g, " ").trim();
}

function memberLabel(member: Member): string {
  return member.kind === "constructor" || member.kind === "method" || member.kind === "annotationElement" || member.kind === "function"
    ? `${member.name}()`
    : member.name;
}

/** The path from one page's directory to the site root: "../../". */
export function rootOf(page: string): string {
  return "../".repeat(page.split("/").length - 1);
}

/** A relative link from one page to another page's file. */
export function relative(from: string, to: string, ext: string): string {
  const fromDirs = from.split("/").slice(0, -1);
  const toParts = to.split("/");
  let common = 0;
  while (common < fromDirs.length && common < toParts.length - 1 && fromDirs[common] === toParts[common]) common++;
  return "../".repeat(fromDirs.length - common) + toParts.slice(common).join("/") + ext;
}

/** An anchor as a URL fragment, escaped as the JDK doclet escapes it. */
export function fragment(anchor: string): string {
  return anchor.replace(/[<> "%]/g, c => encodeURIComponent(c));
}

export function isAbsolute(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url);
}

/**
 * Where a reference to id (with an external url) points from a page, or
 * undefined when it resolves nowhere and should render as plain code.
 */
export function resolve(site: Site, from: string, ext: string, id: string | undefined, url?: string, section?: string): string | undefined {
  if (id) {
    const target = site.targets.get(id);
    if (target) {
      const file = relative(from, target.page, ext);
      if (section) return `${file}#${encodeURIComponent(section)}`;
      return target.anchor ? `${file}#${fragment(target.anchor)}` : file;
    }
  }
  const safe = safeUrl(url);
  if (safe) return isAbsolute(safe) || safe.startsWith("//") ? safe : rootOf(from) + safe;
  return undefined;
}

export function resolveRef(site: Site, from: string, ext: string, ref: Ref): string | undefined {
  return resolve(site, from, ext, ref.id, ref.url, ref.section);
}

export function resolveToken(site: Site, from: string, ext: string, token: Token): string | undefined {
  return token.ref || token.url ? resolve(site, from, ext, token.ref, token.url) : undefined;
}

/** A reference's text: its own, the target's label, or the id's last segment. */
export function refLabel(site: Site, ref: Ref): string {
  if (ref.text) return ref.text;
  const target = site.targets.get(ref.id);
  if (target && ref.section) {
    const section = site.guides.find(g => g.page === target.page)?.sections.find(s => s.anchor === ref.section);
    if (section) return section.text;
  }
  if (target) return target.label;
  const tail = ref.id.split("#").pop()!;
  return tail.slice(tail.lastIndexOf(".", tail.indexOf("(") < 0 ? tail.length : tail.indexOf("(")) + 1).replace(/\$/g, ".");
}

/** Whether a type is an exception: its superclass chain reaches java.lang.Throwable. */
export function isThrowable(type: Type): boolean {
  return (type.ancestors ?? []).some(a => a.id === "java.lang.Throwable") || type.id === "java.lang.Throwable";
}

/** Tokens as plain text. */
export function tokenText(tokens: Token[] | undefined): string {
  return (tokens ?? []).map(t => t.text).join("");
}

// ---- Index pages (src/indexes.tsx): Javadoc's package, all-types, A-Z and deprecated lists, each written only when
// it has content.

export const PACKAGES_PAGE = "packages";
export const TYPES_PAGE = "types";
export const INDEX_ALL_PAGE = "index-all";
export const DEPRECATED_PAGE = "deprecated";

/** Whether anything in the model is deprecated: a package, a type, a member or a top-level declaration. */
export function hasDeprecated(site: Site): boolean {
  return site.packages.some(pkg =>
    !!pkg.deprecated ||
    (pkg.types ?? []).some(t => !!t.deprecated || (t.members ?? []).some(m => !!m.deprecated)) ||
    [...(pkg.functions ?? []), ...(pkg.properties ?? [])].some(m => !!m.deprecated) ||
    (pkg.typeAliases ?? []).some(a => !!a.deprecated));
}

/** The index pages this site has, in the order a top bar lists them. */
export function indexPages(site: Site): { page: string; label: string }[] {
  const types = site.types.size > 0;
  const declarations = types || site.packages.some(p => (p.functions?.length ?? 0) + (p.properties?.length ?? 0) + (p.typeAliases?.length ?? 0) > 0);
  return [
    ...(site.packages.length > 0 ? [{ page: PACKAGES_PAGE, label: "Packages" }] : []),
    ...(types ? [{ page: TYPES_PAGE, label: "All types" }] : []),
    // A guides-only site has no declarations to index: its navigator and search list the guides.
    ...(declarations || (site.guides.length > 0 && site.packages.length > 0) ? [{ page: INDEX_ALL_PAGE, label: "Index" }] : []),
    ...(hasDeprecated(site) ? [{ page: DEPRECATED_PAGE, label: "Deprecated" }] : []),
  ];
}
