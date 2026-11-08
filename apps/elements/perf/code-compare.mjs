import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const [beforePath, afterPath = beforePath] = process.argv.slice(2);
if (!beforePath || !afterPath) throw new Error('Usage: node perf/code-compare.mjs before/results.json after/results.json');
const [before, after] = await Promise.all([beforePath, afterPath].map(async path => JSON.parse(await readFile(path, 'utf8'))));
for (const key of ['browser', 'cpu', 'throttle', 'samples', 'viewport', 'counts', 'tokensPerRow']) {
  assert.deepEqual(after.metadata[key], before.metadata[key], `Incompatible ${key}`);
}
assert.ok(before.metadata.samples >= 7, 'At least seven samples required');
const stats = values => {
  const sorted = values.toSorted((a, b) => a - b);
  assert.ok(sorted.every(Number.isFinite));
  const middle = Math.floor(sorted.length / 2);
  return { median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    p75: sorted[Math.ceil(sorted.length * .75) - 1], min: sorted[0], max: sorted.at(-1) };
};
const rows = [];
for (const kind of ['react', 'preact']) for (const count of [100, 1000]) {
  const trials = [before, after].map(report => {
    const selected = report.trials.filter(t => t.kind === kind && t.count === count && (beforePath !== afterPath || t.revision === (report === before ? 'before' : 'after')));
    assert.deepEqual(selected.map(t => t.sample).toSorted((a, b) => a - b), Array.from({ length: report.metadata.samples }, (_, i) => i), 'Incomplete or duplicate trials');
    return selected;
  });
  for (const extension of ['html', 'png']) {
    const [a, b] = await Promise.all([beforePath, afterPath].map((path, i) => readFile(join(dirname(path), `${kind}${beforePath === afterPath ? (i ? '-after' : '-before') : ''}-${count}.${extension}`))));
    assert.ok(a.equals(b), `${kind}/${count}: ${extension} output changed; review parity before accepting`);
  }
  for (const [metric, pick] of [['startupMs', t => t.startupMs], ['heapBytes', t => t.mounted.heap], ['nodes', t => t.mounted.nodes]]) {
    const [a, b] = trials.map(ts => stats(ts.map(pick)));
    rows.push({ kind, count, metric, beforeMedian: a.median, afterMedian: b.median,
      changePercent: +((b.median / a.median - 1) * 100).toFixed(1), beforeP75: a.p75, afterP75: b.p75,
      beforeRange: [a.min, a.max], afterRange: [b.min, b.max] });
  }
}
console.log(JSON.stringify({ parity: 'Exact HTML and viewport PNG match in React and Preact', rows }, null, 2));
