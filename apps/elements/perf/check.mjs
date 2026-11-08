import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { installStaticDriver, afterPaint, diagnostics } from './browser.mjs';
import { readFile } from 'node:fs/promises';

const bundles = JSON.parse(await readFile('dist/perf/bundles.json', 'utf8'));
assert.deepEqual(bundles.variants.static.js, []);
const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch();
try {
  for (const kind of ['static', 'react', 'lit', 'adapter']) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/perf/${kind}/${kind === 'static' ? 'index-100.html' : 'index.html?count=100'}`);
    if (kind === 'static') {
      assert.equal(await page.locator('script').count(), 0);
      await page.evaluate(installStaticDriver);
    } else await page.evaluate(() => window.logoReady);
    await page.evaluate(afterPaint);
    assert.equal(await page.locator('[data-item]').count(), 100);
    const result = await page.evaluate(diagnostics, 100);
    assert.equal(result.sameNodes, true, `${kind}: node identity`);
    assert.equal(result.one.unrelatedMutations, 0, `${kind}: unrelated DOM mutated`);
    assert.ok(Math.abs(result.heights[0] - 32) < 0.02);
    assert.ok(result.heights.slice(1).every(height => Math.abs(height - 24) < 0.02));
    assert.equal(result.themeMutations, 0, `${kind}: theme should need no component DOM writes`);
    assert.ok(result.colors.every(color => color === 'rgb(250, 250, 250)'), `${kind}: theme did not apply`);
    await page.evaluate(async () => {
      // A same-value write must resolve, rather than hang the runner.
      await window.logoDriver.update([0], 24);
      await window.logoDriver.clear();
      await window.logoDriver.mount(1);
      await window.logoDriver.update([0], 32);
    });
    assert.equal(await page.locator('[data-item]').count(), 1);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`${kind}: equivalent geometry/theme, local updates, stable nodes, no-op writes, and remount pass`);
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
