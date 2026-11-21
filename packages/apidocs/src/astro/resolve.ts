/**
 * What a path under a site means. Paths are relative to the site's base, without a leading slash, decoded:
 * "" (the overview), "com/example/geo/", "com/example/geo/Circle", "guides/concepts", "packages", and every
 * file the static renderer writes ("llms.txt", "com/example/geo/Circle.md", "assets/search-index.js", ...).
 * The static renderer's page paths ("index.html", "com/example/geo/Circle.html") redirect to the Astro form.
 */
import type { Model } from "../model";
import type { Theme } from "../theme";
import { prepareTheme } from "./text";
import { pageUrl } from "./urls";
import { siteOf } from "./pages";

export type Resolved =
  /** An HTML page: render it with <ApidocsPage page={page} />. */
  | { kind: "page"; page: string }
  /** A page's Markdown twin: serve renderText(model, `${page}.md`). */
  | { kind: "markdown"; page: string }
  /** Another file: renderText(model, name) for text, or a theme font (see assetFile). */
  | { kind: "file"; name: string }
  /** A permanent redirect to the canonical path, relative to the base. */
  | { kind: "redirect"; to: string }
  | { kind: "missing" };

/** The text files of a site other than Markdown twins, as renderText serves them. */
export function textFiles(model: Model, themeInput?: Theme): string[] {
  const { site } = siteOf(model);
  const theme = themeInput && prepareTheme(themeInput);
  return [
    "llms.txt",
    "llms-full.txt",
    "api.json",
    // A guides-only site has no packages for javadoc -link to find, so it has no element-list.
    ...(site.packages.length > 0 || !site.guides.length ? ["element-list"] : []),
    "assets/search-index.js",
    "assets/search-index.json",
    "assets/theme.css",
    ...(!theme || theme.logo?.light ? ["assets/logo-light.svg"] : []),
    ...(!theme || theme.logo?.dark ? ["assets/logo-dark.svg"] : []),
    ...(!theme || theme.favicon ? ["assets/favicon.svg"] : []),
    ...(!theme || theme.baseUrl ? ["sitemap.xml"] : []),
  ];
}

function decode(path: string): string {
  if (!path.includes("%")) return path;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * What `path` (relative to the site's base) is. Without a theme, theme-dependent files (logos, the favicon,
 * sitemap.xml, fonts) resolve by name, and renderText returns undefined for one the theme does not have.
 */
export function resolvePage(model: Model, rawPath: string, theme?: Theme): Resolved {
  const { pages } = siteOf(model);
  const path = decode(rawPath).replace(/^\/+/, "");
  const canonical = (page: string): Resolved => ({ kind: "redirect", to: pageUrl(page) });
  if (path === "") return { kind: "page", page: "index" };
  if (textFiles(model, theme).includes(path)) return { kind: "file", name: path };
  if (path.startsWith("assets/fonts/") && /\.woff2$/.test(path)) {
    const fonts = theme ? (prepareTheme(theme).fonts ?? []).map(f => `assets/${f.asset}`) : undefined;
    return !fonts || fonts.includes(path) ? { kind: "file", name: path } : { kind: "missing" };
  }
  if (path.endsWith(".html")) {
    const page = path.slice(0, -".html".length);
    return pages.has(page) ? canonical(page) : { kind: "missing" };
  }
  if (path.endsWith(".md")) {
    const page = path.slice(0, -".md".length);
    return pages.has(page) ? { kind: "markdown", page } : { kind: "missing" };
  }
  if (path.endsWith("/")) {
    const dir = path.slice(0, -1);
    if (pages.has(`${dir}/index`)) return { kind: "page", page: `${dir}/index` };
    return pages.has(dir) ? canonical(dir) : { kind: "missing" };
  }
  if (pages.has(path)) return path === "index" || path.endsWith("/index") ? canonical(path) : { kind: "page", page: path };
  if (pages.has(`${path}/index`)) return canonical(`${path}/index`);
  return { kind: "missing" };
}

/** Every path a site serves in the Astro form, pages first: what a prerendering route lists in getStaticPaths. */
export function sitePaths(model: Model, theme?: Theme): string[] {
  const { pages } = siteOf(model);
  return [
    ...[...pages.keys()].map(pageUrl),
    ...[...pages.keys()].map(page => `${page}.md`),
    ...textFiles(model, theme),
  ];
}
