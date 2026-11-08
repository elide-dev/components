import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const file = process.argv[2];
assert.ok(file, 'Usage: node perf/summarize.mjs .profiles/<run>/results.json');
const report = JSON.parse(await readFile(file, 'utf8'));
const summarize = values => {
  assert.ok(values.every(Number.isFinite), 'Missing/nonfinite measurement');
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return `${median.toFixed(1)} [${sorted[0].toFixed(1)}, ${sorted.at(-1).toFixed(1)}]`;
};
console.log(JSON.stringify(report.metadata, null, 2));
const kinds = report.metadata.kinds ?? ['static', 'react', 'lit', 'adapter'];
if (report.metadata.options.staticUI) {
  console.log('\nMedian [min, max]; task/FCP times in ms; heap in KiB. Scroll N/A means the page fits in the viewport.');
  console.log('| Kind | Count | Startup task | FCP | Scroll task | Mounted JS heap |');
  console.log('| --- | ---: | --- | --- | --- | --- |');
  for (const count of report.metadata.options.counts) for (const kind of kinds) {
    const trials = report.trials.filter(trial => trial.kind === kind && trial.count === count);
    assert.equal(trials.length, report.metadata.options.samples, `Incomplete run: ${kind} count=${count}`);
    const scroll = trials.every(trial => trial.scroll) ? summarize(trials.map(trial => trial.scroll.TaskDurationMs)) : 'N/A';
    console.log(`| ${kind} | ${count} | ${summarize(trials.map(t => t.startup.TaskDurationMs))} | ${summarize(trials.map(t => t.startup.fcpMs))} | ${scroll} | ${summarize(trials.map(t => t.mountedMemory.usedHeapBytes / 1024))} |`);
  }
  process.exit(0);
}
console.log('\nMedian [min, max]; task times in ms, heap in KiB. Each update sample includes all configured steps.');
console.log('| Kind | Count | Samples | Startup task | One update task | All update task | Theme task | Mounted heap |');
console.log('| --- | ---: | ---: | --- | --- | --- | --- | --- |');
for (const count of report.metadata.options.counts) {
  for (const kind of kinds) {
    const trials = report.trials.filter(trial => trial.kind === kind && trial.count === count);
    assert.equal(trials.length, report.metadata.options.samples, `Incomplete run: ${kind} count=${count}`);
    const columns = [t => t.startup.TaskDurationMs, t => t.scenarios.one.TaskDurationMs, t => t.scenarios.all.TaskDurationMs, t => t.scenarios.theme.TaskDurationMs, t => t.mountedMemory.usedHeapBytes / 1024];
    console.log(`| ${kind} | ${count} | ${trials.length} | ${columns.map(column => summarize(trials.map(column))).join(' | ')} |`);
  }
}
if (report.metadata.options.counts.includes(100)) {
  console.log('\n100-instance teardown: retained heap delta KiB after warmup and configured mount/unmount cycles. Not proof of a leak.');
  for (const kind of kinds) {
    const trials = report.trials.filter(trial => trial.kind === kind && trial.count === 100);
    console.log(`${kind}: ${summarize(trials.map(trial => (trial.teardown.after.usedHeapBytes - trial.teardown.before.usedHeapBytes) / 1024))}; DOM node delta ${summarize(trials.map(trial => trial.teardown.after.nodes - trial.teardown.before.nodes))}`);
  }
}
