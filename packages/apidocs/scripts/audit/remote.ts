/**
 * `bun run audit --url <site>`: audits a site someone else serves, such as the Astro sample app. The site is read
 * through its llms.txt (every page's Markdown twin, so every page) and saved into a directory in the static
 * renderer's layout, so the checks that read files see what the server sends: each page is fetched at its Astro
 * URL (urls.ts) and written as X.html, with its links mapped back to the static form (relative, naming .html
 * files), and the Markdown twins and text files are written as they are. Checks that make requests, and
 * Lighthouse, go to the server itself at the Astro URLs (Site.urlOf).
 */
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pageUrl } from "../../src/astro/urls";
import { relative } from "../../src/site";
import type { Site } from "./types";

/** The static file a site-relative Astro path names: "" -> index.html, "x/" -> x/index.html, "x/Y" -> x/Y.html. */
function staticFile(path: string, pages: Set<string>): string {
  if (path === "" || path.endsWith("/")) return `${path}index.html`;
  return pages.has(path) ? `${path}.html` : path;
}

async function text(url: string): Promise<string | undefined> {
  const r = await fetch(url, { redirect: "manual" });
  return r.status === 200 ? r.text() : undefined;
}

/** Fetches the site at `url` (ending with "/") into `dir`, and describes it for the audits. */
export async function mirrorSite(name: string, url: string, dir: string): Promise<Site> {
  const base = new URL(url).pathname;
  const llms = await text(`${url}llms.txt`);
  if (!llms) throw new Error(`${url}llms.txt did not load: --url takes the base URL of an apidocs site`);
  const pages = new Set([...llms.matchAll(/\]\(([^)#]+)\.md\)/g)].map(m => m[1]!).filter(p => !/^[a-z]+:/i.test(p)));
  pages.add("index");
  const write = (path: string, body: string) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), body);
  };
  const toStatic = (page: string, href: string) => {
    // Absolute URLs (the canonical link, og:url) stay as the server wrote them, as the static build's do.
    const full = href;
    if (!full.startsWith(base) || full.startsWith("//")) return href;
    const cut = full.search(/[?#]/);
    const path = decodeURI(cut < 0 ? full.slice(base.length) : full.slice(base.length, cut));
    const file = staticFile(path, pages);
    const link = file.endsWith(".html") ? relative(page, file.slice(0, -".html".length), ".html") : relative(page, file, "");
    return link + (cut < 0 ? "" : full.slice(cut));
  };
  for (const page of pages) {
    const html = await text(url + pageUrl(page));
    if (!html) throw new Error(`${url}${pageUrl(page)} did not load`);
    write(`${page}.html`, html.replace(/(\s(?:href|src)=")([^"]*)(")/g, (_, a: string, href: string, b: string) => a + toStatic(page, href.replace(/&amp;/g, "&")).replace(/&/g, "&amp;") + b));
    const md = await text(`${url}${page}.md`);
    if (md !== undefined) write(`${page}.md`, md);
  }
  for (const file of ["llms.txt", "llms-full.txt", "api.json", "element-list", "sitemap.xml", "robots.txt"]) {
    const body = await text(url + file);
    if (body !== undefined) write(file, body);
  }
  const all = [...pages].map(p => `${p}.html`);
  const size = (f: string) => statSync(join(dir, f)).size;
  const types = all.filter(f => !f.endsWith("index.html") && !f.startsWith("guides/") && !["packages.html", "types.html", "index-all.html", "deprecated.html"].includes(f));
  const packages = all.filter(f => f.endsWith("/index.html")).sort((a, b) => size(b) - size(a));
  const bySize = [...types].sort((a, b) => size(a) - size(b));
  return {
    name,
    dir,
    url,
    urlOf: page => url + pageUrl(page.replace(/\.html$/, "")),
    pages: {
      overview: "index.html",
      package: packages[0] ?? "index.html",
      // The smallest type page with real content, and the largest, as representativePages chooses them.
      smallType: bySize.find(f => size(f) > 4000) ?? bySize[0] ?? "index.html",
      largestType: bySize.at(-1) ?? "index.html",
      ...(all.some(f => f.startsWith("guides/")) ? { guide: all.filter(f => f.startsWith("guides/")).sort().find(g => /getting-started/.test(g)) ?? all.filter(f => f.startsWith("guides/")).sort()[0] } : {}),
      all,
    },
  };
}
