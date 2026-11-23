/** The Markdown importer: each construct, the diagnostics, hostile input, guides-only sites, the CLI and Komodo's suites. */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readSuite } from "../src/import/files";
import { imageSize } from "../src/import/images";
import { sanitizeSvg } from "../src/import/svg";
import { formatDiagnostic, guidesModel, importMarkdown, type ImportOptions, mapLink } from "../src/import/markdown";
import { suiteSite } from "../src/import/suite";
import type { Block, Guide, Inline, Model } from "../src/model";
import { type Output, render } from "../src/render";
import { checkSite } from "./check";
import { validate } from "./validate";

const root = fileURLToPath(new URL("..", import.meta.url));
const SAMPLE = join(root, "samples/guides");
const ERRORS = join(root, "test/fixtures/guides-errors");
const SAMPLE_LINKS = [{ prefix: "../developer/", target: "https://example.com/developer/" }, { prefix: "../api/", target: "https://example.com/api/" }];

/** A page with frontmatter. */
const page = (title: string, body: string, extra = "") => `---\ntitle: ${title}\ndescription: About ${title}.\n${extra}---\n\n${body}\n`;
const imp = (files: Record<string, string>, options: ImportOptions = {}) =>
  importMarkdown(Object.entries(files).map(([path, text]) => ({ path, text })), options);
/** The body of the one non-overview guide, or of the guide at a path. */
const bodyOf = (markdown: string, options: ImportOptions = {}): Block[] => {
  const result = imp({ "index.md": page("Home", "Home."), "a.md": page("A", markdown) }, options);
  return result.guides.find(g => g.slug === "a")!.body ?? [];
};
const first = (blocks: Block[]) => blocks[0]!;
const inl = (markdown: string): Inline[] => (first(bodyOf(markdown)) as { children: Inline[] }).children;

describe("suite files", () => {
  test("readSuite skips README.md at any depth", () => {
    const dir = mkdtempSync(join(tmpdir(), "apidocs-readme-"));
    try {
      writeFileSync(join(dir, "index.md"), "---\ntitle: Home\ndescription: The home page.\n---\n\nHello.\n");
      writeFileSync(join(dir, "README.md"), "## Not a page\n");
      mkdirSync(join(dir, "group"));
      writeFileSync(join(dir, "group", "readme.md"), "## Not a page either\n");
      const suite = readSuite(dir);
      expect(suite.files.map(f => f.path)).toEqual(["index.md"]);
      expect(suite.assets).toEqual([]);
      const result = importMarkdown(suite.files);
      expect(result.diagnostics).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("frontmatter", () => {
  test("title, description, sidebar.label and sidebar.order", () => {
    const result = imp({
      "index.md": page("Home", "x", "sidebar:\n  label: Start\n  order: 0\n"),
      "b.md": page("B page", "x", "sidebar:\n  order: 1\n"),
      "a.md": page("A page", "x", "sidebar:\n  order: 2\n  label: A\n"),
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.guides.map(g => [g.slug, g.title, g.navTitle, g.summary])).toEqual([
      ["index", "Home", "Start", [{ kind: "text", text: "About Home." }]],
      ["b", "B page", undefined, [{ kind: "text", text: "About B page." }]],
      ["a", "A page", "A", [{ kind: "text", text: "About A page." }]],
    ]);
  });
  test("drafts are left out unless included", () => {
    const files = { "index.md": page("Home", "x"), "d.md": page("D", "x", "draft: true\n") };
    expect(imp(files).guides.map(g => g.slug)).toEqual(["index"]);
    expect(imp(files).drafts).toEqual(["d.md"]);
    expect(imp(files, { includeDrafts: true }).guides.map(g => g.slug)).toEqual(["index", "d"]);
  });
  test("an unknown key is an error naming the file and the key, unless accepted", () => {
    const files = { "index.md": page("Home", "x", "template: splash\nsidebar:\n  badge: New\n") };
    expect(imp(files).diagnostics.map(d => formatDiagnostic(d))).toEqual([
      'index.md:4: unknown frontmatter key "template"; the importer reads title, description, sidebar.label, sidebar.order and draft',
      'index.md:6: unknown frontmatter key "sidebar.badge"; the importer reads sidebar.label and sidebar.order',
    ]);
    expect(imp(files, { extraKeys: ["template", "sidebar.badge"] }).diagnostics).toEqual([]);
  });
  test("bad values and a missing title are errors; a missing description is a warning", () => {
    const result = imp({ "index.md": "---\nsidebar:\n  order: first\ndraft: maybe\n---\n\nx\n" });
    expect(result.diagnostics.map(d => `${d.severity} ${d.line} ${d.message}`)).toEqual([
      "error 3 sidebar.order must be a number",
      "error 4 draft must be true or false",
      "error 1 the frontmatter has no title",
      "warning 1 the frontmatter has no description, which listings, search and llms.txt show",
    ]);
  });
});

describe("structure", () => {
  const files = {
    "index.md": page("Suite", "x", "sidebar:\n  label: Overview\n"),
    "zeta.md": page("Zeta", "x"),
    "alpha.md": page("Alpha", "x"),
    "usage/index.md": page("Using it", "x", "sidebar:\n  order: 2\n"),
    "usage/running.md": page("Running", "x", "sidebar:\n  order: 1\n"),
    "usage/advanced/index.md": page("Advanced", "x"),
    "usage/advanced/tuning.md": page("Tuning", "x"),
    "start/index.md": page("Start here", "x", "sidebar:\n  order: 1\n"),
    "start/install.md": page("Install", "x"),
  };
  const result = imp(files, { suite: "user", sourceRoot: "docs/user/" });
  test("the root index is the overview; directories are groups in their index's order, nested ones named Parent › Child", () => {
    expect(result.overview).toBe("guide:user/index");
    expect(result.guides.map(g => [g.slug, g.group ?? ""])).toEqual([
      ["index", ""], ["alpha", ""], ["zeta", ""],
      ["start/index", "Start here"], ["start/install", "Start here"],
      ["usage/index", "Using it"], ["usage/running", "Using it"],
      ["usage/advanced/index", "Using it › Advanced"], ["usage/advanced/tuning", "Using it › Advanced"],
    ]);
  });
  test("stable ids from paths, Overview as an index's navigator label, source paths", () => {
    const usage = result.guides.find(g => g.slug === "usage/index")!;
    expect(usage.id).toBe("guide:user/usage/index");
    expect(usage.navTitle).toBe("Overview");
    expect(usage.source).toEqual({ path: "docs/user/usage/index.md", line: 1 });
  });
  test("the model validates and renders nested pages", () => {
    const model = guidesModel(result, { name: "Suite", version: "1.0" });
    expect(validate(model)).toEqual([]);
    const out = render(model);
    expect(Object.keys(out)).toContain("guides/usage/advanced/tuning.html");
    expect(out["guides/usage/index.html"]).toBeDefined();
    expect(checkSite(out, { allowed: [] })).toEqual([]);
  });
  test("a directory without an index is a group named after it, with a warning", () => {
    const r = imp({ "index.md": page("Home", "x"), "how-to/x.md": page("X", "x") });
    expect(r.guides[1]!.group).toBe("How to");
    expect(r.diagnostics.map(d => formatDiagnostic(d))).toEqual(['how-to/:1: warning: the directory has no index.md to introduce it and name its group; the group is named "How to"']);
  });
});

describe("Markdown", () => {
  test("headings: levels, explicit {#id}, and anchors the renderer generates", () => {
    const body = bodyOf("## Install it {#setup}\n\n### Then *this*\n\n#### Deep");
    expect(body).toEqual([
      { kind: "heading", level: 2, children: [{ kind: "text", text: "Install it" }], anchor: "setup" },
      { kind: "heading", level: 3, children: [{ kind: "text", text: "Then " }, { kind: "emphasis", children: [{ kind: "text", text: "this" }] }] },
      { kind: "heading", level: 4, children: [{ kind: "text", text: "Deep" }] },
    ]);
  });
  test("HTML comments, the sync block among them, do not render", () => {
    expect(bodyOf("<!-- sync\ndocs/handbook/usage.md\n-->\n\nText <!-- hidden --> here.")).toEqual([
      { kind: "paragraph", children: [{ kind: "text", text: "Text " }, { kind: "text", text: " here." }] },
    ]);
  });
  test("inline: emphasis, strong, strikethrough, code, hard break, autolinks", () => {
    expect(inl("*a* **b** ~~c~~ `d`  \ne https://example.com <mailto:x@example.com>")).toEqual([
      { kind: "emphasis", children: [{ kind: "text", text: "a" }] }, { kind: "text", text: " " },
      { kind: "strong", children: [{ kind: "text", text: "b" }] }, { kind: "text", text: " " },
      { kind: "strikethrough", children: [{ kind: "text", text: "c" }] }, { kind: "text", text: " " },
      { kind: "code", text: "d" }, { kind: "break" }, { kind: "text", text: "e " },
      { kind: "link", children: [{ kind: "text", text: "https://example.com" }], url: "https://example.com" }, { kind: "text", text: " " },
      { kind: "link", children: [{ kind: "text", text: "mailto:x@example.com" }], url: "mailto:x@example.com" },
    ]);
  });
  test("lists, ordered lists and task lists", () => {
    expect(bodyOf("- a\n- b\n\n1. one\n2. two\n\n- [x] done\n- [ ] open")).toEqual([
      { kind: "list", items: [[{ kind: "paragraph", children: [{ kind: "text", text: "a" }] }], [{ kind: "paragraph", children: [{ kind: "text", text: "b" }] }]] },
      { kind: "list", ordered: true, items: [[{ kind: "paragraph", children: [{ kind: "text", text: "one" }] }], [{ kind: "paragraph", children: [{ kind: "text", text: "two" }] }]] },
      { kind: "list", items: [
        [{ kind: "paragraph", children: [{ kind: "check", checked: true }, { kind: "text", text: "done" }] }],
        [{ kind: "paragraph", children: [{ kind: "check" }, { kind: "text", text: "open" }] }],
      ] },
    ]);
  });
  test("fenced code keeps its language; a fence without one is text", () => {
    expect(bodyOf("```Kotlin\nfun main() {}\n```\n\n```\nplain\n```")).toEqual([
      { kind: "code", language: "kotlin", text: "fun main() {}" },
      { kind: "code", language: "text", text: "plain" },
    ]);
  });
  test("tables: the first row is the head", () => {
    expect(bodyOf("| A | B |\n| --- | :-: |\n| `x` | |")).toEqual([{
      kind: "table",
      head: [[[{ kind: "paragraph", children: [{ kind: "text", text: "A" }] }], [{ kind: "paragraph", children: [{ kind: "text", text: "B" }] }]]],
      rows: [[[{ kind: "paragraph", children: [{ kind: "code", text: "x" }] }], []]],
    }]);
  });
  test("each GitHub alert is an admonition; another quote stays a quote", () => {
    const body = bodyOf(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"].map(t => `> [!${t}]\n> About ${t}.`).join("\n\n") + "\n\n> [!note]\n>\n> Lower case, own paragraph.\n\n> Just a quote.");
    expect(body.map(b => (b.kind === "admonition" ? b.tone : b.kind))).toEqual(["note", "tip", "important", "warning", "caution", "note", "quote"]);
    expect(body[1]).toEqual({ kind: "admonition", tone: "tip", children: [{ kind: "paragraph", children: [{ kind: "text", text: "About TIP." }] }] });
    expect(body[5]).toEqual({ kind: "admonition", tone: "note", children: [{ kind: "paragraph", children: [{ kind: "text", text: "Lower case, own paragraph." }] }] });
  });
  test("raw HTML: a block is a raw node; an inline element is one raw node with its content; a rule is <hr>", () => {
    expect(bodyOf("<dl><dt>A</dt><dd>B</dd></dl>\n\nPress <kbd>Ctrl</kbd>+C and <br> go.\n\n---")).toEqual([
      { kind: "raw", html: "<dl><dt>A</dt><dd>B</dd></dl>", text: "AB" },
      { kind: "paragraph", children: [
        { kind: "text", text: "Press " }, { kind: "raw", html: "<kbd>Ctrl</kbd>", text: "Ctrl" }, { kind: "text", text: "+C and " },
        { kind: "raw", html: "<br>", text: "" }, { kind: "text", text: " go." },
      ] },
      { kind: "raw", html: "<hr>", text: "---" },
    ]);
  });
  test("footnotes are reported, not rendered", () => {
    const result = imp({ "index.md": page("Home", "A note.[^1]\n\n[^1]: The note.") });
    expect(result.diagnostics.map(d => formatDiagnostic(d))).toEqual([
      "index.md:6: footnotes are not supported; put the note in the text or in a callout",
      "index.md:8: footnotes are not supported; put the note in the text or in a callout",
    ]);
  });
});

describe("links", () => {
  const files = {
    "index.md": page("Home", "## Intro\n\n[same](#intro) [up](usage/index.md) [dir](usage/) [section](usage/run.md#Running-a-file) [by id](usage/run.md#flags) [file](usage/chart.png)"),
    "usage/index.md": page("Usage", "[home](../index.md#intro) [sibling suite](../../developer/embedding/index.md#setup) [api](../../api/latest/index.html) [web](https://example.com/x?y#z)"),
    "usage/run.md": page("Run", "## Running a file\n\n## Options {#flags}"),
  };
  const result = imp(files, { suite: "s", assets: [{ path: "usage/chart.png", data: new TextEncoder().encode("png") }], links: [{ prefix: "../developer/", target: "../developer/" }, { prefix: "../api/", target: "https://example.com/api/" }] });
  const links = (slug: string) => (result.guides.find(g => g.slug === slug)!.body!.find(b => b.kind === "paragraph") as { children: Inline[] }).children.filter(n => n.kind === "link");
  test("Markdown files become guide references, fragments become sections, checked at import", () => {
    expect(result.diagnostics).toEqual([]);
    expect(links("index").map(l => (l.kind === "link" ? l.target ?? l.url : undefined))).toEqual([
      { id: "guide:s/index", section: "intro" },
      { id: "guide:s/usage/index" },
      { id: "guide:s/usage/index" },
      { id: "guide:s/usage/run", section: "running-a-file" },
      { id: "guide:s/usage/run", section: "flags" },
      "guides/usage/chart.png",
    ]);
    expect(result.files.map(f => [f.from, f.to])).toEqual([["usage/chart.png", "guides/usage/chart.png"]]);
  });
  test("links that leave the suite go through the mapping, relative to their page", () => {
    expect(links("usage/index").map(l => (l.kind === "link" ? l.target ?? l.url : undefined))).toEqual([
      { id: "guide:s/index", section: "intro" },
      "../../../developer/guides/embedding/index.html#setup",
      "https://example.com/api/latest/index.html",
      "https://example.com/x?y#z",
    ]);
    expect(mapLink("../developer/index.md", undefined, [{ prefix: "../developer/", target: "../developer/" }])).toBe("../developer/index.html");
    expect(mapLink("../developer/", undefined, [{ prefix: "../developer/", target: "https://e.com/dev" }])).toBe("https://e.com/dev/index.html");
  });
  test("the rendered links resolve", () => {
    const out = render(guidesModel(result, { name: "S" }));
    expect(out["index.html"] as string).toContain('href="guides/usage/run.html#running-a-file"');
    expect(out["index.html"] as string).toContain('href="index.html#intro"');
    expect(out["guides/usage/index.html"] as string).toContain('href="../../../developer/guides/embedding/index.html#setup"');
    expect(out["guides/usage/index.md"] as string).toContain("(../../index.md#intro)");
  });
});

describe("images", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1, 0x2c, 0, 0, 0, 0x96, 8, 2, 0, 0, 0]);
  test("a suite image is copied, sized and linked from the site root", () => {
    const result = imp({ "index.md": page("Home", "x"), "a/index.md": page("A", "x"), "a/b.md": page("B", '![A chart of sales](img/chart.png "Sales")') }, { assets: [{ path: "a/img/chart.png", data: png }] });
    expect(result.diagnostics).toEqual([]);
    expect(inlOf(result.guides[2]!)).toEqual([{ kind: "image", src: "guides/a/img/chart.png", alt: "A chart of sales", title: "Sales", width: 300, height: 150 }]);
    expect(result.files).toEqual([{ from: "a/img/chart.png", to: "guides/a/img/chart.png", data: png }]);
    const out = render(guidesModel(result, { name: "S" }));
    expect(out["guides/a/b.html"] as string).toContain('<img src="../../guides/a/img/chart.png" alt="A chart of sales" title="Sales" width="300" height="150" loading="lazy" decoding="async"/>');
    expect(out["guides/a/b.md"] as string).toContain("![A chart of sales](../../guides/a/img/chart.png)");
    expect(checkSite({ ...out, "guides/a/img/chart.png": "" }, { allowed: [] })).toEqual([]);
  });
  test("an image needs alternative text and an existing file", () => {
    const result = imp({ "index.md": page("Home", "![](a.png) ![Shown](missing.png)") }, { assets: [{ path: "a.png", data: png }] });
    expect(result.diagnostics.map(d => formatDiagnostic(d))).toEqual([
      "index.md:6: the image a.png has no alternative text; describe it in the brackets: ![what it shows](a.png)",
      "index.md:6: the image missing.png is not in the suite",
    ]);
  });
  test("sizes from PNG, GIF, JPEG, WebP and SVG headers", () => {
    expect(imageSize(png)).toEqual({ width: 300, height: 150 });
    expect(imageSize(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 10, 0, 20, 0]))).toEqual({ width: 10, height: 20 });
    expect(imageSize(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0, 40, 0, 30, 3, 0, 0, 0]))).toEqual({ width: 30, height: 40 });
    const webp = new Uint8Array(30);
    webp.set(new TextEncoder().encode("RIFF"), 0);
    webp.set(new TextEncoder().encode("WEBPVP8X"), 8);
    webp.set([99, 0, 0, 49, 0, 0], 24);
    expect(imageSize(webp)).toEqual({ width: 100, height: 50 });
    expect(imageSize(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">'))).toEqual({ width: 120, height: 80 });
    expect(imageSize(new TextEncoder().encode('<svg width="100%" height="2em">'))).toBeUndefined();
    expect(imageSize(new TextEncoder().encode("not an image"))).toBeUndefined();
  });
});

function inlOf(guide: Guide): Inline[] {
  return (guide.body![0] as { children: Inline[] }).children;
}

describe("copied files", () => {
  const bytes = (text: string) => new TextEncoder().encode(text);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 8, 0, 0, 0, 8]);
  test("only images are copied; every other type is an error and stays out of the output", () => {
    const rejected = ["page.html", "page.HTM", "page.xhtml", "page.shtml", "feed.xml", "archive.mht", "notes.txt", "data.json", "report.pdf", "app.js",
      "shot.html.png", "shot.png.", "shot.png ", "README"];
    const body = rejected.map((name, i) => `[f${i}](${encodeURI(name)})`).join("\n\n") + "\n\n![A photo](photo.PNG) ![A sketch](sketch.svg)";
    const result = imp({ "index.md": page("Home", body) }, {
      assets: [...rejected.map(path => ({ path, data: bytes("<script>alert(1)</script>") })), { path: "photo.PNG", data: png },
        { path: "sketch.svg", data: bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>') }],
    });
    const messages = result.diagnostics.map(d => formatDiagnostic(d));
    expect(messages.length).toBe(rejected.length);
    for (const [i, name] of rejected.entries()) expect(messages[i]).toStartWith(`index.md:${6 + 2 * i}: ${name} is not copied into the site: `);
    expect(messages.filter(m => m.endsWith("second, document-like extension"))).toEqual(["index.md:26: shot.html.png is not copied into the site: its name has a second, document-like extension"]);
    expect(messages.filter(m => m.endsWith("a dot or a space")).length).toBe(2);
    expect(result.files.map(f => f.to)).toEqual(["guides/photo.PNG", "guides/sketch.svg"]);
    const out = render(guidesModel(result, { name: "S" }));
    for (const name of rejected) expect(Object.keys(out).some(k => k.includes(name.trim()))).toBe(false);
    expect(out["index.html"] as string).toContain('<img src="guides/photo.PNG" alt="A photo" width="8" height="8"');
    expect(out["index.html"] as string).toContain('<img src="guides/sketch.svg" alt="A sketch" width="10" height="10"');
  });
  test("a hostile SVG comes out inert; one that cannot be made safe is refused", () => {
    const hostile = [
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10" onload="alert(1)">',
      "<script>alert(2)</script><script xlink:href=\"https://evil.example/x.js\"/>",
      '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(3)"/><iframe src="javascript:alert(4)"></iframe></div></foreignObject>',
      '<use href="https://evil.example/s.svg#a"/><use xlink:href="data:image/svg+xml,&lt;svg onload=alert(5)&gt;"/><use href="#ok"/>',
      '<a href="javascript:alert(6)"><text>click</text></a><image href="https://evil.example/t.png"/>',
      '<style>@import url(https://evil.example/x.css); rect { fill: url(https://evil.example/p) }</style>',
      '<rect width="10" height="10" fill="url(https://evil.example/p)" stroke="url(#g)" style="background:url(//evil.example)" onclick="alert(7)"/>',
      '<set attributeName="onmouseover" to="alert(8)"/><animate attributeName="href" to="javascript:alert(9)"/>',
      "</svg>",
    ].join("");
    const result = imp({ "index.md": page("Home", "![Hostile](h.svg) ![Entities](e.svg)") }, {
      assets: [{ path: "h.svg", data: bytes(hostile) }, { path: "e.svg", data: bytes('<!DOCTYPE svg [<!ENTITY a "&#60;script&#62;">]><svg xmlns="http://www.w3.org/2000/svg">&a;</svg>') }],
    });
    expect(result.diagnostics.map(d => formatDiagnostic(d))).toEqual([
      "index.md:6: e.svg is not copied into the site: the SVG cannot be made safe, because it has a DOCTYPE or CDATA section, which can declare entities or hide markup",
    ]);
    const svg = new TextDecoder().decode(result.files.find(f => f.from === "h.svg")!.data);
    expect(svg).toBe('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><use/><use/><use href="#ok"/><rect width="10" height="10" stroke="url(#g)"/></svg>\n');
    expect(svg).not.toMatch(/script|foreignObject|onload|onclick|onerror|javascript:|data:|evil|<a\b|<image|<style|<set|<animate/i);
    expect(result.files.some(f => f.from === "e.svg")).toBe(false);
  });
  test("a symbolic link is never followed, so a file outside the suite cannot be copied", () => {
    const dir = mkdtempSync(join(tmpdir(), "apidocs-symlink-"));
    try {
      mkdirSync(join(dir, "suite"));
      writeFileSync(join(dir, "secret.png"), png);
      symlinkSync(join(dir, "secret.png"), join(dir, "suite/leak.png"));
      symlinkSync(dir, join(dir, "suite/up"));
      writeFileSync(join(dir, "suite/index.md"), page("Home", "![Leak](leak.png) ![Up](up/secret.png)"));
      const { files, assets } = readSuite(join(dir, "suite"));
      expect(assets).toEqual([]);
      const result = importMarkdown(files, { assets });
      expect(result.files).toEqual([]);
      expect(result.diagnostics.map(d => d.message)).toEqual(["the image leak.png is not in the suite", "the image up/secret.png is not in the suite"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test("CSS escapes, control characters and anything but url(#id) refuse a presentation value", () => {
    const value = (attr: string, v: string) => {
      const result = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg"><rect ${attr}="${v}"/></svg>`);
      if (!result.ok) throw new Error(result.reason);
      return /<rect( [^>]*)?\/>/.exec(result.svg)![1] ?? "";
    };
    const refused: [string, string][] = [
      ["fill", "\\75 rl(https://evil.example/p)"], ["fill", "\\75rl(https://evil.example/p)"], ["fill", "\\u rl(https://evil.example/p)"],
      ["fill", "u\\rl(https://evil.example/p)"], ["fill", "\\6a avascript:alert(1)"], ["fill", "\\j avascript:alert(1)"],
      ["fill", "\\65 xpression(alert(1))"], ["fill", "e\\xpression(alert(1))"], ["stroke", "\\75 \\72 \\6c (#g)"],
      ["fill", "url(https://evil.example/p)"], ["fill", "url(#g) url(#h)"], ["fill", "url(#g), red"], ["fill", "URL( data:x )"],
      ["fill", "expression(alert(1))"], ["fill", "red;@import x"], ["fill", "javascript:alert(1)"], ["fill", "vbscript:x"],
      ["fill", "data:image/svg+xml,x"], ["fill", "red\u0000"], ["fill", "url(#g\u0000)"], ["fill", "red&#1;"], ["fill", "re&#9;d"], ["mask", "url(#m)x"],
    ];
    for (const [attr, v] of refused) expect([attr, v, value(attr, v)]).toEqual([attr, v, ""]);
    expect(value("fill", "url(#gradient)")).toBe(' fill="url(#gradient)"');
    expect(value("fill", " url( '#paint-1' ) ")).toBe(' fill=" url( \'#paint-1\' ) "');
    expect(value("d", "M 0 0\n  L 10 10")).toBe(' d="M 0 0   L 10 10"');
    expect(value("id", "has\\backslash")).toBe(' id="has\\backslash"');
    expect(value("style", "fill:red")).toBe("");
    // A null character written as a reference is not XML at all: the file is refused.
    expect(sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="red&#0;"/></svg>').ok).toBe(false);
  });
  test("an ordinary diagram keeps its drawing", () => {
    const { files, assets } = readSuite(SAMPLE);
    const result = importMarkdown(files, { assets, links: SAMPLE_LINKS });
    const svg = new TextDecoder().decode(result.files.find(f => f.from === "concepts/diagram.svg")!.data);
    for (const part of ['viewBox="0 0 240 240"', "<rect ", "<circle ", "<line ", '<text x="160" y="112"', ">r</text>", 'aria-label="A circle inside a square"']) expect(svg).toContain(part);
    expect(result.files.find(f => f.from === "concepts/swatch.png")!.data).toEqual(assets.find(a => a.path === "concepts/swatch.png")!.data);
  });
});

describe("diagnostics", () => {
  test("the broken fixture reports each problem with its file and line", () => {
    const { files, assets } = readSuite(ERRORS);
    const result = importMarkdown(files, { assets });
    expect(result.diagnostics.map(d => formatDiagnostic(d))).toEqual([
      "bad-yaml.md:3: the frontmatter is not valid YAML: Flow sequence in block collection must be sufficiently indented and end with a ]",
      'index.md:4: unknown frontmatter key "template"; the importer reads title, description, sidebar.label, sidebar.order and draft',
      'index.md:7: unknown frontmatter key "sidebar.badge"; the importer reads sidebar.label and sidebar.order',
      "no-frontmatter.md:1: the page has no frontmatter: start it with ---, a title and a description, then ---",
      "page.mdx:1: MDX is not supported: write the page as Markdown (.md)",
      "index.md:20: the image diagram.png has no alternative text; describe it in the brackets: ![what it shows](diagram.png)",
      "index.md:22: footnotes are not supported; put the note in the text or in a callout",
      "index.md:24: footnotes are not supported; put the note in the text or in a callout",
      "index.md:10: links to missing.md, which is not in the suite",
      "index.md:12: links to #nope in getting-started.md, which has no such heading",
      "index.md:14: links outside the suite to ../../outside.md; add a link mapping for it, or use an absolute URL",
      "index.md:16: warning: links to draft.md, a draft this build leaves out; the link shows as text",
      "index.md:18: links to page.mdx, an MDX page, which is not supported",
    ]);
  });
  test("the CLI prints them, exits 1 and writes nothing; --warn-only writes the site", () => {
    const out = mkdtempSync(join(tmpdir(), "apidocs-guides-"));
    try {
      const failed = spawnSync(process.execPath, [join(root, "src/cli.ts"), "guides", "--src", ERRORS, "--id", "e", "--title", "E", "--out", join(out, "a")], { encoding: "utf8" });
      expect(failed.status).toBe(1);
      expect(failed.stderr).toContain(`${ERRORS}/index.md:10: links to missing.md, which is not in the suite`);
      expect(existsSync(join(out, "a"))).toBe(false);
      const warned = spawnSync(process.execPath, [join(root, "src/cli.ts"), "guides", "--src", ERRORS, "--id", "e", "--title", "E", "--out", join(out, "b"), "--warn-only"], { encoding: "utf8" });
      expect(warned.status).toBe(0);
      expect(warned.stderr).toContain(`${ERRORS}/index.md:10: warning: links to missing.md`);
      expect(existsSync(join(out, "b/index.html"))).toBe(true);
      const usage = spawnSync(process.execPath, [join(root, "src/cli.ts"), "guides", "--src", ERRORS], { encoding: "utf8" });
      expect(usage.status).toBe(2);
      expect(usage.stderr).toContain("missing --id");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 60_000);
});

describe("hostile Markdown", () => {
  const evil = imp({
    "index.md": [
      "---",
      `title: '<img src=x onerror="alert(1)">'`,
      `description: '<script>alert(2)</script> "quoted"'`,
      "---",
      "",
      '<div onclick="alert(3)"><script>alert(4)</script><a href="javascript:alert(5)">a</a></div>',
      "",
      '[a](javascript:alert(6)) [b](JaVaScRiPt:alert(7)) [c](jav&#x61;script:alert(8)) [d](&#106;avascript:alert(9)) [e](<java\tscript:alert(10)>) [f](data:text/html,<script>alert(11)</script>) [g](vbscript:x)',
      "",
      "![img](javascript:alert(12)) <b onmouseover=alert(13)>bold</b> <svg onload=alert(14)>",
      "",
      "## <img src=y onerror=alert(15)> {#\"onclick=alert(16)}",
    ].join("\n"),
  });
  const out = render(guidesModel(evil, { name: '<script>alert("name")</script>' }));
  test("unsafe link URLs are reported and dropped", () => {
    expect(evil.diagnostics.filter(d => d.message.startsWith("unsafe link")).length).toBe(7);
    expect(evil.diagnostics.filter(d => d.message.startsWith("unsafe image")).length).toBe(1);
  });
  test("no executable markup or unsafe URL reaches the output", () => {
    for (const [file, content] of Object.entries(out)) {
      if (typeof content !== "string" || file === "api.json" || file.endsWith(".js")) continue;
      // Hostile text stays as text: HTML escapes its angle brackets as entities, Markdown with a backslash.
      expect(content).not.toMatch(/javascript:|vbscript:|data:text|(?<!\\)<script>alert|(?<!\\)<img src=|(?<!\\)<svg onload|(?<!\\)<div onclick|<b onmouseover/i);
    }
    expect(checkSite(out, { allowed: [] })).toEqual([]);
    expect(out["index.html"] as string).toContain("<b>bold</b>");
  });
});

const sampleSite = await suiteSite(SAMPLE, { id: "geo", title: "Geo user guide", version: "2.1.0", baseUrl: "https://docs.example.com/geo/", links: SAMPLE_LINKS, theme: { extends: "elide" } });
describe("guides-only site", () => {
  const site = sampleSite;
  const out: Output = { ...site.output, ...Object.fromEntries(site.copies.map(c => [c.to, ""])) };
  const html = (path: string) => out[path] as string;
  test("the sample suite imports cleanly; its model validates", () => {
    expect(site.diagnostics).toEqual([]);
    expect(site.result.drafts).toEqual(["reference/format.md", "reference/index.md"]);
    expect(validate(site.model)).toEqual([]);
    expect(validate(JSON.parse(html("api.json")))).toEqual([]);
  });
  test("passes the output checker", () => {
    // With a base URL, pages offer to open themselves in Claude and ChatGPT.
    expect(checkSite(out, { allowed: ["https://example.com/", "https://docs.example.com/", "mailto:", "https://claude.ai/", "https://chatgpt.com/"] })).toEqual([]);
  });
  test("the overview is the suite's index, with no API lists, index pages or element-list", () => {
    expect(html("index.html")).toContain("<h1>Geo user guide</h1>");
    expect(html("index.html")).not.toContain('id="packages"');
    expect(html("index.html")).not.toContain("nav-packages");
    expect(html("index.html")).not.toContain("search-fallback");
    for (const file of ["packages.html", "types.html", "index-all.html", "deprecated.html", "element-list", "guides/index.html"]) expect(out[file]).toBeUndefined();
    expect(html("index.html")).toContain('placeholder="Search the guides"');
  });
  test("navigator, breadcrumbs and reading order across groups", () => {
    const alerts = html("guides/concepts/alerts.html");
    expect(alerts).toContain('<nav class="crumbs" aria-label="Breadcrumbs"><ol><li><a href="../../index.html">Geo user guide</a></li><li><a href="index.html">Concepts</a></li><li><span aria-current="page">Callouts</span></li></ol></nav>');
    expect(alerts).toMatch(/<span class="nav-label">Alerts<\/span>/);
    expect(alerts).toContain('<span class="nav-row nav-group-row"><span class="nav-label">Concepts › Advanced topics</span></span>');
    const order = site.model.module.guides!.map(g => g.slug);
    expect(order).toEqual(["index", "getting-started", "concepts/index", "concepts/alerts", "concepts/images", "concepts/diagrams", "concepts/advanced/index", "concepts/advanced/custom-shapes"]);
    expect(html("index.html")).toContain('rel="next" href="guides/getting-started.html"');
    expect(html("guides/concepts/images.html")).toContain('rel="next" href="diagrams.html"');
    expect(html("guides/concepts/diagrams.html")).toContain('rel="next" href="advanced/index.html"');
    expect(html("guides/concepts/index.html")).toContain('rel="prev" href="../getting-started.html"');
    expect(html("guides/getting-started.html")).toContain('rel="prev" href="../index.html"');
  });
  test("search, llms.txt, llms-full.txt, Markdown twins and the sitemap", () => {
    const index = JSON.parse(html("assets/search-index.js").replace(/^window\.apidocsSearch=/, "").replace(/;\n$/, "")) as string[][];
    expect(index).toContainEqual(["Before you start", "section", "guides/concepts/alerts.html#before-you-start", "Callouts", ""]);
    expect(index).toContainEqual(["Getting started", "guide", "guides/getting-started.html", "Guides", "Install Geo, then measure your first shape."]);
    expect(html("llms.txt")).not.toContain("## Pages");
    expect(html("llms.txt")).toContain("> Measure and draw shapes with the Geo library, from installation to custom shapes.");
    for (const slug of ["getting-started", "concepts/alerts", "concepts/advanced/custom-shapes"]) {
      expect(html("llms.txt")).toContain(`(guides/${slug}.md)`);
      expect(html("llms-full.txt")).toContain(`<!-- guides/${slug}.md -->`);
      expect(out[`guides/${slug}.md`]).toBeDefined();
    }
    expect(html("sitemap.xml")).toContain("<loc>https://docs.example.com/geo/guides/concepts/images.html</loc>");
  });
  test("snapshots", () => {
    for (const path of ["index.md", "guides/getting-started.md", "guides/concepts/alerts.md", "guides/concepts/images.md", "guides/concepts/diagrams.md", "guides/concepts/alerts.html"]) expect(out[path]).toMatchSnapshot(path);
  });
  test("a guides-only model without an overview lists its guides, with no empty package lists", () => {
    const model: Model = { schema: "apidocs/1", module: { name: "m", guides: [{ id: "guide:a", slug: "a", title: "A" }] } };
    const plain = render(model);
    expect(plain["index.html"] as string).toContain('id="guides"');
    expect(plain["index.html"] as string).not.toContain('id="packages"');
    expect(plain["index.md"] as string).not.toContain("## Packages");
    expect(checkSite(plain, { allowed: [] })).toEqual([]);
  });
  test("the CLI writes the same site, with the suite's files", () => {
    const dir = mkdtempSync(join(tmpdir(), "apidocs-guides-"));
    try {
      const run = spawnSync(process.execPath, [join(root, "src/cli.ts"), "guides", "--src", SAMPLE, "--id", "geo", "--title", "Geo user guide", "--out", dir, "--version", "2.1.0",
        "--source-link", "https://example.com/src/{path}#L{line}", "--source-root", "docs/user", ...SAMPLE_LINKS.flatMap(l => ["--link", `${l.prefix}=${l.target}`])], { encoding: "utf8" });
      expect(run.status).toBe(0);
      expect(JSON.parse(run.stdout)).toMatchObject({ pages: 8, guides: 8, drafts: 2, errors: 0, warnings: 0 });
      for (const file of ["index.html", "index.md", "llms.txt", "llms-full.txt", "api.json", "assets/search-index.js", "assets/apidocs.css", "assets/apidocs.js", "guides/concepts/swatch.png", "guides/concepts/diagram.svg"]) {
        expect(existsSync(join(dir, file))).toBe(true);
      }
      expect(readFileSync(join(dir, "guides/getting-started.html"), "utf8")).toContain('href="https://example.com/src/docs/user/getting-started.md#L1"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

// Komodo's documentation suites, when this package is checked out inside Komodo (web/vendor/components). Not a
// snapshot: those pages change on their own schedule.
const komodo = join(root, "../../../../../docs");
describe.skipIf(!existsSync(join(komodo, "user/index.md")) || !existsSync(join(komodo, "developer/index.md")))("Komodo's suites", () => {
  for (const [suite, other] of [["user", "developer"], ["developer", "user"]] as const) {
    for (const includeDrafts of [false, true]) {
      test(`${suite}${includeDrafts ? " with drafts" : ""} imports without errors and passes the output checker`, async () => {
        const site = await suiteSite(join(komodo, suite), { id: suite, title: `Komodo ${suite} guide`, includeDrafts, links: [{ prefix: `../${other}/`, target: `https://example.com/${other}/` }] });
        expect(site.diagnostics.filter(d => d.severity === "error").map(d => formatDiagnostic(d))).toEqual([]);
        expect(site.model.module.overview).toBe(`guide:${suite}/index`);
        const out = { ...site.output, ...Object.fromEntries(site.copies.map(c => [c.to, ""])) };
        expect(checkSite(out, { allowed: ["https://"] })).toEqual([]);
      }, 60_000);
    }
  }
});
