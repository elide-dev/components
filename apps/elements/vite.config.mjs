import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { gzipSync, brotliCompressSync } from 'node:zlib';

export default defineConfig({
  plugins: [react(), tailwind(), {
    name: 'verify-portable-entry',
    generateBundle(_options, bundle) {
      const plain = Object.values(bundle).find(chunk => chunk.type === 'chunk' && chunk.isEntry && chunk.name === 'plain');
      if (!plain) throw new Error('Missing plain element consumer');
      const seen = new Set();
      const visit = chunk => {
        if (seen.has(chunk.fileName)) return;
        seen.add(chunk.fileName);
        for (const id of Object.keys(chunk.modules)) {
          if (/node_modules\/(?:\.bun\/)?(?:react|react-dom|@lit\/react|@base-ui\/react|@lit-labs\/ssr|@lit-labs\/ssr-client)(?:@|\/)/.test(id)) {
            throw new Error(`Framework/server code entered plain consumer: ${id}`);
          }
        }
        for (const name of [...chunk.imports, ...chunk.dynamicImports]) {
          if (bundle[name]?.type === 'chunk') visit(bundle[name]);
        }
      };
      visit(plain);
      const chunks = [...seen].map(name => bundle[name].code);
      const gzip = chunks.reduce((sum, code) => sum + gzipSync(code).byteLength, 0);
      const brotli = chunks.reduce((sum, code) => sum + brotliCompressSync(code).byteLength, 0);
      if (gzip > 14_000) throw new Error(`Plain logo consumer exceeds 14 KB gzip including Lit: ${gzip}`);
      console.log(`Plain logo consumer: ${gzip} bytes gzip / ${brotli} bytes Brotli including Lit; no React or SSR runtime.`);
      this.emitFile({ type: 'asset', fileName: 'bundle-report.json', source: JSON.stringify({ gzip, brotli, chunks: [...seen] }, null, 2) });
    },
  }],
  build: { target: 'es2022', rollupOptions: { input: ['plain.html', 'react.html', 'hydrate.html'] } },
});
