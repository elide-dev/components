import assert from 'node:assert/strict';
import { build, preview } from 'vite';
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { cpus } from 'node:os';
import { afterPaint, workload, diagnostics } from './browser.mjs';

const baseline = process.argv[2];
if (!baseline) throw new Error('Usage: node perf/logo-paired.mjs BASELINE_COMMIT');
const source = resolve('../../packages/elements/src/logo.ts');
const temporary = resolve(`../../packages/elements/src/.perf-${randomUUID()}.ts`);
const old = execFileSync('git', ['show', `${baseline}:packages/elements/src/logo.ts`]);
const current = await readFile(source);
await writeFile(temporary, old, { flag: 'wx' });
try {
  for (const revision of ['before', 'after']) {
    await build({ configFile: false, resolve: { alias: { '@elide/elements/logo': revision === 'before' ? temporary : source } },
      build: { target: 'es2022', outDir: `dist/logo-paired/${revision}`, emptyOutDir: true,
        rollupOptions: { input: 'src/perf/lit.ts', output: { entryFileNames: 'entry.js' } } },
    });
    await writeFile(`dist/logo-paired/${revision}/index.html`, await readFile('dist/perf/lit/index.html'));
  }
} finally { await unlink(temporary); }
const directory = `.profiles/logo-paired-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const metrics = async session => Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(v => [v.name, v.value]));
const memory = async session => {
  await session.send('HeapProfiler.collectGarbage');
  return { heap: (await metrics(session)).JSHeapUsedSize, ...await session.send('Memory.getDOMCounters') };
};
const report = { metadata: { baseline, browser: browser.version(), cpu: cpus()[0]?.model, throttle: 4,
  samples: 7, count: 100, steps: 20, cycles: 100, viewport: { width: 900, height: 900 },
  sourceHashes: [old, current].map(bytes => createHash('sha256').update(bytes).digest('hex')) }, trials: [] };
try {
  for (let sample = 0; sample < 7; sample++) for (const revision of sample % 2 ? ['after', 'before'] : ['before', 'after']) {
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
      await page.goto(`${base}/logo-paired/${revision}/index.html?count=100`);
      await page.evaluate(() => window.logoReady);
      await page.evaluate(afterPaint);
      const initial = await metrics(session);
      const trial = { sample, revision, startupMs: initial.TaskDuration * 1000, mounted: await memory(session), scenarios: {} };
      if (sample === 0) await page.screenshot({ path: `${directory}/${revision}.png` });
      for (const scenario of ['one', 'all', 'theme']) {
        await page.evaluate(workload, { scenario, steps: 2, count: 100 });
        const a = await metrics(session);
        await page.evaluate(workload, { scenario, steps: 20, count: 100 });
        const b = await metrics(session);
        trial.scenarios[scenario] = Object.fromEntries(['TaskDuration', 'RecalcStyleDuration', 'LayoutDuration'].map(key => [key, (b[key] - a[key]) * 1000]));
      }
      const diagnostic = await page.evaluate(diagnostics, 100);
      assert.ok(diagnostic.sameNodes);
      assert.equal(diagnostic.one.unrelatedMutations, 0);
      assert.equal(diagnostic.themeMutations, 0);
      await page.evaluate(async () => { await window.logoDriver.clear(); await window.logoDriver.mount(100); await window.logoDriver.clear(); });
      await page.evaluate(afterPaint);
      const empty = await memory(session);
      await page.evaluate(async () => { for (let i = 0; i < 100; i++) { await window.logoDriver.mount(100); await window.logoDriver.clear(); } });
      await page.evaluate(afterPaint);
      trial.retention = { before: empty, after: await memory(session) };
      for (const key of ['nodes', 'documents', 'jsEventListeners']) assert.ok(trial.retention.after[key] <= empty[key], `${revision}: retained ${key}`);
      assert.deepEqual(errors, []);
      report.trials.push(trial);
      await writeFile(`${directory}/results.json`, JSON.stringify(report, null, 2) + '\n');
      console.log(`${sample} ${revision}: startup ${trial.startupMs.toFixed(1)}ms; bulk ${trial.scenarios.all.TaskDuration.toFixed(1)}ms; style ${trial.scenarios.all.RecalcStyleDuration.toFixed(1)}ms`);
    } finally { await context.close(); }
  }
  assert.ok((await readFile(`${directory}/before.png`)).equals(await readFile(`${directory}/after.png`)), 'Pixel output changed');
  console.log(directory);
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
