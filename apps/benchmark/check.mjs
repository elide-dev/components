import assert from "node:assert/strict";
import { chromium } from "playwright";
import { preview } from "vite";
import { fileURLToPath } from "node:url";
const server = process.env.BENCHMARK_URL ? undefined : await preview({
  root: fileURLToPath(new URL(".", import.meta.url)), preview: { host: "127.0.0.1", port: 4175, strictPort: true },
});
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const page = await browser.newPage({ reducedMotion, viewport: { width: 390, height: 844 } });
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(process.env.BENCHMARK_URL ?? "http://127.0.0.1:4175");
    await page.getByRole("switch").waitFor();
    assert.equal(await page.locator('[data-slot="tabs"]').evaluate(el => getComputedStyle(el).flexDirection), "column");
    for (const dark of [false, true]) {
      if (dark) await page.getByRole("switch").click();
      const trigger = page.getByRole("button", { name: "Explore the details" });
      assert.equal(await trigger.evaluate(el => getComputedStyle(el).userSelect), "none");
      if (reducedMotion === "reduce") assert.equal(await trigger.evaluate(el => getComputedStyle(el).transitionProperty), "none");
      await trigger.click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
      await page.getByRole("tab", { name: "Overview" }).focus();
      await page.keyboard.press("ArrowRight");
      await page.getByRole("tab", { name: "Installation" }).waitFor();
      await page.keyboard.press("Space");
      const code = page.locator("code");
      await code.waitFor();
      assert.equal(await code.evaluate(el => getComputedStyle(el).userSelect), "text");
      await page.getByRole("tab", { name: "Overview" }).click();
      const accordion = page.getByRole("button", { name: "Can I use the keyboard?" });
      await accordion.click();
      assert.equal(await accordion.getAttribute("aria-expanded"), "true");
      if (reducedMotion === "reduce") assert.equal(await page.locator('[data-slot="accordion-content"]').first().evaluate(el => getComputedStyle(el).animationName), "none");
      await accordion.click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: `/tmp/elide-components-${reducedMotion}.png`, fullPage: true });
    await page.emulateMedia({ forcedColors: "active" });
    assert.notEqual(await page.getByRole("button", { name: "Explore the details" }).evaluate(el => getComputedStyle(el).borderStyle), "none");
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log("Production consumer: themes, selection, keyboard tabs, dialog focus return, accordion, reduced motion, forced colors, and mobile overflow passed.");
} finally { await browser.close(); await new Promise(resolve => server ? server.httpServer.close(resolve) : resolve()); }
