/**
 * The Astro integration's URL form, and the mapping from the static renderer's links to it.
 *
 * A site lives under a base path that ends with a slash (`/api/komodo/main/`). Under it:
 *
 *   static file                     Astro URL (relative to the base)
 *   index.html                      (the base itself)
 *   com/example/geo/index.html      com/example/geo/          a package: a directory URL
 *   com/example/geo/Circle.html     com/example/geo/Circle    a type, a guide or an index page: no extension
 *   anything else                   the same path             .md twins, llms.txt, api.json, assets/...
 *
 * Pages are rendered with the static renderer's components, whose links are relative and name .html files.
 * rewriteHtml maps every such link to a root-absolute URL in this form, so the top bar and the navigator, which
 * the client router keeps across pages, link correctly from any page of the site.
 */

/** A page's URL under the base, from its page path without an extension ("com/example/geo/index" -> "com/example/geo/"). */
export function pageUrl(page: string): string {
  if (page === "index") return "";
  if (page.endsWith("/index")) return page.slice(0, -"index".length);
  return page;
}

/** A static file path's URL under the base: pages lose ".html" (and "index.html"); other files keep their path. */
export function fileUrl(path: string): string {
  return path.endsWith(".html") ? pageUrl(path.slice(0, -".html".length)) : path;
}

/** The directory part of a page path, with a trailing slash ("com/example/geo/Circle" -> "com/example/geo/"). */
function dirOf(page: string): string {
  return page.slice(0, page.lastIndexOf("/") + 1);
}

/** Resolves a relative path against a directory, or undefined when it climbs above the site root. */
function join(dir: string, relative: string): string | undefined {
  const parts = dir.split("/").filter(Boolean);
  for (const segment of relative.split("/")) {
    if (segment === "..") {
      if (!parts.length) return undefined;
      parts.pop();
    } else if (segment !== "." && segment !== "") parts.push(segment);
  }
  return parts.join("/") + (relative.endsWith("/") ? "/" : "");
}

export interface UrlContext {
  /** The page whose links these are, as a page path without an extension. */
  page: string;
  /** The site's base path, ending with a slash: "/api/komodo/main/". */
  base: string;
  /** The site's absolute URL (theme.baseUrl when the page was rendered), ending with a slash. */
  baseUrl?: string;
}

/**
 * One URL from a page rendered by the static renderer, in the Astro form: relative links become root-absolute,
 * links under baseUrl stay absolute, and fragments, other sites and other schemes are left alone.
 */
export function mapUrl(url: string, ctx: UrlContext): string {
  if (ctx.baseUrl && url.startsWith(ctx.baseUrl)) return ctx.baseUrl + mapPath(url.slice(ctx.baseUrl.length));
  if (url === "" || url.startsWith("#") || url.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  const cut = url.search(/[?#]/);
  const path = cut < 0 ? url : url.slice(0, cut);
  const target = join(dirOf(ctx.page), path);
  if (target === undefined) return url;
  return ctx.base + mapPath(target + (cut < 0 ? "" : url.slice(cut)));
}

/** A site-relative path with an optional query and fragment, with its file part in the Astro form. */
function mapPath(pathWithRest: string): string {
  const cut = pathWithRest.search(/[?#]/);
  const path = cut < 0 ? pathWithRest : pathWithRest.slice(0, cut);
  return fileUrl(path) + (cut < 0 ? "" : pathWithRest.slice(cut));
}

const ATTR = /(\s(?:href|src|data-copy-markdown)=")([^"]*)(")/g;
const META_CONTENT = /(<meta property="og:url" content=")([^"]*)(")/g;
const JSON_LD = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g;
/** The JSON-LD keys whose values are URLs. */
const URL_KEYS = new Set(["url", "item", "contentUrl"]);

function unescapeAttr(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Maps the URLs in a page that Preact rendered: href, src and data-copy-markdown attributes, og:url, and the
 * URL fields of the JSON-LD graph. Preact escapes every quote in text and in attribute values, so `href="` can
 * occur only as an attribute; raw HTML from documentation comments has passed the sanitizer, which writes its
 * attributes the same way.
 */
export function rewriteHtml(html: string, ctx: UrlContext): string {
  const map = (value: string) => escapeAttr(mapUrl(unescapeAttr(value), ctx));
  return html
    .replace(ATTR, (_, start: string, value: string, end: string) => start + map(value) + end)
    .replace(META_CONTENT, (_, start: string, value: string, end: string) => start + map(value) + end)
    .replace(JSON_LD, (_, start: string, json: string, end: string) => {
      const graph = JSON.parse(json) as unknown;
      const walk = (node: unknown): unknown => {
        if (Array.isArray(node)) return node.map(walk);
        if (node && typeof node === "object") {
          return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, URL_KEYS.has(k) && typeof v === "string" ? mapUrl(v, ctx) : walk(v)]));
        }
        return node;
      };
      return start + JSON.stringify(walk(graph)).replace(/</g, "\\u003c") + end;
    });
}
