import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const file = process.argv[2];
if (!file) throw new Error('Usage: node perf/catalog-summary.mjs results.json');
const report = JSON.parse(await readFile(file, 'utf8'));
const { samples, cases, counts } = report.metadata;
assert.ok(samples >= 7, 'At least seven samples required');
assert.equal(report.trials.length, samples * cases.length * counts.length * 4, 'Incomplete report');
const stats = values => {
  assert.ok(values.every(Number.isFinite));
  const sorted = values.toSorted((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return { median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    p75: sorted[Math.ceil(sorted.length * .75) - 1], min: sorted[0], max: sorted.at(-1) };
};
const rows = [];
for (const scenario of cases) for (const count of counts) for (const kind of ['react', 'preact']) {
  const trials = ['before', 'after'].map(revision => {
    const values = report.trials.filter(t => t.scenario === scenario && t.count === count && t.kind === kind && t.revision === revision);
    assert.deepEqual(values.map(t => t.sample).toSorted((a, b) => a - b), Array.from({ length: samples }, (_, i) => i), 'Missing or duplicate trial');
    return values;
  });
  for (const [metric, pick, floor] of [['startupMs', t => t.startupMs, 5], ['heapBytes', t => t.mounted.heap, 65536], ['nodes', t => t.mounted.nodes, 4]]) {
    const [before, after] = trials.map(values => stats(values.map(pick)));
    rows.push({ scenario, kind, count, metric, before, after,
      changePercent: +((after.median / before.median - 1) * 100).toFixed(1),
      regression: after.p75 > before.p75 + Math.max(before.p75 * .15, floor) });
  }
}
console.log(JSON.stringify({ rows }, null, 2));
if (rows.some(row => row.regression)) process.exitCode = 1;
