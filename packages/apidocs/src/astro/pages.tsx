/**
 * One page at a time: which pages a model has, and how each renders as HTML and Markdown. render() writes the
 * whole site in one pass; an on-demand server renders only the page it was asked for, so this mirrors render()'s
 * dispatch page by page. test/astro.test.ts checks that both give the same pages and the same Markdown.
 */
import type { VNode } from "preact";
import { DeprecatedPage, IndexAllPage, PackagesIndexPage, TypesIndexPage } from "../indexes";
import { deprecatedIndexMarkdown, guideMarkdown, indexAllMarkdown, indexMarkdown, packageMarkdown, packagesIndexMarkdown, typeMarkdown, typesIndexMarkdown } from "../markdown";
import type { Model } from "../model";
import { GuidePage } from "../narrative";
import { IndexPage, PackagePage, TypePage } from "../pages";
import { SCHEMA } from "../render";
import { buildSite, DEPRECATED_PAGE, INDEX, INDEX_ALL_PAGE, indexPages, PACKAGES_PAGE, packagePage, type Site, TYPES_PAGE, typePage } from "../site";
import type { SymbolMode } from "../symbols";

/** A page of a site: its path without an extension, its code language, and how to render it. */
export interface SitePage {
  page: string;
  language: string;
  html: () => VNode;
  markdown: (symbols: SymbolMode) => string;
}

interface Built {
  site: Site;
  pages: Map<string, SitePage>;
}

const built = new WeakMap<Model, Built>();

/** The model's site structure and its pages, computed once per model object. Keep the model object to reuse them. */
export function siteOf(model: Model): Built {
  let entry = built.get(model);
  if (!entry) {
    if (model.schema !== SCHEMA) throw new Error(`Expected an ${SCHEMA} model, got ${JSON.stringify(model.schema)}`);
    const site = buildSite(model);
    entry = { site, pages: new Map(sitePages(site).map(p => [p.page, p])) };
    built.set(model, entry);
  }
  return entry;
}

/** Every page, in render()'s order: the overview, the guides, each package and its types, the index pages. */
function sitePages(site: Site): SitePage[] {
  const pages: SitePage[] = [];
  pages.push({ page: INDEX, language: site.language, html: () => <IndexPage />, markdown: s => indexMarkdown(site, s) });
  for (const entry of site.guides) {
    // The overview guide is the index page.
    if (entry.page === INDEX) continue;
    pages.push({ page: entry.page, language: site.language, html: () => <GuidePage entry={entry} />, markdown: s => guideMarkdown(site, entry, s) });
  }
  for (const pkg of site.packages) {
    pages.push({ page: packagePage(pkg), language: site.language, html: () => <PackagePage pkg={pkg} />, markdown: s => packageMarkdown(site, pkg, s) });
    for (const type of pkg.types ?? []) {
      pages.push({ page: typePage(pkg, type), language: type.language, html: () => <TypePage type={type} />, markdown: s => typeMarkdown(site, type, s) });
    }
  }
  for (const { page } of indexPages(site)) {
    const lang = site.language;
    if (page === PACKAGES_PAGE) pages.push({ page, language: lang, html: () => <PackagesIndexPage />, markdown: s => packagesIndexMarkdown(site, s) });
    if (page === TYPES_PAGE) pages.push({ page, language: lang, html: () => <TypesIndexPage />, markdown: s => typesIndexMarkdown(site, s) });
    if (page === INDEX_ALL_PAGE) pages.push({ page, language: lang, html: () => <IndexAllPage />, markdown: s => indexAllMarkdown(site, s) });
    if (page === DEPRECATED_PAGE) pages.push({ page, language: lang, html: () => <DeprecatedPage />, markdown: s => deprecatedIndexMarkdown(site, s) });
  }
  return pages;
}
