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
import { sharedPrefix } from "../src/components/chrome";
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
    expect(site["assets/fonts/inter-latin-wght-normal.woff2"]).toEqual({ asset: "fonts/inter-latin-wght-normal.woff2" });
    expect(site["assets/theme.css"]).toContain("--apidocs-accent:#6d28d9");
  });
  test("notes render as distinct callouts, the API note first", () => {
    const html = out["fixture/java/Geometry.html"] as string;
    expect(html).toContain('class="callout callout-implSpec"');
    const shapes = render(samples.java)["com/example/geo/Shapes.html"] as string;
    const parse = shapes.slice(shapes.indexOf('id="parse(java.lang.String)"'));
    expect(parse.indexOf("callout-apiNote")).toBeGreaterThan(0);
    expect(parse.indexOf("callout-apiNote")).toBeLessThan(parse.indexOf("callout-implNote"));
    expect(render(samples.java)["com/example/geo/Shapes.md"]).toContain("> **API note**");
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
  test("font preloads are added at run time off file://, upright faces only", () => {
    const head = between(java["com/example/geo/Shapes.html"] as string, "<head>", "</head>");
    expect(head).not.toContain('<link rel="preload"');
    expect(head).toContain('if(location.protocol!=="file:")');
    const urls = JSON.parse(/\(location\.protocol!=="file:"\)(\[[^\]]*\])/.exec(head)![1]!) as string[];
    expect(urls.map(u => u.split("/").pop())).toEqual(["inter-latin-wght-normal.woff2", "instrument-sans-latin-wght-normal.woff2", "jetbrains-mono-latin-wght-normal.woff2"]);
    expect(render(fixture)["index.html"]).not.toContain("protocol");
  });
});

describe("output checker", () => {
  for (const [name, model] of Object.entries(models)) {
    for (const preset of ["neutral", "elide"] as const) {
      test(`${name} with ${preset} passes`, () => expect(checkSite(render(model, { extends: preset }), { allowed: allowed(model) })).toEqual([]));
    }
  }
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
