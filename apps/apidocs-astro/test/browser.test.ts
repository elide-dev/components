/**
 * The sample app built for Cloudflare and served by wrangler dev, in Chromium: the client router, the persisted
 * top bar and navigator, the page behaviors across navigations, server islands, JavaScript off, reduced motion,
 * layout stability, axe, and head metadata against the static renderer.
 *
 * Builds the app and starts wrangler dev on port 5191 (APIDOCS_ASTRO_PORT picks another) unless APIDOCS_ASTRO_URL
 * names a running server. Needs a Playwright 1.65 Chromium (PLAYWRIGHT_BROWSERS_PATH).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { samples } from "@elide/apidocs/samples";
import { render } from "@elide/apidocs";
import { mapUrl } from "@elide/apidocs/astro/helpers";
import { type Browser, type BrowserContextOptions, chromium, type Page } from "playwright";

const app = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const PORT = Number(process.env.APIDOCS_ASTRO_PORT ?? 5191);
let origin = process.env.APIDOCS_ASTRO_URL?.replace(/\/$/, "") ?? `http://127.0.0.1:${PORT}`;
let server: ChildProcess | undefined;
let browser: Browser;

const TYPE = "/java/2.0/com/example/geo/Circle";
const OTHER = "/java/2.0/com/example/geo/Shapes";

beforeAll(async () => {
  if (!process.env.APIDOCS_ASTRO_URL) {
    const build = spawnSync("bun", ["run", "build"], { cwd: app, encoding: "utf8" });
    if (build.status !== 0) throw new Error(build.stdout + build.stderr);
    server = spawn("bunx", ["wrangler", "dev", "-c", "dist/server/wrangler.json", "--ip", "127.0.0.1", "--port", String(PORT)], { cwd: app, stdio: "ignore" });
    origin = `http://127.0.0.1:${PORT}`;
    for (let i = 0; ; i++) {
      try {
        if ((await fetch(`${origin}/`)).ok) break;
      } catch {
        if (i > 120) throw new Error("wrangler dev did not start");
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }
  browser = await chromium.launch();
}, 240_000);

afterAll(async () => {
  await browser?.close();
  server?.kill();
});

interface Opened {
  page: Page;
  errors: string[];
  /** Document requests after the first: a full page load. */
  documents: string[];
}

async function open(path: string, options: BrowserContextOptions = {}): Promise<Opened> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light", ...options });
  const page = await context.newPage();
  const errors: string[] = [];
  const documents: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => m.type() === "error" && errors.push(m.text()));
  await page.goto(origin + path, { waitUntil: "load" });
  page.on("request", r => r.resourceType() === "document" && r.frame() === page.mainFrame() && documents.push(r.url()));
  return { page, errors, documents };
}

/** Clicks a link and waits until the router has swapped in its page. */
async function follow(page: Page, selector: string): Promise<void> {
  const before = await page.evaluate(() => location.href);
  const loaded = page.evaluate(() => new Promise<void>(r => document.addEventListener("astro:page-load", () => r(), { once: true })));
  await page.locator(selector).first().click();
  await loaded;
  expect(await page.evaluate(() => location.href)).not.toBe(before);
}

async function afterLoad(page: Page, action: () => Promise<unknown>): Promise<void> {
  const loaded = page.evaluate(() => new Promise<void>(r => document.addEventListener("astro:page-load", () => r(), { once: true })));
  await action();
  await loaded;
}

describe("client router", () => {
  test("links, back and forward swap pages without a document load", async () => {
    const { page, errors, documents } = await open(TYPE);
    await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
    await follow(page, `.sidebar a[href="${OTHER}"]`);
    expect(await page.locator("h1").textContent()).toContain("Shapes");
    await afterLoad(page, () => page.goBack());
    expect(new URL(page.url()).pathname).toBe(TYPE);
    expect(await page.locator("h1").textContent()).toContain("Circle");
    await afterLoad(page, () => page.goForward());
    expect(new URL(page.url()).pathname).toBe(OTHER);
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
    expect(documents).toEqual([]);
    expect(errors).toEqual([]);
    await page.context().close();
  });

  test("back restores the scroll position", async () => {
    const { page } = await open("/java/2.0/com/example/geo/registry/ShapeCatalog");
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(100);
    await follow(page, `.sidebar a[href="/java/2.0/com/example/geo/"]`);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await afterLoad(page, () => page.goBack());
    expect(await page.evaluate(() => scrollY)).toBe(1500);
    await page.context().close();
  });

  test("the route change is announced, and focus leaves the old page", async () => {
    const { page } = await open(TYPE);
    await follow(page, `.content a[href="/java/2.0/com/example/geo/Shape"]`);
    await page.waitForFunction(() => document.querySelector(".astro-route-announcer")?.textContent === document.title);
    expect(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest(".topbar, .sidebar"))).toBe(true);
    await page.context().close();
  });

  test("a keyboard user who follows a navigator row keeps focus on that row", async () => {
    const { page } = await open(TYPE);
    await page.locator(`.sidebar a[href="${OTHER}"]`).focus();
    await afterLoad(page, () => page.keyboard.press("Enter"));
    expect(await page.evaluate(() => document.activeElement?.getAttribute("href"))).toBe(OTHER);
    expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-current"))).toBe("page");
    await page.context().close();
  });

  test("hovering a link prefetches its page", async () => {
    const { page } = await open(TYPE);
    const fetched = page.waitForRequest(r => r.url() === `${origin}/java/2.0/com/example/geo/Units`, { timeout: 5000 });
    await page.locator(`.sidebar a[href="/java/2.0/com/example/geo/Units"]`).hover();
    await fetched;
    await page.context().close();
  });
});

describe("the persisted top bar and navigator", () => {
  test("the navigator keeps its scroll position and filter text, and shows the new page as current", async () => {
    const { page } = await open(TYPE, { viewport: { width: 1440, height: 500 } });
    const nav = page.locator("#apidocs-nav");
    await page.locator("#apidocs-nav-filter").fill("sha");
    // Scroll so the row to follow is in view, then follow it without Playwright scrolling anything.
    await nav.evaluate((n, href) => (n.scrollTop = (n.querySelector(`a[href="${href}"]`) as HTMLElement).offsetTop - 120), OTHER);
    await page.waitForTimeout(50);
    const top = await nav.evaluate(n => n.scrollTop);
    expect(top).toBeGreaterThan(0);
    await afterLoad(page, () => page.evaluate(href => (document.querySelector(`.sidebar a[href="${href}"]`) as HTMLAnchorElement).click(), OTHER));
    expect(await nav.evaluate(n => n.scrollTop)).toBe(top);
    expect(await page.locator("#apidocs-nav-filter").inputValue()).toBe("sha");
    expect(await page.locator('.sidebar [aria-current="page"]').getAttribute("href")).toBe(OTHER);
    // The filter applies to the new page's rows: Units does not match "sha".
    expect(await page.locator(`.sidebar a[href="/java/2.0/com/example/geo/Units"]`).isVisible()).toBe(false);
    await page.context().close();
  });

  test("the navigator's index links and module heading follow the page", async () => {
    const { page } = await open(TYPE);
    expect(await page.locator('.nav-module [aria-current="page"]').count()).toBe(0);
    await follow(page, '.nav-index a[href="/java/2.0/index-all"]');
    expect(await page.locator('.nav-index [aria-current="page"]').getAttribute("href")).toBe("/java/2.0/index-all");
    expect(await page.locator('.sidebar [aria-current="page"]').count()).toBe(1);
    // The module's heading is its overview.
    await follow(page, '.nav-module > a[href="/java/2.0/"]');
    expect(await page.locator('.nav-module > a').getAttribute("aria-current")).toBe("page");
    expect(await page.locator('.sidebar [aria-current="page"]').count()).toBe(1);
    await page.context().close();
  });

  test("the suite switcher marks the current site, within a site and after moving to another", async () => {
    const { page, documents } = await open(TYPE);
    const current = () => page.locator('.suites-row a[aria-current="true"]').textContent();
    expect(await current()).toBe("Java API");
    expect(await page.locator('.suites-row a[aria-current="true"]').getAttribute("href")).toBe("/java/2.0/");
    await follow(page, `.sidebar a[href="${OTHER}"]`);
    expect(await current()).toBe("Java API");
    expect(await page.locator(".suites").getAttribute("data-fit")).toBe("row");
    await follow(page, '.suites-row a[href="/kotlin/"]');
    expect(new URL(page.url()).pathname).toBe("/kotlin/");
    expect(await current()).toBe("Kotlin API");
    expect(await page.locator('.suites-row a[aria-current="true"]').getAttribute("href")).toBe("/kotlin/");
    expect(await page.locator(".suites").getAttribute("data-fit")).toBe("row");
    await follow(page, '.suites-row a[href="/guides/"]');
    expect(await current()).toBe("User guide");
    // The guides-only site has its overview as a guide, so the navigator lists no index links.
    expect(await page.locator(".nav-reference, .nav-index").count()).toBe(0);
    expect(documents).toEqual([]);
    await page.context().close();
  });

  test("on a phone the switcher leaves the bar, and the drawer lists the sites first", async () => {
    const { page } = await open(TYPE, { viewport: { width: 360, height: 700 } });
    expect(await page.locator(".suites").getAttribute("data-fit")).toBe("none");
    expect(await page.locator(".suites-row").isVisible()).toBe(false);
    await page.locator(".nav-button").click();
    const first = page.locator(".sidebar > :first-child");
    expect(await first.evaluate(e => e.classList.contains("nav-suites"))).toBe(true);
    expect(await first.locator("a").allTextContents()).toEqual(["User guide", "Java API", "Kotlin API"]);
    // After a navigation the drawer's blocks keep their order around the kept filter field.
    await follow(page, `.sidebar a[href="${OTHER}"]`);
    expect(await page.locator(".sidebar > :first-child").evaluate(e => e.classList.contains("nav-suites"))).toBe(true);
    expect(await page.locator(".sidebar > :nth-child(2)").evaluate(e => e.classList.contains("nav-filter"))).toBe(true);
    await page.context().close();
  });

  test("opening a guide group preserves saved folds and distinguishes focus on its first child", async () => {
    const { page } = await open(TYPE);
    const nav = page.locator(".sidebar");
    const foldedKeys = () => nav.locator(".nav-branch[data-folded]").evaluateAll(rows => rows.map(row => row.getAttribute("data-nav-key")));
    const saved = await foldedKeys();
    const button = nav.locator("[data-nav-fold-all]");
    await button.click();
    const group = nav.locator('[data-nav-key="g:Advanced"]');
    const heading = group.locator(".nav-group-row");
    await afterLoad(page, () => heading.press("Enter"));
    expect(await heading.evaluate(el => el === document.activeElement)).toBe(true);
    expect(await button.getAttribute("aria-label")).toBe("Expand all");
    await button.click();
    await button.click();
    expect(await foldedKeys()).toEqual(saved);

    const children = group.locator(".nav-children a.nav-row");
    await group.locator(".nav-twisty").click();
    await afterLoad(page, () => children.nth(1).click());
    await afterLoad(page, () => children.first().press("Enter"));
    expect(await children.first().evaluate(el => el === document.activeElement)).toBe(true);
    await page.keyboard.press("ArrowDown");
    expect(await children.nth(1).evaluate(el => el === document.activeElement)).toBe(true);
    await page.context().close();
  });

  test("the elements are the same objects after a navigation", async () => {
    const { page } = await open(TYPE);
    await page.evaluate(() => ((window as unknown as { kept: Element[] }).kept = [document.querySelector(".topbar")!, document.querySelector(".sidebar")!]));
    await follow(page, `.sidebar a[href="${OTHER}"]`);
    expect(await page.evaluate(() => (window as unknown as { kept: Element[] }).kept.every(e => e.isConnected))).toBe(true);
    await page.context().close();
  });
});

describe("behaviors across navigations", () => {
  const pages = [TYPE, OTHER, "/java/2.0/com/example/geo/Units", "/java/2.0/guides/concepts", "/java/2.0/com/example/geo/"];

  test("after ten navigations, every behavior works once, with no errors", async () => {
    const { page, errors } = await open(TYPE);
    for (let i = 1; i <= 10; i++) {
      const target = pages[i % pages.length]!;
      await afterLoad(page, () => page.evaluate(href => (document.querySelector(`a[href="${href}"]`) as HTMLAnchorElement).click(), target));
    }
    await afterLoad(page, () => page.evaluate(href => (document.querySelector(`a[href="${href}"]`) as HTMLAnchorElement).click(), OTHER));
    // Theme switch: one click is one step (a duplicate listener would skip a mode).
    await page.locator("[data-theme-switch]").click();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
    await page.locator("[data-theme-switch]").click();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
    // Expand all: one click opens every member of the group.
    const toggle = page.locator("[data-expand-all]").first();
    await toggle.click();
    expect(await toggle.getAttribute("aria-expanded")).toBe("true");
    expect(await page.locator("section.members").first().locator("details.member:not([open])").count()).toBe(0);
    // The navigator's filter narrows its rows; fold-all folds and opens every branch, once per click.
    const visible = () => page.locator(".sidebar a.nav-row:visible").count();
    const all = await visible();
    await page.locator("#apidocs-nav-filter").fill("Circle");
    const narrowed = await visible();
    expect(narrowed).toBeGreaterThan(0);
    expect(narrowed).toBeLessThan(all);
    await page.locator("#apidocs-nav-filter").fill("");
    const foldedKeys = () => page.locator(".sidebar .nav-branch[data-folded]").evaluateAll(rows => rows.map(row => row.getAttribute("data-nav-key")));
    const saved = await foldedKeys();
    await page.getByRole("button", { name: "Collapse all", exact: true }).and(page.locator("[data-nav-fold-all]")).click();
    expect(await page.locator(".sidebar .nav-branch:not([data-folded])").count()).toBe(0);
    await page.getByRole("button", { name: "Expand all", exact: true }).and(page.locator("[data-nav-fold-all]")).click();
    expect(await foldedKeys()).toEqual([]);
    await page.getByRole("button", { name: "Restore previous layout" }).click();
    expect(await foldedKeys()).toEqual(saved);
    // The navigator toggle.
    await page.locator(".nav-button").click();
    expect(await page.locator("#apidocs-nav").isVisible()).toBe(false);
    await page.locator(".nav-button").click();
    // Search: type, open a result through the router.
    await page.locator("#apidocs-search").fill("ShapeCat");
    await page.locator("#apidocs-results [role=option]").first().waitFor();
    await afterLoad(page, () => page.locator("#apidocs-search").press("Enter"));
    expect(new URL(page.url()).pathname).toBe("/java/2.0/com/example/geo/registry/ShapeCatalog");
    expect(await page.locator("#apidocs-search").inputValue()).toBe("");
    expect(errors).toEqual([]);
    await page.context().close();
  }, 60_000);

  test("twenty navigations leave listener and node counts flat", async () => {
    const { page } = await open(TYPE);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const sample = async () => {
      await cdp.send("HeapProfiler.collectGarbage");
      const { metrics } = await cdp.send("Performance.getMetrics");
      const get = (name: string) => metrics.find(m => m.name === name)!.value;
      return { listeners: get("JSEventListeners"), nodes: get("Nodes"), documents: get("Documents") };
    };
    // A router transition keeps the outgoing page alive until it ends, and a slow runner ends it late. Sample until
    // three reads in a row agree, so the counts are those of the settled page; a real leak never settles lower.
    const measure = async () => {
      let last = await sample();
      for (let stable = 0, tries = 0; stable < 3 && tries < 40; tries++) {
        await page.waitForTimeout(250);
        const next = await sample();
        stable = JSON.stringify(next) === JSON.stringify(last) ? stable + 1 : 0;
        last = next;
      }
      return last;
    };
    const loop = async (n: number) => {
      for (let i = 0; i < n; i++) {
        await afterLoad(page, () => page.evaluate(href => (document.querySelector(`a[href="${href}"]`) as HTMLAnchorElement).click(), i % 2 ? TYPE : OTHER));
      }
    };
    // Which elements the page holds, live and detached (kept alive by something), to read a growth from.
    const census = async () => {
      const { result } = await cdp.send("Runtime.evaluate", { expression: "Element.prototype", objectGroup: "census" });
      const { objects } = await cdp.send("Runtime.queryObjects", { prototypeObjectId: result.objectId!, objectGroup: "census" });
      const detached = await cdp.send("Runtime.callFunctionOn", {
        objectId: objects.objectId!,
        functionDeclaration: `function () {
          const tally = {};
          for (const el of this) try { if (!el.isConnected) { const k = el.tagName + (typeof el.className === "string" && el.className ? "." + el.className.split(" ")[0] : ""); tally[k] = (tally[k] || 0) + 1; } } catch {}
          return JSON.stringify(Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 12));
        }`,
        returnByValue: true,
      });
      await cdp.send("Runtime.releaseObjectGroup", { objectGroup: "census" });
      const live = await page.evaluate(() => ({
        elements: document.querySelectorAll("*").length,
        containers: Array.from(document.body.children).map(c => `${c.tagName.toLowerCase()}.${(c as HTMLElement).className}:${c.querySelectorAll("*").length}`).join(" "),
        head: Array.from(document.head.children).map(c => c.tagName.toLowerCase()).join(","),
      }));
      return { ...live, detached: detached.result.value ?? detached.exceptionDetails?.text };
    };
    await loop(4);
    await page.waitForTimeout(300);
    const before = await measure();
    const censusBefore = await census();
    await loop(20);
    await page.waitForTimeout(300);
    const after = await measure();
    const censusAfter = await census();
    console.log("  listeners and nodes, after 4 and after 24 navigations:", before, after);
    const grew = after.listeners > before.listeners || after.nodes > before.nodes * 1.02 || after.documents > before.documents;
    // The counts alone cannot say where a growth sits: print what the page holds, live and detached, when it fails.
    if (grew || censusAfter.elements !== censusBefore.elements || censusAfter.detached !== "[]") {
      console.log("  census before:", JSON.stringify(censusBefore), "\n  census after: ", JSON.stringify(censusAfter));
    }
    expect(after.listeners).toBeLessThanOrEqual(before.listeners);
    expect(after.nodes).toBeLessThanOrEqual(before.nodes * 1.02);
    expect(after.documents).toBeLessThanOrEqual(before.documents);
    // The page's own elements are the same in number, and nothing detached stays reachable from script.
    expect(censusAfter.elements).toBe(censusBefore.elements);
    expect(censusAfter.containers).toBe(censusBefore.containers);
    expect(censusAfter.detached).toBe("[]");
    await page.context().close();
  }, 120_000);
});

describe("layout stability", () => {
  async function shifts(page: Page): Promise<number> {
    return page.evaluate(() => (window as unknown as { cls: number }).cls);
  }
  const observe = () => {
    (window as unknown as { cls: number }).cls = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!entry.hadRecentInput) (window as unknown as { cls: number }).cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  };

  test("first load shifts nothing, with the version islands arriving after it", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(observe);
    const box = async () => page.locator(".version-menu").first().boundingBox();
    await page.goto(origin + "/java/main/com/example/geo/Circle", { waitUntil: "domcontentloaded" });
    const fallback = await box();
    await page.waitForFunction(() => !!document.querySelector("details.version-menu .version-list a[href='/java/2.0/com/example/geo/Circle']"));
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    expect(await box()).toEqual(fallback);
    expect(await shifts(page)).toBe(0);
    await context.close();
  });

  test("a navigation shifts nothing", async () => {
    const { page } = await open("/java/main/com/example/geo/Circle");
    await page.evaluate(observe);
    await page.waitForTimeout(300);
    await follow(page, `.sidebar a[href="/java/main/com/example/geo/Shapes"]`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    expect(await shifts(page)).toBe(0);
    await page.context().close();
  });
});

describe("the top bar", () => {
  /** packages/apidocs/test/topbar.test.ts topBarProblems, for the app's own pages: what wraps, overflows or is cut off. */
  const problems = (page: Page) => page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>(".topbar")!;
    const box = bar.getBoundingClientRect();
    const found: string[] = [];
    if (bar.scrollWidth > bar.clientWidth) found.push(`the bar scrolls: ${bar.scrollWidth} > ${bar.clientWidth}`);
    const shown = (e: Element) => {
      for (let n: Element | null = e; n && n !== bar.parentElement; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.display === "none" || s.visibility === "hidden" || n.classList.contains("visually-hidden")) return false;
      }
      return true;
    };
    for (const e of bar.querySelectorAll<HTMLElement>("*")) {
      if (e.matches(".suites-fit, .suites-probe") || e.closest(".search-results, .suite-list, .version-list, script") || !shown(e)) continue;
      const r = e.getBoundingClientRect();
      if ((r.width === 0 && r.height === 0) || r.bottom < 0) continue;
      const s = getComputedStyle(e);
      const name = `${e.tagName.toLowerCase()}.${typeof e.className === "string" ? e.className.split(" ")[0] : ""}`;
      if (r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5) found.push(`${name} lies outside the bar`);
      if (s.overflowX !== "visible" && e.scrollWidth > e.clientWidth + 1 && s.textOverflow !== "ellipsis" && !(e instanceof HTMLInputElement)) found.push(`${name} is cut off`);
    }
    return found;
  });

  for (const path of [TYPE, "/kotlin/org/example/kgeo/Geometry", "/guides/guides/getting-started"]) {
    test(`${path}: nothing wraps, overflows or is cut off from 320 to 1600px`, async () => {
      const { page } = await open(path, { viewport: { width: 1600, height: 600 } });
      await page.waitForSelector(".topbar");
      const found: string[] = [];
      for (let width = 320; width <= 1600; width += 20) {
        await page.setViewportSize({ width, height: 600 });
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        for (const problem of await problems(page)) found.push(`${width}px: ${problem}`);
      }
      expect(found).toEqual([]);
      await page.context().close();
    }, 120_000);
  }
});

describe("server islands", () => {
  test("the version menu lists the versions and opens the same page in another one", async () => {
    const { page, documents } = await open("/java/main/com/example/geo/Circle");
    await page.waitForSelector("details.version-menu .version-list", { state: "attached" });
    expect(await page.locator(".version-notice").textContent()).toContain("latest release is 2.0");
    await follow(page, `.sidebar a[href="/java/main/com/example/geo/Shapes"]`);
    await page.locator("details.version-menu summary").click();
    // The menu was rendered for Circle; its links now point at the page being read.
    expect(await page.locator(".version-list a").first().getAttribute("href")).toBe("/java/2.0/com/example/geo/Shapes");
    await follow(page, '.version-list a[href="/java/2.0/com/example/geo/Shapes"]');
    expect(new URL(page.url()).pathname).toBe("/java/2.0/com/example/geo/Shapes");
    await page.waitForSelector("details.version-menu .version-list", { state: "attached" });
    expect(await page.locator("details.version-menu summary").textContent()).toContain("2.0");
    expect(await page.locator(".version-notice").count()).toBe(0);
    expect(await page.locator('.sidebar a[aria-current="page"]').getAttribute("href")).toBe("/java/2.0/com/example/geo/Shapes");
    expect(documents).toEqual([]);
    await page.context().close();
  });
});

describe("JavaScript off", () => {
  test("pages are complete, links work, and the islands' fallbacks stand in", async () => {
    const { page } = await open("/java/main/com/example/geo/Circle", { javaScriptEnabled: false });
    expect(await page.locator("h1").textContent()).toContain("Circle");
    expect(await page.locator("details.member").count()).toBeGreaterThan(3);
    // Nothing in the navigator is folded without the script.
    const rows = page.locator(".sidebar a.nav-row");
    expect(await rows.count()).toBeGreaterThan(5);
    expect(await page.locator(".sidebar a.nav-row:visible").count()).toBe(await rows.count() - await page.locator(".nav-suites a.nav-row").count());
    for (const control of await page.locator("[data-js-only]").all()) expect(await control.isVisible()).toBe(false);
    // The fallbacks: a working version menu and the notice, from the versions known when the page rendered.
    expect(await page.locator(".version-notice").textContent()).toContain("2.0");
    await page.locator("details.version-menu summary").click();
    await page.locator('.version-list a[href="/java/2.0/com/example/geo/Circle"]').click();
    await page.waitForURL(`${origin}/java/2.0/com/example/geo/Circle`);
    await page.locator(`.sidebar a[href="${OTHER}"]`).click();
    await page.waitForURL(origin + OTHER);
    expect(await page.locator("h1").textContent()).toContain("Shapes");
    await page.context().close();
  });
});

describe("reduced motion", () => {
  test("no transition or load bar animates, and navigation still works", async () => {
    const { page } = await open(TYPE, { reducedMotion: "reduce" });
    expect(await page.locator(".loadbar").evaluate(e => getComputedStyle(e).display)).toBe("none");
    const animated = page.evaluate(() => new Promise<string[]>(resolve => {
      const seen = new Set<string>();
      const watch = () => {
        for (const a of document.getAnimations()) if ((a.effect as KeyframeEffect | null)?.getComputedTiming().duration) seen.add(String((a as CSSAnimation).animationName ?? a.id));
      };
      const timer = setInterval(watch, 5);
      document.addEventListener("astro:page-load", () => {
        watch();
        clearInterval(timer);
        resolve([...seen]);
      }, { once: true });
    }));
    await page.locator(`.sidebar a[href="${OTHER}"]`).click();
    expect(await animated).toEqual([]);
    expect(await page.locator("h1").textContent()).toContain("Shapes");
    await page.context().close();
  });
});

describe("accessibility", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const path of [TYPE, "/java/2.0/guides/concepts", "/java/2.0/index-all", "/java/main/com/example/geo/", "/guides/", "/kotlin/org/example/kgeo/ShapeParseException", "/java/2.0/nope"]) {
      test(`${path} in ${colorScheme} has no axe violations`, async () => {
        const { page } = await open(path, { colorScheme });
        await page.waitForLoadState("networkidle");
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

describe("metadata", () => {
  test("a served page's head metadata is the static renderer's, apart from the URL form", async () => {
    const baseUrl = `${origin}/java/2.0/`;
    const page = "com/example/geo/Circle";
    const served = await (await fetch(`${baseUrl}${page}`)).text();
    const staticHtml = render(samples.java, { extends: "elide", baseUrl })[`${page}.html`] as string;
    const ctx = { page, base: "/java/2.0/", baseUrl };
    const metadata = (html: string, map: (u: string) => string | undefined) => {
      const head = html.split("<head>")[1]!.split("</head>")[0]!;
      return {
        title: /<title>(.*?)<\/title>/.exec(head)?.[1],
        meta: [...head.matchAll(/<meta (?:name|property)="(description|keywords|generator|apidocs:[a-z]+|og:[a-z_]+|twitter:card)" content="([^"]*)"\/?>/g)].map(m => [m[1], m[1] === "og:url" ? map(m[2]!) : m[1] === "og:image" ? "(the social image)" : m[2]]),
        links: [...head.matchAll(/<link rel="(canonical|alternate|index)"[^>]*? href="([^"]*)"/g)].map(m => [m[1], map(m[2]!)]),
        // The social image is the app's bundled file, not the static site's assets/social/.
        jsonLd: JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(head)![1]!, (key, value) => (key === "url" && /\.png$/.test(value) ? "(the social image)" : ["url", "item", "contentUrl"].includes(key) ? map(value) : value)),
      };
    };
    expect(metadata(served, u => u)).toEqual(metadata(staticHtml, u => mapUrl(u, ctx)));
  });

  test("text files are served with their types; the static form redirects", async () => {
    const at = (path: string) => fetch(`${origin}${path}`, { redirect: "manual" });
    expect((await at("/java/2.0/llms.txt")).headers.get("content-type")).toContain("text/plain");
    expect((await at("/java/2.0/com/example/geo/Circle.md")).headers.get("content-type")).toContain("text/markdown");
    const redirect = await at("/java/2.0/com/example/geo/Circle.html");
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get("location")).toBe("/java/2.0/com/example/geo/Circle");
    expect((await at("/java/2.0/com/example/geo/Nope")).status).toBe(404);
  });

  test("the social image is served, and a missing page is the site's not-found page, as HTML or Markdown", async () => {
    const html = await (await fetch(`${origin}/java/2.0/`)).text();
    const image = /<meta property="og:image" content="([^"]*)"/.exec(html)![1]!;
    expect(image).toMatch(new RegExp(`^${origin}/_astro/`));
    const png = await fetch(image);
    expect(png.status).toBe(200);
    expect(png.headers.get("content-type")).toBe("image/png");
    const missing = await fetch(`${origin}/java/2.0/com/example/geo/Nope`);
    expect(missing.status).toBe(404);
    const page = await missing.text();
    expect(page).toContain("<h1>Not found</h1>");
    expect(page).toContain('<a href="/java/2.0/packages">Packages</a>');
    expect(page).toContain('<meta name="robots" content="noindex"/>');
    const md = await fetch(`${origin}/java/2.0/com/example/geo/Nope`, { headers: { accept: "text/markdown" } });
    expect(md.status).toBe(404);
    expect(md.headers.get("content-type")).toContain("text/markdown");
    expect(await md.text()).toContain("Start at the [overview](/java/2.0/index.md)");
  });
});
