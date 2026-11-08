import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';
import { preview } from 'vite';

const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const url = `http://127.0.0.1:${server.httpServer.address().port}/code.html`;
try {
  for (const engine of (process.env.BROWSERS ?? 'chromium').split(',')) {
    const browser = await { chromium, firefox, webkit }[engine].launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      const player = page.getByTestId('code-help');
      await player.scrollIntoViewIfNeeded();
      const measurements = [];
      for (const width of [1100, 760, 640, 480]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const time of [0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8]) {
          await player.getByRole('slider').evaluate((input, value) => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }, time);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const geometry = await player.locator('.eld-terminal-screen').evaluate(screen => {
            const rows = [...screen.querySelectorAll('.eld-content')];
            const probe = document.createElement('span');
            probe.textContent = '0000000000000000';
            rows[0].append(probe);
            const cell = probe.getBoundingClientRect().width / 16;
            probe.remove();
            return rows.map(row => {
              let column = 0;
              const glyphs = [];
              const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
              while (walker.nextNode()) {
                const node = walker.currentNode;
                const glyph = node.parentElement.closest('.eld-glyph');
                if (glyph) {
                  const actual = glyph.getBoundingClientRect().left - parseFloat(getComputedStyle(glyph).marginLeft) - row.getBoundingClientRect().left;
                  glyphs.push({ column, actual, expected: column * cell, error: actual - column * cell });
                }
                column += [...node.textContent].length;
              }
              return { text: row.textContent, cell, glyphs };
            });
          });
          assert.ok(geometry.slice(0, 6).every(row => row.glyphs.length > 0), 'Help logo not rendered');
          measurements.push({ width, time, geometry });
        }
      }
      const worst = measurements.flatMap(m => m.geometry.flatMap(row => row.glyphs.map(g => ({ width: m.width, time: m.time, ...g })))).sort((a, b) => Math.abs(b.error) - Math.abs(a.error))[0];
      console.log(engine, JSON.stringify(worst));
      assert.ok(Math.abs(worst.error) <= 0.125, `${engine}: terminal art must remain within an eighth of a CSS pixel of its cell column`);
      const positions = new Map();
      for (const measurement of measurements) measurement.geometry.forEach((row, index) => {
        for (const glyph of row.glyphs) {
          const key = `${measurement.width}/${index}/${glyph.column}`;
          const previous = positions.get(key);
          if (previous !== undefined) assert.ok(Math.abs(previous - glyph.actual) <= 0.125, `${engine}: cell moved horizontally between playback frames`);
          positions.set(key, glyph.actual);
        }
      });
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.httpServer.close(resolve)); }
