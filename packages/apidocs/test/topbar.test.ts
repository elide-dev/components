/**
 * The top bar at every width from 320 to 1600px (in steps of 20), in both renderers' markup: nothing in it may
 * wrap, overflow or be cut off, with zero to five sibling sites in the switcher, with and without a version menu,
 * and with a short and a long product name. Static pages are built with dist/runner.mjs; the Astro form is the
 * integration's own page parts (renderPage) assembled as ApidocsPage.astro assembles them, with the version menu
 * and the search field in their holes. The Astro sample app's suite sweeps its real pages too.
 *
 * Also: the switcher's menu works with and without the script, and pages with a switcher do not shift as they load.
 * Needs `bun run build` first and a Playwright Chromium.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page } from "playwright";
import { renderToString } from "preact-render-to-string";
import { h } from "preact";
import { samples } from "../samples";
import { renderPage } from "../src/astro/render";
import { SearchField } from "../src/components/chrome";
import type { Theme, ThemeLink } from "../src/theme";

const root = fileURLToPath(new URL("..", import.meta.url));
let browser: Browser;
let dir: string;
let server: ReturnType<typeof Bun.serve>;

const SITES: ThemeLink[] = [
  { label: "User guide", url: "https://example.com/user/" },
  { label: "Developer guide", url: "https://example.com/developer/" },
  { label: "API reference", url: "index.html", current: true },
  { label: "Kotlin API", url: "https://example.com/kotlin/" },
  { label: "Release notes", url: "https://example.com/notes/" },
];
const SUITES: Record<number, ThemeLink[]> = { 0: [], 1: [SITES[0]!], 3: SITES.slice(0, 3), 5: SITES };
const LONG = "Komodo Kotlin Standard Library Reference";
const PAGE = "com/example/geo/Shapes";

interface Variant {
  name: string;
  suites: number;
  long: boolean;
  astro: boolean;
  /** The Astro form with a version menu in the top bar's slot (in place of the module's version). */
  versionMenu: boolean;
}

const variants: Variant[] = [];
for (const astro of [false, true]) {
  for (const suites of [0, 1, 3, 5]) {
    for (const long of [false, true]) {
      for (const versionMenu of astro ? [false, true] : [false]) {
        variants.push({ name: `${astro ? "astro" : "static"}-s${suites}${long ? "-long" : ""}${versionMenu ? "-menu" : ""}`, suites, long, astro, versionMenu });
      }
    }
  }
}

const theme = (v: { suites: number; long: boolean }): Theme => ({ extends: "elide", ...(v.long ? { productName: LONG } : {}), links: { header: SUITES[v.suites] } });

const CHEVRON = '<svg class="icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 6.25 8 10.25l4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
/** VersionSelect.astro's markup, for two versions. */
const VERSION_MENU = `<details class="version-menu" data-version-menu><summary class="version-current" aria-label="Version 2.0: other versions" title="Other versions"><span class="version">2.0</span>${CHEVRON}</summary><ul class="version-list"><li><a href="/v/2.0/" aria-current="page"><span class="version">2.0</span><small>latest</small></a></li><li><a href="/v/main/"><span class="version">main</span><small>development</small></a></li></ul></details>`;

/** An Astro page as ApidocsPage.astro assembles it, served under /<name>/ with the static stylesheets and client. */
function astroPage(v: Variant): string {
  const base = `/${v.name}/`;
  const parts = renderPage(samples.java, PAGE, theme(v), { base, baseUrl: `http://127.0.0.1/${v.name}/`, fontUrl: asset => `/assets/${asset}` });
  const search = renderToString(h(SearchField, { apiLabel: parts.api }));
  return `<!doctype html>\n<html lang="en" data-root="${base}"><head>${parts.head}<link rel="stylesheet" href="/assets/apidocs.css"><link rel="stylesheet" href="/astro.css"><style>${parts.themeCss}</style></head><body>`
    + `${parts.body[0]}${v.versionMenu ? VERSION_MENU : parts.moduleVersion}${parts.body[1]}${search}${parts.body[2]}${parts.body[3]}<script src="/assets/apidocs.js"></script></body></html>`;
}

beforeAll(async () => {
  if (!existsSync(join(root, "dist/render.js"))) throw new Error("dist/ is missing: run `bun run build` first");
  dir = mkdtempSync(join(tmpdir(), "apidocs-topbar-"));
  const model = join(dir, "model.json");
  writeFileSync(model, JSON.stringify(samples.java));
  for (const v of variants.filter(v => !v.astro)) {
    const themeFile = join(dir, `${v.name}.theme.json`);
    writeFileSync(themeFile, JSON.stringify(theme(v)));
    const run = spawnSync(process.execPath, [join(root, "dist/runner.mjs"), "--bundle", join(root, "dist/render.js"), "--assets", join(root, "dist/assets"), "--model", model, "--theme", themeFile, "--out", join(dir, v.name)], { encoding: "utf8" });
    if (run.status !== 0) throw new Error(run.stderr);
  }
  for (const v of variants.filter(v => v.astro)) {
    mkdirSync(join(dir, v.name), { recursive: true });
    writeFileSync(join(dir, v.name, "page.html"), astroPage(v));
  }
  const types: Record<string, string> = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(request) {
      const path = decodeURIComponent(new URL(request.url).pathname);
      const file = path === "/astro.css" ? join(root, "src/astro/apidocs-astro.css")
        : path.startsWith("/assets/") ? join(root, "dist", path)
        : resolve(dir, `.${path}`);
      if (!file.startsWith(root) && !file.startsWith(dir)) return new Response("Not found", { status: 404 });
      if (!existsSync(file)) return new Response("Not found", { status: 404 });
      return new Response(readFileSync(file), { headers: { "content-type": types[extname(file)] ?? "application/octet-stream" } });
    },
  });
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  server?.stop(true);
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const urlOf = (v: Variant) => `http://127.0.0.1:${server.port}/${v.name}/${v.astro ? "page.html" : `${PAGE}.html`}`;

/**
 * What is wrong with the top bar as laid out now: the bar scrolls; a visible part lies outside it; a visible part
 * is cut off (its content wider than its box) other than by an ellipsis; or text in it wraps.
 */
export async function topBarProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>(".topbar")!;
    const box = bar.getBoundingClientRect();
    const problems: string[] = [];
    if (bar.scrollWidth > bar.clientWidth) problems.push(`the bar scrolls: ${bar.scrollWidth} > ${bar.clientWidth}`);
    const shown = (e: Element) => {
      for (let n: Element | null = e; n && n !== bar.parentElement; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.display === "none" || s.visibility === "hidden" || n.classList.contains("visually-hidden")) return false;
      }
      return true;
    };
    for (const e of bar.querySelectorAll<HTMLElement>("*")) {
      // The switcher's measuring row paints nothing and takes no pointer events (see SuiteSwitcher); what it holds is checked.
      if (e.matches(".suites-fit, .suites-probe") || e.closest(".search-results, .suite-list, .version-list, script") || !shown(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const name = `${e.tagName.toLowerCase()}${e.className && typeof e.className === "string" ? `.${e.className.split(" ")[0]}` : ""}`;
      // The switcher's row or menu out of view sits far above the page, and is hidden by the script.
      if (r.bottom < 0) continue;
      if (r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5) problems.push(`${name} lies outside the bar: ${Math.round(r.left)}..${Math.round(r.right)} x ${Math.round(r.top)}..${Math.round(r.bottom)}`);
      const s = getComputedStyle(e);
      if (s.overflowX !== "visible" && e.scrollWidth > e.clientWidth + 1 && s.textOverflow !== "ellipsis" && !(e instanceof HTMLInputElement)) problems.push(`${name} is cut off: ${e.scrollWidth} > ${e.clientWidth}`);
      if (e.children.length === 0 && e.textContent?.trim() && s.whiteSpace !== "nowrap" && r.height > parseFloat(s.lineHeight || "0") * 1.5 + 1) problems.push(`${name} wraps: ${Math.round(r.height)}px tall`);
    }
    return problems;
  });
}

describe("the top bar never wraps, overflows or is cut off", () => {
  for (const v of variants) {
    test(`${v.name}, 320 to 1600px`, async () => {
      const page = await browser.newPage({ viewport: { width: 1600, height: 600 } });
      await page.goto(urlOf(v));
      await page.evaluate(() => document.fonts.ready);
      const found: string[] = [];
      for (let width = 320; width <= 1600; width += 20) {
        await page.setViewportSize({ width, height: 600 });
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        for (const problem of await topBarProblems(page)) found.push(`${width}px: ${problem}`);
      }
      expect(found).toEqual([]);
      await page.close();
    }, 120_000);
  }
});

describe("right to left", () => {
  test("a page laid out with dir=rtl mirrors: navigator on the right, bar intact", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(urlOf(variants.find(v => v.name === "static-s3")!));
    await page.evaluate(() => document.documentElement.setAttribute("dir", "rtl"));
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const box = (selector: string) => page.locator(selector).first().evaluate(e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right }; });
    const [nav, content] = [await box(".sidebar"), await box(".content")];
    expect(nav.left).toBeGreaterThan(content.left);
    // The brand starts the bar on the right; the theme switch ends it on the left.
    expect((await box(".brand")).left).toBeGreaterThan((await box(".theme-switch")).left);
    // Text starts at the right edge of its box: a navigator row's label, a member row's signature.
    const row = await page.locator(".sidebar .nav-row").first().evaluate(e => getComputedStyle(e).direction);
    expect(row).toBe("rtl");
    expect(await topBarProblems(page)).toEqual([]);
    await page.screenshot({ path: join(dir, "rtl.png") });
    await page.close();
  });
});

describe("the suite switcher", () => {
  const five = () => variants.find(v => v.name === "static-s5")!;

  test("shows the row where it fits, the menu where it does not, and leaves a phone's bar", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 700 } });
    await page.goto(urlOf(five()));
    const state = () => page.locator(".suites").getAttribute("data-fit");
    expect(await state()).toBe("row");
    expect(await page.locator(".suites-row").isVisible()).toBe(true);
    expect(await page.locator('.suites-row a[aria-current="true"]').textContent()).toBe("API reference");
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.waitForFunction(() => document.querySelector(".suites")?.getAttribute("data-fit") === "menu");
    expect(await page.locator(".suites-row").isVisible()).toBe(false);
    expect(await page.locator(".suite-current").textContent()).toBe("API reference");
    await page.setViewportSize({ width: 360, height: 700 });
    await page.waitForFunction(() => document.querySelector(".suites")?.getAttribute("data-fit") === "none");
    expect(await page.locator(".suite-current").isVisible()).toBe(false);
    // The drawer lists the sites first.
    await page.locator(".nav-button").click();
    expect(await page.locator(".sidebar > :first-child a").allTextContents()).toEqual(SITES.map(s => s.label));
    expect(await page.locator('.sidebar > :first-child a[aria-current="true"]').textContent()).toBe("API reference");
    await page.close();
  });

  test("the menu opens, and closes on Escape and on a click outside it", async () => {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto(urlOf(five()));
    const open = () => page.locator("details.suite-menu").evaluate(d => (d as HTMLDetailsElement).open);
    await page.locator(".suite-current").click();
    expect(await open()).toBe(true);
    expect(await page.locator(".suite-list a").allTextContents()).toEqual(SITES.map(s => s.label));
    await page.keyboard.press("Escape");
    expect(await open()).toBe(false);
    expect(await page.evaluate(() => document.activeElement?.classList.contains("suite-current"))).toBe(true);
    await page.locator(".suite-current").click();
    // A click outside the menu, at the window's bottom corner: the open list can cover the heading, whose center
    // moves with the fonts the machine has.
    await page.mouse.click(980, 680);
    expect(await open()).toBe(false);
    await page.close();
  });

  test("without JavaScript, the layout still picks the row or the menu, and the menu opens", async () => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 700 } });
    const page = await context.newPage();
    // With a long product name: without the script there is no search field, so the row fits at 1000px otherwise.
    await page.goto(urlOf(variants.find(v => v.name === "static-s5-long")!));
    const inView = (selector: string) => page.locator(selector).evaluate(e => e.getBoundingClientRect().bottom > 0);
    expect(await inView(".suites-row")).toBe(true);
    expect(await inView(".suite-menu")).toBe(false);
    await page.setViewportSize({ width: 1000, height: 700 });
    expect(await inView(".suites-row")).toBe(false);
    expect(await inView(".suite-menu")).toBe(true);
    expect(await topBarProblems(page)).toEqual([]);
    await page.locator(".suite-current").click();
    expect(await page.locator(".suite-list").isVisible()).toBe(true);
    await context.close();
  });

  for (const width of [1440, 1000, 360]) {
    test(`a page with five sites does not shift as it loads, at ${width}px`, async () => {
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      await page.addInitScript(() => {
        (window as unknown as { cls: number }).cls = 0;
        new PerformanceObserver(list => {
          for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
            if (!entry.hadRecentInput) (window as unknown as { cls: number }).cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(urlOf(five()), { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => (window as unknown as { cls: number }).cls)).toBe(0);
      await page.close();
    });
  }
});
