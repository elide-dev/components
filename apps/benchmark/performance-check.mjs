import assert from "node:assert/strict";
import { chromium, firefox, webkit } from "playwright";
import { preview } from "vite";

const server = await preview({ preview: { host: "127.0.0.1", port: 4177, strictPort: true } });
const engines = { chromium, firefox, webkit };

try {
  for (const name of (process.env.BROWSERS ?? "chromium").split(",")) {
    assert.ok(engines[name], `Unknown browser: ${name}`);
    const browser = await engines[name].launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("http://127.0.0.1:4177/performance.html");
      await page.evaluate(() => document.fonts.ready);
      const toc = page.getByTestId("performance-toc");
      const metrics = () => toc.getByRole("link").evaluateAll(links => links.map(link => {
        const rect = link.getBoundingClientRect();
        return [getComputedStyle(link).fontWeight, rect.width, rect.height];
      }));
      const before = await metrics();
      await page.locator("#performance-section-20").evaluate(el => scrollTo(0, scrollY + el.getBoundingClientRect().top - 95));
      await page.waitForFunction(() => document.querySelector('[data-testid="performance-toc"] [aria-current]')?.getAttribute("href") === "#performance-section-20");
      assert.deepEqual(await metrics(), before, "Changing the active TOC entry must preserve text metrics");

      // Preserve scroll-spy correctness when content above the headings changes
      // height, and when the document reflows at a different viewport width.
      await page.getByTestId("performance-expand").click();
      for (const width of [1100, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.locator("#performance-section-40").evaluate(el => scrollTo(0, scrollY + el.getBoundingClientRect().top - 95));
        await page.waitForFunction(() => document.querySelector('[data-testid="performance-toc"] [aria-current]')?.getAttribute("href") === "#performance-section-40");
      }
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForFunction(() => document.querySelector('[data-testid="performance-toc"] [aria-current]')?.getAttribute("href") === "#performance-section-80");

      const trigger = page.getByTestId("performance-search");
      await trigger.focus(); await page.keyboard.press("Space");
      const dialog = page.getByRole("dialog", { name: "Command palette" });
      const input = dialog.getByRole("textbox");
      await input.waitFor();
      await page.waitForFunction(el => el === document.activeElement, await input.elementHandle());
      const titles = dialog.locator("button span.block.truncate");
      // Layout width excludes the popup's independent entrance scale.
      const widths = () => titles.evaluateAll(nodes => nodes.map(node => node.clientWidth));
      const initialWidths = await widths();
      await page.keyboard.press("ArrowDown");
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      assert.deepEqual(await widths(), initialWidths, "Command highlights must not change available text width");
      await page.keyboard.press("Enter");
      await dialog.waitFor({ state: "hidden" });
      assert.equal(await page.getByTestId("performance-selection").textContent(), "Selected: Inspect projects 02");
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true);

      await page.keyboard.press("Space");
      await input.fill("Configure deployments 03");
      await page.getByRole("button", { name: "Configure deployments 03", exact: true }).waitFor();
      await page.keyboard.press("Enter");
      await dialog.waitFor({ state: "hidden" });
      assert.equal(await page.getByTestId("performance-selection").textContent(), "Selected: Configure deployments 03");
      assert.deepEqual(errors, []);
      console.log(`${name}: stable TOC and command geometry, dynamic document layout, filtering, keyboard selection and focus passed.`);
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.httpServer.close(resolve)); }
