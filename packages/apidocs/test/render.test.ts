import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { samples } from "../samples";
import { generate } from "../scripts/gen-types";
import { search } from "../src/client/search";
import { highlight } from "../src/highlight";
import type { Model, Token } from "../src/model";
import { render } from "../src/render";
import { sanitize } from "../src/sanitize";
import { layoutSignature } from "../src/signature";
import { navIndexes, sharedPrefix, suites } from "../src/components/chrome";
import { buildSite } from "../src/site";
import { checkSite } from "./check";
import { validate } from "./validate";

const fixture: Model = JSON.parse(readFileSync(new URL("fixtures/fixture-java.api.json", import.meta.url), "utf8"));
const models: Record<string, Model> = { fixture, java: samples.java, kotlin: samples.kotlin };

function allowed(model: Model): string[] {
  return [...(model.externals ?? []).map(e => e.url.split("{")[0]!), "https://example.com/", "https://en.wikipedia.org/", "https://kotlinlang.org/"];
}

describe("schema", () => {
  for (const [name, model] of Object.entries(models)) {
    test(`${name} model is valid apidocs/1`, () => expect(validate(model)).toEqual([]));
  }
  test("src/model.ts is generated from the schema", () => {
    const schema = JSON.parse(readFileSync(new URL("../schema/apidocs-1.schema.json", import.meta.url), "utf8"));
    expect(readFileSync(new URL("../src/model.ts", import.meta.url), "utf8")).toBe(generate(schema));
  });
  test("the Elide artwork module is current", () => {
    const check = spawnSync("bun", ["scripts/gen-artwork.ts", "--check"], { cwd: new URL("..", import.meta.url).pathname });
    expect(check.status).toBe(0);
  });
  test("the validator rejects what the schema forbids", () => {
    expect(validate({ schema: "apidocs/1", module: { name: "m" }, extra: 1 })).toContain("$: unexpected property extra");
    expect(validate({ schema: "apidocs/2", module: { name: "m" } })).toHaveLength(1);
    const bad = structuredClone(fixture);
    (bad.packages![0]!.types![0]! as { kind: string }).kind = "struct";
    expect(validate(bad).join()).toContain("is not one of");
  });
});

describe("render", () => {
  const out = render(fixture);
  test("is deterministic", () => expect(render(fixture)).toEqual(out));
  test("accepts the model and theme as JSON text", () => expect(render(JSON.stringify(fixture), "{}")).toEqual(out));
  test("rejects another schema", () => expect(() => render({ ...fixture, schema: "apidocs/0" as "apidocs/1" })).toThrow("apidocs/1"));
  test("writes every page as HTML and Markdown, and the indexes", () => {
    for (const page of ["index", "fixture/java/index", "fixture/java/Geometry", "fixture/java/Canvas.Layer.Kind", "fixture/java/io/ShapeReader"]) {
      expect(out[`${page}.html`]).toBeString();
      expect(out[`${page}.md`]).toBeString();
    }
    for (const file of ["llms.txt", "llms-full.txt", "api.json", "element-list", "assets/search-index.js", "assets/theme.css"]) expect(out[file]).toBeDefined();
    expect(out["assets/apidocs.css"]).toEqual({ asset: "apidocs.css" });
    expect(out["sitemap.xml"]).toBeUndefined();
    expect(out["element-list"]).toBe("fixture.java\nfixture.java.io\n");
    const named = render({ ...fixture, module: { ...fixture.module, javaModule: "dev.example.fixture" } });
    expect(named["element-list"]).toBe("module:dev.example.fixture\nfixture.java\nfixture.java.io\n");
  });
  test("uses the JDK doclet's anchors", () => {
    const html = out["fixture/java/io/ShapeReader.html"] as string;
    expect(html).toContain('id="read(java.io.InputStream)"');
    expect(out["fixture/java/Polygon.html"] as string).toContain('id="&lt;init>(double...)"');
  });
  test("HTML snapshots", () => {
    for (const page of ["fixture/java/Geometry.html", "fixture/java/Circle.html", "fixture/java/index.html", "index.html"]) {
      expect(out[page]).toMatchSnapshot(page);
    }
  });
  test("a base URL adds canonical links and a sitemap", () => {
    const site = render(fixture, { baseUrl: "https://docs.example.com/api/" });
    expect(site["sitemap.xml"]).toContain("<loc>https://docs.example.com/api/fixture/java/Geometry.html</loc>");
    expect(site["index.html"]).toContain('rel="canonical" href="https://docs.example.com/api/index.html"');
  });
  test("the neutral default carries no Elide branding (fixture text has none)", () => {
    for (const model of [fixture]) {
      for (const [file, content] of Object.entries(render(model))) {
        if (typeof content === "string" && file !== "api.json" && file !== "llms-full.txt") expect(`${file}: ${content}`).not.toMatch(/elide/i);
      }
    }
  });
  test("the Elide preset adds its artwork and fonts", () => {
    const site = render(fixture, { extends: "elide" });
    expect(site["assets/logo-light.svg"]).toContain("<svg");
    expect(site["assets/fonts/jetbrains-mono-latin-wght-normal.woff2"]).toEqual({ asset: "fonts/jetbrains-mono-latin-wght-normal.woff2" });
    // Prose and headings use the reader's system fonts: no other font file ships.
    expect(Object.keys(site).filter(f => f.startsWith("assets/fonts/")).sort()).toEqual(["assets/fonts/jetbrains-mono-latin-wght-italic.woff2", "assets/fonts/jetbrains-mono-latin-wght-normal.woff2"]);
    expect(site["assets/theme.css"]).toContain("--apidocs-accent:#6d28d9");
  });
  test("notes render as distinct callouts, the API note first", () => {
    const html = out["fixture/java/Geometry.html"] as string;
    expect(html).toContain('class="callout callout-implSpec"');
    const shapes = render(samples.java)["com/example/geo/Shapes.html"] as string;
    const parse = shapes.slice(shapes.indexOf('id="parse(java.lang.String)"'));
    expect(parse.indexOf("callout-apiNote")).toBeGreaterThan(0);
    expect(parse.indexOf("callout-apiNote")).toBeLessThan(parse.indexOf("callout-implNote"));
    expect(render(samples.java, { symbols: "none" })["com/example/geo/Shapes.md"]).toContain("> **API note**");
  });
});

describe("agent readiness", () => {
  const base = "https://example.com/geo/";
  const elide = render(samples.java, { extends: "elide", baseUrl: base, lastModified: "2026-11-21" });
  const head = (html: string) => html.split("<head>")[1]!.split("</head>")[0]!;
  const graph = (html: string) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)![1]!)["@graph"];

  test("a theme's social image gives og:image, its size and alt text, and the large card; none without one", () => {
    const h = head(elide["com/example/geo/Shapes.html"] as string);
    expect(h).toContain(`<meta property="og:image" content="${base}assets/social/elide.png"/>`);
    expect(h).toContain('<meta property="og:image:width" content="1200"/>');
    expect(h).toContain('<meta property="og:image:height" content="630"/>');
    expect(h).toContain('<meta property="og:image:alt" content="The Elide logo on a dark background"/>');
    expect(h).toContain('<meta name="twitter:card" content="summary_large_image"/>');
    expect(elide["assets/social/elide.png"]).toEqual({ asset: "social/elide.png" });
    expect(head(render(samples.java)["index.html"] as string)).toContain('<meta property="og:image" content="assets/social/neutral.png"/>');
    const none = head(render(samples.java, { socialImage: null })["index.html"] as string);
    expect(none).not.toContain("og:image");
    expect(none).toContain('<meta name="twitter:card" content="summary"/>');
    // A URL that is not http(s), or an asset path that climbs out of assets/, is dropped.
    expect(render(samples.java, { socialImage: { url: "javascript:x", width: 1, height: 1, alt: "" } })["index.html"]).not.toContain("og:image");
    expect(Object.keys(render(samples.java, { socialImage: { asset: "../secret.png", width: 1, height: 1, alt: "" } }))).not.toContain("assets/../secret.png");
  });
  test("the overview's JSON-LD lists the guides and packages, every page's has a url", () => {
    const parts = graph(elide["index.html"] as string)[0].hasPart as { "@type": string; name: string; url: string }[];
    expect(parts[0]).toEqual({ "@type": "TechArticle", name: "Getting started", url: `${base}guides/getting-started.html` });
    expect(parts.find(p => p.name === "com.example.geo")).toEqual({ "@type": "APIReference", name: "com.example.geo", url: `${base}com/example/geo/index.html` });
    expect(graph(elide["com/example/geo/Shapes.html"] as string)[0].url).toBe(`${base}com/example/geo/Shapes.html`);
    // Relative without a base URL, as the breadcrumbs are.
    expect(graph(render(samples.java)["com/example/geo/Shapes.html"] as string)[0].url).toBe("Shapes.html");
  });
  test("404.html and 404.md: the page shell with the way back, links from the site's address, kept out of the indexes", () => {
    const html = elide["404.html"] as string;
    expect(html).toContain(`<head><base href="${base}"/>`);
    expect(html).toContain('<meta name="robots" content="noindex"/>');
    expect(html).not.toContain('rel="canonical"');
    expect(html).toContain('<h1>Not found</h1>');
    expect(html).toContain('<a href="deprecated.html">Deprecated</a>');
    expect(elide["404.md"]).toContain(`Start at the [overview](${base}index.md)`);
    expect(render(samples.java)["404.md"]).toContain("Start at the [overview](index.md)");
    expect(elide["llms.txt"]).not.toContain("404");
    expect(elide["sitemap.xml"]).not.toContain("404");
  });
  test("sitemap.xml has lastmod from the theme, never from the clock", () => {
    expect(elide["sitemap.xml"]).toContain(`<url><loc>${base}index.html</loc><lastmod>2026-11-21</lastmod></url>`);
    expect(render(samples.java, { baseUrl: base })["sitemap.xml"]).not.toContain("lastmod");
    expect(render(samples.java, { baseUrl: base, lastModified: "yesterday" })["sitemap.xml"]).not.toContain("lastmod");
  });
  test("llms.txt says when to use the reference: the theme's text, or a sentence from the module's", () => {
    expect(elide["llms.txt"]).toContain("## When to use this\n\nUse this API reference when you write, read or review code that uses geo 2.1.0. A small geometry library: the Java-flavored sample for @elide/apidocs.");
    expect(render(samples.java, { whenToUse: "Read the guides first." })["llms.txt"]).toContain("## When to use this\n\nRead the guides first.");
  });
  test("Markdown twins open with frontmatter; llms-full.txt joins them without it", () => {
    expect((elide["com/example/geo/Shapes.md"] as string).split("\n---\n")[0]).toBe(
      `---\ntitle: "Shapes"\ndescription: "Operations on shapes."\nkind: "class"\nid: "com.example.geo.Shapes"\nmodule: "geo"\nversion: "2.1.0"\ncanonical: "${base}com/example/geo/Shapes.html"`);
    expect(elide["guides/concepts.md"]).toMatch(/^---\ntitle: "Concepts"\n[\s\S]*kind: "guide"\nid: "guide:concepts"/);
    expect(elide["packages.md"]).toMatch(/^---\ntitle: "Packages"\ndescription: "Packages: every package with its summary and type counts\."\nkind: "index"/);
    const full = elide["llms-full.txt"] as string;
    expect(full).not.toMatch(/^(title|kind|canonical): "/m);
    expect(full).toContain("<!-- com/example/geo/Shapes.md -->\n# ");
  });
});

describe("layout", () => {
  const java = render(samples.java, { extends: "elide" });
  const between = (html: string, start: string, end: string) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));

  test("sharedPrefix: one package, several, one equal to the prefix, the default package", () => {
    expect(sharedPrefix(["com.example.geo"])).toBe("com.example");
    expect(sharedPrefix(["com.example.geo.io", "com.example.geo.spi"])).toBe("com.example.geo");
    expect(sharedPrefix(["com.example.geo", "com.example.geo.io"])).toBe("com.example");
    expect(sharedPrefix(["", "org.example.kgeo"])).toBe("org.example");
    expect(sharedPrefix([""])).toBe("");
    expect(sharedPrefix(["alpha", "beta"])).toBe("");
  });
  test("the navigator has no disclosure widgets", () => {
    for (const page of ["index.html", "com/example/geo/index.html", "com/example/geo/Shapes.Builder.Option.html"]) {
      const nav = between(java[page] as string, '<nav class="sidebar"', "</nav>");
      expect(nav.length).toBeGreaterThan(100);
      expect(nav).not.toContain("<details");
    }
  });
  test("a rail section with more than 12 entries is folded; a short one is not", () => {
    const rail = (page: string) => between(java[page] as string, '<nav class="toc"', "</nav>");
    expect(rail("com/example/geo/registry/ShapeCatalog.html")).toContain('<details class="toc-more">');
    expect(rail("com/example/geo/Circle.html")).not.toContain('<details class="toc-more">');
  });
  test("script-only controls are marked, and the head marks script support before paint", () => {
    const html = java["com/example/geo/Shapes.html"] as string;
    for (const control of ["data-search", "data-theme-switch", "data-nav-filter"]) {
      expect(html).toMatch(new RegExp(`${control}="true"[^>]*data-js-only|data-js-only[^>]*${control}`));
    }
    const head = between(html, "<head>", "</head>");
    expect(head).toContain('setAttribute("data-js","")');
    expect(head.indexOf('setAttribute("data-js","")')).toBeLessThan(head.indexOf("apidocs.css") < 0 ? Infinity : head.length);
  });
  test("the navigator toggle is a checkbox that works without script", () => {
    const html = java["index.html"] as string;
    expect(html).toContain('<input type="checkbox" id="apidocs-nav-toggle"');
    expect(html).toContain('for="apidocs-nav-toggle"');
  });
  test("theme links are resolved from the site root on pages at any depth, header and footer alike", () => {
    const out = render(samples.java, { links: { header: [{ label: "Guide", url: "guides/concepts.html" }, { label: "Here", url: "./", current: true }], footer: [{ label: "Notes", url: "guides/concepts.html" }, { label: "Root", url: "/docs/" }, { label: "Elsewhere", url: "https://example.com/x" }] } });
    const footer = (page: string) => between(out[page] as string, '<p class="footer-links">', "</p>");
    expect(footer("index.html")).toContain('href="guides/concepts.html"');
    expect(footer("com/example/geo/Shapes.html")).toContain('href="../../../guides/concepts.html"');
    expect(footer("com/example/geo/Shapes.html")).toContain('href="/docs/"');
    expect(footer("com/example/geo/Shapes.html")).toContain('href="https://example.com/x"');
    expect(between(out["com/example/geo/Shapes.html"] as string, '<nav class="suites-row"', "</nav>")).toContain('href="../../../guides/concepts.html"');
    expect(checkSite(out, { allowed: [...allowed(samples.java), "/docs/"] }).filter(e => !e.includes("/docs/"))).toEqual([]);
  });
  test("the suite switcher marks the current site, given or inferred, and is left out with nothing to switch to", () => {
    const sites = [{ label: "Guide", url: "https://example.com/guide/" }, { label: "API", url: "https://example.com/api/" }];
    expect(suites({ links: { header: sites } }, "index").map(s => s.current)).toEqual([false, false]);
    expect(suites({ links: { header: [sites[0]!, { ...sites[1]!, current: true }] } }, "a/B").map(s => [s.current, s.href])).toEqual([[false, "https://example.com/guide/"], [true, "../index.html"]]);
    // Inferred from the base URL, or from a link to the site's own root.
    expect(suites({ baseUrl: "https://example.com/api/", links: { header: sites } }, "index").map(s => s.current)).toEqual([false, true]);
    expect(suites({ links: { header: [sites[0]!, { label: "API", url: "index.html" }] } }, "index").map(s => s.current)).toEqual([false, true]);
    // Only this site, or no links: no switcher.
    expect(suites({ links: { header: [{ label: "API", url: "./" }] } }, "index")).toEqual([]);
    expect(suites({}, "index")).toEqual([]);
    expect(java["index.html"]).not.toContain('class="suites"');
    const html = render(samples.java, { extends: "elide", links: { header: [...sites, { label: "Here", url: "./", current: true }] } })["com/example/geo/Shapes.html"] as string;
    expect(between(html, '<nav class="suites-row"', "</nav>")).toContain('<a href="../../../index.html" aria-current="true">Here</a>');
    expect(between(html, '<section class="nav-section nav-suites"', "</section>")).toContain(">Guide<");
  });
  test("the navigator lists the indexes: rows under Reference past two, the current one marked; none on a guides-only site", () => {
    const site = buildSite(samples.java);
    expect(navIndexes(site, "types").map(e => [e.label, e.current])).toEqual([["Overview", false], ["Packages", false], ["All types", true], ["Index", false], ["Deprecated", false]]);
    const nav = between(java["com/example/geo/Shapes.html"] as string, '<nav class="sidebar"', "</nav>");
    expect(nav).toContain('<section class="nav-section nav-reference"><h2 class="nav-heading"><span>Reference</span></h2>');
    expect(between(java["types.html"] as string, '<section class="nav-section nav-reference"', "</section>")).toContain('<a class="nav-row" href="types.html" aria-current="page">');
    expect(java["index.html"]).not.toContain('class="topbar-nav"');
    // A guides-only site whose overview is a guide has none: the overview is the first guide row.
    const guides = render({ ...samples.java, packages: [], module: { ...samples.java.module, overview: samples.java.module.guides![0]!.id } });
    expect(guides["index.html"]).not.toMatch(/nav-reference|nav-index/);
    // One with a generated overview has a one-link row.
    const plain = render({ ...samples.java, packages: [], module: { ...samples.java.module, overview: undefined } });
    expect(between(plain["index.html"] as string, '<ul class="nav-index"', "</ul>")).toContain(">Overview<");
    // The filter is there on guides-only sites too, and filters guides and types, never sites, indexes or packages.
    expect(plain["index.html"]).toContain("data-nav-filter");
    expect(nav).toContain('<section class="nav-section nav-guides" data-nav-filterable');
    expect(nav).not.toMatch(/nav-packages" data-nav-filterable|nav-reference" data-nav-filterable/);
  });
  test("font preloads are added at run time off file://, upright faces only", () => {
    const head = between(java["com/example/geo/Shapes.html"] as string, "<head>", "</head>");
    expect(head).not.toContain('<link rel="preload"');
    expect(head).toContain('if(location.protocol!=="file:")');
    const urls = JSON.parse(/\(location\.protocol!=="file:"\)(\[[^\]]*\])/.exec(head)![1]!) as string[];
    expect(urls.map(u => u.split("/").pop())).toEqual(["jetbrains-mono-latin-wght-normal.woff2"]);
    // A theme without font files preloads nothing.
    expect(render(fixture)["index.html"]).not.toContain(".forEach(function(h)");
  });
});

describe("output checker", () => {
  for (const [name, model] of Object.entries(models)) {
    for (const preset of ["neutral", "elide"] as const) {
      test(`${name} with ${preset} passes`, () => expect(checkSite(render(model, { extends: preset }), { allowed: allowed(model) })).toEqual([]));
    }
  }
  test("reads only script code for fetch and import(), not prose or string data", () => {
    expect(checkSite({
      "a.html": "<p>Modules that programs import (the stdlib) and fetch (later).</p><script>var s = \"fetch(x)\";</script>",
      "b.js": 'window.index = ["programs import (the stdlib)"];',
    }, { allowed: [] })).toEqual([]);
    expect(checkSite({ "a.html": "<script>fetch('x')</script>", "b.js": "import('x')" }, { allowed: [] }))
      .toEqual(["a.html: uses fetch", "b.js: dynamic import"]);
  });
  test("allows inline classic scripts and JSON-LD; rejects module scripts", () => {
    expect(checkSite({ "a.html": '<script>document.documentElement.setAttribute("data-js","")</script><script type="application/ld+json">{}</script>' }, { allowed: [] })).toEqual([]);
    expect(checkSite({ "a.html": '<script type="module">x()</script>' }, { allowed: [] })).toEqual(["a.html: module script"]);
  });
  test("finds what breaks portability", () => {
    const errors = checkSite({
      "a.html": '<a href="https://evil.example/x">x</a><a href="b.html#nope">b</a><a href="missing.html">m</a><a href="#top">t</a><a href="dir/">d</a><script type="module" src="c.js"></script>',
      "b.html": '<p id="yes"></p>',
      "c.js": "fetch('x')",
    }, { allowed: [] });
    expect(errors).toEqual([
      "a.html: module script",
      "a.html: absolute URL https://evil.example/x",
      "a.html: link to a missing anchor b.html#nope",
      "a.html: link to a missing file missing.html",
      'a.html: link does not name its file: "#top"',
      "a.html: link names a directory: dir/",
      "c.js: uses fetch",
    ]);
  });
});

describe("runner", () => {
  test("renders through dist/runner.mjs, with --source-ref filling the theme's {ref}", () => {
    const work = mkdtempSync(join(tmpdir(), "apidocs-runner-"));
    try {
      writeFileSync(join(work, "model.json"), JSON.stringify(fixture));
      writeFileSync(join(work, "theme.json"), JSON.stringify({ sourceLink: "https://example.com/blob/{ref}/{path}#L{line}" }));
      const dist = new URL("../dist/", import.meta.url).pathname;
      const run = spawnSync(process.execPath, [`${dist}runner.mjs`, "--bundle", `${dist}render.js`, "--assets", `${dist}assets`,
        "--model", join(work, "model.json"), "--theme", join(work, "theme.json"), "--source-ref", "v1.2.3", "--out", join(work, "out")], { encoding: "utf8" });
      expect(run.stderr).toBe("");
      expect(JSON.parse(run.stdout).files).toBeGreaterThan(40);
      expect(readFileSync(join(work, "out/fixture/java/Geometry.html"), "utf8")).toContain("https://example.com/blob/v1.2.3/fixture/java/Geometry.java#L");
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});

describe("parts", () => {
  test("highlights Java and Kotlin", () => {
    expect(highlight('String s = "a"; // c', "java")).toEqual([
      { cls: "t", text: "String" }, { text: " s = " }, { cls: "s", text: '"a"' }, { text: "; " }, { cls: "c", text: "// c" },
    ]);
    expect(highlight("suspend fun f() = 1", "kotlin").filter(r => r.cls === "k").map(r => r.text)).toEqual(["suspend", "fun"]);
    expect(highlight("x", "cobol")).toEqual([{ text: "x" }]);
  });
  test("lays out long signatures one parameter per line", () => {
    const tokens: Token[] = [
      { kind: "keyword", text: "public" }, { kind: "punct", text: " " }, { kind: "name", text: "transform" },
      { kind: "punct", text: "(" }, { kind: "type", text: "Map" }, { kind: "punct", text: "<" }, { kind: "type", text: "String" },
      { kind: "punct", text: ", " }, { kind: "type", text: "Object" }, { kind: "punct", text: "> " }, { kind: "param", text: "aVeryLongParameterName" },
      { kind: "punct", text: ", " }, { kind: "keyword", text: "int" }, { kind: "punct", text: " " }, { kind: "param", text: "anotherQuiteLongParameterName" },
      { kind: "punct", text: ")" },
    ];
    expect(layoutSignature(tokens).map(t => t.text).join("")).toBe(
      "public transform(\n    Map<String, Object> aVeryLongParameterName,\n    int anotherQuiteLongParameterName\n)");
    expect(layoutSignature(tokens.slice(0, 4))).toEqual(tokens.slice(0, 4));
  });
  test("ranks search results", () => {
    const entries: [string, string, string, string, string][] = [
      ["readAll()", "method", "a", "Reader", ""], ["Reader", "class", "b", "p", ""], ["ShapeReader", "class", "c", "p", ""], ["thread()", "method", "d", "X", ""],
    ];
    expect(search(entries, "reader").map(e => e[0])).toEqual(["Reader", "ShapeReader", "readAll()"]);
    expect(search(entries, "read").map(e => e[0])).toEqual(["Reader", "readAll()", "ShapeReader", "thread()"]);
    expect(search(entries, "")).toEqual([]);
  });
  test("drops executable markup from raw nodes", () => {
    expect(sanitize('<sup onclick="x()">2</sup><script>alert(1)</script><a href="javascript:x">y</a>')).toBe("<sup>2</sup><a>y</a>");
  });
});
