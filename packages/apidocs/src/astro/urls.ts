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
import { safeUrl } from "../url";

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

/** A backslash, or a control character (which browsers strip from URLs, joining what was around it). */
// eslint-disable-next-line no-control-regex
const UNSAFE = /[\\\u0000-\u001f\u007f]/;

/**
 * Throws unless `base` is an absolute path that starts with a single "/" and ends with "/", whose segments are
 * plain names: "/" and "/api/komodo/main/" are bases; "//x/", "/x", "x/", "/a/../" and "/a\\b/" are not. A base
 * that passes can never join with a mapped path into a URL that starts with "//" or "/\\".
 */
export function assertBase(base: string): void {
  const segments = base.slice(1, -1).split("/");
  const ok = base.startsWith("/") && base.endsWith("/") && !UNSAFE.test(base) && !/[\s?#]/.test(base)
    && (base === "/" || segments.every(segment => segment !== "" && segment !== "." && segment !== ".."));
  if (!ok) throw new Error(`apidocs: a site's base is an absolute path that starts and ends with "/", such as "/api/" or "/"; got ${JSON.stringify(base)}`);
}

/**
 * Whether a path relative to a site's base stays inside it when appended to the base: no scheme, no leading "/"
 * or "\\", no backslash or control character, and no empty, "." or ".." segment (a trailing "/" is allowed).
 */
export function isBaseRelative(path: string): boolean {
  if (UNSAFE.test(path) || /^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("/")) return false;
  const segments = (path.endsWith("/") ? path.slice(0, -1) : path).split("/");
  return path === "" || segments.every(segment => segment !== "" && segment !== "." && segment !== "..");
}

/**
 * One URL from a page rendered by the static renderer, in the Astro form: relative links become root-absolute,
 * links under baseUrl stay absolute, and fragments, other sites and other schemes are left alone. Undefined when
 * safeUrl rejects the URL: the caller drops the attribute, so a link renders as text.
 *
 * Links can come from documentation comments, which are untrusted, so a rewritten URL always starts with the
 * base (or baseUrl) it was mapped under and passes safeUrl again. Anything that could leave it (a backslash, a
 * control character, a target that resolves to a path starting with "/") is not rewritten: it keeps the static
 * page's form, relative to the page, with backslashes percent-encoded so no browser reads one as a slash.
 */
export function mapUrl(url: string, ctx: UrlContext): string | undefined {
  assertBase(ctx.base);
  const safe = safeUrl(url);
  if (safe === undefined) return undefined;
  const keep = () => {
    const kept = safe.replace(/\\/g, "%5C");
    // safeUrl drops tabs and newlines, as browsers do: "/<tab>/host" would come out as "//host", another origin.
    return kept.startsWith("//") && UNSAFE.test(url) ? undefined : kept;
  };
  if (UNSAFE.test(url) || UNSAFE.test(safe)) return keep();
  if (ctx.baseUrl && safe.startsWith(ctx.baseUrl)) {
    const rest = safe.slice(ctx.baseUrl.length);
    return rest.startsWith("/") ? keep() : (under(ctx.baseUrl + mapPath(rest), ctx.baseUrl) ?? keep());
  }
  if (safe === "" || safe.startsWith("#") || safe.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(safe)) return keep();
  const cut = safe.search(/[?#]/);
  const path = cut < 0 ? safe : safe.slice(0, cut);
  const target = join(dirOf(ctx.page), path);
  if (target === undefined || target.startsWith("/")) return keep();
  return under(ctx.base + mapPath(target + (cut < 0 ? "" : safe.slice(cut))), ctx.base) ?? keep();
}

/** The mapped URL when it starts with its prefix, cannot be read as another origin, and passes safeUrl unchanged. */
function under(mapped: string, prefix: string): string | undefined {
  if (!mapped.startsWith(prefix) || /^\/[/\\]/.test(mapped) || UNSAFE.test(mapped)) return undefined;
  return safeUrl(mapped) === mapped ? mapped : undefined;
}

/** A site-relative path with an optional query and fragment, with its file part in the Astro form. */
function mapPath(pathWithRest: string): string {
  const cut = pathWithRest.search(/[?#]/);
  const path = cut < 0 ? pathWithRest : pathWithRest.slice(0, cut);
  return fileUrl(path) + (cut < 0 ? "" : pathWithRest.slice(cut));
}

const ATTR = /(\s(?:href|src|data-copy-markdown)=")([^"]*)(")/g;
const META_CONTENT = /(<meta property="og:(?:url|image)" content=")([^"]*)(")/g;
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
  const map = (value: string) => {
    const url = mapUrl(unescapeAttr(value), ctx);
    return url === undefined ? undefined : escapeAttr(url);
  };
  return html
    // An attribute whose URL safeUrl rejects is dropped: a link without href renders as its text.
    .replace(ATTR, (_, start: string, value: string, end: string) => {
      const url = map(value);
      return url === undefined ? "" : start + url + end;
    })
    .replace(META_CONTENT, (_, start: string, value: string, end: string) => start + (map(value) ?? "") + end)
    .replace(JSON_LD, (_, start: string, json: string, end: string) => {
      const graph = JSON.parse(json) as unknown;
      const walk = (node: unknown): unknown => {
        if (Array.isArray(node)) return node.map(walk);
        if (node && typeof node === "object") {
          return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, URL_KEYS.has(k) && typeof v === "string" ? (mapUrl(v, ctx) ?? "") : walk(v)]));
        }
        return node;
      };
      return start + JSON.stringify(walk(graph)).replace(/</g, "\\u003c") + end;
    });
}
