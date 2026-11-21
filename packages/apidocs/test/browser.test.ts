/**
 * Opens a site built exactly as the doclet builds it (dist/runner.mjs running
 * dist/render.js) from file://, with JavaScript on and off, and runs axe on the
 * page shell in light and dark. Needs `bun run build` first (turbo runs it) and
 * a Playwright Chromium.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type Browser, chromium, type Page } from "playwright";
import { samples } from "../samples";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
let browser: Browser;
let site: string;

beforeAll(async () => {
  if (!existsSync(join(root, "dist/render.js"))) throw new Error("dist/ is missing: run `bun run build` first");
  site = mkdtempSync(join(tmpdir(), "apidocs-browser-"));
  const model = join(site, "model.json");
  const theme = join(site, "theme.json");
  writeFileSync(model, JSON.stringify(samples.java));
  writeFileSync(theme, JSON.stringify({ extends: "elide" }));
  const run = spawnSync(process.execPath, [join(root, "dist/runner.mjs"), "--bundle", join(root, "dist/render.js"), "--assets", join(root, "dist/assets"), "--model", model, "--theme", theme, "--out", join(site, "out")], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(run.stderr);
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  if (site) rmSync(site, { recursive: true, force: true });
});

const url = (path: string) => {
  const [file, fragment] = path.split("#");
  return pathToFileURL(join(site, "out", file!)).href + (fragment === undefined ? "" : `#${fragment}`);
};

async function open(path: string, options: { javaScriptEnabled?: boolean; colorScheme?: "light" | "dark" } = {}): Promise<{ page: Page; requests: string[]; errors: string[] }> {
  const context = await browser.newContext({ javaScriptEnabled: options.javaScriptEnabled ?? true, colorScheme: options.colorScheme ?? "light" });
  const page = await context.newPage();
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", request => requests.push(request.url()));
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => message.type() === "error" && errors.push(message.text()));
  await page.goto(url(path));
  return { page, requests, errors };
}

describe("from file:// with JavaScript off", () => {
  test("pages are complete, and the islands stay hidden", async () => {
    const { page, requests } = await open("com/example/geo/Shapes.html", { javaScriptEnabled: false });
    expect(await page.locator("h1").textContent()).toBe("Shapes");
    expect(await page.locator("section.member").count()).toBeGreaterThan(8);
    expect(await page.locator("#parse\\(java\\.lang\\.String\\) .note-apiNote").count()).toBe(1);
    expect(await page.locator("[data-search]").isHidden()).toBe(true);
    expect(await page.locator(".search-fallback").isVisible()).toBe(true);
    expect(await page.locator("[data-copy]").first().isHidden()).toBe(true);
    expect(await page.locator("[data-theme-switch]").isHidden()).toBe(true);
    expect(requests.every(r => r.startsWith("file://"))).toBe(true);
    await page.context().close();
  });
});

describe("from file:// with JavaScript on", () => {
  test("search finds a member and opens it", async () => {
    const { page, requests, errors } = await open("index.html");
    const input = page.getByRole("combobox", { name: "Search the API" });
    await input.fill("parse");
    const first = page.locator("#apidocs-results [role=option]").first();
    await first.waitFor();
    expect(await first.textContent()).toContain("parse(String)");
    await input.press("Enter");
    await page.waitForURL(/Shapes\.html#parse/);
    expect(requests.every(r => r.startsWith("file://"))).toBe(true);
    expect(errors).toEqual([]);
    await page.context().close();
  });

  test("the theme switch cycles and persists", async () => {
    const { page } = await open("com/example/geo/Shape.html");
    const button = page.locator("[data-theme-switch]");
    await button.click();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
    await button.click();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
    await page.context().close();
  });

  test("copy buttons show, and the table of contents follows the page", async () => {
    const { page } = await open("com/example/geo/registry/ShapeCatalog.html#scaleStar(com.example.geo.Shape,double)");
    expect(await page.locator("[data-copy]").first().isHidden()).toBe(false);
    await page.waitForSelector('.toc a[aria-current="true"]');
    const current = await page.locator('.toc a[aria-current="true"]').textContent();
    expect(current).toContain("scaleStar");
    await page.context().close();
  });
});

describe("accessibility", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const path of ["index.html", "com/example/geo/index.html", "com/example/geo/Shapes.html", "com/example/geo/Circle.html"]) {
      test(`${path} in ${colorScheme} has no axe violations`, async () => {
        const { page } = await open(path, { colorScheme });
        await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
        const violations = await page.evaluate(async () => {
          const result = await (window as unknown as { axe: { run: (o: object) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } })
            .axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } });
          return result.violations.map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(" ")).join(", ")}`);
        });
        expect(violations).toEqual([]);
        await page.context().close();
      }, 30_000);
    }
  }
});
