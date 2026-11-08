import { build } from 'vite';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { renderLogo } from '@elide/elements/ssr';

await build();
await cp('../../packages/brand/assets', 'dist/brand', { recursive: true });
const html = await readFile('dist/hydrate.html', 'utf8');
const markup = renderLogo({ variant: 'blend', height: 40, accessibleLabel: 'Server logo' });
await writeFile('dist/hydrate.html', html.replace('<!--logo-->', markup));
await writeFile('dist/static.html', html.replace('<!--logo-->', markup).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g, ''));
