import assert from 'node:assert/strict';

// Fixture-specific ceilings, including benchmark drivers and runtimes.
// Changing a ceiling requires a reviewed explanation, never automatic rebasing.
export const gzipBudgets = { static: 0, lit: 12_000, preact: 22_000, react: 85_000, adapter: 85_000 };
export function checkBundles(bundles) {
  for (const [kind, ceiling] of Object.entries(gzipBudgets)) {
    const bytes = bundles.variants[kind].js.reduce((sum, chunk) => sum + chunk.gzip, 0);
    assert.ok(bytes <= ceiling, `${kind}: ${bytes} gzip JS bytes exceeds ${ceiling}`);
  }
}

const p75 = values => values.toSorted((a, b) => a - b)[Math.ceil(values.length * 0.75) - 1];
const at = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
export function checkReports(baseline, candidate) {
  checkBundles(candidate.bundles);
  for (const key of ['browser', 'os', 'cpuModel', 'network', 'node', 'zlib']) {
    assert.ok(candidate.metadata[key], `Missing environment metadata: ${key}`);
    assert.deepEqual(candidate.metadata[key], baseline.metadata[key], `Incompatible ${key}`);
  }
  assert.deepEqual(candidate.metadata.options, baseline.metadata.options, 'Incompatible run options');
  assert.deepEqual(candidate.metadata.kinds, baseline.metadata.kinds, 'Incompatible implementations');
  const { samples, counts, staticUI, rendering, trace } = candidate.metadata.options;
  assert.ok(Number.isInteger(samples) && samples >= 7, 'Release gate requires at least seven samples');
  assert.deepEqual(candidate.metadata.kinds.toSorted(), Object.keys(gzipBudgets).toSorted(), 'Missing implementation');
  assert.ok(counts.length > 0 && new Set(counts).size === counts.length && counts.every(n => [1, 100, 1000].includes(n)), 'Invalid counts');
  assert.ok(candidate.metadata.options.idleMs >= 2000, 'At least two seconds of idle observation required');
  assert.ok(candidate.metadata.options.steps >= 20, 'At least 20 workload steps required');
  if (!staticUI) {
    assert.ok(counts.includes(100) && candidate.metadata.options.cycles >= 100, 'Retention gate requires 100 instances and at least 100 cycles');
  }
  assert.equal(trace, false, 'Trace overhead must be measured separately');
  const expected = samples * counts.length * candidate.metadata.kinds.length;
  const rows = [];
  for (const report of [baseline, candidate]) {
    assert.equal(report.trials.length, expected, 'Incomplete report');
    const keys = new Set(report.trials.map(t => `${t.kind}/${t.count}/${t.sample}`));
    assert.equal(keys.size, expected, 'Duplicate trials');
    for (const kind of report.metadata.kinds) for (const count of counts) {
      for (let sample = 0; sample < samples; sample++) assert.ok(keys.has(`${kind}/${count}/${sample}`), 'Missing trial');
    }
  }
  // Both relative AND absolute tolerance must be exceeded to fail. These are
  // regression guardrails, not a claim of statistical significance or speedup.
  const metrics = rendering ? [] : [
    ['startup.TaskDurationMs', 5], ['startup.fcpMs', 16],
    ['mountedMemory.usedHeapBytes', 64 * 1024], ['mountedMemory.nodes', 4],
    ...(staticUI ? [['scroll.TaskDurationMs', 5], ['idle.TaskDurationMs', 2]]
      : [['scenarios.idle.TaskDurationMs', 2]]),
  ];
  for (const kind of candidate.metadata.kinds) for (const count of counts) {
    const old = baseline.trials.filter(t => t.kind === kind && t.count === count);
    const next = candidate.trials.filter(t => t.kind === kind && t.count === count);
    for (const [path, floor] of metrics) {
      if (path.startsWith('scroll.') && count === 1) continue;
      const a = old.map(t => at(t, path));
      const b = next.map(t => at(t, path));
      assert.ok([...a, ...b].every(Number.isFinite), `${kind}/${count}: missing ${path}`);
      const previous = p75(a), current = p75(b);
      const ceiling = previous + Math.max(previous * 0.15, floor);
      rows.push({ kind, count, metric: path, previous, current, ceiling, pass: current <= ceiling });
    }
    for (const trial of next) {
      if (rendering) {
        assert.ok(staticUI, 'Rendering gates require --static-ui');
        const diagnostic = trial.rendering;
        assert.ok(diagnostic, 'Missing rendering diagnostics');
        for (const type of ['longtask', 'long-animation-frame', 'layout-shift']) {
          assert.ok(Array.isArray(diagnostic.entries[type]), `Unsupported ${type}; cannot certify gate`);
        }
        const shifts = diagnostic.entries['layout-shift'].filter(e => !e.hadRecentInput).reduce((sum, e) => sum + e.value, 0);
        // Total shift is stricter than session-window CLS, and is labelled as such.
        rows.push({ kind, count, metric: 'total layout shift', current: shifts, ceiling: 0.001, pass: shifts <= 0.001 });
        for (const type of ['longtask', 'long-animation-frame']) {
          const entries = diagnostic.entries[type].filter(e => e.startTime >= diagnostic.scrollStart);
          rows.push({ kind, count, metric: `${type} during scroll/idle`, current: entries.length, ceiling: 0, pass: entries.length === 0 });
        }
      }
      if (!staticUI && count === 100) {
        assert.ok(trial.teardown, 'Missing teardown measurement');
        for (const metric of ['nodes', 'documents', 'jsEventListeners', 'usedHeapBytes']) {
          const growth = trial.teardown.after[metric] - trial.teardown.before[metric];
          assert.ok(Number.isFinite(growth), `Missing teardown ${metric}`);
          const ceiling = metric === 'usedHeapBytes' ? 128 * 1024 : 0;
          rows.push({ kind, count, metric: `teardown ${metric} growth`, current: growth, ceiling, pass: growth <= ceiling });
        }
      }
    }
  }
  return { pass: rows.every(row => row.pass), rows };
}
