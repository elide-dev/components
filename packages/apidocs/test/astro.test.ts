/**
 * The Astro integration's helpers, without Astro: resolvePage and renderText over every page of every sample,
 * in both URL forms, and renderPage's markup against the static renderer's.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { samples } from "../samples";
import { guidesModel, importMarkdown, readSuite } from "../src/import";
import type { Model } from "../src/model";
import { render } from "../src/render";
import { mapUrl, pageUrl, renderPage, renderText, resolvePage, searchEntries, sitePaths, textFiles } from "../src/astro/helpers";

const fixture: Model = JSON.parse(readFileSync(new URL("fixtures/fixture-java.api.json", import.meta.url), "utf8"));
const suite = readSuite(fileURLToPath(new URL("../samples/guides", import.meta.url)));
const guides = guidesModel(importMarkdown(suite.files, { suite: "markdown", assets: suite.assets }), { name: "Geo user guide", version: "2.0" });
const models: Record<string, Model> = { java: samples.java, kotlin: samples.kotlin, fixture, guides };
const theme = { extends: "elide" as const, baseUrl: "https://example.com/docs/" };

for (const [name, model] of Object.entries(models)) {
  describe(`${name}: every page and file`, () => {
    const out = render(model, theme);
    const pages = Object.keys(out).filter(f => f.endsWith(".html")).map(f => f.slice(0, -".html".length));

    test("the pages are the static renderer's pages", () => {
      const astroPages = sitePaths(model, theme).filter(p => p.endsWith(".md")).map(p => p.slice(0, -".md".length));
      expect(astroPages.sort()).toEqual([...pages].sort());
    });

    test("each page resolves in the Astro form, and its static form redirects there", () => {
      for (const page of pages) {
        expect(resolvePage(model, pageUrl(page), theme)).toEqual({ kind: "page", page });
        const url = pageUrl(page);
        // A leading slash is accepted, and so is the encoded form a request URL has.
        expect(resolvePage(model, `/${encodeURI(url)}`, theme)).toEqual({ kind: "page", page });
        expect(resolvePage(model, `${page}.html`, theme)).toEqual({ kind: "redirect", to: url });
        if (url.endsWith("/")) expect(resolvePage(model, url.slice(0, -1), theme)).toEqual({ kind: "redirect", to: url });
        else if (url) expect(resolvePage(model, `${url}/`, theme)).toEqual({ kind: "redirect", to: url });
      }
    });

    test("each Markdown twin is the static renderer's", () => {
      for (const page of pages) {
        expect(resolvePage(model, `${page}.md`, theme)).toEqual({ kind: "markdown", page });
        const text = renderText(model, `${page}.md`, theme)!;
        expect(text.body).toBe(out[`${page}.md`] as string);
        expect(text.contentType).toBe("text/markdown; charset=utf-8");
      }
    });

    test("each text file is the static renderer's, except the Astro-form sitemap and search index", () => {
      for (const file of textFiles(model, theme)) {
        expect(resolvePage(model, file, theme)).toEqual({ kind: "file", name: file });
        const text = renderText(model, file, theme);
        if (file === "assets/search-index.json" || file === "sitemap.xml") continue;
        expect(text?.body).toBe(out[file] as string);
      }
      for (const file of Object.keys(out).filter(f => typeof out[f] === "string" && !f.endsWith(".html") && !f.endsWith(".md"))) {
        expect(textFiles(model, theme)).toContain(file);
      }
    });

    test("sitemap.xml and the JSON search index name pages in the Astro form", () => {
      const sitemap = renderText(model, "sitemap.xml", theme)!.body;
      expect(sitemap).not.toContain(".html<");
      for (const page of pages) expect(sitemap).toContain(`<loc>${theme.baseUrl}${pageUrl(page)}</loc>`);
      for (const entry of searchEntries(model)) {
        const path = entry[2].split("#")[0]!;
        expect(path.endsWith(".html")).toBe(false);
        expect(resolvePage(model, path, theme).kind).toBe("page");
      }
    });

    test("paths that are not in the site are missing", () => {
      for (const path of ["nope", "nope/", "nope.html", "nope.md", "assets/apidocs.css", "assets/apidocs.js", "assets/fonts/other.woff2", "../index.html"]) {
        expect(resolvePage(model, path, theme)).toEqual({ kind: "missing" });
      }
      expect(renderText(model, "nope.md", theme)).toBeUndefined();
    });
  });
}

describe("theme-dependent files", () => {
  test("without a theme, resolvePage names them; renderText has them only when the theme does", () => {
    expect(resolvePage(samples.java, "assets/logo-light.svg")).toEqual({ kind: "file", name: "assets/logo-light.svg" });
    expect(renderText(samples.java, "assets/logo-light.svg")).toBeUndefined();
    expect(renderText(samples.java, "assets/logo-light.svg", { extends: "elide" })?.contentType).toBe("image/svg+xml");
    expect(resolvePage(samples.java, "sitemap.xml", { extends: "neutral" })).toEqual({ kind: "missing" });
    expect(resolvePage(samples.java, "assets/fonts/jetbrains-mono-latin-wght-normal.woff2", { extends: "elide" }).kind).toBe("file");
  });
});

describe("mapUrl", () => {
  const ctx = { page: "com/example/geo/Circle", base: "/docs/", baseUrl: "https://example.com/docs/" };
  test("maps the static renderer's links to the Astro form", () => {
    expect(mapUrl("Shape.html", ctx)).toBe("/docs/com/example/geo/Shape");
    expect(mapUrl("index.html", ctx)).toBe("/docs/com/example/geo/");
    expect(mapUrl("../../../index.html#all-types", ctx)).toBe("/docs/#all-types");
    expect(mapUrl("io/index.html", ctx)).toBe("/docs/com/example/geo/io/");
    expect(mapUrl("Circle.html#area()", ctx)).toBe("/docs/com/example/geo/Circle#area()");
    expect(mapUrl("Circle.md", ctx)).toBe("/docs/com/example/geo/Circle.md");
    expect(mapUrl("../../../llms.txt", ctx)).toBe("/docs/llms.txt");
    expect(mapUrl("https://example.com/docs/com/example/geo/Circle.html", ctx)).toBe("https://example.com/docs/com/example/geo/Circle");
    expect(mapUrl("https://example.com/docs/index.html", ctx)).toBe("https://example.com/docs/");
  });
  test("leaves fragments, other sites and other schemes alone", () => {
    for (const url of ["#area()", "https://docs.oracle.com/x.html", "mailto:a@example.com", "/other/x.html", "../../../../../escape.html"]) expect(mapUrl(url, ctx)).toBe(url);
  });
});

describe("renderPage", () => {
  const base = "/docs/";
  const pageOf = (model: Model, page: string) => renderPage(model, page, theme, { base, baseUrl: theme.baseUrl });

  test("every site link is root-absolute in the Astro form; nothing names an .html page of the site", () => {
    for (const [name, model] of Object.entries(models)) {
      const out = render(model, theme);
      for (const file of Object.keys(out).filter(f => f.endsWith(".html")).slice(0, 40)) {
        const parts = pageOf(model, file.slice(0, -".html".length));
        const html = parts.head + parts.body.join("");
        for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
          const url = m[1]!.replace(/&amp;/g, "&");
          if (/^[a-z]+:/i.test(url)) {
            if (url.startsWith(theme.baseUrl)) expect(`${name} ${file} ${url}`).not.toMatch(/\.html(#|$)/);
            continue;
          }
          expect(`${name} ${file} ${url}`).toMatch(new RegExp(`^${name} ${file.replace(/[.()$]/g, "\\$&")} (/docs/|#)`));
          expect(url).not.toMatch(/\.html(#|$)/);
        }
      }
    }
  });

  test("the head's metadata is the static renderer's, apart from the URL form", () => {
    for (const [name, model] of Object.entries(models)) {
      const out = render(model, theme);
      for (const file of Object.keys(out).filter(f => f.endsWith(".html")).slice(0, 25)) {
        const page = file.slice(0, -".html".length);
        const ctx = { page, base, baseUrl: theme.baseUrl };
        const staticHead = (out[file] as string).split("<head>")[1]!.split("</head>")[0]!;
        const astroHead = pageOf(model, page).head;
        const metadata = (head: string, map: (u: string) => string) => ({
          title: /<title>(.*?)<\/title>/.exec(head)?.[1],
          meta: [...head.matchAll(/<meta (?:name|property)="([^"]*)" content="([^"]*)"\/>/g)].map(m => [m[1], m[1] === "og:url" ? map(m[2]!) : m[2]]),
          links: [...head.matchAll(/<link rel="(canonical|alternate|index)"[^>]*? href="([^"]*)"/g)].map(m => [m[1], map(m[2]!)]),
          jsonLd: JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(head)![1]!, (key, value) => (["url", "item", "contentUrl"].includes(key) ? map(value) : value)),
        });
        expect(`${name} ${page}`).toBeTruthy();
        expect(metadata(astroHead, u => u)).toEqual(metadata(staticHead, u => mapUrl(u, ctx)));
      }
    }
  });

  test("static-only head and body parts stay out; the router's persisted elements carry the site's base", () => {
    const parts = pageOf(samples.java, "com/example/geo/Circle");
    const html = parts.head + parts.body.join("");
    expect(html).not.toContain("speculationrules");
    expect(html).not.toContain("assets/apidocs.js");
    expect(html).not.toContain('rel="stylesheet"');
    expect(html).toContain('data-astro-transition-persist="apidocs-topbar:/docs/"');
    expect(html).toContain('data-astro-transition-persist="apidocs-nav:/docs/"');
    expect(parts.body).toHaveLength(4);
    expect(parts.themeCss).toContain(":root:root{");
    expect(parts.preload).toEqual(["/docs/assets/fonts/jetbrains-mono-latin-wght-normal.woff2"]);
    expect(parts.moduleVersion).toBe('<span class="module-version"><span class="version">2.1.0</span></span>');
  });

  test("an unknown page is an error, not an empty page", () => {
    expect(() => pageOf(samples.java, "com/example/geo/Nope")).toThrow("no page");
  });
});
