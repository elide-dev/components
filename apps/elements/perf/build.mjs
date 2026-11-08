import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ElideLogo } from '@elide/ui/components/elide-logo';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { gzipSync, brotliCompressSync } from 'node:zlib';

const sizes = code => ({ raw: Buffer.byteLength(code), gzip: gzipSync(code).byteLength, brotli: brotliCompressSync(code).byteLength });
const css = `:root{--foreground:#171717;background:#fff;color:var(--foreground)}
:root.dark{--foreground:#fafafa;background:#111}
body{margin:8px}#app{display:grid;grid-template-columns:repeat(5,150px);gap:8px}
[data-item]{height:40px;display:flex;align-items:center}
svg{display:block}.text-foreground{color:var(--foreground)}`;
const document = (body, script = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logo performance fixture</title><style>${css}</style></head><body><main id="app">${body}</main>${script}</body></html>`;
await rm('dist/perf', { recursive: true, force: true });
const report = { description: 'Independent production builds. JS includes benchmark driver and full runtime; identical minimal CSS is inline in HTML. Compression is per resource, not a network measurement.', variants: {} };
for (const kind of ['react', 'preact', 'lit', 'adapter']) {
  let code = [];
  await build({
    configFile: false,
    resolve: kind === 'preact' ? { alias: [
      { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
      { find: /^react-dom$/, replacement: 'preact/compat' },
      { find: /^react$/, replacement: 'preact/compat' },
      { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
    ], dedupe: ['preact'] } : undefined,
    plugins: [react(), {
      name: 'isolated-performance-entry',
      generateBundle(_options, bundle) {
        const chunks = Object.values(bundle).filter(item => item.type === 'chunk');
        const ids = chunks.flatMap(chunk => Object.keys(chunk.modules));
        const reactPresent = ids.some(id => /node_modules\/(?:\.bun\/)?react(?:@|\/)/.test(id));
        const litPresent = ids.some(id => /node_modules\/(?:\.bun\/)?lit(?:@|\/|-)/.test(id));
        const preactPresent = ids.some(id => /node_modules\/(?:\.bun\/)?preact(?:@|\/)/.test(id));
        if (reactPresent !== ['react', 'adapter'].includes(kind)) throw new Error(`${kind}: wrong React runtime graph`);
        if (litPresent !== ['lit', 'adapter'].includes(kind)) throw new Error(`${kind}: wrong Lit runtime graph`);
        if (preactPresent !== (kind === 'preact')) throw new Error(`${kind}: wrong Preact runtime graph`);
        if (ids.some(id => /@lit-labs\/ssr/.test(id))) throw new Error(`${kind}: SSR code in client graph`);
        code = chunks.map(chunk => ({ file: chunk.fileName, ...sizes(chunk.code) }));
      },
    }],
    build: {
      target: 'es2022', outDir: `dist/perf/${kind}`, emptyOutDir: true,
      rollupOptions: {
        input: `src/perf/${kind}.${kind === 'lit' ? 'ts' : 'tsx'}`,
        output: { entryFileNames: 'entry.js' },
      },
    },
  });
  const html = document('', '<script type="module" src="./entry.js"></script>');
  await writeFile(`dist/perf/${kind}/index.html`, html);
  // Measure final bytes on disk, after all bundler output transforms.
  code = await Promise.all(code.map(async chunk => ({ file: chunk.file, ...sizes(await readFile(`dist/perf/${kind}/${chunk.file}`)) })));
  report.variants[kind] = { js: code, html: sizes(html), inlineCSS: sizes(css) };
}

// Static reference is the exact existing React output produced at build time.
// It ships no React, Lit, or benchmark JavaScript to the browser.
await mkdir('dist/perf/static', { recursive: true });
const logo = renderToStaticMarkup(createElement(ElideLogo, { form: 'full', variant: 'mono', height: 24, decorative: true }));
report.variants.static = { js: [], html: {}, inlineCSS: sizes(css) };
for (const count of [1, 100, 1000]) {
  const html = document(Array.from({ length: count }, (_, index) => `<div data-item="${index}">${logo}</div>`).join(''));
  await writeFile(`dist/perf/static/index-${count}.html`, html);
  report.variants.static.html[count] = sizes(html);
}
await writeFile('dist/perf/bundles.json', JSON.stringify(report, null, 2) + '\n');
for (const [kind, variant] of Object.entries(report.variants)) {
  console.log(`${kind}: ${variant.js.reduce((sum, chunk) => sum + chunk.gzip, 0)} bytes gzip JS including driver/runtime`);
}
