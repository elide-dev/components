import assert from "node:assert/strict";
import { chromium, firefox, webkit } from "playwright";
import { preview } from "vite";
import { fileURLToPath } from "node:url";

const server = process.env.BENCHMARK_URL ? undefined : await preview({
  root: fileURLToPath(new URL(".", import.meta.url)), preview: { host: "127.0.0.1", port: 4176, strictPort: true },
});
const url = `${process.env.BENCHMARK_URL ?? "http://127.0.0.1:4176"}/platform.html`;
const engines = { chromium, firefox, webkit };
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const columns = locator => locator.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
async function colors(page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const probe = document.createElement("span"); document.body.append(probe);
    const result = {};
    for (const name of ["background", "foreground", "card", "popover", "muted-foreground", "primary-emphasis", "primary-soft", "border", "nav-background", "ring"]) {
      probe.style.color = `var(--${name})`;
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = getComputedStyle(probe).color; ctx.fillRect(0, 0, 1, 1);
      result[name] = [...ctx.getImageData(0, 0, 1, 1).data];
    }
    probe.remove(); return result;
  });
}
async function withinViewport(locator, page) {
  const box = await locator.boundingBox(); assert.ok(box);
  const viewport = page.viewportSize();
  assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, JSON.stringify(box));
}

try {
  for (const name of (process.env.BROWSERS ?? "chromium").split(",")) {
    assert.ok(engines[name], `Unknown browser: ${name}`);
    const browser = await engines[name].launch({ headless: true });
    const errors = [];
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(url); await frame(page);
      const capabilities = await page.evaluate(() => ({
        alpha: CSS.supports("color", "alpha(from red / 50%)"),
        border: CSS.supports("background-clip", "border-area"),
        anchor: CSS.supports("anchor-name", "--eld-anchor") && CSS.supports("position-area", "bottom span-all") && CSS.supports("justify-self", "anchor-center") && CSS.supports("position-try-fallbacks", "flip-block"),
        timeline: CSS.supports("animation-timeline", "scroll(root block)"),
      }));
      const theme = page.getByRole("button", { name: "Dark theme" });
      const modernColors = [];
      for (const dark of [false, true]) {
        if (dark) await theme.click();
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), dark ? "dark" : "light");
        modernColors.push(await colors(page));
      }
      await theme.click();
      const primary = page.getByRole("button", { name: "Project details", exact: true });
      const clips = await primary.evaluate(el => [getComputedStyle(el).backgroundClip, getComputedStyle(el, "::before").backgroundClip]);
      assert.deepEqual(clips, [0, 1].map(() => capabilities.border ? "padding-box, border-area" : "padding-box, border-box"));
      assert.notEqual(await primary.evaluate(el => getComputedStyle(el).backgroundImage), "none");
      assert.equal(await columns(page.getByTestId("wide-grid")), 3);
      assert.equal(await columns(page.getByTestId("narrow-grid")), 1);
      assert.equal(await columns(page.getByTestId("narrow-stats")), 1);

      for (const [label, mode] of [["Project details", capabilities.anchor ? "css" : "floating"], ["Floating details", "floating"]]) {
        const trigger = page.getByRole("button", { name: label, exact: true });
        await trigger.focus(); await page.keyboard.press("Space");
        const panel = page.getByRole("dialog", { name: label, exact: true });
        await panel.waitFor(); await frame(page);
        assert.equal(await panel.getAttribute("data-positioning"), mode);
        await withinViewport(panel, page);
        await page.keyboard.press("Escape"); await panel.waitFor({ state: "hidden" });
        assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
      }
      // Nested overlays retain focus and dismissal order across native/floating paths.
      await page.getByRole("button", { name: "Review settings", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Review settings" }); await dialog.waitFor();
      const footer = dialog.locator('[data-slot="dialog-footer"]');
      assert.equal(await footer.evaluate(el => getComputedStyle(el).flexDirection), "row");
      await dialog.evaluate(el => el.style.width = "280px"); await frame(page);
      assert.equal(await footer.evaluate(el => getComputedStyle(el).flexDirection), "column-reverse");
      const nestedTrigger = dialog.getByRole("button", { name: "Nested details" }); await nestedTrigger.click();
      const nested = page.getByRole("dialog", { name: "Nested details" }); await nested.waitFor();
      await page.keyboard.press("Escape"); await nested.waitFor({ state: "hidden" });
      assert.equal(await dialog.isVisible(), true);
      assert.equal(await nestedTrigger.evaluate(el => el === document.activeElement), true);
      await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });

      const progress = page.locator('[data-slot="reading-progress"]');
      if (capabilities.timeline) {
        for (let attempt = 0; attempt < 8; attempt++) {
          await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await frame(page);
        }
        assert.ok(await progress.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).a) > .99);
        assert.equal(await page.getByRole("link", { name: "Rendering long pages", exact: true }).getAttribute("aria-current"), "location");
      } else assert.equal(await progress.evaluate(el => getComputedStyle(el).display), "none");
      await page.evaluate(() => scrollTo(0, 0)); await frame(page);
      if (capabilities.timeline) assert.ok(await progress.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).a) < .01);
      assert.equal(await page.locator('h2[id]').evaluateAll(headings => headings.some(h => h.closest('[data-slot="deferred-content"]'))), false);
      await page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(await progress.evaluate(el => getComputedStyle(el).display), "none");
      await page.getByRole("button", { name: "Search commands" }).click();
      const commands = page.getByRole("dialog", { name: "Command palette" }); await commands.waitFor();
      const motion = await commands.evaluate(el => ({ animation: getComputedStyle(el).animationName, transition: getComputedStyle(el).transitionProperty }));
      assert.deepEqual(motion, { animation: "none", transition: "none" });
      await page.keyboard.press("Escape"); await commands.waitFor({ state: "hidden" });
      await page.emulateMedia({ media: "print" });
      assert.equal(await page.locator('[data-slot="deferred-content"]').first().evaluate(el => getComputedStyle(el).contentVisibility), "visible");
      await page.emulateMedia({ media: "screen", reducedMotion: "no-preference" });
      await page.setViewportSize({ width: 390, height: 844 }); await frame(page);
      assert.equal(await columns(page.getByTestId("wide-grid")), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `/tmp/elide-platform-${name}.png`, fullPage: true });
      if (capabilities.anchor) {
        const triggerStyle = await primary.getAttribute("style");
        await primary.click(); const panel = page.getByRole("dialog", { name: "Project details", exact: true }); await panel.waitFor();
        for (const edge of ["top-left", "top-right", "bottom-right", "bottom-left"]) {
          await primary.evaluate((el, edge) => { Object.assign(el.style, { position: "fixed", top: edge.startsWith("top") ? "8px" : "auto", bottom: edge.startsWith("bottom") ? "8px" : "auto", left: edge.endsWith("left") ? "8px" : "auto", right: edge.endsWith("right") ? "8px" : "auto", zIndex: "60" }); }, edge);
          await frame(page); await withinViewport(panel, page);
        }
        await page.keyboard.press("Escape"); await panel.waitFor({ state: "hidden" });
        await primary.evaluate((el, value) => value === null ? el.removeAttribute("style") : el.setAttribute("style", value), triggerStyle);
      }
      // Long content must scroll inside either positioning path on a phone.
      for (const label of ["Project details", "Floating details"]) {
        await page.getByRole("button", { name: label, exact: true }).click();
        const panel = page.getByRole("dialog", { name: label, exact: true }); await panel.waitFor();
        await panel.evaluate(el => {
          const body = document.createElement("div"); body.style.flexShrink = "0";
          const spacer = document.createElement("div"); spacer.style.height = "1600px";
          const last = document.createElement("button"); last.textContent = "Last panel action";
          body.append(spacer, last); el.append(body);
        });
        await frame(page); await frame(page);
        await withinViewport(panel, page);
        assert.equal(await panel.evaluate(el => getComputedStyle(el).overflowY), "auto");
        await panel.getByRole("button", { name: "Last panel action" }).focus(); await frame(page);
        assert.ok(await panel.evaluate(el => el.scrollTop) > 0);
        await page.keyboard.press("Escape"); await panel.waitFor({ state: "hidden" });
      }
      // Remove enhancement branches to exercise the baseline CSS without changing
      // browser feature detection. Floating positioning is separately forced above.
      await page.evaluate(() => {
        const remove = rules => { for (let i = rules.cssRules.length - 1; i >= 0; i--) {
          const rule = rules.cssRules[i];
          if (rule.constructor.name === "CSSContainerRule" || (rule.constructor.name === "CSSSupportsRule" && /light-dark|alpha\(|border-area|content-visibility|animation-timeline|transition-behavior/.test(rule.conditionText))) rules.deleteRule(i);
          else if (rule.cssRules) remove(rule);
        } };
        for (const sheet of document.styleSheets) remove(sheet);
      });
      assert.equal(await primary.evaluate(el => getComputedStyle(el).backgroundClip), "padding-box, border-box");
      assert.equal(await progress.evaluate(el => getComputedStyle(el).display), "none");
      assert.equal(await page.locator('[data-slot="deferred-content"]').first().evaluate(el => getComputedStyle(el).contentVisibility), "visible");
      assert.equal(await columns(page.getByTestId("wide-grid")), 1);
      assert.equal(await columns(page.getByTestId("narrow-grid")), 1);
      for (const dark of [false, true]) {
        if (dark) await theme.click();
        const fallback = await colors(page);
        for (const token of Object.keys(fallback)) for (let channel = 0; channel < 4; channel++) {
          assert.ok(Math.abs(fallback[token][channel] - modernColors[Number(dark)][token][channel]) <= 1, `${name} ${token} changed with fallback`);
        }
      }
      assert.deepEqual(errors, []);
      console.log(`${name}: colors/fallbacks, containers, native/floating/nested overlays, viewport collision, reduced motion, reading progress, print, and mobile layout passed. ${JSON.stringify(capabilities)}`);
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server ? server.httpServer.close(resolve) : resolve()); }
