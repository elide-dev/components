import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
const baseline = process.argv[2];
const source = resolve('../../packages/ui/src/components/code-lines.tsx');
const temporary = resolve(`../../packages/ui/src/components/.perf-${randomUUID()}.tsx`);
if (baseline) await writeFile(temporary, execFileSync('git', ['show', `${baseline}:packages/ui/src/components/code-lines.tsx`]), { flag: 'wx' });
const variants = ['react', 'preact'].flatMap(kind => (baseline ? ['before', 'after'] : ['after']).map(revision => ({ kind, revision, directory: baseline ? `${kind}-${revision}` : kind })));
try {
const css = (await Promise.all(['../../packages/tokens/src/tokens.css', '../../packages/ui/src/code-surface.css'].map(p => readFile(p, 'utf8')))).join('\n');
for (const { kind, revision, directory } of variants) {
  await build({ configFile: false, plugins: [react(), {
    name: 'verify-code-runtime',
    generateBundle(_options, bundle) {
      const ids = Object.values(bundle).filter(item => item.type === 'chunk').flatMap(chunk => Object.keys(chunk.modules));
      const hasReact = ids.some(id => /node_modules\/(?:\.bun\/)?react(?:@|\/)/.test(id));
      const hasPreact = ids.some(id => /node_modules\/(?:\.bun\/)?preact(?:@|\/)/.test(id));
      if (hasReact !== (kind === 'react') || hasPreact !== (kind === 'preact')) throw new Error(`${kind}: incorrect runtime graph`);
    },
  }],
    resolve: { alias: [
      { find: '@elide/ui/components/code-lines', replacement: revision === 'before' ? temporary : source },
      ...(kind === 'preact' ? [
      { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
      { find: /^react-dom$/, replacement: 'preact/compat' },
      { find: /^react$/, replacement: 'preact/compat' },
      { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
    ] : []),
    ], dedupe: ['preact'] },
    build: { target: 'es2022', outDir: `dist/code-perf/${directory}`, emptyOutDir: true,
      rollupOptions: { input: 'src/perf/code.tsx', output: { entryFileNames: 'entry.js' } } },
  });
  await writeFile(`dist/code-perf/${directory}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Code rendering cost</title><style>${css}</style><main id="app"></main><script type="module" src="./entry.js"></script></html>`);
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await writeFile('dist/code-perf/build.json', JSON.stringify({
  baseline: baseline ? execFileSync('git', ['rev-parse', baseline], { encoding: 'utf8' }).trim() : null,
  variants, sourceHashes: { before: baseline ? hash(await readFile(temporary)) : null, after: hash(await readFile(source)) },
  fixtureHash: hash(await readFile('src/perf/code.tsx')), cssHash: hash(css),
}, null, 2));
} finally { if (baseline) await unlink(temporary); }
