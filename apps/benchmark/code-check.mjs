import assert from "node:assert/strict";
import { chromium, firefox, webkit } from "playwright";
import { preview } from "vite";

// Code surfaces in a production build: server-rendered content, clean
// hydration, OS-matched chrome without script-driven markup, zero layout
// shift while a recording autoplays, and no work while it is offscreen.
const server = await preview({ preview: { host: "127.0.0.1", port: 4180, strictPort: true } });
const url = "http://127.0.0.1:4180/code.html";

try {
  for (const engine of (process.env.BROWSERS ?? "chromium").split(",")) {
    const browser = await { chromium, firefox, webkit }[engine].launch({ headless: true });
    try {
      // Without JavaScript: the transcript, the recording's poster frame and the
      // session are all real text in the HTML (readable by agents and crawlers).
      const noJs = await browser.newPage({ javaScriptEnabled: false });
      await noJs.goto(url);
      const recording = noJs.getByTestId("code-recording");
      assert.match(await recording.locator("pre.sr-only").textContent(), /elide run app\.ts\n✓ Hello from Elide!/);
      assert.equal(await noJs.locator("code.language-ts").count(), 1);
      assert.match(await noJs.getByTestId("code-session").locator("pre").textContent(), /elide test --update-snapshots/);
      await noJs.close();

      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (["error", "warning"].includes(message.type())) errors.push(message.text()); });
      await page.addInitScript(() => {
        window.__cls = 0;
        new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value; })
          .observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);

      // Shiki loads lazily and upgrades the plain server-rendered source in place.
      await page.locator("code.language-ts .tk-keyword").first().waitFor();
      assert.equal(await page.evaluate(() => window.__cls), 0, "Highlighting must not shift layout");

      // The inline platform script picked a chrome variant; CSS alone shows it.
      const os = await page.evaluate(() => document.documentElement.dataset.os);
      assert.ok(["mac", "windows", "linux"].includes(os), `data-os is set: ${os}`);
      const shown = await page.locator('[data-chrome="auto"]').first().evaluate(root =>
        ["mac", "windows", "linux"].filter(kind => getComputedStyle(root.querySelector(`.eld-chrome-${kind}`)).display !== "none"));
      assert.deepEqual(shown, [os]);

      // Autoplay (in view) types the session out with no layout shift at all.
      const recordingRoot = page.getByTestId("code-recording");
      await recordingRoot.getByRole("button", { name: "Pause", exact: true }).waitFor();
      await recordingRoot.getByRole("button", { name: "Play", exact: true }).waitFor({ timeout: 15_000 });
      assert.match(await recordingRoot.locator('pre[aria-hidden="true"]').textContent(), /Hello from Elide!/);
      assert.equal(await page.evaluate(() => window.__cls), 0, "Recording playback must not shift layout");

      // Copying a session yields commands and output, never prompts or gutter glyphs.
      const selected = await page.getByTestId("code-session").locator("pre").evaluate(pre => {
        const range = document.createRange(); range.selectNodeContents(pre);
        const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
        const text = selection.toString(); selection.removeAllRanges(); return text;
      });
      assert.ok(!/❯|~\/app|●/.test(selected), `Selection excludes prompt and status: ${selected}`);
      assert.match(selected, /elide install --frozen-lockfile 2>&1 \| tee install\.log/);

      // Offscreen recordings stop spending frames; returning resumes.
      await page.setViewportSize({ width: 1280, height: 500 });
      await recordingRoot.getByRole("button", { name: "Restart", exact: true }).click();
      await recordingRoot.getByRole("button", { name: "Pause", exact: true }).waitFor();
      await page.evaluate(() => document.body.style.setProperty("padding-block-end", "300vh"));
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      const slider = recordingRoot.getByRole("slider");
      await recordingRoot.getByRole("button", { name: "Play", exact: true }).waitFor();
      const parked = await slider.inputValue();
      await page.waitForTimeout(400);
      assert.equal(await slider.inputValue(), parked, "Playback is paused while offscreen");
      await recordingRoot.scrollIntoViewIfNeeded();
      await recordingRoot.getByRole("button", { name: "Pause", exact: true }).waitFor();
      assert.deepEqual(errors, [], "No console errors or warnings (including hydration)");
    } finally { await browser.close(); }
  }
  console.log("Code samples: SSR text, OS chrome via CSS, zero-CLS playback, prompt-free copy, clean hydration passed.");
} finally { await new Promise(resolve => server.httpServer.close(resolve)); }
