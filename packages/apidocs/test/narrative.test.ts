/** Guides: schema, ordering, anchors, links, outputs, backward compatibility and hostile input. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { samples } from "../samples";
import type { Guide, Model } from "../src/model";
import { render } from "../src/render";
import { buildSite, orderGuides } from "../src/site";
import { compactTokens, guideAnchors } from "../src/structure";
import { checkSite } from "./check";
import { validate } from "./validate";

const fixture: Model = JSON.parse(readFileSync(new URL("fixtures/fixture-java.api.json", import.meta.url), "utf8"));
const allowed = (model: Model) => [...(model.externals ?? []).map(e => e.url.split("{")[0]!), "https://example.com/", "https://en.wikipedia.org/", "https://kotlinlang.org/", "https://jspecify.dev/"];
const p = (text: string) => ({ kind: "paragraph" as const, children: [{ kind: "text" as const, text }] });
const h = (level: number, text: string, anchor?: string) => ({ kind: "heading" as const, level, children: [{ kind: "text" as const, text }], ...(anchor ? { anchor } : {}) });
const g = (slug: string, extra: Partial<Guide> = {}): Guide => ({ id: `guide:${slug}`, slug, title: slug, ...extra });
const withGuides = (guides: Guide[], doc?: Model["module"]["doc"]): Model => ({ schema: "apidocs/1", module: { name: "m", guides, ...(doc ? { doc } : {}) } });

describe("schema", () => {
  for (const [name, model] of Object.entries(samples)) test(`${name} sample with guides is valid`, () => expect(validate(model)).toEqual([]));
  test("rejects an admonition without a tone and an unknown tone", () => {
    expect(validate(withGuides([g("a", { body: [{ kind: "admonition" } as never] })])).length).toBeGreaterThan(0);
    expect(validate(withGuides([g("a", { body: [{ kind: "admonition", tone: "danger" } as never] })])).length).toBeGreaterThan(0);
  });
});

describe("backward compatibility", () => {
  test("a model without guides gets no guide files and no guide links; an empty list renders the same", () => {
    const out = render(fixture);
    const empty = render({ ...fixture, module: { ...fixture.module, guides: [] } });
    expect({ ...empty, "api.json": "" }).toEqual({ ...out, "api.json": "" });
    for (const [file, content] of Object.entries(out)) {
      expect(file.startsWith("guides/")).toBe(false);
      if (typeof content === "string" && file !== "api.json") expect(content).not.toContain("guides/");
    }
    expect(out["llms.txt"] as string).not.toContain("## Guides");
  });
});

describe("ordering and pages", () => {
  test("ungrouped first, groups by first appearance, order before unordered, model order on ties", () => {
    const list = [g("c"), g("x/b", { group: "X", order: 2 }), g("a", { order: 1 }), g("x/a", { group: "X", order: 1 }), g("y/a", { group: "Y" }), g("d")];
    expect(orderGuides(list).map(x => x.slug)).toEqual(["a", "c", "d", "x/a", "x/b", "y/a"]);
  });
  test("slugs become safe paths; a taken page gets a suffix", () => {
    const site = buildSite(withGuides([g("../../etc/Passwd"), g("a b/C"), g(""), g("a-b/c")]));
    expect(site.guides.map(e => e.page)).toEqual(["guides/etc/passwd", "guides/a-b/c", "guides/guide", "guides/a-b/c-2"]);
  });
});

describe("anchors", () => {
  test("readable, deduplicated, never a shell id, explicit anchors win", () => {
    const body = [h(2, "Café & Crème"), h(2, "Example"), h(3, "Example"), h(2, "Content"), h(2, "Any", "custom-id"), { kind: "admonition" as const, tone: "note" as const, children: [h(2, "Example")] }, h(4, "Deep")];
    const { anchors, sections } = guideAnchors(body, ["content"]);
    expect([...anchors.values()]).toEqual(["cafe-creme", "example", "example-2", "content-2", "custom-id", "example-3", "deep"]);
    expect(sections.map(s => [s.anchor, s.level])).toEqual([["cafe-creme", 2], ["example", 2], ["example-2", 3], ["content-2", 2], ["custom-id", 2]]);
  });
  test("links to a guide and a section resolve in HTML and Markdown; a missing guide is plain text", () => {
    const link = (id: string, section?: string) => ({ kind: "link" as const, target: { id, ...(section ? { section } : {}) }, children: [{ kind: "text" as const, text: `to ${id}${section ?? ""}` }] });
    const model = withGuides([g("a/b", { body: [h(2, "Intro"), { kind: "paragraph", children: [link("guide:c", "usage"), link("guide:missing")] }] }), g("c", { body: [h(2, "Usage")] })],
      { body: [{ kind: "paragraph", children: [link("guide:a/b", "intro")] }] });
    const out = render(model);
    expect(out["index.html"] as string).toContain('href="guides/a/b.html#intro"');
    expect(out["index.md"] as string).toContain("(guides/a/b.md#intro)");
    expect(out["guides/a/b.html"] as string).toContain('href="../c.html#usage"');
    expect(out["guides/a/b.html"] as string).toContain("to guide:missing");
    expect(out["guides/a/b.html"] as string).not.toContain("missing.html");
    expect(checkSite(out, { allowed: [] })).toEqual([]);
  });
  test("the checker reports a link to a missing section", () => {
    const model = withGuides([g("a", { body: [{ kind: "paragraph", children: [{ kind: "link", target: { id: "guide:b", section: "nope" }, children: [{ kind: "text", text: "x" }] }] }] }), g("b")]);
    expect(checkSite(render(model), { allowed: [] })).toEqual(["guides/a.html: link to a missing anchor ../guides/b.html#nope".replace("../guides/", "")]);
  });
});

describe("outputs", () => {
  const out = render(samples.java, { baseUrl: "https://docs.example.com/" });
  test("both samples pass the output checker", () => {
    for (const [name, model] of Object.entries(samples)) expect(checkSite(render(model, { extends: "elide" }), { allowed: allowed(model) })).toEqual([]);
  });
  test("llms.txt lists guides before the reference pages; llms-full.txt puts them after the overview", () => {
    const llms = out["llms.txt"] as string;
    expect(llms.indexOf("## Guides")).toBeGreaterThan(0);
    expect(llms.indexOf("## Guides")).toBeLessThan(llms.indexOf("## Pages"));
    expect(llms.indexOf("guides/getting-started.md")).toBeLessThan(llms.indexOf("guides/concepts.md"));
    expect(llms.indexOf("guides/concepts.md")).toBeLessThan(llms.indexOf("guides/migrating-from-1x.md"));
    expect(llms.indexOf("guides/advanced/custom-shapes.md")).toBeLessThan(llms.indexOf("guides/advanced/text-format.md"));
    const full = out["llms-full.txt"] as string;
    expect(full.indexOf("<!-- guides/getting-started.md -->")).toBeLessThan(full.indexOf("<!-- com/example/geo/index.md -->"));
    expect(full.indexOf("<!-- index.md -->")).toBe(0);
  });
  test("search has an entry per guide and per section; the sitemap lists guides", () => {
    const index = JSON.parse((out["assets/search-index.js"] as string).replace(/^window\.apidocsSearch=/, "").replace(/;\n$/, "")) as string[][];
    expect(index).toContainEqual(["Concepts", "guide", "guides/concepts.html", "Guides", "Shapes, measuring and units: the ideas the reference pages assume."]);
    expect(index).toContainEqual(["Example", "section", "guides/concepts.html#example-2", "Concepts", ""]);
    expect(index).toContainEqual(["The text format", "guide", "guides/advanced/text-format.html", "Advanced", "The grammar Shapes.parse reads, and how to read files of shapes."]);
    expect(out["sitemap.xml"] as string).toContain("<loc>https://docs.example.com/guides/concepts.html</loc>");
  });
  test("every admonition tone renders as a callout, in HTML and Markdown", () => {
    const html = out["guides/concepts.html"] as string;
    for (const tone of ["note", "tip", "important", "warning", "caution", "apiNote", "implSpec", "implNote"]) expect(html).toContain(`callout callout-${tone}`);
    const md = out["guides/concepts.md"] as string;
    for (const alert of ["[!NOTE]", "[!TIP]", "[!IMPORTANT]", "[!WARNING]", "[!CAUTION]"]) expect(md).toContain(`> ${alert}`);
    expect(md).toContain("> **⚠︎ API note**");
  });
  test("guide page snapshots, HTML and Markdown", () => {
    for (const page of ["guides/concepts.md", "guides/advanced/text-format.md", "guides/getting-started.html"]) expect(out[page]).toMatchSnapshot(page);
  });
  test("compact tokens put a formatter-wrapped signature on one line", () => {
    const tokens = [{ kind: "name" as const, text: "f" }, { kind: "punct" as const, text: "(\n    " }, { kind: "param" as const, text: "a" }, { kind: "punct" as const, text: ",\n    " }, { kind: "param" as const, text: "b" }, { kind: "punct" as const, text: ",\n)" }];
    expect(compactTokens(tokens).map(t => t.text).join("")).toBe("f(a, b)");
  });
});

describe("hostile guides", () => {
  const evil = withGuides([{
    id: "guide:x", slug: "x", title: '<img src=x onerror="alert(1)">',
    summary: [{ kind: "link", url: "javascript:alert(2)", children: [{ kind: "text", text: "s" }] }],
    body: [
      h(2, '"><script>alert(3)</script>', '" onclick="alert(4)'),
      { kind: "paragraph", children: [
        { kind: "link", url: "jav&#x61;script:alert(5)", children: [{ kind: "text", text: "encoded" }] },
        { kind: "link", target: { id: "guide:x", section: '" onmouseover="alert(6)' }, children: [{ kind: "text", text: "section" }] },
        { kind: "raw", html: "<svg onload=alert(7)></svg>", text: "" },
      ] },
      { kind: "admonition", tone: "warning", title: [{ kind: "raw", html: "<b onclick=x>t</b>", text: "t" }], children: [{ kind: "raw", html: "<script>alert(8)</script>", text: "" }] },
    ],
  }]);
  const out = render(evil);
  test("no executable markup or unsafe URL reaches the output", () => {
    for (const [file, content] of Object.entries(out)) {
      if (typeof content !== "string" || file === "api.json" || file.endsWith(".js")) continue;
      // Markdown escapes the angle brackets of hostile text; HTML escapes them as entities.
      expect(content).not.toMatch(/javascript:|(?<!\\)<script>alert|(?<!\\)<img|(?<!\\)<svg onload/i);
    }
    // The hostile section names no heading, so the only finding is that missing anchor.
    expect(checkSite(out, { allowed: [] })).toEqual(["guides/x.html: link to a missing anchor x.html#%22%20onmouseover%3D%22alert(6)"]);
    expect(out["guides/x.html"] as string).toContain("encoded");
  });
  test("the hostile section becomes an encoded fragment", () => {
    expect(out["guides/x.html"] as string).toContain('href="x.html#%22%20onmouseover%3D%22alert(6)"');
  });
});
