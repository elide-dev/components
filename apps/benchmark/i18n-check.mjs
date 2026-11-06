import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium, firefox, webkit } from "playwright";
import { preview } from "vite";
const locales = ["en", "es", "de", "fr", "ru", "uk", "ar", "zh-Hans", "zh-Hant", "ja", "ko", "he"];
const catalogs = Object.fromEntries(await Promise.all(locales.map(async locale => [locale,
  JSON.parse(await readFile(new URL(`../../packages/ui/src/i18n/locales/${locale}.json`, import.meta.url), "utf8")),
])));
const server = await preview({ preview: { host: "127.0.0.1", port: 4179, strictPort: true } });
try {
  for (const engine of (process.env.BROWSERS ?? "chromium").split(",")) {
    const browser = await { chromium, firefox, webkit }[engine].launch({ headless: true });
    try {
      const noJs = await browser.newPage({ javaScriptEnabled: false });
      await noJs.goto("http://127.0.0.1:4179/i18n.html");
      assert.equal(await noJs.getByTestId("locale-root").getAttribute("dir"), "rtl");
      assert.ok(await noJs.getByRole("navigation", { name: catalogs.he.breadcrumbs.navLabel }).isVisible());
      await noJs.close();
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      await page.goto("http://127.0.0.1:4179/i18n.html");
      const root = page.getByTestId("locale-root");
      for (const locale of locales) {
        const m = catalogs[locale];
        const dir = ["he", "ar"].includes(locale) ? "rtl" : "ltr";
        await page.getByTestId("locale-select").selectOption(locale);
        await page.waitForFunction(language => document.querySelector('[data-testid="locale-root"]').lang === language, locale);
        assert.equal(await root.getAttribute("dir"), dir);
        assert.ok(await root.getByRole("navigation", { name: m.breadcrumbs.navLabel }).isVisible());
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${engine}/${locale}: page overflow`);
        assert.equal(await root.locator("pre").first().evaluate(el => getComputedStyle(el).direction), "ltr");
        assert.ok(await root.locator('[data-slot="code-block-status"]').evaluate(el =>
          el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth), `${locale}: translated code metadata must not clip`);
        const command = root.locator("code").filter({ hasText: "curl elide.sh" });
        const prompt = command.locator("..").locator("span[aria-hidden]");
        assert.ok((await prompt.boundingBox()).x < (await command.boundingBox()).x, "Shell prompt stays before LTR command syntax");
        const toc = root.getByRole("navigation", { name: m.tableOfContents.navLabel });
        const indent = await toc.getByRole("link").last().evaluate(el => getComputedStyle(el).paddingInlineStart);
        assert.equal(indent, "23px");
        await page.getByTestId("dialog-trigger").click();
        const dialog = page.getByRole("dialog"); await dialog.waitFor();
        assert.equal(await dialog.getAttribute("lang"), locale);
        assert.equal(await dialog.getAttribute("dir"), dir);
        await dialog.getByRole("button", { name: m.common.close }).click();
        await dialog.waitFor({ state: "hidden" });
        const tabs = page.getByRole("tab");
        await tabs.first().click(); await tabs.first().focus();
        await page.keyboard.press(dir === "rtl" ? "ArrowLeft" : "ArrowRight");
        await page.waitForFunction(() => document.querySelectorAll('[role="tab"]')[1] === document.activeElement);
        await tabs.first().click();
      }
      for (const locale of ["ar", "he"]) {
        await page.getByTestId("locale-select").selectOption(locale);
        await page.waitForFunction(language => document.querySelector('[data-testid="locale-root"]').lang === language, locale);
        for (const dark of [false, true]) {
          await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), dark);
          const toggle = page.getByTestId("rtl-switch");
          if (await toggle.getAttribute("aria-checked") === "true") await toggle.click();
          const thumb = toggle.locator('[data-slot="switch-thumb"]');
          const off = await thumb.boundingBox(); await toggle.click();
          const on = await thumb.boundingBox();
          assert.ok(on.x < off.x, `${engine}/${locale}: checked switch must move toward inline-end`);
          await page.getByTestId("sheet-trigger").click();
          const sheet = page.locator('[data-slot="sheet-content"]'); await sheet.waitFor();
          assert.equal(await sheet.getAttribute("data-side"), "right");
          await page.keyboard.press("Escape"); await sheet.waitFor({ state: "hidden" });
          await page.getByTestId("menu-trigger").click();
          const sub = page.getByTestId("submenu-trigger"); await sub.focus();
          await page.keyboard.press("ArrowLeft");
          const panel = page.locator('[data-slot="dropdown-menu-sub-content"]'); await panel.waitFor();
          assert.equal(await panel.getAttribute("dir"), "rtl");
          await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
          await page.getByTestId("anchor-trigger").click();
          const anchor = page.locator('[data-slot="anchored-popover-content"]'); await anchor.waitFor();
          assert.equal(await anchor.getAttribute("lang"), locale);
          assert.equal(await anchor.getAttribute("dir"), "rtl");
          await page.keyboard.press("Escape"); await anchor.waitFor({ state: "hidden" });
          await page.getByRole("combobox", { name: catalogs[locale].appNav.language }).last().click();
          const select = page.locator('[data-slot="select-content"]'); await select.waitFor();
          assert.equal(await select.getAttribute("lang"), locale);
          assert.equal(await select.getAttribute("dir"), "rtl");
          await page.keyboard.press("Escape"); await select.waitFor({ state: "hidden" });
        }
      }
      assert.deepEqual(errors, [], `${engine}: hydration or runtime errors`);
      await page.close();
      console.log(`${engine}: 12 locales, SSR/hydration, mobile overflow, RTL portals, tabs, submenus, sheets, switches, and LTR code passed.`);
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.httpServer.close(resolve)); }
