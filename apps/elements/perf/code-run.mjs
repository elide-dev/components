import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { cpus } from 'node:os';
import { afterPaint } from './browser.mjs';

const build = JSON.parse(await readFile('dist/code-perf/build.json', 'utf8'));
const samples = Number(process.argv[2] ?? 7);
assert.ok(Number.isInteger(samples) && samples > 0);
const directory = `.profiles/code-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const metrics = async session => Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(v => [v.name, v.value]));
const memory = async session => {
  await session.send('HeapProfiler.collectGarbage');
  return { heap: (await metrics(session)).JSHeapUsedSize, ...await session.send('Memory.getDOMCounters') };
};
const report = { metadata: { browser: browser.version(), cpu: cpus()[0]?.model, throttle: 4, samples,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  build, viewport: { width: 900, height: 900 }, counts: [100, 1000], tokensPerRow: 12 }, trials: [] };
try {
  for (let sample = 0; sample < samples; sample++) for (const count of [100, 1000]) {
    for (const { kind, revision, directory: variant } of build.variants.map((_, i, all) => all[(i + sample) % all.length])) {
      const context = await browser.newContext({ viewport: report.metadata.viewport, deviceScaleFactor: 1 });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        const session = await context.newCDPSession(page);
        await session.send('Network.enable');
        await session.send('Network.setCacheDisabled', { cacheDisabled: true });
        await session.send('Performance.enable');
        await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await page.goto(`${base}/code-perf/${variant}/index.html?count=${count}`);
        await page.evaluate(() => window.codeReady);
        await page.evaluate(afterPaint);
        const startup = await metrics(session);
        const mounted = await memory(session);
        assert.equal(await page.locator('.eld-line').count(), count);
        const text = await page.locator('code').textContent();
        assert.equal(text, Array.from({ length: count }, (_, i) => `const result = await client.fetch("/projects/${i}"); // response\n`).join(''));
        if (sample === 0) {
          await page.screenshot({ path: `${directory}/${variant}-${count}.png` });
          await writeFile(`${directory}/${variant}-${count}.html`, await page.locator('#app').innerHTML());
        }
        await page.evaluate(() => window.codeDriver.clear());
        await page.evaluate(afterPaint);
        const empty = await memory(session);
        await page.evaluate(async () => { for (let i = 0; i < 10; i++) { await window.codeDriver.mount(); window.codeDriver.clear(); } });
        await page.evaluate(afterPaint);
        const teardown = await memory(session);
        for (const key of ['nodes', 'documents', 'jsEventListeners']) assert.ok(teardown[key] <= empty[key], `${kind}: retained ${key}`);
        assert.deepEqual(errors, []);
        const trial = { sample, count, kind, revision, startupMs: startup.TaskDuration * 1000, mounted, empty, teardown };
        report.trials.push(trial);
        await writeFile(`${directory}/results.json`, JSON.stringify(report, null, 2) + '\n');
        console.log(`${variant} ${count}: ${trial.startupMs.toFixed(1)}ms, ${(mounted.heap / 1024).toFixed(0)} KiB, ${mounted.nodes} nodes`);
      } finally { await context.close(); }
    }
  }
  console.log(directory);
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
