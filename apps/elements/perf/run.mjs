import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { cpus, platform, arch, release } from 'node:os';
import { gzipSync } from 'node:zlib';
import { installStaticDriver, afterPaint, workload, diagnostics } from './browser.mjs';
import { observeRendering } from './observe.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
for (const key of Object.keys(args)) assert.ok(['samples', 'counts', 'steps', 'cycles', 'cpu', 'trace', 'static-ui', 'rendering'].includes(key), `Unknown option ${key}`);
const options = {
  samples: Number(args.samples ?? 5), counts: (args.counts ?? '1,100,1000').split(',').map(Number),
  steps: Number(args.steps ?? 20), cycles: Number(args.cycles ?? 100), cpu: Number(args.cpu ?? 4),
  trace: Object.hasOwn(args, 'trace'), viewport: { width: 900, height: 900 },
  staticUI: Object.hasOwn(args, 'static-ui'),
  rendering: Object.hasOwn(args, 'rendering'),
  idleMs: 2000,
};
for (const key of ['samples', 'steps', 'cycles']) assert.ok(Number.isInteger(options[key]) && options[key] > 0, `${key} must be a positive integer`);
assert.ok(options.steps % 2 === 0, 'steps must be even so each workload returns to its initial state');
assert.ok(options.counts.length && options.counts.every(count => [1, 100, 1000].includes(count)), 'counts must select from 1,100,1000');
assert.ok(Number.isFinite(options.cpu) && options.cpu >= 1, 'cpu must be >= 1');
assert.ok(!options.rendering || options.staticUI, '--rendering requires --static-ui');
const kinds = ['static', 'react', 'preact', 'lit', 'adapter'];
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const directory = `.profiles/${stamp}`;
await mkdir(directory, { recursive: true });
const bundles = JSON.parse(await readFile('dist/perf/bundles.json', 'utf8'));
const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch();
const report = {
  metadata: {
    date: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
    browser: browser.version(), os: `${platform()} ${release()} ${arch()}`, cpuModel: cpus()[0]?.model,
    node: process.version, zlib: process.versions.zlib,
    options, kinds, cache: 'New context and disabled HTTP cache per trial; browser process and OS caches may be warm',
    network: 'Local HTTP without network throttling; compressed sizes are calculated separately per resource',
    notes: 'Logo microbenchmark, not INP or a playback result. Static update driver is test-injected. CDP heap sampling is a separate instrumented pass. CPU slowdown does not model mobile GPU/memory.',
  }, bundles, trials: [],
};

const metrics = async session => Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value]));
const durationNames = ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration'];
function delta(before, after) {
  const output = {};
  for (const name of durationNames) {
    assert.ok(Number.isFinite(before[name]) && Number.isFinite(after[name]), `Missing metric ${name}`);
    output[`${name}Ms`] = (after[name] - before[name]) * 1000;
  }
  for (const name of ['LayoutCount', 'RecalcStyleCount']) output[name] = after[name] - before[name];
  return output;
}
async function memory(session) {
  await session.send('HeapProfiler.collectGarbage');
  const values = await metrics(session);
  return { usedHeapBytes: values.JSHeapUsedSize, allocatedHeapBytes: values.JSHeapTotalSize, ...await session.send('Memory.getDOMCounters') };
}
async function endTrace(session, file) {
  const complete = new Promise(resolve => session.once('Tracing.tracingComplete', resolve));
  await session.send('Tracing.end');
  const { stream } = await complete;
  const chunks = [];
  for (;;) {
    const chunk = await session.send('IO.read', { handle: stream });
    chunks.push(Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8'));
    if (chunk.eof) break;
  }
  await session.send('IO.close', { handle: stream });
  await writeFile(file, gzipSync(Buffer.concat(chunks)));
}
function sampledBytes(node) {
  return node.selfSize + node.children.reduce((sum, child) => sum + sampledBytes(child), 0);
}

try {
  for (let sample = 0; sample < options.samples; sample++) {
    for (const count of options.counts) {
      // Rotate implementation order to reduce consistent thermal/order bias.
      const order = kinds.map((_, index) => kinds[(index + sample) % kinds.length]);
      for (const kind of order) {
        const context = await browser.newContext({ viewport: options.viewport, deviceScaleFactor: 1 });
        try {
          const page = await context.newPage();
          if (options.rendering) await page.addInitScript(observeRendering);
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          const session = await context.newCDPSession(page);
          await session.send('Network.enable');
          await session.send('Network.setCacheDisabled', { cacheDisabled: true });
          await session.send('Emulation.setCPUThrottlingRate', { rate: options.cpu });
          await session.send('Performance.enable');
          await page.goto(`${base}/perf/${kind}/${kind === 'static' ? `index-${count}.html` : `index.html?count=${count}`}`);
          if (kind !== 'static') await page.evaluate(() => window.logoReady);
          await page.evaluate(afterPaint);
          const startupMetrics = await metrics(session);
          const startup = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            const resources = [nav, ...performance.getEntriesByType('resource')];
            return {
              readyMs: performance.getEntriesByName('eld:ready')[0]?.startTime ?? nav.domContentLoadedEventEnd,
              fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
              encodedBodyBytes: resources.reduce((sum, resource) => sum + resource.encodedBodySize, 0),
              resources: resources.length,
            };
          });
          for (const name of durationNames) startup[`${name}Ms`] = startupMetrics[name] * 1000;
          if (kind === 'static' && !options.staticUI) await page.evaluate(installStaticDriver);
          const mountedMemory = await memory(session);
          if (options.staticUI) {
            // Native wheel input, with no component state updates. This measures
            // main-thread cost, not compositor FPS or field responsiveness.
            const range = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight));
            let scroll = null;
            const scrollStart = await page.evaluate(() => performance.now());
            if (range > 0) {
              await page.mouse.move(450, 450);
              if (options.trace) await session.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing', transferMode: 'ReturnAsStream' });
              await page.evaluate(() => performance.mark('eld:scroll:start'));
              const before = await metrics(session);
              for (let step = 0; step < options.steps; step++) {
                await page.mouse.wheel(0, Math.ceil(range / options.steps));
                await page.evaluate(afterPaint);
              }
              scroll = { ...delta(before, await metrics(session)), range, endY: await page.evaluate(() => scrollY) };
              assert.ok(scroll.endY > 0, 'Wheel workload did not scroll');
              await page.evaluate(() => performance.mark('eld:scroll:end'));
              if (options.trace) await endTrace(session, `${directory}/${kind}-${count}-${sample}-scroll.json.gz`);
            }
            const beforeIdle = await metrics(session);
            const idleStart = await page.evaluate(() => performance.now());
            await page.waitForTimeout(options.idleMs);
            const idle = delta(beforeIdle, await metrics(session));
            const rendering = options.rendering ? await page.evaluate(({ scrollStart, idleStart }) => ({
              entries: window.renderingDiagnostics(), scrollStart, idleStart, end: performance.now(),
            }), { scrollStart, idleStart }) : undefined;
            assert.deepEqual(errors, []);
            report.trials.push({ sample, kind, count, startup, mountedMemory, scroll, idle, rendering });
            await writeFile(`${directory}/results.json`, JSON.stringify(report, null, 2) + '\n');
            console.log(`${sample + 1}/${options.samples} ${kind.padEnd(7)} n=${count}: startup ${startup.TaskDurationMs.toFixed(1)}ms; FCP ${startup.fcpMs}ms; scroll ${scroll ? scroll.TaskDurationMs.toFixed(1) + 'ms' : 'N/A'}; heap ${(mountedMemory.usedHeapBytes / 1024).toFixed(0)} KiB`);
            continue;
          }
          // Warm each scenario before collecting a timed sample. No GC/profiler
          // or mutation observers run inside the timed workload.
          const scenarios = {};
          for (const scenario of ['one', 'all', 'theme']) {
            await page.evaluate(workload, { scenario, steps: 2, count });
            if (options.trace) await session.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing', transferMode: 'ReturnAsStream' });
            const before = await metrics(session);
            const wallMs = await page.evaluate(workload, { scenario, steps: options.steps, count });
            const after = await metrics(session);
            scenarios[scenario] = { ...delta(before, after), wallMs };
            if (options.trace) await endTrace(session, `${directory}/${kind}-${count}-${sample}-${scenario}.json.gz`);
          }
          const idleBefore = await metrics(session);
          await page.waitForTimeout(options.idleMs);
          scenarios.idle = delta(idleBefore, await metrics(session));
          const diagnostic = await page.evaluate(diagnostics, count);
          assert.equal(diagnostic.one.unrelatedMutations, 0, `${kind}: nonlocal update`);
          assert.equal(diagnostic.sameNodes, true, `${kind}: replaced artwork`);
          assert.equal(diagnostic.themeMutations, 0, `${kind}: JS theme mutation`);
          const trial = { sample, kind, count, startup, mountedMemory, scenarios, diagnostic };

          // Fixed 100-instance workload for retention and sampling; not repeated
          // at every density. Reports are explicit when count=100 was omitted.
          if (count === 100) {
            const allocation = {};
            for (const scenario of ['one', 'all']) {
              await session.send('HeapProfiler.startSampling', {
                samplingInterval: 32768, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true,
              });
              await page.evaluate(workload, { scenario, steps: options.steps, count });
              const { profile } = await session.send('HeapProfiler.stopSampling');
              allocation[scenario] = { sampledAllocatedBytes: sampledBytes(profile.head), samplingInterval: 32768 };
            }
            trial.allocations = allocation;
            // Warm mount/unmount once so library initialization isn't called a leak.
            await page.evaluate(async () => { await window.logoDriver.clear(); await window.logoDriver.mount(100); await window.logoDriver.clear(); });
            await page.evaluate(afterPaint);
            const before = await memory(session);
            await page.evaluate(async cycles => {
              for (let cycle = 0; cycle < cycles; cycle++) {
                await window.logoDriver.mount(100);
                await window.logoDriver.clear();
              }
            }, options.cycles);
            await page.evaluate(afterPaint);
            trial.teardown = { before, after: await memory(session) };
            assert.equal(await page.locator('[data-item]').count(), 0);
          }
          assert.deepEqual(errors, []);
          report.trials.push(trial);
          await writeFile(`${directory}/results.json`, JSON.stringify(report, null, 2) + '\n');
          console.log(`${sample + 1}/${options.samples} ${kind.padEnd(7)} n=${count}: startup task ${startup.TaskDurationMs.toFixed(1)}ms; one/all ${scenarios.one.TaskDurationMs.toFixed(1)}/${scenarios.all.TaskDurationMs.toFixed(1)}ms; heap ${(mountedMemory.usedHeapBytes / 1024).toFixed(0)} KiB`);
        } finally { await context.close(); }
      }
    }
  }
  console.log(`Saved ${directory}/results.json`);
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
