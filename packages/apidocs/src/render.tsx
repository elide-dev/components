/**
 * render(model, theme): the whole site as a map from path to content. A pure
 * function: no file, network, Node, Bun or DOM API, so any JavaScript runtime
 * can run the bundled form. Binary files (fonts, the stylesheet and client
 * script) are references to the renderer's assets directory, which the caller
 * copies: { asset: "apidocs.css" } means <assets>/apidocs.css.
 */
import { renderToString } from "preact-render-to-string";
import { Ctx, type PageContext } from "./context";
import { guideMarkdown, indexMarkdown, packageMarkdown, typeMarkdown } from "./markdown";
import type { Model } from "./model";
import { GuidePage } from "./narrative";
import { IndexPage, PackagePage, TypePage } from "./pages";
import { buildSite, INDEX, isThrowable, packagePage, type Site, typePage } from "./site";
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

  const html = (page: string, language: string, node: preact.VNode) => {
    const ctx: PageContext = { site, theme, page, language };
    out[`${page}.html`] = "<!doctype html>\n" + renderToString(<Ctx.Provider value={ctx}>{node}</Ctx.Provider>) + "\n";
  };

  html(INDEX, site.language, <IndexPage />);
  out[`${INDEX}.md`] = indexMarkdown(site, symbols);
  pages.push({ page: INDEX, title: `${model.module.name} overview`, summary: summaryText(model.module.doc), symbol: "module" });
  // Guides come right after the overview in llms-full.txt: agents should read them before the reference.
  const guides: ListedPage[] = [];
  for (const entry of site.guides) {
    html(entry.page, site.language, <GuidePage entry={entry} />);
    out[`${entry.page}.md`] = guideMarkdown(site, entry, symbols);
    guides.push({ page: entry.page, title: entry.guide.title, summary: oneLine(inlineText(entry.guide.summary)), symbol: "guide" });
  }
  for (const pkg of site.packages) {
    const page = packagePage(pkg);
    html(page, site.language, <PackagePage pkg={pkg} />);
    out[`${page}.md`] = packageMarkdown(site, pkg, symbols);
    pages.push({ page, title: `Package ${pkg.name}`, summary: summaryText(pkg.doc), symbol: "package" });
    for (const type of pkg.types ?? []) {
      const tpage = typePage(pkg, type);
      html(tpage, type.language, <TypePage type={type} />);
      out[`${tpage}.md`] = typeMarkdown(site, type, symbols);
      pages.push({ page: tpage, title: `${type.name} (${typeKindWord(type)} in ${pkg.name})`, summary: summaryText(type.doc), symbol: typeSymbolKey(type.kind, isThrowable(type)) });
    }
  }

  out["llms.txt"] = llms(site, pages, guides, symbols);
  out["llms-full.txt"] = [pages[0]!, ...guides, ...pages.slice(1)].map(p => `<!-- ${p.page}.md -->\n${out[`${p.page}.md`]}`).join("\n");
  out["api.json"] = JSON.stringify(model);
  // Javadoc's element-list: a module line first when the packages belong to a named JPMS module, as -link expects.
  const modulePrefix = model.module.javaModule ? [`module:${model.module.javaModule}`] : [];
  out["element-list"] = [...modulePrefix, ...site.packages.map(p => p.name).filter(Boolean)].join("\n") + "\n";
  out["assets/search-index.js"] = searchIndex(site);
  out["assets/theme.css"] = themeCss({ ...theme, fonts: (theme.fonts ?? []).map(f => ({ ...f, asset: f.asset })) });
  for (const name of STATIC_ASSETS) out[`assets/${name}`] = { asset: name };
  for (const font of theme.fonts ?? []) out[`assets/${font.asset}`] = { asset: font.asset };
  if (theme.logo?.light) out["assets/logo-light.svg"] = theme.logo.light;
  if (theme.logo?.dark) out["assets/logo-dark.svg"] = theme.logo.dark;
  if (theme.favicon) out["assets/favicon.svg"] = theme.favicon;
  if (theme.baseUrl) out["sitemap.xml"] = sitemap(theme.baseUrl, [pages[0]!, ...guides, ...pages.slice(1)].map(p => p.page));
  return out;
}

/**
 * The theme with its URLs checked: header and footer links with an unsafe URL
 * are dropped, and so are a base URL that is not http(s) and a source-link
 * template that would not give a safe URL.
 */
function safeTheme(theme: Theme): Theme {
  const links = (list: ThemeLink[] | undefined) =>
    list?.flatMap(link => {
      const url = safeUrl(link.url);
      return url ? [{ ...link, url }] : [];
    });
  const base = theme.baseUrl && /^https?:\/\//i.test(safeUrl(theme.baseUrl) ?? "") ? theme.baseUrl : undefined;
  const source = theme.sourceLink && safeUrl(theme.sourceLink.replace(/\{(path|line|ref)\}/g, "x")) ? theme.sourceLink : undefined;
  return { ...theme, links: { header: links(theme.links?.header), footer: links(theme.links?.footer) }, baseUrl: base, sourceLink: source };
}

/** llms.txt (llmstxt.org): what the module is, the guides, then every reference page, each with its summary. */
function llms(site: Site, pages: ListedPage[], guides: ListedPage[], symbols: SymbolMode): string {
  const m = site.model.module;
  const entry = (p: ListedPage) => `- [${withSym(symbols, p.symbol, p.title.replace(/([\\[\]<>])/g, "\\$1"))}](${p.page}.md)${p.summary ? `: ${p.summary}` : ""}`;
  const lines = [`# ${m.name}${m.version ? ` ${m.version}` : ""}`, ""];
  lines.push(`> ${summaryText(m.doc) || `API reference for ${m.name}.`}`, "");
  lines.push(
    "Each page below is Markdown; the HTML page of the same name has the same content. llms-full.txt has every page in one file, and api.json is the apidocs/1 model.",
    "",
  );
  lines.push(
    "## Overview", "",
    `- [${withSym(symbols, "module", m.name)}](index.md): packages and types`,
    "- [llms-full.txt](llms-full.txt): every page in one file",
    "- [api.json](api.json): the apidocs/1 model",
    "",
  );
  if (guides.length) {
    lines.push("## Guides", "", "Read these first: they explain the concepts the reference pages assume.", "");
    for (const g of guides) lines.push(entry(g));
    lines.push("");
  }
  lines.push("## Pages", "");
  for (const p of pages.slice(1)) lines.push(entry(p));
  return lines.join("\n") + "\n";
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
function searchIndex(site: Site): string {
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

function sitemap(base: string, pages: string[]): string {
  const urls = pages.map(p => `  <url><loc>${escapeXml(base + p + ".html")}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
