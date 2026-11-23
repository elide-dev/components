// Mermaid diagrams in Markdown suites: the importer's diagram blocks, drawDiagrams with a fake renderer, suiteSite's
// renderer choice, and the real Chromium renderer when Playwright's Chromium is installed.
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { type DiagramRenderer, drawDiagrams } from "../src/import/diagrams";
import { importMarkdown } from "../src/import/markdown";
import { mermaidRenderer } from "../src/import/mermaid";
import { suiteSite } from "../src/import/suite";
import { sanitizeSvg } from "../src/import/svg";

const page = (body: string) => `---\ntitle: Page\ndescription: A page.\n---\n\n${body}`;
const FLOW = "flowchart LR\n  a --> b";
const fence = (source: string) => "```mermaid\n" + source + "\n```\n";
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect class="d-fill-surface" width="1" height="1"></rect></svg>';

/** A renderer that records its calls and draws a fixed SVG, or an error for sources containing "bad". */
function fake(): DiagramRenderer & { calls: [string, string][]; closed: boolean } {
  const self = {
    calls: [] as [string, string][],
    closed: false,
    async draw(source: string, seed: string) {
      self.calls.push([source, seed]);
      return source.includes("bad") ? { error: "Parse error on line 2:\nbad\n^" } : { svg: SVG, title: "T", description: "D" };
    },
    async close() { self.closed = true; },
  };
  return self;
}

function suite(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "apidocs-diagrams-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

describe("importing diagrams", () => {
  test("a mermaid fence becomes a diagram block with its source and line", () => {
    const result = importMarkdown([{ path: "a.md", text: page("Intro.\n\n" + fence(FLOW)) }]);
    const block = result.guides[0]!.body!.find(b => b.kind === "diagram");
    expect(block).toEqual({ kind: "diagram", language: "mermaid", source: FLOW });
    expect(result.diagrams.map(d => [d.path, d.line])).toEqual([["a.md", 8]]);
    expect(result.diagrams[0]!.block).toBe(block as never);
  });

  test("drawDiagrams fills svg, title and description, and closes the renderer", async () => {
    const result = importMarkdown([{ path: "index.md", text: page(fence(FLOW)) }]);
    const renderer = fake();
    await drawDiagrams(result, renderer);
    expect(result.diagrams[0]!.block).toMatchObject({ svg: sanitizeSvg(SVG).ok ? (sanitizeSvg(SVG) as { svg: string }).svg : "", title: "T", description: "D" });
    expect(renderer.closed).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  test("a draw error is an error diagnostic at the line Mermaid names, and the diagram stays undrawn", async () => {
    const result = importMarkdown([{ path: "index.md", text: page(fence("flowchart LR\n  bad")) }]);
    await drawDiagrams(result, fake());
    expect(result.diagnostics).toEqual([{ file: "index.md", line: 8, severity: "error", message: "Mermaid: Parse error on line 2: bad ^" }]);
    expect(result.diagrams[0]!.block.svg).toBeUndefined();
  });

  test("seeds differ for identical sources on one page", async () => {
    const result = importMarkdown([{ path: "a.md", text: page(fence(FLOW) + "\n" + fence(FLOW)) }, { path: "b.md", text: page(fence(FLOW)) }]);
    const renderer = fake();
    await drawDiagrams(result, renderer);
    expect(renderer.calls.map(c => c[1])).toEqual(["a.md#0", "a.md#1", "b.md#0"]);
  });
});

describe("suiteSite and the renderer", () => {
  test("a suite without diagrams never calls the renderer factory", async () => {
    const dir = suite({ "index.md": page("No diagrams.") });
    try {
      const site = await suiteSite(dir, { id: "s", title: "S", diagrams: () => { throw new Error("must not start"); } });
      expect(site.diagnostics).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a renderer factory that fails reports one error naming the fix", async () => {
    const dir = suite({ "index.md": page(fence(FLOW) + "\n" + fence(FLOW)) });
    try {
      const site = await suiteSite(dir, { id: "s", title: "S", diagrams: async () => { throw new Error("Executable doesn't exist at /x/chrome\nmore"); } });
      expect(site.diagnostics).toEqual([{ file: "index.md", line: 6, severity: "error", message: "Mermaid diagrams need Chromium: run bunx playwright install chromium (Executable doesn't exist at /x/chrome)" }]);
      expect(site.output["index.html"] as string).toContain("flowchart LR");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("diagrams: false leaves them undrawn without an error", async () => {
    const dir = suite({ "index.md": page(fence(FLOW)) });
    try {
      const site = await suiteSite(dir, { id: "s", title: "S", diagrams: false });
      expect(site.diagnostics).toEqual([]);
      expect(site.output["index.html"] as string).not.toContain('<figure class="diagram">');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!existsSync(chromium.executablePath()))("the Mermaid renderer", () => {
  test("draws, themes, sanitizes and is deterministic", async () => {
    const renderer = await mermaidRenderer();
    try {
      const source = 'flowchart LR\n  accTitle: Pipeline\n  accDescr: From source to IR\n  a["a < b & c+d"] --> b["模块 🚀"]';
      const first = await renderer.draw(source, "p.md#0");
      const again = await renderer.draw(source, "p.md#0");
      const other = await renderer.draw(source, "p.md#1");
      if ("error" in first || "error" in again || "error" in other) throw new Error("drawing failed");
      expect(again.svg).toBe(first.svg);
      expect(other.svg).not.toBe(first.svg);
      expect(first).toMatchObject({ title: "Pipeline", description: "From source to IR" });
      expect(sanitizeSvg(first.svg).ok).toBe(true);
      expect(first.svg).not.toMatch(/<style|\sstyle="|foreignObject|font-family/);
      expect(first.svg).toContain("模块");
      expect(first.svg).toContain("🚀");
      expect(first.svg).toContain("c+d");
      expect(first.svg).toContain("&lt;");
      expect(first.svg).toContain("&amp;");
      expect(first.svg).toMatch(/class="d-fill-surface/);
      expect(first.svg).toMatch(/d-stroke-rule-strong/);
      // Every color is a d-* class or none.
      expect(first.svg).not.toMatch(/\s(fill|stroke)="(?!none")[^"]*"/);
      expect(first.svg).toMatch(/class="d-fill-/);
      expect(first.svg).toMatch(/class="d-text-fg"/);
      for (const kind of ["sequenceDiagram\n  A->>B: hi", "classDiagram\n  class A", "stateDiagram-v2\n  [*] --> A"]) {
        const drawn = await renderer.draw(kind, `k.md#${kind.length}`);
        expect("error" in drawn ? drawn.error : sanitizeSvg(drawn.svg).ok).toBe(true);
      }
      expect(await renderer.draw("flowchart LR\n  A -->", "e.md#0")).toMatchObject({ error: expect.stringContaining("Parse error on line") });
    } finally {
      await renderer.close();
    }
  }, 60_000);
});
