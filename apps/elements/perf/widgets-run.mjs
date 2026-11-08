import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { afterPaint } from './browser.mjs';

const samples = Number(process.argv[2] ?? 7);
assert.ok(Number.isInteger(samples) && samples > 0);
const cases = ['terminal', 'scene'];

const build = JSON.parse(await readFile('dist/widget-perf/build.json', 'utf8'));
const directory = `.profiles/widgets-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const metrics = async session => Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(v => [v.name, v.value]));
const memory = async session => {
  await session.send('HeapProfiler.collectGarbage');
  return { heap: (await metrics(session)).JSHeapUsedSize, ...await session.send('Memory.getDOMCounters') };
};
const report = { metadata: { node: process.version, platform: process.platform, arch: process.arch, build, samples, browser: browser.version(), cpu: cpus()[0]?.model,
  throttle: 4, viewport: { width: 900, height: 900 }, counts: [1], cases }, trials: [] };
try {
  for (let sample = 0; sample < samples; sample++) for (const scenario of report.metadata.cases) for (const count of report.metadata.counts) {
    for (const { kind, revision, directory: variant } of build.variants.map((_, i, all) => all[(sample + i) % all.length])) {
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
        await page.goto(`${base}/widget-perf/${variant}/index.html?case=${scenario}&count=${count}`);
        await page.evaluate(() => window.widgetReady);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(afterPaint);
        const startup = await metrics(session);
        const mounted = await memory(session);
        const start = await metrics(session);
        await page.evaluate(() => window.widgetDriver.run());
        const end = await metrics(session);
        const work = Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'].map(key => [key, (end[key]-start[key])*1000]));
        const afterWork = await memory(session);
        if (sample === 0) {
          await page.screenshot({ path: `${directory}/${scenario}-${count}-${variant}.png` });
          await writeFile(`${directory}/${scenario}-${count}-${variant}.html`, await page.locator('#app').innerHTML());
        }
        await page.evaluate(() => window.widgetDriver.clear());
        await page.evaluate(afterPaint);
        const empty = await memory(session);
        await page.evaluate(async () => { await window.widgetDriver.mount(); window.widgetDriver.clear(); });
        await page.evaluate(afterPaint);
        const teardown = await memory(session);
        for (const key of ['nodes', 'documents', 'jsEventListeners']) assert.ok(teardown[key] <= empty[key], `${scenario}/${variant}: retained ${key}`);
        assert.deepEqual(errors, []);
        report.trials.push({ sample, scenario, count, kind, revision, startupMs: startup.TaskDuration * 1000, work, mounted, afterWork, empty, teardown });
        await writeFile(`${directory}/results.json`, JSON.stringify(report, null, 2) + '\n');
        console.log(`${sample} ${scenario}/${variant}: ${work.TaskDuration.toFixed(1)} ms task, ${(mounted.heap / 1024).toFixed(0)} KiB`);
      } finally { await context.close(); }
    }
  }
  for (const scenario of report.metadata.cases) for (const count of report.metadata.counts) for (const kind of ['react', 'preact']) {
    for (const extension of ['html', 'png']) {
      const [a, b] = await Promise.all(['before', 'after'].map(revision => readFile(`${directory}/${scenario}-${count}-${kind}-${revision}.${extension}`)));
      assert.ok(a.equals(b), `${scenario}/${count}/${kind}: ${extension} parity changed`);
    }
  }
  console.log(directory);
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
