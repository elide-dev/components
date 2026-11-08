import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const baseline = process.argv[2];
if (!baseline) throw new Error('Usage: node perf/catalog-build.mjs BASELINE_COMMIT');
const components = ['sidebar', 'code-surface', 'support-matrix'];
const files = [];
const variants = ['react', 'preact'].flatMap(kind => ['before', 'after'].map(revision => ({ kind, revision, directory: `${kind}-${revision}` })));
try {
  for (const name of components) {
    const file = resolve(`../../packages/ui/src/components/.perf-${randomUUID()}.tsx`);
    await writeFile(file, execFileSync('git', ['show', `${baseline}:packages/ui/src/components/${name}.tsx`]), { flag: 'wx' });
    files.push(file);
  }
  for (const { kind, revision, directory } of variants) {
    await build({ configFile: false, plugins: [react(), tailwind(), {
      name: 'check-catalog-runtime',
      generateBundle(_options, bundle) {
        const ids = Object.values(bundle).filter(item => item.type === 'chunk').flatMap(chunk => Object.keys(chunk.modules));
        const hasReact = ids.some(id => /node_modules\/(?:\.bun\/)?react(?:@|\/)/.test(id));
        const hasPreact = ids.some(id => /node_modules\/(?:\.bun\/)?preact(?:@|\/)/.test(id));
        if (hasReact !== (kind === 'react') || hasPreact !== (kind === 'preact')) throw new Error('Wrong runtime');
      },
    }], resolve: { alias: [
      ...components.map((name, i) => ({ find: `@elide/ui/components/${name}`, replacement: revision === 'before' ? files[i] : resolve(`../../packages/ui/src/components/${name}.tsx`) })),
      ...(kind === 'preact' ? [
        { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
        { find: /^react-dom$/, replacement: 'preact/compat' },
        { find: /^react$/, replacement: 'preact/compat' },
        { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
      ] : []),
    ], dedupe: ['preact'] }, build: { target: 'es2022', outDir: `dist/catalog-perf/${directory}`, emptyOutDir: true,
      rollupOptions: { input: 'src/perf/catalog.tsx', output: { entryFileNames: 'entry.js', assetFileNames: '[name][extname]' } } },
    });
    await writeFile(`dist/catalog-perf/${directory}/index.html`, '<!doctype html><html lang="en"><meta charset="utf-8"><title>Catalog costs</title><link rel="stylesheet" href="./catalog.css"><main id="app"></main><script type="module" src="./entry.js"></script></html>');
  }
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  await writeFile('dist/catalog-perf/build.json', JSON.stringify({ baseline, variants,
    components: await Promise.all(components.map(async (name, i) => ({ name,
      before: hash(await readFile(files[i])), after: hash(await readFile(`../../packages/ui/src/components/${name}.tsx`)),
    }))), fixture: hash(await readFile('src/perf/catalog.tsx')) }, null, 2));
} finally { await Promise.allSettled(files.map(file => unlink(file))); }
