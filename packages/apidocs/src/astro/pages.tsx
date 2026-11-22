/**
 * One page at a time: which pages a model has, and how each renders as HTML and Markdown. render() writes the
 * whole site in one pass; an on-demand server renders only the page it was asked for, so this mirrors render()'s
 * dispatch page by page. test/astro.test.ts checks that both give the same pages and the same Markdown.
 */
import type { VNode } from "preact";
import { DeprecatedPage, IndexAllPage, PackagesIndexPage, TypesIndexPage } from "../indexes";
import { deprecatedIndexMarkdown, frontmatter, guideMarkdown, guideTwin, indexAllMarkdown, indexMarkdown, indexTwin, moduleTwin, NOT_FOUND, notFoundMarkdown, packageMarkdown, packagesIndexMarkdown, packageTwin, type TwinMeta, typeMarkdown, typesIndexMarkdown, typeTwin } from "../markdown";
import type { Model } from "../model";
import { GuidePage } from "../narrative";
import { IndexPage, NotFoundPage, PackagePage, TypePage } from "../pages";
import { SCHEMA } from "../render";
import { buildSite, DEPRECATED_PAGE, INDEX, INDEX_ALL_PAGE, indexPages, PACKAGES_PAGE, packagePage, type Site, TYPES_PAGE, typePage } from "../site";
import type { SymbolMode } from "../symbols";

/** A page of a site: its path without an extension, its code language, and how to render it. */
export interface SitePage {
  page: string;
  language: string;
  html: () => VNode;
  /** The Markdown twin, its frontmatter naming `canonical` as the page's URL when given. */
  markdown: (symbols: SymbolMode, canonical?: string) => string;
}

interface Built {
  site: Site;
  pages: Map<string, SitePage>;
  /** The page for a missing URL ("404"): rendered like a page, but never resolved from a path. */
  notFound: SitePage;
}

const built = new WeakMap<Model, Built>();

/** The model's site structure and its pages, computed once per model object. Keep the model object to reuse them. */
export function siteOf(model: Model): Built {
  let entry = built.get(model);
  if (!entry) {
    if (model.schema !== SCHEMA) throw new Error(`Expected an ${SCHEMA} model, got ${JSON.stringify(model.schema)}`);
    const site = buildSite(model);
    entry = { site, pages: new Map(sitePages(site).map(p => [p.page, p])), notFound: notFoundPage(site) };
    built.set(model, entry);
  }
  return entry;
}

/** The not-found page, with links from the site's base (`root`, given when its Markdown is rendered). */
function notFoundPage(site: Site): SitePage {
  return { page: NOT_FOUND, language: site.language, html: () => <NotFoundPage />, markdown: (_, root) => frontmatter(site, { title: "Not found", kind: "notfound" }) + notFoundMarkdown(site, root ?? "", indexPages(site)) };
}

/** Every page, in render()'s order: the overview, the guides, each package and its types, the index pages. */
function sitePages(site: Site): SitePage[] {
  const pages: SitePage[] = [];
  const twin = (meta: TwinMeta, body: (s: SymbolMode) => string) => (s: SymbolMode, canonical?: string) => frontmatter(site, meta, canonical) + body(s);
  pages.push({ page: INDEX, language: site.language, html: () => <IndexPage />, markdown: twin(moduleTwin(site), s => indexMarkdown(site, s)) });
  for (const entry of site.guides) {
    // The overview guide is the index page.
    if (entry.page === INDEX) continue;
    pages.push({ page: entry.page, language: site.language, html: () => <GuidePage entry={entry} />, markdown: twin(guideTwin(entry), s => guideMarkdown(site, entry, s)) });
  }
  for (const pkg of site.packages) {
    pages.push({ page: packagePage(pkg), language: site.language, html: () => <PackagePage pkg={pkg} />, markdown: twin(packageTwin(pkg), s => packageMarkdown(site, pkg, s)) });
    for (const type of pkg.types ?? []) {
      pages.push({ page: typePage(pkg, type), language: type.language, html: () => <TypePage type={type} />, markdown: twin(typeTwin(type), s => typeMarkdown(site, type, s)) });
    }
  }
  for (const { page } of indexPages(site)) {
    const lang = site.language;
    // The same titles and summaries as render()'s llms.txt entries for these pages.
    if (page === PACKAGES_PAGE) pages.push({ page, language: lang, html: () => <PackagesIndexPage />, markdown: twin(indexTwin("Packages", "Packages: every package with its summary and type counts."), s => packagesIndexMarkdown(site, s)) });
    if (page === TYPES_PAGE) pages.push({ page, language: lang, html: () => <TypesIndexPage />, markdown: twin(indexTwin("All types", "All types: every type, nested ones too, by name."), s => typesIndexMarkdown(site, s)) });
    if (page === INDEX_ALL_PAGE) pages.push({ page, language: lang, html: () => <IndexAllPage />, markdown: twin(indexTwin("Index", "Index: every declaration from A to Z."), s => indexAllMarkdown(site, s)) });
    if (page === DEPRECATED_PAGE) pages.push({ page, language: lang, html: () => <DeprecatedPage />, markdown: twin(indexTwin("Deprecated", "Deprecated: everything deprecated, for removal first."), s => deprecatedIndexMarkdown(site, s)) });
  }
  return pages;
}
