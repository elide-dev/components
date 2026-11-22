/**
 * The text a site serves besides its HTML pages: Markdown twins, llms.txt, llms-full.txt, api.json,
 * element-list, the search index, the theme stylesheet, the theme's artwork and sitemap.xml. Each is the same
 * text the static renderer writes, except sitemap.xml and assets/search-index.json, which list URLs in the
 * Astro form.
 */
import type { Model } from "../model";
import { render, safeTheme, searchIndex, sitemap } from "../render";
import { resolveTheme, type Theme, themeCss } from "../theme";
import type { Entry } from "../client/search";
import { siteOf } from "./pages";
import { fileUrl, pageUrl } from "./urls";

/**
 * The not-found page as Markdown, with links under the site's base path: what a server sends a client that asks for
 * Markdown at a missing URL. The same text as the static renderer's 404.md.
 */
export function notFoundText(model: Model, base: string, themeInput?: Theme | string): string {
  return siteOf(model).notFound.markdown(prepareTheme(themeInput).symbols ?? "utf", base);
}


/** A theme with its preset applied and its URLs checked, as render() uses it. Accepts the theme as JSON text. */
export function prepareTheme(input: Theme | string | undefined): Theme {
  return safeTheme(resolveTheme(typeof input === "string" ? JSON.parse(input) : input));
}

export interface TextFile {
  body: string;
  /** The Content-Type to serve it with. */
  contentType: string;
}

const TYPES: Record<string, string> = {
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  json: "application/json; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml",
  xml: "application/xml; charset=utf-8",
};

function contentType(path: string): string {
  const ext = /\.([a-z0-9]+)$/.exec(path)?.[1];
  return (ext && TYPES[ext]) || "text/plain; charset=utf-8";
}

/** The site-wide files that need every page: rendered once per model and symbol set, then kept. */
const whole = new WeakMap<Model, Map<string, Record<string, string>>>();

function wholeSite(model: Model, theme: Theme): Record<string, string> {
  let perModel = whole.get(model);
  if (!perModel) whole.set(model, (perModel = new Map()));
  const key = theme.symbols ?? "utf";
  let files = perModel.get(key);
  if (!files) {
    // render() writes every page too; only the files built from all of them are kept.
    const out = render(model, { ...theme, baseUrl: undefined, extends: undefined });
    files = {};
    for (const name of ["llms.txt", "llms-full.txt", "element-list"]) if (typeof out[name] === "string") files[name] = out[name];
    perModel.set(key, files);
  }
  return files;
}

/** The search index's entries with their paths in the Astro form: what assets/search-index.json holds. */
export function searchEntries(model: Model): Entry[] {
  const script = searchIndex(siteOf(model).site);
  const json = script.slice(script.indexOf("=") + 1, script.lastIndexOf(";"));
  return (JSON.parse(json) as Entry[]).map(entry => {
    const at = entry[2].indexOf("#");
    const file = at < 0 ? entry[2] : entry[2].slice(0, at);
    return [entry[0], entry[1], fileUrl(file) + (at < 0 ? "" : entry[2].slice(at)), entry[3], entry[4]] as Entry;
  });
}

/**
 * The text at `path` (relative to the site's base; a page's Markdown twin is `${page}.md`), or undefined when
 * the site has no such text file. llms.txt, llms-full.txt and element-list render the whole site once per model
 * object, and keep only those files; everything else renders on its own.
 */
export function renderText(model: Model, path: string, themeInput?: Theme | string): TextFile | undefined {
  const { site, pages } = siteOf(model);
  const theme = prepareTheme(themeInput);
  const body = ((): string | undefined => {
    if (path.endsWith(".md")) {
      const page = path.slice(0, -".md".length);
      // The frontmatter's canonical URL is the page's, in the Astro form.
      return pages.get(page)?.markdown(theme.symbols ?? "utf", theme.baseUrl ? theme.baseUrl + pageUrl(page) : undefined);
    }
    switch (path) {
      case "llms.txt":
      case "llms-full.txt":
      case "element-list":
        return wholeSite(model, theme)[path];
      case "api.json":
        return JSON.stringify(model);
      case "assets/search-index.js":
        return searchIndex(site);
      case "assets/search-index.json":
        return JSON.stringify(searchEntries(model));
      case "assets/theme.css":
        return themeCss(theme);
      case "assets/logo-light.svg":
        return theme.logo?.light;
      case "assets/logo-dark.svg":
        return theme.logo?.dark;
      case "assets/favicon.svg":
        return theme.favicon;
      case "sitemap.xml":
        return theme.baseUrl ? sitemap(theme.baseUrl, [...pages.keys()].map(pageUrl), theme.lastModified) : undefined;
      default:
        return undefined;
    }
  })();
  return body === undefined ? undefined : { body, contentType: contentType(path) };
}
