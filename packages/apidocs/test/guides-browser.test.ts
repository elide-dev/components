/**
 * A guides-only site in Chromium: the Markdown sample suite built with the CLI (`apidocs guides`), opened from
 * file:// with JavaScript on and off, and axe on its pages in light and dark. Needs `bun run build` first and a
 * Playwright Chromium (PLAYWRIGHT_BROWSERS_PATH).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type Browser, type BrowserContextOptions, chromium, type Page } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
let browser: Browser;
let site: string;
let out: string;

beforeAll(async () => {
  if (!existsSync(join(root, "dist/assets/apidocs.js"))) throw new Error("dist/ is missing: run `bun run build` first");
  site = mkdtempSync(join(tmpdir(), "apidocs-guides-browser-"));
  out = join(site, "out");
  // The Elide preset, as Komodo uses it.
  writeFileSync(join(site, "theme.json"), JSON.stringify({ extends: "elide" }));
  const run = spawnSync(process.execPath, [
    join(root, "src/cli.ts"), "guides", "--src", join(root, "samples/guides"), "--id", "geo", "--title", "Geo user guide", "--out", out,
    "--version", "2.1.0", "--theme", join(site, "theme.json"), "--assets", join(root, "dist/assets"), "--link", "../developer/=https://example.com/developer/", "--link", "../api/=https://example.com/api/",
  ], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(run.stderr);
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  if (site) rmSync(site, { recursive: true, force: true });
});

async function open(path: string, options: BrowserContextOptions = {}): Promise<{ page: Page; requests: string[]; errors: string[] }> {
  const context = await browser.newContext({ colorScheme: "light", ...options });
  const page = await context.newPage();
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", request => requests.push(request.url()));
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => message.type() === "error" && errors.push(message.text()));
  const [file, fragment] = path.split("#");
  await page.goto(pathToFileURL(join(out, file!)).href + (fragment === undefined ? "" : `#${fragment}`));
  return { page, requests, errors };
}

describe("a guides-only site from file://", () => {
  test("with JavaScript off, pages are complete and script-only controls stay out", async () => {
    const { page, requests } = await open("guides/concepts/alerts.html", { javaScriptEnabled: false });
    expect(await page.getByRole("heading", { level: 1 }).textContent()).toBe("Callouts");
    expect(await page.locator(".callout").count()).toBe(5);
    expect(await page.getByRole("navigation", { name: "Guides" }).locator("a.nav-row").count()).toBe(8);
    // Without the script nothing is folded: every guide is reachable.
    expect(await page.getByRole("navigation", { name: "Guides" }).locator("a.nav-row:visible").count()).toBe(8);
    expect(await page.locator(".nav-packages").count()).toBe(0);
    for (const control of await page.locator("[data-js-only]").all()) expect(await control.isVisible()).toBe(false);
    expect(requests.every(r => r.startsWith("file://"))).toBe(true);
    await page.context().close();
  });

  test("images load with their size reserved", async () => {
    const { page, errors } = await open("guides/concepts/images.html");
    const images = page.locator(".prose img");
    expect(await images.count()).toBe(2);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await page.waitForFunction(i => (i as HTMLImageElement).complete, await image.elementHandle());
      expect(await image.evaluate(i => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      expect(await image.getAttribute("width")).not.toBeNull();
    }
    expect(errors).toEqual([]);
    await page.context().close();
  });

  test("with JavaScript on, search finds a section and opens it, with no errors and no network", async () => {
    const { page, requests, errors } = await open("index.html");
    const input = page.getByRole("combobox", { name: "Search the guides" });
    await input.fill("before you");
    const first = page.locator("#apidocs-results [role=option]").first();
    await first.waitFor();
    expect(await first.textContent()).toContain("Before you start");
    await input.press("Enter");
    await page.waitForURL(/alerts\.html#before-you-start/);
    expect(requests.every(r => r.startsWith("file://"))).toBe(true);
    expect(errors).toEqual([]);
    await page.context().close();
  });

  test("the navigator's filter narrows the guides", async () => {
    const { page } = await open("guides/getting-started.html");
    const links = page.locator(".nav-guides a.nav-row:visible");
    const before = await links.count();
    // "Pictures" is in a group folded on this page: the filter opens the branch that leads to it.
    await page.locator("#apidocs-nav-filter").fill("pictures");
    expect(await links.allTextContents()).toEqual([expect.stringContaining("Pictures")]);
    await page.locator("#apidocs-nav-filter").press("Escape");
    expect(await links.count()).toBe(before);
    await page.context().close();
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`diagrams draw in the ${colorScheme} scheme's colors and fit their column`, async () => {
      const { page, errors } = await open("guides/concepts/diagrams.html", { colorScheme, javaScriptEnabled: false });
      const figures = page.locator("figure.diagram");
      expect(await figures.count()).toBe(4);
      expect(await page.locator("figure.diagram figcaption").first().textContent()).toBe("Measuring a shape");
      for (const figure of await figures.all()) {
        expect(await figure.isVisible()).toBe(true);
        // The figure never widens the page: a wide diagram scrolls inside its own box.
        expect(await figure.evaluate(f => f.scrollWidth <= (f.parentElement as HTMLElement).clientWidth + 1)).toBe(true);
      }
      const colors = await page.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.color = "var(--apidocs-fg)";
        document.body.append(probe);
        const fg = getComputedStyle(probe).color;
        probe.style.color = "var(--apidocs-surface)";
        const surface = getComputedStyle(probe).color;
        const text = document.querySelector("figure.diagram .d-text-fg")!;
        const box = document.querySelector("figure.diagram .d-fill-surface")!;
        return { fg, surface, text: getComputedStyle(text).fill, box: getComputedStyle(box).fill };
      });
      expect(colors.text).toBe(colors.fg);
      expect(colors.box).toBe(colors.surface);
      expect(errors).toEqual([]);
      await page.context().close();
    });
  }

  test("previous and next follow reading order across groups", async () => {
    const { page } = await open("guides/concepts/images.html", { javaScriptEnabled: false });
    await page.locator("a.guide-next").click();
    await page.waitForURL(/concepts\/diagrams\.html$/);
    await page.locator("a.guide-next").click();
    await page.waitForURL(/concepts\/advanced\/index\.html$/);
    expect(await page.getByRole("heading", { level: 1 }).textContent()).toBe("Advanced topics");
    await page.context().close();
  });
});

describe("accessibility of a guides-only site", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const path of ["index.html", "guides/getting-started.html", "guides/concepts/alerts.html", "guides/concepts/images.html", "guides/concepts/diagrams.html"]) {
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
