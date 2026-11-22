/**
 * render(model, theme): the whole site as a map from path to content. A pure
 * function: no file, network, Node, Bun or DOM API, so any JavaScript runtime
 * can run the bundled form. Binary files (fonts, the stylesheet and client
 * script) are references to the renderer's assets directory, which the caller
 * copies: { asset: "apidocs.css" } means <assets>/apidocs.css.
 */
import { renderToString } from "preact-render-to-string";
import { DeprecatedPage, IndexAllPage, PackagesIndexPage, TypesIndexPage } from "./indexes";
import { Ctx, type PageContext } from "./context";
import { deprecatedIndexMarkdown, frontmatter, guideMarkdown, guideTwin, indexAllMarkdown, indexMarkdown, indexTwin, moduleTwin, NOT_FOUND, notFoundMarkdown, packageMarkdown, packagesIndexMarkdown, packageTwin, stripFrontmatter, typeMarkdown, typesIndexMarkdown, typeTwin } from "./markdown";
import type { Model } from "./model";
import { GuidePage } from "./narrative";
import { IndexPage, NotFoundPage, PackagePage, TypePage } from "./pages";
import { buildSite, DEPRECATED_PAGE, INDEX, INDEX_ALL_PAGE, indexPages, isThrowable, overviewGuide, PACKAGES_PAGE, packagePage, type Site, TYPES_PAGE, typePage } from "./site";
import { inlineText, summaryText, typeKindWord } from "./structure";
import { type SymbolKey, type SymbolMode, typeSymbolKey, withSym } from "./symbols";
import { resolveTheme, type Theme, type ThemeLink, themeCss } from "./theme";
import { safeUrl } from "./url";

export const SCHEMA = "apidocs/1";

/** A file the caller copies from the renderer's assets directory. */
export interface AssetRef {
  asset: string;
}

export type Output = Record<string, string | AssetRef>;

/** The renderer's own assets, copied into every site. */
const STATIC_ASSETS = ["apidocs.css", "apidocs.js"];

export function render(modelInput: Model | string, themeInput?: Theme | string): Output {
  const model: Model = typeof modelInput === "string" ? JSON.parse(modelInput) : modelInput;
  if (model.schema !== SCHEMA) throw new Error(`Expected an ${SCHEMA} model, got ${JSON.stringify(model.schema)}`);
  const theme = safeTheme(resolveTheme(typeof themeInput === "string" ? JSON.parse(themeInput) : themeInput));
  const site = buildSite(model);
  const out: Output = {};
  const pages: ListedPage[] = [];
  const symbols = theme.symbols ?? "utf";
  // A Markdown twin's canonical URL is its HTML page's, when the site's address is known.
  const canonical = (page: string) => (theme.baseUrl ? `${theme.baseUrl}${page}.html` : undefined);

  const html = (page: string, language: string, node: preact.VNode) => {
    const ctx: PageContext = { site, theme, page, language };
    out[`${page}.html`] = "<!doctype html>\n" + renderToString(<Ctx.Provider value={ctx}>{node}</Ctx.Provider>) + "\n";
  };

  html(INDEX, site.language, <IndexPage />);
  out[`${INDEX}.md`] = frontmatter(site, moduleTwin(site), canonical(INDEX)) + indexMarkdown(site, symbols);
  pages.push({ page: INDEX, title: `${model.module.name} overview`, summary: overviewSummary(site), symbol: "module" });
  // Guides come right after the overview in llms-full.txt: agents should read them before the reference. The
  // overview guide is the index page, already written.
  const guides: ListedPage[] = [];
  for (const entry of site.guides) {
    if (entry.page === INDEX) continue;
    html(entry.page, site.language, <GuidePage entry={entry} />);
    out[`${entry.page}.md`] = frontmatter(site, guideTwin(entry), canonical(entry.page)) + guideMarkdown(site, entry, symbols);
    guides.push({ page: entry.page, title: entry.guide.title, summary: oneLine(inlineText(entry.guide.summary)), symbol: "guide" });
  }
  for (const pkg of site.packages) {
    const page = packagePage(pkg);
    html(page, site.language, <PackagePage pkg={pkg} />);
    out[`${page}.md`] = frontmatter(site, packageTwin(pkg), canonical(page)) + packageMarkdown(site, pkg, symbols);
    pages.push({ page, title: `Package ${pkg.name}`, summary: summaryText(pkg.doc), symbol: "package" });
    for (const type of pkg.types ?? []) {
      const tpage = typePage(pkg, type);
      html(tpage, type.language, <TypePage type={type} />);
      out[`${tpage}.md`] = frontmatter(site, typeTwin(type), canonical(tpage)) + typeMarkdown(site, type, symbols);
      pages.push({ page: tpage, title: `${type.name} (${typeKindWord(type)} in ${pkg.name})`, summary: summaryText(type.doc), symbol: typeSymbolKey(type.kind, isThrowable(type)) });
    }
  }

  // Javadoc's index pages, each only when it has content.
  const indexes: ListedPage[] = [];
  const indexPage = (page: string, title: string, summary: string, node: preact.VNode, markdown: string) => {
    html(page, site.language, node);
    out[`${page}.md`] = frontmatter(site, indexTwin(title, `${title}: ${summary}.`), canonical(page)) + markdown;
    indexes.push({ page, title, summary, symbol: "module" });
  };
  for (const { page } of indexPages(site)) {
    if (page === PACKAGES_PAGE) indexPage(page, "Packages", "every package with its summary and type counts", <PackagesIndexPage />, packagesIndexMarkdown(site, symbols));
    if (page === TYPES_PAGE) indexPage(page, "All types", "every type, nested ones too, by name", <TypesIndexPage />, typesIndexMarkdown(site, symbols));
    if (page === INDEX_ALL_PAGE) indexPage(page, "Index", "every declaration from A to Z", <IndexAllPage />, indexAllMarkdown(site, symbols));
    if (page === DEPRECATED_PAGE) indexPage(page, "Deprecated", "everything deprecated, for removal first", <DeprecatedPage />, deprecatedIndexMarkdown(site, symbols));
  }

  // What a host serves for a missing URL: the page shell with the way back, and its Markdown form.
  html(NOT_FOUND, site.language, <NotFoundPage />);
  out[`${NOT_FOUND}.md`] = frontmatter(site, { title: "Not found", kind: "notfound" }) + notFoundMarkdown(site, theme.baseUrl ?? "", indexPages(site));

  out["llms.txt"] = llms(site, pages, guides, symbols, indexes, theme.whenToUse);
  // The twins without their frontmatter: in one file, each starts at the comment that names it.
  out["llms-full.txt"] = [pages[0]!, ...guides, ...pages.slice(1)].map(p => `<!-- ${p.page}.md -->\n${stripFrontmatter(out[`${p.page}.md`] as string)}`).join("\n");
  out["api.json"] = JSON.stringify(model);
  // Javadoc's element-list: a module line first when the packages belong to a named JPMS module, as -link expects.
  // A guides-only site has no packages for -link to find, so it has no element-list.
  const modulePrefix = model.module.javaModule ? [`module:${model.module.javaModule}`] : [];
  if (site.packages.length > 0 || !site.guides.length) out["element-list"] = [...modulePrefix, ...site.packages.map(p => p.name).filter(Boolean)].join("\n") + "\n";
  out["assets/search-index.js"] = searchIndex(site);
  out["assets/theme.css"] = themeCss({ ...theme, fonts: (theme.fonts ?? []).map(f => ({ ...f, asset: f.asset })) });
  for (const name of STATIC_ASSETS) out[`assets/${name}`] = { asset: name };
  for (const font of theme.fonts ?? []) out[`assets/${font.asset}`] = { asset: font.asset };
  if (theme.logo?.light) out["assets/logo-light.svg"] = theme.logo.light;
  if (theme.logo?.dark) out["assets/logo-dark.svg"] = theme.logo.dark;
  if (theme.favicon) out["assets/favicon.svg"] = theme.favicon;
  if (theme.socialImage?.asset) out[`assets/${theme.socialImage.asset}`] = { asset: theme.socialImage.asset };
  if (theme.baseUrl) out["sitemap.xml"] = sitemap(theme.baseUrl, [pages[0]!, ...guides, ...pages.slice(1), ...indexes].map(p => `${p.page}.html`), theme.lastModified);
  return out;
}

/**
 * The theme with its URLs checked: header and footer links with an unsafe URL
 * are dropped, and so are a base URL that is not http(s) and a source-link
 * template that would not give a safe URL.
 */
export function safeTheme(theme: Theme): Theme {
  const links = (list: ThemeLink[] | undefined) =>
    list?.flatMap(link => {
      const url = safeUrl(link.url);
      return url ? [{ ...link, url }] : [];
    });
  const base = theme.baseUrl && /^https?:\/\//i.test(safeUrl(theme.baseUrl) ?? "") ? theme.baseUrl : undefined;
  const source = theme.sourceLink && safeUrl(theme.sourceLink.replace(/\{(path|line|ref)\}/g, "x")) ? theme.sourceLink : undefined;
  return {
    ...theme,
    links: { header: links(theme.links?.header), footer: links(theme.links?.footer) },
    baseUrl: base,
    sourceLink: source,
    socialImage: safeSocialImage(theme.socialImage),
    lastModified: theme.lastModified && W3C_DATE.test(theme.lastModified) ? theme.lastModified : undefined,
  };
}

/** A W3C date or date-time, as sitemap.xml's lastmod takes it: 2026-11-21, or with a time and a zone. */
const W3C_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;

/** The social image when it is usable: an absolute http(s) URL, or an asset path with no way out of assets/. */
function safeSocialImage(image: Theme["socialImage"]): Theme["socialImage"] | undefined {
  if (!image || !(image.width > 0) || !(image.height > 0)) return undefined;
  const url = image.url && /^https?:\/\//i.test(safeUrl(image.url) ?? "") ? image.url : undefined;
  const asset = image.asset && /^[a-z0-9][a-z0-9._/-]*\.(png|jpe?g|webp)$/i.test(image.asset) && !image.asset.split("/").includes("..") ? image.asset : undefined;
  return url || asset ? { ...image, url, asset } : undefined;
}

/** llms.txt (llmstxt.org): what the module is, the guides, then every reference page, each with its summary. */
function llms(site: Site, pages: ListedPage[], guides: ListedPage[], symbols: SymbolMode, indexes: ListedPage[] = [], whenToUse?: string): string {
  const m = site.model.module;
  const guidesOnly = site.packages.length === 0 && site.guides.length > 0;
  // Names and summaries are untrusted text: Markdown escapes keep their angle brackets and brackets literal.
  const md = (text: string) => text.replace(/([\\[\]<>])/g, "\\$1");
  const entry = (p: ListedPage) => `- [${withSym(symbols, p.symbol, md(p.title))}](${p.page}.md)${p.summary ? `: ${md(p.summary)}` : ""}`;
  const lines = [`# ${md(m.name)}${m.version ? ` ${md(m.version)}` : ""}`, ""];
  lines.push(`> ${md(overviewSummary(site)) || `${guidesOnly ? "Documentation" : "API reference"} for ${md(m.name)}.`}`, "");
  lines.push(
    "Each page below is Markdown; the HTML page of the same name has the same content. llms-full.txt has every page in one file, and api.json is the apidocs/1 model.",
    "",
  );
  // For an agent deciding whether this is the reference it needs: the theme's words, or one sentence from the module's.
  const what = guidesOnly ? "documentation" : "API reference";
  const summary = overviewSummary(site);
  lines.push("## When to use this", "", whenToUse?.trim() || `Use this ${what} when you write, read or review code that uses ${md(m.name)}${m.version ? ` ${md(m.version)}` : ""}.${summary ? ` ${md(summary)}` : ""}`, "");
  lines.push(
    "## Overview", "",
    `- [${withSym(symbols, "module", md(m.name))}](index.md): ${guidesOnly ? "the overview" : "packages and types"}`,
    "- [llms-full.txt](llms-full.txt): every page in one file",
    "- [api.json](api.json): the apidocs/1 model",
    "",
  );
  if (guides.length) {
    lines.push("## Guides", "", ...(guidesOnly ? [] : ["Read these first: they explain the concepts the reference pages assume.", ""]));
    for (const g of guides) lines.push(entry(g));
    lines.push("");
  }
  if (pages.length > 1 || !guides.length) {
    lines.push("## Pages", "");
    for (const p of pages.slice(1)) lines.push(entry(p));
  }
  if (indexes.length) {
    lines.push("", "## Indexes", "");
    for (const p of indexes) lines.push(`- [${p.title}](${p.page}.md): ${p.summary}`);
  }
  return lines.join("\n").trimEnd() + "\n";
}

/** The overview's summary: the module documentation's first sentence, else the overview guide's summary. */
function overviewSummary(site: Site): string {
  return summaryText(site.model.module.doc) || oneLine(inlineText(overviewGuide(site)?.guide.summary));
}

/** A page as llms.txt lists it. */
interface ListedPage {
  page: string;
  title: string;
  summary: string;
  symbol: SymbolKey;
}

/**
 * The search index, as a script that assigns a global (browsers block fetch on
 * file://). Entries: [label, kind, path from the root, context, summary].
 */
export function searchIndex(site: Site): string {
  const items: string[][] = [];
  for (const entry of site.guides) {
    const file = `${entry.page}.html`;
    items.push([entry.guide.title, "guide", file, entry.group ?? "Guides", oneLine(inlineText(entry.guide.summary))]);
    for (const section of entry.sections) items.push([section.text, "section", `${file}#${section.anchor}`, entry.guide.title, ""]);
  }
  for (const pkg of site.packages) {
    items.push([pkg.name, "package", `${packagePage(pkg)}.html`, "", summaryText(pkg.doc)]);
    for (const type of pkg.types ?? []) {
      const page = typePage(pkg, type);
      items.push([type.name, typeKindWord(type), `${page}.html`, pkg.name, summaryText(type.doc)]);
      for (const member of type.members ?? []) {
        const label = member.kind === "field" || member.kind === "enumConstant" || member.kind === "property"
          ? member.name : `${member.name}(${(member.params ?? []).map(p => p.type.map(t => t.text).join("")).join(", ")})`;
        items.push([label, member.kind, `${page}.html#${member.anchor.replace(/[<> %"]/g, c => encodeURIComponent(c))}`, type.name, summaryText(member.doc)]);
      }
    }
  }
  return `window.apidocsSearch=${JSON.stringify(items).replace(/</g, "\\u003c")};\n`;
}

/** sitemap.xml: each URL (relative to base), with the theme's lastModified as every entry's lastmod when there is one. */
export function sitemap(base: string, paths: string[], lastModified?: string): string {
  const lastmod = lastModified ? `<lastmod>${escapeXml(lastModified)}</lastmod>` : "";
  const urls = paths.map(p => `  <url><loc>${escapeXml(base + p)}</loc>${lastmod}</url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
