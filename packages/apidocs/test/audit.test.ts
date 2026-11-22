/**
 * The pure parts of the audits (scripts/audit/): the good-css.com rules on
 * hand-written CSS, the robots.txt and code-fence helpers, and one
 * agent-readiness run over the Java sample built with the runner and served
 * by the audit server. Lighthouse is not run here; `bun run audit` runs it.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { samples } from "../samples";
import { agenticAudit, fencesBalanced, robotsAllows } from "../scripts/audit/agentic";
import { packageRoot, renderSite, representativePages } from "../scripts/audit/build";
import { cssAudit } from "../scripts/audit/css";
import { type AuditServer, prefersMarkdown, serve } from "../scripts/audit/server";

describe("good-css rules", () => {
  const status = (css: string, rule: string) => cssAudit([{ path: "a.css", css, source: "a.css" }]).rules.find(r => r.rule === rule)!.status;
  test("logical properties", () => {
    expect(status(".a { margin-left: 1px }", "logical-properties")).toBe("fail");
    expect(status(".a { padding: 0 4px }", "logical-properties")).toBe("fail");
    expect(status(".a { margin-inline-start: 1px; padding: 4px }", "logical-properties")).toBe("pass");
  });
  test("oklch colors and gray hues", () => {
    expect(status(".a { color: #fff }", "oklch-color")).toBe("fail");
    expect(status(".a { color: oklch(98% 0 0) }", "oklch-color")).toBe("fail");
    expect(status(".a { color: oklch(98% 0 none) }", "oklch-color")).toBe("pass");
  });
  test(":hover inside the hover media query, with :active", () => {
    expect(status("a:hover { color: red }", "hover-media")).toBe("fail");
    expect(status("@media (hover: hover) and (pointer: fine) { a:hover { color: red } }", "hover-media")).toBe("pass");
    expect(status("@media (hover: hover) and (pointer: fine) { a:hover { color: red } } a:active { color: blue }", "press-feedback")).toBe("pass");
  });
  test("focus and motion", () => {
    expect(status(".a:focus { outline: none }", "focus-visible")).toBe("fail");
    expect(status(".a:focus-visible { outline: 2px solid }", "focus-visible")).toBe("pass");
    expect(status(".a { transition: transform 200ms ease-out }", "opt-in-motion")).toBe("fail");
    expect(status("@media (prefers-reduced-motion: no-preference) { .a { transition: transform 200ms ease-out } }", "opt-in-motion")).toBe("pass");
    expect(status(".a { transition: all 200ms }", "motion-properties")).toBe("fail");
    expect(status(".a { transition: opacity 150ms ease-in }", "motion-properties")).toBe("fail");
  });
});

describe("helpers", () => {
  test("robots.txt matching", () => {
    const robots = "User-agent: *\nDisallow: /private/\n\nUser-agent: GPTBot\nDisallow: /\n";
    expect(robotsAllows(robots, "Claude-User", "/index.html")).toBe(true);
    expect(robotsAllows(robots, "Claude-User", "/private/x.html")).toBe(false);
    expect(robotsAllows(robots, "GPTBot", "/index.html")).toBe(false);
  });
  test("code fences", () => {
    expect(fencesBalanced("```java\nx\n```\n")).toBe(true);
    expect(fencesBalanced("````md\n```\n````\n")).toBe(true);
    expect(fencesBalanced("```\nx\n")).toBe(false);
  });
  test("markdown negotiation", () => {
    expect(prefersMarkdown("text/markdown")).toBe(true);
    expect(prefersMarkdown("text/html, text/markdown;q=0.5")).toBe(false);
    expect(prefersMarkdown("text/html")).toBe(false);
  });
});

describe("agent readiness over the Java sample", () => {
  let dir: string;
  let server: AuditServer;
  beforeAll(() => {
    if (!existsSync(join(packageRoot, "dist/render.js"))) throw new Error("dist/ is missing: run `bun run build` first");
    dir = mkdtempSync(join(tmpdir(), "apidocs-audit-test-"));
    server = serve(join(dir, "out"));
    renderSite({ model: { json: JSON.stringify(samples.java) }, theme: { extends: "elide", baseUrl: server.url }, out: join(dir, "out"), work: join(dir, "work") });
  });
  afterAll(() => {
    server?.stop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test("every rule reports, and the output basics pass", async () => {
    const out = join(dir, "out");
    const report = await agenticAudit({ name: "java", dir: out, url: server.url, pages: representativePages(out) });
    expect(report.score).toBeGreaterThan(0);
    expect(report.score).toBeLessThanOrEqual(100);
    const by = new Map(report.findings.map(f => [f.rule, f]));
    for (const id of ["llms-txt-exists", "llms-txt-links-resolve", "sitemap", "noindex-directives", "redirect-hygiene", "code-fence-validity", "markdown-link-alternate", "ax-tree-injection-safe"]) {
      expect(`${id}: ${by.get(id)?.status}`).toBe(`${id}: pass`);
    }
    for (const f of report.findings) expect(f.evidence).not.toBe("not measured");
  }, 30_000);
});
