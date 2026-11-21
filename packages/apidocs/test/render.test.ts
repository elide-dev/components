import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { samples } from "../samples";
import { generate } from "../scripts/gen-types";
import { search } from "../src/client/search";
import { highlight } from "../src/highlight";
import type { Model, Token } from "../src/model";
import { render } from "../src/render";
import { sanitize } from "../src/sanitize";
import { layoutSignature } from "../src/signature";
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
    expect(html).toContain('class="note note-implSpec"');
    const shapes = render(samples.java)["com/example/geo/Shapes.html"] as string;
    const parse = shapes.slice(shapes.indexOf('id="parse(java.lang.String)"'));
    expect(parse.indexOf("note-apiNote")).toBeLessThan(parse.indexOf("note-implNote"));
    expect(render(samples.java)["com/example/geo/Shapes.md"]).toContain("> **API note**");
  });
});

describe("output checker", () => {
  for (const [name, model] of Object.entries(models)) {
    for (const preset of ["neutral", "elide"] as const) {
      test(`${name} with ${preset} passes`, () => expect(checkSite(render(model, { extends: preset }), { allowed: allowed(model) })).toEqual([]));
    }
  }
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
