import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkReports, gzipBudgets } from './budgets.mjs';

function fixture() {
  return {
    metadata: { browser: 'test', os: 'test', cpuModel: 'test', network: 'local', node: 'test', zlib: 'test', kinds: Object.keys(gzipBudgets),
      options: { samples: 7, counts: [100], staticUI: true, rendering: false, trace: false, idleMs: 2000, steps: 20, cycles: 100 } },
    bundles: { variants: Object.fromEntries(Object.entries(gzipBudgets).map(([kind, gzip]) => [kind, { js: [{ gzip }] }])) },
    trials: Object.keys(gzipBudgets).flatMap(kind => Array.from({ length: 7 }, (_, sample) => ({ kind, count: 100, sample,
      startup: { TaskDurationMs: 40, fcpMs: 60 }, mountedMemory: { usedHeapBytes: 1_000_000, nodes: 2000 },
      scroll: { TaskDurationMs: 40 }, idle: { TaskDurationMs: 1 } }))),
  };
}
test('accepts equivalent reports and tolerates small absolute noise', () => {
  const before = fixture(), after = fixture();
  after.trials.forEach(t => t.idle.TaskDurationMs = 2);
  assert.equal(checkReports(before, after).pass, true);
});
test('rejects CPU regression and incomplete or mismatched evidence', () => {
  const before = fixture(), after = fixture();
  after.trials.forEach(t => t.startup.TaskDurationMs = 60);
  assert.equal(checkReports(before, after).pass, false);
  after.trials.pop();
  assert.throws(() => checkReports(before, after), /Incomplete/);
  const mismatched = fixture();
  mismatched.metadata.browser = 'different';
  assert.throws(() => checkReports(before, mismatched), /Incompatible/);
});
test('does not certify missing metrics, unsupported rendering APIs or byte regressions', () => {
  const before = fixture(), after = fixture();
  delete after.trials[0].startup.fcpMs;
  assert.throws(() => checkReports(before, after), /missing/);
  const oversized = fixture();
  oversized.bundles.variants.lit.js[0].gzip++;
  assert.throws(() => checkReports(before, oversized), /exceeds/);
  for (const report of [before, after]) report.metadata.options.rendering = true;
  assert.throws(() => checkReports(before, after), /Missing rendering/);
});
test('rendering gate fails long frames and shifts even with a slow baseline', () => {
  const before = fixture(), after = fixture();
  for (const report of [before, after]) {
    report.metadata.options.rendering = true;
    report.trials.forEach(t => t.rendering = { scrollStart: 100, idleStart: 200, end: 2200,
      entries: { longtask: [], 'long-animation-frame': [], 'layout-shift': [] } });
  }
  assert.equal(checkReports(before, after).pass, true);
  for (const report of [before, after]) {
    report.trials[0].rendering.entries['long-animation-frame'].push({ startTime: 150, duration: 60 });
    report.trials[0].rendering.entries['layout-shift'].push({ value: 0.01, hadRecentInput: false });
  }
  assert.equal(checkReports(before, after).pass, false);
  delete after.trials[0].rendering.entries.longtask;
  assert.throws(() => checkReports(before, after), /Unsupported/);
});
test('retention gate rejects listeners and retained heap beyond the allowance', () => {
  const before = fixture(), after = fixture();
  for (const report of [before, after]) {
    report.metadata.options.staticUI = false;
    report.trials.forEach(t => {
      t.scenarios = { idle: t.idle };
      t.teardown = { before: { nodes: 10, documents: 1, jsEventListeners: 1, usedHeapBytes: 1000 },
        after: { nodes: 10, documents: 1, jsEventListeners: 1, usedHeapBytes: 1000 } };
    });
  }
  assert.equal(checkReports(before, after).pass, true);
  after.trials[0].teardown.after.jsEventListeners++;
  after.trials[1].teardown.after.usedHeapBytes += 200_000;
  assert.equal(checkReports(before, after).pass, false);
});
