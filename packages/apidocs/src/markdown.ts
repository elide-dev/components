/**
 * Markdown twins of the HTML pages: the same sections in the same order
 * (signature, description, parameters, returns, throws, notes, see also), with
 * links to the other Markdown files. Written for agents and plain-text readers.
 */
import type { AdmonitionTone, Block, Inline, Member, Package, Param, Thrown, Token, Type } from "./model";
import { deprecatedGroups, guideEntries as guideEntriesForIndex, type IndexEntry, letterGroups, packageRows, typeRows } from "./index-data";
import { DEPRECATED_PAGE, INDEX_ALL_PAGE, PACKAGES_PAGE, TYPES_PAGE } from "./site";
import { type GuideEntry, guideCrumbs, guideNav, INDEX, isThrowable, overviewGuide, packagePage, refLabel, relative, resolve, resolveRef, Site, tokenText, typePage } from "./site";
import { type SymbolKey, type SymbolMode, typeSymbolKey, withSym } from "./symbols";
import { NOTE_LABEL, sortedNotes } from "./components/declaration";
import { markdownDestination, safeUrl } from "./url";
import { ADMONITION_LABEL, inlineText, memberGroups, memberTitle, summaryText, typeGroups, typeKindWord } from "./structure";

interface Md {
  site: Site;
  page: string;
  language: string;
  /** The theme's symbol set; "none" writes exactly the text without symbols. */
  symbols: SymbolMode;
}

const dest = markdownDestination;

function esc(text: string): string {
  return text.replace(/([\\`*_[\]<>|])/g, "\\$1");
}

function codeSpan(text: string): string {
  const ticks = "`".repeat(Math.max(1, ...[...text.matchAll(/`+/g)].map(m => m[0].length + 1)));
  const pad = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return `${ticks}${pad}${text}${pad}${ticks}`;
}

function fence(code: string, language: string | undefined): string {
  const ticks = "`".repeat(Math.max(3, ...[...code.matchAll(/`{3,}/g)].map(m => m[0].length + 1)));
  return `${ticks}${language ?? ""}\n${code}\n${ticks}`;
}

function inlines(md: Md, nodes: Inline[] | undefined): string {
  return (nodes ?? []).map(node => {
    switch (node.kind) {
      case "text": return esc(node.text);
      case "code": return codeSpan(node.text);
      case "emphasis": return `*${inlines(md, node.children)}*`;
      case "strong": return `**${inlines(md, node.children)}**`;
      case "break": return "  \n";
      case "raw": return esc(node.text);
      case "strikethrough": return `~~${inlines(md, node.children)}~~`;
      case "check": return node.checked ? "[x] " : "[ ] ";
      case "image": {
        // An unsafe source keeps the alternative text, as the HTML page does.
        const src = resolve(md.site, md.page, ".md", undefined, node.src);
        return src ? `![${esc(node.alt)}](${markdownDestination(src)})` : esc(node.alt);
      }
      case "link": {
        const label = node.code
          ? codeSpan(plain(node.children))
          : inlines(md, node.children);
        const href = node.target ? resolveRef(md.site, md.page, ".md", node.target) : safeUrl(node.url);
        return href ? `[${label}](${markdownDestination(href)})` : label;
      }
    }
  }).join("");
}

function plain(nodes: Inline[] | undefined): string {
  return (nodes ?? []).map(n => (n.kind === "text" || n.kind === "code" || n.kind === "raw" ? n.text : n.kind === "break" ? " " : n.kind === "image" ? n.alt : n.kind === "check" ? "" : plain(n.children))).join("");
}

function blocks(md: Md, nodes: Block[] | undefined, depth = 3): string {
  return (nodes ?? []).map(node => block(md, node, depth)).filter(Boolean).join("\n\n");
}

function block(md: Md, node: Block, depth: number): string {
  switch (node.kind) {
    case "paragraph": return inlines(md, node.children);
    case "heading": return `${"#".repeat(Math.min(6, Math.max(2, node.level) + depth - 2))} ${inlines(md, node.children)}`;
    case "code": return fence(node.text, node.language ?? md.language);
    case "raw": return esc(node.text);
    case "quote": return blocks(md, node.children, depth).split("\n").map(l => `> ${l}`).join("\n");
    case "admonition": {
      // GitHub's alert syntax for the five general tones; a bold label for the API note kinds.
      const alert = GITHUB_ALERT[node.tone];
      const title = node.title?.length ? `**${inlines(md, node.title)}**` : "";
      const label = title || (alert ? "" : `**${withSym(md.symbols, node.tone as SymbolKey, ADMONITION_LABEL[node.tone])}**`);
      const text = [label, blocks(md, node.children, depth)].filter(Boolean).join("\n\n");
      return (alert ? `[!${alert}]\n${text}` : text).split("\n").map(l => (l ? `> ${l}` : ">")).join("\n");
    }
    case "list": return (node.items ?? []).map((item, i) => {
      const bullet = node.ordered ? `${i + 1}. ` : "- ";
      return bullet + blocks(md, item, depth).split("\n").join("\n" + " ".repeat(bullet.length));
    }).join("\n");
    case "table": {
      const cell = (b: Block[]) => blocks(md, b, depth).replace(/\n+/g, " ").replace(/\|/g, "\\|");
      const head = node.head?.[0] ?? (node.rows?.[0]?.map(() => []) ?? []);
      const lines = [`| ${head.map(cell).join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`];
      for (const row of node.rows ?? []) lines.push(`| ${row.map(cell).join(" | ")} |`);
      const caption = node.caption?.length ? `${inlines(md, node.caption)}\n\n` : "";
      return caption + lines.join("\n");
    }
  }
}

const GITHUB_ALERT: Partial<Record<AdmonitionTone, string>> = {
  note: "NOTE", tip: "TIP", important: "IMPORTANT", warning: "WARNING", caution: "CAUTION",
};

function tokens(md: Md, list: Token[] | undefined): string {
  // Type names link inside code spans as separate spans: [`List`](..)`<`[`String`](..)`>`.
  const parts: string[] = [];
  let buffer = "";
  for (const token of list ?? []) {
    const href = token.kind === "type" || token.kind === "annotation" ? resolve(md.site, md.page, ".md", token.ref, token.url) : undefined;
    if (href) {
      if (buffer) parts.push(codeSpan(buffer));
      buffer = "";
      parts.push(`[${codeSpan(token.text)}](${markdownDestination(href)})`);
    } else {
      buffer += token.text;
    }
  }
  if (buffer) parts.push(codeSpan(buffer));
  return parts.join("");
}

function signature(md: Md, list: Token[], annotations?: Token[][]): string {
  const lines = [...(annotations ?? []).map(tokenText), tokenText(list)];
  return fence(lines.join("\n"), md.language);
}

function nullness(n: string | undefined): string {
  return n === "nullable" ? " (nullable)" : n === "nonNull" ? " (non-null)" : "";
}

function paramList(md: Md, title: string, params: Param[] | undefined): string {
  if (!params?.length) return "";
  return `**${title}**\n\n` + params.map(p =>
    `- ${codeSpan(p.name)}${p.type.length ? ` ${tokens(md, p.type)}` : ""}${p.defaultValue ? ` = ${codeSpan(p.defaultValue)}` : ""}${nullness(p.nullness)}: ${oneLine(md, p.doc)}`).join("\n");
}

function oneLine(md: Md, doc: Block[] | undefined): string {
  const text = blocks(md, doc, 4);
  return text ? text.replace(/\n\n/g, " ") : "No description.";
}

function throwsList(md: Md, list: Thrown[] | undefined): string {
  if (!list?.length) return "";
  return `**${withSym(md.symbols, "throws", "Throws")}**\n\n` + list.map(t => `- ${tokens(md, t.type)}${t.declared ? "" : " (unchecked)"}: ${oneLine(md, t.doc)}`).join("\n");
}

function notes(md: Md, list: import("./model").Note[] | undefined): string {
  return sortedNotes(list).map(note => {
    const body = blocks(md, note.body, 4).split("\n").map(l => `> ${l}`).join("\n");
    return `> **${withSym(md.symbols, note.kind, NOTE_LABEL[note.kind])}**\n>\n${body}`;
  }).join("\n\n");
}

function see(md: Md, list: Inline[][] | undefined): string {
  if (!list?.length) return "";
  return "**See also**\n\n" + list.map(entry => `- ${inlines(md, entry)}`).join("\n");
}

function deprecation(md: Md, d: import("./model").Deprecation | undefined): string {
  if (!d) return "";
  const title = d.forRemoval ? "Deprecated for removal" : "Deprecated";
  const since = d.since ? ` since ${d.since}` : "";
  const body = blocks(md, d.doc, 4);
  return `> **${withSym(md.symbols, "deprecated", `${title}${since}`)}.**${body ? `\n>\n> ${body.replace(/\n/g, "\n> ")}` : ""}`;
}

function join(parts: string[]): string {
  return parts.filter(p => p && p.trim()).join("\n\n") + "\n";
}

export function indexMarkdown(site: Site, symbols: SymbolMode = "utf"): string {
  const md: Md = { site, page: INDEX, language: site.language, symbols };
  const m = site.model.module;
  const overview = overviewGuide(site);
  // An overview guide is the overview's text, as on the HTML page; the package lists follow when there are any.
  const parts = overview
    ? [guideMarkdown(site, overview, symbols).trimEnd()]
    : [`# ${withSym(symbols, "module", `${m.name}${m.version ? ` ${m.version}` : ""}`)}`, location(md, []), m.doc ? blocks(md, m.doc.body) : `${site.packages.length === 0 && site.guides.length > 0 ? "Documentation" : "API reference"} for ${esc(m.name)}.`];
  if (site.guides.length && !overview) parts.push(guideListMarkdown(site, INDEX));
  if (!site.packages.length && site.guides.length) return join(parts);
  parts.push("## Packages\n\n" + site.packages.map(pkg =>
    `- [${codeSpan(pkg.name)}](${dest(relative(INDEX, packagePage(pkg), ".md"))}): ${esc(summaryText(pkg.doc)) || "No description."}`).join("\n"));
  for (const pkg of site.packages) {
    parts.push(`## Types in ${codeSpan(pkg.name)}\n\n` + (pkg.types ?? []).map(type =>
      `- [${codeSpan(type.name)}](${dest(relative(INDEX, typePage(pkg, type), ".md"))}) (${typeKindWord(type)}): ${esc(summaryText(type.doc)) || "No description."}`).join("\n"));
  }
  return join(parts);
}

export function packageMarkdown(site: Site, pkg: Package, symbols: SymbolMode = "utf"): string {
  const page = packagePage(pkg);
  const md: Md = { site, page, language: site.language, symbols };
  const facts = [`Package in ${esc(site.model.module.name)}.`];
  if (pkg.since) facts.push(`Since ${esc(pkg.since)}.`);
  if (pkg.nullMarked) facts.push("Null-marked: types are non-null unless annotated.");
  const parts = [`# ${withSym(symbols, "package", pkg.name)}`, location(md, [{ label: site.model.module.name, page: INDEX }]), facts.join(" "), deprecation(md, pkg.deprecated), blocks(md, pkg.doc?.body), notes(md, pkg.doc?.notes), see(md, pkg.doc?.see)];
  for (const group of typeGroups((pkg.types ?? []).filter(t => !t.enclosing))) {
    parts.push(`## ${group.title}\n\n` + group.types.map(type =>
      `- [${codeSpan(type.name)}](${dest(relative(page, typePage(pkg, type), ".md"))}): ${esc(summaryText(type.doc)) || "No description."}`).join("\n"));
  }
  if (pkg.typeAliases?.length) {
    parts.push("## Type aliases");
    for (const alias of pkg.typeAliases) {
      parts.push([`### ${esc(alias.name)}`, signature(md, alias.signature), deprecation(md, alias.deprecated), blocks(md, alias.doc?.body, 4)].filter(Boolean).join("\n\n"));
    }
  }
  for (const [title, members] of [["Functions", pkg.functions], ["Properties", pkg.properties]] as const) {
    if (!members?.length) continue;
    parts.push(`## ${title}`);
    for (const member of members) parts.push(memberMarkdown(md, member));
  }
  if (!pkg.types?.length && !pkg.functions?.length && !pkg.properties?.length && !pkg.typeAliases?.length) {
    parts.push("This package declares nothing public.");
  }
  return join(parts);
}

export function typeMarkdown(site: Site, type: Type, symbols: SymbolMode = "utf"): string {
  const entry = site.types.get(type.id)!;
  const page = entry.page;
  const md: Md = { site, page, language: type.language, symbols };
  const facts = [`${capitalize(typeKindWord(type))} in [${codeSpan(entry.pkg.name)}](${dest(relative(page, packagePage(entry.pkg), ".md"))}).`];
  if (type.since) facts.push(`Since ${esc(type.since)}.`);
  if (type.nullMarked) facts.push("Null-marked: types are non-null unless annotated.");
  if (type.enclosing) facts.push(`Nested in [${codeSpan(refLabel(site, { id: type.enclosing }))}](${resolve(site, page, ".md", type.enclosing)}).`);
  const crumbs = [{ label: site.model.module.name, page: INDEX }, { label: entry.pkg.name, page: packagePage(entry.pkg) }];
  const parts = [`# ${withSym(symbols, typeSymbolKey(type.kind, isThrowable(type)), type.name)}`, location(md, crumbs), facts.join(" "), signature(md, type.signature, type.annotations)];
  if (type.ancestors?.length) {
    parts.push("Inheritance: " + [...type.ancestors].reverse().map(ref => link(md, ref)).join(" > ") + ` > ${codeSpan(type.name.split(".").pop()!)}`);
  }
  if (type.interfaces?.length) parts.push(`${type.kind === "interface" ? "Extends" : "Implements"}: ${type.interfaces.map(t => tokens(md, t)).join(", ")}`);
  if (type.permits?.length) parts.push(`Permitted subtypes: ${type.permits.map(r => link(md, r)).join(", ")}`);
  parts.push(deprecation(md, type.deprecated), blocks(md, type.doc?.body, 2));
  parts.push(paramList(md, "Record components", type.components));
  parts.push(paramList(md, "Type parameters", type.typeParams?.filter(p => p.doc?.length).map(p => ({ name: `<${p.name}>`, type: [], doc: p.doc }))));
  parts.push(notes(md, type.doc?.notes), see(md, type.doc?.see));
  if (entry.nested.length) {
    parts.push("## Nested types\n\n" + entry.nested.map(t =>
      `- [${codeSpan(t.name)}](${dest(relative(page, typePage(entry.pkg, t), ".md"))}) (${typeKindWord(t)}): ${esc(summaryText(t.doc)) || "No description."}`).join("\n"));
  }
  for (const group of memberGroups(type)) {
    parts.push(`## ${group.title}`);
    for (const member of group.members) parts.push(memberMarkdown(md, member));
  }
  if (type.inherited?.length) {
    parts.push("## Inherited members\n\n" + type.inherited.map(g =>
      `- From ${g.kind} ${link(md, g.from)}: ${(g.members ?? []).map(r => link(md, r)).join(", ")}`).join("\n"));
  }
  return join(parts);
}

function memberMarkdown(md: Md, member: Member): string {
  const title = memberTitle(member);
  const facts: string[] = [];
  if (member.since) facts.push(`Since ${esc(member.since)}.`);
  if (member.implicit) facts.push("Declared by the compiler.");
  const parts = [
    `### ${esc(title)}`,
    signature(md, member.signature, member.annotations),
    facts.join(" "),
    deprecation(md, member.deprecated),
    blocks(md, member.doc?.body, 4),
    member.doc?.inheritedFrom ? `Description copied from ${link(md, member.doc.inheritedFrom)}.` : "",
    paramList(md, "Type parameters", member.typeParams?.filter(p => p.doc?.length).map(p => ({ name: `<${p.name}>`, type: [], doc: p.doc }))),
    member.receiver ? `**Receiver** ${tokens(md, member.receiver.type)}${nullness(member.receiver.nullness)}: ${oneLine(md, member.receiver.doc)}` : "",
    paramList(md, "Parameters", member.params),
    member.returns ? `**${withSym(md.symbols, "returns", "Returns")}** ${tokens(md, member.returns.type)}${nullness(member.returns.nullness)}: ${oneLine(md, member.returns.doc)}` : "",
    (member.kind === "field" || member.kind === "property") && member.constant ? `Constant value: ${codeSpan(member.constant)}` : "",
    member.defaultValue ? `Default: ${codeSpan(member.defaultValue)}` : "",
    throwsList(md, member.throws),
    notes(md, member.doc?.notes),
    member.overrides ? `Overrides ${link(md, member.overrides)}.` : "",
    see(md, member.doc?.see),
  ];
  return parts.filter(p => p && p.trim()).join("\n\n");
}

function link(md: Md, ref: import("./model").Ref): string {
  const href = resolveRef(md.site, md.page, ".md", ref);
  const label = codeSpan(refLabel(md.site, ref));
  return href ? `[${label}](${markdownDestination(href)})` : label;
}

function capitalize(s: string): string {
  return s[0]!.toUpperCase() + s.slice(1);
}

// ---- Guides.

/**
 * The line under a page's title that says where the page sits, for a reader that lands on it alone: links up
 * to the module overview and the package, then llms.txt, the index of every page. On the overview, llms.txt
 * and llms-full.txt.
 */
function location(md: Md, crumbs: { label: string; page?: string }[]): string {
  const root = relative(md.page, INDEX, "").slice(0, -INDEX.length);
  const up = crumbs.map(c => (c.page ? `[${esc(c.label)}](${dest(relative(md.page, c.page, ".md"))})` : esc(c.label))).join(" › ");
  const index = md.page === INDEX
    ? `Every page: [llms.txt](${root}llms.txt), or all in one file: [llms-full.txt](${root}llms-full.txt)`
    : `Every page: [llms.txt](${root}llms.txt)`;
  return up ? `${up} · ${index}` : index;
}

/** The guides as a Markdown list from a page, grouped as the navigator groups them. */
function guideListMarkdown(site: Site, page: string): string {
  const lines = ["## Guides"];
  for (const group of guideNav(site, page).groups) {
    lines.push("", ...(group.title ? [`### ${esc(group.title)}`, ""] : []));
    for (const guide of site.guides.filter(g => g.group === group.title)) {
      const summary = esc(inlineText(guide.guide.summary).replace(/\s+/g, " ").trim());
      lines.push(`- [${esc(guide.guide.title)}](${dest(relative(page, guide.page, ".md"))})${summary ? `: ${summary}` : ""}`);
    }
  }
  return lines.join("\n");
}

/** A guide's Markdown twin: the title, where it belongs, the summary, the body, then the previous and next guides. */
export function guideMarkdown(site: Site, entry: GuideEntry, symbols: SymbolMode = "utf"): string {
  const md: Md = { site, page: entry.page, language: site.language, symbols };
  const g = entry.guide;
  // The same trail as the HTML page's breadcrumbs, without the page itself.
  const crumbs = guideCrumbs(site, entry).slice(0, -1);
  const parts = [`# ${withSym(symbols, entry.page === INDEX ? "module" : "guide", esc(g.title))}`, location(md, crumbs), g.summary?.length ? `*${inlines(md, g.summary)}*` : "", blocks(md, g.body, 2)];
  const nav = guideNav(site, entry.page);
  const pager = [
    nav.prev ? `Previous: [${esc(nav.prev.title)}](${dest(nav.prev.href.replace(/\.html$/, ".md"))})` : "",
    nav.next ? `Next: [${esc(nav.next.title)}](${dest(nav.next.href.replace(/\.html$/, ".md"))})` : "",
  ].filter(Boolean);
  if (pager.length) parts.push("---", pager.join("  \n"));
  return join(parts);
}

// ---- Index pages (src/indexes.tsx): the same lists as their HTML twins.

function indexMd(site: Site, page: string, symbols: SymbolMode): Md {
  return { site, page, language: site.language, symbols };
}

function entryLine(md: Md, entry: IndexEntry): string {
  const href = entry.page ? relative(md.page, entry.page, ".md") : resolve(md.site, md.page, ".md", entry.id);
  // A declaration's name is code; a guide's title is prose, escaped like any other text.
  const name = entry.page?.startsWith("guides/") ? esc(entry.name) : codeSpan(entry.name);
  const label = href ? `[${name}](${dest(href)})` : name;
  const removal = entry.deprecation ? (entry.deprecation.forRemoval ? " (deprecated for removal)" : " (deprecated)") : "";
  const summary = entry.summary?.length ? `: ${inlines(md, entry.summary)}` : "";
  return `- ${label}, ${esc(entry.where)}${removal}${summary}`;
}

export function packagesIndexMarkdown(site: Site, symbols: SymbolMode = "utf"): string {
  const md = indexMd(site, PACKAGES_PAGE, symbols);
  const lines = packageRows(site).map(({ pkg, counts }) =>
    `- [${codeSpan(pkg.name || "(default package)")}](${dest(relative(PACKAGES_PAGE, packagePage(pkg), ".md"))}) (${counts.map(c => `${c.count} ${c.word}`).join(", ") || "no types"})${pkg.doc?.summary?.length ? `: ${inlines(md, pkg.doc.summary)}` : ""}`);
  return join([`# Packages`, `Every package of ${esc(site.model.module.name)}.`, lines.join("\n")]);
}

export function typesIndexMarkdown(site: Site, symbols: SymbolMode = "utf"): string {
  const md = indexMd(site, TYPES_PAGE, symbols);
  return join([`# All types`, `Every type of ${esc(site.model.module.name)}, nested ones too, by name.`, typeRows(site).map(e => entryLine(md, e)).join("\n")]);
}

export function indexAllMarkdown(site: Site, symbols: SymbolMode = "utf"): string {
  const md = indexMd(site, INDEX_ALL_PAGE, symbols);
  const parts = [`# Index`, `Every declaration of ${esc(site.model.module.name)}, from A to Z.`];
  const guides = guideEntriesForIndex(site);
  if (guides.length) parts.push(`## Guides\n\n${guides.map(e => entryLine(md, e)).join("\n")}`);
  for (const group of letterGroups(site)) parts.push(`## ${group.letter}\n\n${group.entries.map(e => entryLine(md, e)).join("\n")}`);
  return join(parts);
}

export function deprecatedIndexMarkdown(site: Site, symbols: SymbolMode = "utf"): string {
  const md = indexMd(site, DEPRECATED_PAGE, symbols);
  const parts = [`# Deprecated`, `Everything deprecated in ${esc(site.model.module.name)}; what will be removed comes first.`];
  for (const group of deprecatedGroups(site)) {
    parts.push(`## ${group.title}\n\n` + group.entries.map(e => {
      const text = blocks(md, e.deprecation?.doc, 4).replace(/\n+/g, " ");
      return entryLine({ ...md }, { ...e, summary: undefined }) + (e.deprecation?.since ? ` Since ${esc(e.deprecation.since)}.` : "") + (text ? ` ${text}` : "");
    }).join("\n"));
  }
  return join(parts);
}
