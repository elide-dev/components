// Isolated VT throughput; browser paint, React work and total renderer RAM are separate.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir, cpus } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
const baseline = process.argv[2] ?? '3262c98';
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const relative = 'packages/ui/src/lib/vt.ts';
const source = resolve(root, relative);
const temporary = resolve(root, `packages/ui/src/lib/.perf-vt-${randomUUID()}.ts`);
const directory = await mkdtemp(join(tmpdir(), 'elide-vt-'));
const before = execFileSync('git', ['show', `${baseline}:${relative}`], { cwd: root });
const after = await readFile(source);
const hash = value => createHash('sha256').update(value).digest('hex');
let engines;
try {
  await writeFile(temporary, before, { flag: 'wx' });
  for (const [name, path] of [['before', temporary], ['after', source]]) {
    execFileSync('bun', ['build', path, '--target=node', `--outfile=${join(directory, `${name}.mjs`)}`], { stdio: 'pipe' });
  }
  engines = await Promise.all(['before', 'after'].map(name => import(pathToFileURL(join(directory, `${name}.mjs`)))));
} finally { await rm(temporary, { force: true }); await rm(directory, { recursive: true, force: true }); }
const fixture = await readFile(resolve(root, 'packages/ui/src/stories/fixtures/help-cast.ts'), 'utf8');
const capture = JSON.parse(fixture.slice(fixture.indexOf('=') + 1).trim().replace(/;$/, ''));
const records = capture.trim().split('\n').map(line => JSON.parse(line));
const initial = '\x1b[?25l' + Array.from({ length: 30 }, (_, i) => `\x1b[${i + 1};1H${'abcdefghijklmnopqrst'.repeat(5)}`).join('');
const cases = {
  help: records.slice(1).filter(event => event[1] === 'o').map(event => event[2]),
  sparse: [initial, ...Array.from({ length: 300 }, (_, i) => `\x1b[${i % 30 + 1};${i % 98 + 1}H${i % 10}`)],
  redraw: Array.from({ length: 30 }, (_, i) => initial.replaceAll('a', String(i % 10))),
  scrolling: Array.from({ length: 300 }, (_, i) => `line ${i}: ${'output '.repeat(10)}\r\n`),
};
const options = { cols: 100, rows: 30 };
const snapshot = { scrollback: false, positioned: true };
function replay(engine, events, collect = false) {
  const terminal = engine.createTerminal(options);
  const frames = [];
  let last, reused = 0;
  for (const event of events) {
    terminal.write(event);
    const frame = terminal.snapshot(snapshot);
    if (collect) frames.push(frame);
    if (last) reused += frame.lines.filter((line, i) => line === last.lines[i]).length;
    last = frame;
  }
  return { frames, reused };
}
const parity = {};
for (const [name, events] of Object.entries(cases)) {
  const a = replay(engines[0], events, true), b = replay(engines[1], events, true);
  // Comparing retained snapshots after the full replay also verifies they never mutate.
  assert.deepEqual(b.frames, a.frames, `${name}: frame content changed`);
  parity[name] = { frames: a.frames.length, digest: hash(JSON.stringify(a.frames)), reusedRows: { before: a.reused, after: b.reused } };
}
const trials = [];
const samples = 7, repetitions = 10;
for (const events of Object.values(cases)) for (const engine of engines) for (let i = 0; i < 3; i++) replay(engine, events);
for (let sample = 0; sample < samples; sample++) {
  for (const [name, events] of Object.entries(cases)) {
    for (const index of sample % 2 ? [1, 0] : [0, 1]) {
      const start = performance.now();
      for (let i = 0; i < repetitions; i++) replay(engines[index], events);
      trials.push({ sample, case: name, revision: index ? 'after' : 'before', ms: performance.now() - start });
    }
  }
}
const stats = values => {
  const sorted = values.toSorted((a, b) => a - b);
  return { median: sorted[3], p75: sorted[5], min: sorted[0], max: sorted.at(-1) };
};
const summary = Object.fromEntries(Object.keys(cases).map(name => {
  const a = stats(trials.filter(t => t.case === name && t.revision === 'before').map(t => t.ms));
  const b = stats(trials.filter(t => t.case === name && t.revision === 'after').map(t => t.ms));
  return [name, { before: a, after: b, medianChangePercent: +((b.median / a.median - 1) * 100).toFixed(1) }];
}));
const report = { metadata: { baseline: execFileSync('git', ['rev-parse', baseline], { cwd: root, encoding: 'utf8' }).trim(), node: process.version, platform: process.platform, arch: process.arch, cpu: cpus()[0].model, samples, repetitions, options, snapshot, sourceHashes: { before: hash(before), after: hash(after) }, fixtureHash: hash(fixture) }, parity, trials, summary };
const output = resolve(root, 'apps/elements/perf/results/2026-11-08-vt-snapshots.json');
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, parity, summary }, null, 2));
