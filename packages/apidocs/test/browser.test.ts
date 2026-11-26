/**
 * Opens a site built exactly as the doclet builds it (dist/runner.mjs running
 * dist/render.js) in Chromium: from file:// with JavaScript on and off, and
 * over HTTP where a test needs it. Runs axe on the page shell in light and
 * dark. Needs `bun run build` first (turbo runs it) and a Playwright Chromium.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type Browser, type BrowserContextOptions, chromium, type Page } from "playwright";
import { samples } from "../samples";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
let browser: Browser;
let site: string;
let out: string;
let server: ReturnType<typeof Bun.serve>;

beforeAll(async () => {
  if (!existsSync(join(root, "dist/render.js"))) throw new Error("dist/ is missing: run `bun run build` first");
  site = mkdtempSync(join(tmpdir(), "apidocs-browser-"));
  out = join(site, "out");
  const model = join(site, "model.json");
  const theme = join(site, "theme.json");
  writeFileSync(model, JSON.stringify(samples.java));
  // With sibling sites, so the suite switcher is in every page the tests open.
  writeFileSync(theme, JSON.stringify({ extends: "elide", links: { header: [{ label: "User guide", url: "https://example.com/user/" }, { label: "API reference", url: "index.html", current: true }, { label: "Kotlin API", url: "https://example.com/kotlin/" }] } }));
  const run = spawnSync(process.execPath, [join(root, "dist/runner.mjs"), "--bundle", join(root, "dist/render.js"), "--assets", join(root, "dist/assets"), "--model", model, "--theme", theme, "--out", out], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(run.stderr);
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(request) {
      const path = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, "");
      const file = resolve(out, path);
      if (!file.startsWith(out) || !existsSync(file)) return new Response("Not found", { status: 404 });
      const type = file.endsWith(".html") ? "text/html" : file.endsWith(".css") ? "text/css" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".woff2") ? "font/woff2" : "application/octet-stream";
      return new Response(readFileSync(file), { headers: { "content-type": type } });
    },
  });
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  server?.stop(true);
  if (site) rmSync(site, { recursive: true, force: true });
});

const fileUrl = (path: string) => {
  const [file, fragment] = path.split("#");
  return pathToFileURL(join(out, file!)).href + (fragment === undefined ? "" : `#${fragment}`);
};
const httpUrl = (path: string) => `http://127.0.0.1:${server.port}/${path}`;

async function open(path: string, options: BrowserContextOptions & { http?: boolean } = {}): Promise<{ page: Page; requests: string[]; errors: string[] }> {
  const { http, ...contextOptions } = options;
  const context = await browser.newContext({ colorScheme: "light", ...contextOptions });
  const page = await context.newPage();
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", request => requests.push(request.url()));
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => message.type() === "error" && errors.push(message.text()));
  await page.goto(http ? httpUrl(path) : fileUrl(path));
  return { page, requests, errors };
}

describe("from file:// with JavaScript off", () => {
  test("pages are complete, and script-only controls stay out", async () => {
    const { page, requests } = await open("com/example/geo/Shapes.html", { javaScriptEnabled: false });
    expect(await page.getByRole("heading", { level: 1 }).textContent()).toContain("Shapes");
    expect(await page.getByRole("heading", { level: 1, name: "Shapes" }).count()).toBe(1);
    // Members are disclosures: every entry is in the page, and one opens with a click and no script.
    expect(await page.locator("details.member").count()).toBeGreaterThan(8);
    const parse = page.locator("details.member", { has: page.locator("#parse\\(java\\.lang\\.String\\)") });
    expect(await parse.locator(".callout-apiNote").count()).toBe(1);
    expect(await parse.locator(".callout-apiNote").isVisible()).toBe(false);
    await parse.locator("summary").click();
    expect(await parse.locator(".callout-apiNote").isVisible()).toBe(true);
    for (const control of await page.locator("[data-js-only]").all()) expect(await control.isVisible()).toBe(false);
    expect(await page.locator(".search-fallback").isVisible()).toBe(true);
    expect(await page.locator("[data-copy]").first().isVisible()).toBe(false);
    // The navigator is the page's own copy: the module's heading, which leads to the overview, and the page's own
    // package, open.
    const nav = page.locator("#apidocs-nav");
    expect(await nav.locator(".nav-module a:visible").first().getAttribute("href")).toBe("../../../index.html");
    expect(await nav.locator("a.nav-package:visible").count()).toBe(1);
    expect(await nav.locator(".nav-branch[data-path] a.nav-type:visible").count()).toBeGreaterThan(3);
    expect(await nav.locator('a[aria-current="page"]:visible').count()).toBe(1);
    expect(requests.every(r => r.startsWith("file://"))).toBe(true);
    await page.context().close();
  });
});

describe("from file:// with JavaScript on", () => {
  test("script-only controls show at first paint, before the deferred bundle runs", async () => {
    const bundle = join(out, "assets/apidocs.js");
    renameSync(bundle, `${bundle}.held`);
    try {
      const { page } = await open("com/example/geo/Shapes.html");
      expect(await page.evaluate(() => document.documentElement.hasAttribute("data-js"))).toBe(true);
      expect(await page.locator("[data-search]").isVisible()).toBe(true);
      expect(await page.locator("[data-theme-switch]").isVisible()).toBe(true);
      expect(await page.locator(".search-fallback").isVisible()).toBe(false);
      await page.context().close();
    } finally {
      renameSync(`${bundle}.held`, bundle);
    }
  });

  test("search finds a member and opens it, with no errors and no network", async () => {
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

  test("copy buttons show", async () => {
    const { page } = await open("com/example/geo/registry/ShapeCatalog.html#scaleStar(com.example.geo.Shape,double)");
    expect(await page.locator("[data-copy]").first().isVisible()).toBe(true);
    await page.context().close();
  });

  test("the navigator's branches fold and unfold, all at once too, and the filter finds packages and nested types", async () => {
    const { page, errors } = await open("com/example/geo/Shapes.html", { viewport: { width: 1440, height: 900 } });
    const nav = page.locator("#apidocs-nav");
    // The whole tree is in place (assets/nav.js), with the page's row current and its package open.
    const types = (samples.java.packages ?? []).reduce((n, pkg) => n + (pkg.types ?? []).length, 0);
    expect(await nav.locator("a.nav-type").count()).toBe(types);
    expect(await nav.locator('a[aria-current="page"]').getAttribute("href")).toBe("../../../com/example/geo/Shapes.html");
    expect(await nav.locator(".nav-branch[data-path] > .nav-branch-row > button.nav-twisty").first().getAttribute("aria-expanded")).toBe("true");
    const visible = () => nav.locator("a.nav-row:visible").count();
    // The current package is open; another package is folded, its types out of view.
    const other = nav.locator(".nav-branch[data-nav-key^='p:']").filter({ hasNot: page.locator("[aria-current]") }).first();
    expect(await other.getAttribute("data-folded")).toBe("");
    const before = await visible();
    await other.locator(":scope > .nav-branch-row > .nav-twisty").click();
    expect(await other.getAttribute("data-folded")).toBeNull();
    expect(await visible()).toBeGreaterThan(before);
    const foldedKeys = () => nav.locator(".nav-branch[data-folded]").evaluateAll(rows => rows.map(row => row.getAttribute("data-nav-key")));
    const saved = await foldedKeys();
    const all = nav.locator("[data-nav-fold-all]");
    await all.click();
    expect(await nav.locator(".nav-branch:not([data-folded])").count()).toBe(0);
    await all.click();
    expect(await foldedKeys()).toEqual([]);
    expect(await all.getAttribute("aria-label")).toBe("Restore previous layout");
    await all.click();
    expect(await foldedKeys()).toEqual(saved);
    await all.click();
    await other.locator(":scope > .nav-branch-row > .nav-twisty").click();
    const edited = await foldedKeys();
    expect(edited).not.toEqual(saved);
    await all.click();
    await all.click();
    await all.click();
    expect(await foldedKeys()).toEqual(edited);
    // The filter matches a package's name and keeps its types; it finds a nested type inside folded branches.
    await page.locator("#apidocs-nav-filter").fill("Option");
    expect(await nav.locator("a.nav-row:visible").allTextContents()).toContainEqual(expect.stringContaining("Option"));
    await page.locator("#apidocs-nav-filter").press("Escape");
    expect(await nav.locator("[data-filter-open]").count()).toBe(0);
    expect(errors).toEqual([]);
    await page.context().close();
  });

  test("the navigator toggle hides it on a wide screen, remembers that, and [ toggles it", async () => {
    const { page } = await open("com/example/geo/Shapes.html", { viewport: { width: 1440, height: 900 } });
    const nav = page.locator("#apidocs-nav");
    expect(await nav.isVisible()).toBe(true);
    await page.locator(".nav-button").click();
    expect(await nav.isVisible()).toBe(false);
    await page.reload();
    expect(await nav.isVisible()).toBe(false);
    await page.locator("main").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("[");
    expect(await nav.isVisible()).toBe(true);
    await page.reload();
    expect(await nav.isVisible()).toBe(true);
    await page.context().close();
  });

  test("the navigator's tree is one tab stop, moved through with the arrow keys", async () => {
    const { page, errors } = await open("com/example/geo/Shapes.html", { viewport: { width: 1440, height: 900 } });
    const focused = () => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
    // One row takes Tab: the current page's.
    expect(await page.locator("#apidocs-nav .nav-row[tabindex='0']").count()).toBe(1);
    await page.locator("#apidocs-nav .nav-row[aria-current='page']").focus();
    expect(await focused()).toContain("Shapes");
    await page.keyboard.press("ArrowDown");
    const below = await focused();
    expect(below).not.toContain("Shapes");
    await page.keyboard.press("ArrowUp");
    expect(await focused()).toContain("Shapes");
    expect(await page.locator("#apidocs-nav .nav-row[tabindex='0']").count()).toBe(1);
    // Left folds the open branch; Left again goes to the package.
    await page.keyboard.press("ArrowLeft");
    expect(await page.locator("#apidocs-nav .nav-row[aria-current='page']").locator("xpath=ancestor::li[contains(@class,'nav-branch')][1]").getAttribute("data-folded")).toBe("");
    await page.keyboard.press("ArrowLeft");
    expect(await focused()).toMatch(/^\.geo/);
    // Tab leaves the tree for the content.
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("#apidocs-nav"))).toBe(false);
    expect(errors).toEqual([]);
    await page.context().close();
  });

  test("? lists the shortcuts, whose switch turns single keys off; j moves to a member", async () => {
    const { page, errors } = await open("com/example/geo/Shapes.html", { viewport: { width: 1440, height: 900 } });
    await page.locator("main").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("j");
    expect(await page.evaluate(() => document.activeElement?.classList.contains("member-row"))).toBe(true);
    await page.keyboard.press("?");
    const dialog = page.locator("dialog.keys");
    expect(await dialog.isVisible()).toBe(true);
    await dialog.getByLabel("Single-key shortcuts").uncheck();
    await page.keyboard.press("Escape");
    expect(await dialog.isVisible()).toBe(false);
    await page.keyboard.press("[");
    expect(await page.locator("#apidocs-nav").isVisible()).toBe(true);
    await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
    expect(await dialog.isVisible()).toBe(true);
    expect(errors).toEqual([]);
    await page.context().close();
  });

  test("find in page opens a folded description: scrolling its body to a match opens it", async () => {
    const { page } = await open("com/example/geo/Shapes.html", { viewport: { width: 1440, height: 900 } });
    const fold = page.locator("[data-fold]:not([data-short])").first();
    expect(await fold.getAttribute("data-open")).toBeNull();
    await fold.locator(".fold-body").evaluate(body => { body.scrollTop = 30; });
    await page.waitForSelector("[data-fold][data-open]");
    expect(await fold.locator(".fold-body").evaluate(body => body.scrollTop)).toBe(0);
    await page.context().close();
  });

  test("a link to a declaration shows its card on hover and on keyboard focus, and Escape closes it", async () => {
    const { page, errors } = await open("com/example/geo/Shapes.html", { viewport: { width: 1440, height: 900 } });
    const card = page.locator("#apidocs-card");
    const link = page.locator("main .prose a[href='Shape.html']").first();
    await link.hover();
    await page.waitForFunction(() => document.getElementById("apidocs-card")?.matches(":popover-open"));
    expect(await card.textContent()).toContain("Shape");
    expect(await link.getAttribute("aria-describedby")).toBe("apidocs-card");
    await page.keyboard.press("Escape");
    expect(await card.evaluate(c => c.matches(":popover-open"))).toBe(false);
    expect(await link.getAttribute("aria-describedby")).toBeNull();
    // Keyboard focus shows it too.
    await page.mouse.move(1, 1);
    await link.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => document.getElementById("apidocs-card")?.matches(":popover-open"));
    expect(errors).toEqual([]);
    await page.context().close();
  });

  test("a name's overloads sit together, the later ones marked as overloads", async () => {
    const { page } = await open("com/example/geo/Shapes.html", { viewport: { width: 1440, height: 900 } });
    const names = await page.locator("#method-details > .member").evaluateAll(rows => rows.map(r => ({ name: r.querySelector(".member-key")?.textContent, overload: r.classList.contains("is-overload") })));
    const area = names.findIndex(n => n.name === "area");
    expect(names[area + 1]).toEqual({ name: "area", overload: true });
    expect(names[area]!.overload).toBe(false);
    await page.context().close();
  });

  test("the members switch shows inherited members, keeps the choice and puts it in the URL", async () => {
    const { page, errors } = await open("com/example/geo/Circle.html", { viewport: { width: 1440, height: 900 }, http: true });
    const inherited = page.locator(".member-inherited");
    expect(await inherited.count()).toBe(2);
    expect(await inherited.first().isVisible()).toBe(false);
    await page.locator(".members-filter label", { hasText: "inherited" }).click();
    expect(await inherited.first().isVisible()).toBe(true);
    expect(await inherited.first().textContent()).toContain("from Shape");
    expect(new URL(page.url()).searchParams.get("members")).toBe("all");
    // The choice is kept for the next page, and a URL that says otherwise wins.
    await page.goto(page.url().split("?")[0]!);
    expect(await inherited.first().isVisible()).toBe(true);
    await page.goto(`${page.url().split("?")[0]!}?members=declared`);
    expect(await inherited.first().isVisible()).toBe(false);
    expect(errors).toEqual([]);
    await page.context().close();
  });

  test("the navigator stays under the top bar to the page's end", async () => {
    const { page } = await open("com/example/geo/Shapes.html", { viewport: { width: 1440, height: 600 } });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const top = await page.locator("#apidocs-nav").evaluate(nav => nav.getBoundingClientRect().top);
    const bar = await page.locator(".topbar").evaluate(bar => bar.getBoundingClientRect().height);
    expect(Math.round(top)).toBe(Math.round(bar));
    await page.context().close();
  });

  test("the navigator toggle shows it on a narrow screen", async () => {
    const { page } = await open("com/example/geo/Shapes.html", { viewport: { width: 390, height: 844 } });
    const nav = page.locator("#apidocs-nav");
    expect(await nav.isVisible()).toBe(false);
    await page.locator(".nav-button").click();
    expect(await nav.isVisible()).toBe(true);
    await page.context().close();
  });

  test("copy as Markdown copies the page's text, without the frontmatter its twin opens with", async () => {
    const { page } = await open("com/example/geo/Shapes.html", { http: true });
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.locator("button.formats-main").click();
    await page.waitForSelector("button.formats-main[data-copied]");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.startsWith("# ")).toBe(true);
    expect(copied).toContain("Operations on");
    expect(readFileSync(join(out, "com/example/geo/Shapes.md"), "utf8").startsWith('---\ntitle: "Shapes"')).toBe(true);
    await page.context().close();
  });

  test("a member row shows its summary sentence, drawn from the entry's text", async () => {
    const { page } = await open("com/example/geo/Shapes.html");
    const row = page.locator("details.member", { has: page.locator("#parse\\(java\\.lang\\.String\\)") }).locator(".member-brief");
    const brief = await row.getAttribute("data-brief");
    expect(brief?.length).toBeGreaterThan(10);
    expect(await row.evaluate(e => getComputedStyle(e, "::before").content)).toBe(JSON.stringify(brief));
    expect(await page.getByRole("group").filter({ has: page.locator("#parse\\(java\\.lang\\.String\\)") }).locator("summary").evaluate(e => e.textContent)).not.toContain(brief!);
    await page.context().close();
  });

  test("font preloads appear over HTTP and not on file://", async () => {
    const preloads = (page: Page) => page.locator('head link[rel="preload"][as="font"]').count();
    const local = await open("com/example/geo/Shapes.html");
    expect(await preloads(local.page)).toBe(0);
    expect(local.errors).toEqual([]);
    await local.page.context().close();
    const served = await open("com/example/geo/Shapes.html", { http: true });
    expect(await preloads(served.page)).toBe(1);
    expect(served.errors).toEqual([]);
    await served.page.context().close();
  });
});

describe("layout stability", () => {
  async function shift(blockFonts: boolean): Promise<number> {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    if (blockFonts) await page.route("**/*.woff2", route => route.abort());
    await page.addInitScript(() => {
      (window as unknown as { cls: number }).cls = 0;
      new PerformanceObserver(list => {
        for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
          if (!entry.hadRecentInput) (window as unknown as { cls: number }).cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(httpUrl("com/example/geo/Shapes.html"), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    const cls = await page.evaluate(() => (window as unknown as { cls: number }).cls);
    await context.close();
    return cls;
  }
  test("a type page does not shift as it loads, with fonts", async () => expect(await shift(false)).toBe(0));
  test("a type page does not shift as it loads, with font requests blocked", async () => expect(await shift(true)).toBe(0));
});

describe("accessibility", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const path of ["index.html", "com/example/geo/index.html", "com/example/geo/Shapes.html", "com/example/geo/Shapes.html#parse(java.lang.String)", "com/example/geo/Circle.html", "guides/concepts.html", "guides/getting-started.html", "packages.html", "types.html", "index-all.html", "deprecated.html", "404.html"]) {
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
