import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
const baseline=process.argv[2];
if (!baseline) throw new Error('Provide baseline revision');
const snapshot=resolve(`../../packages/ui/.perf-widget-source-${randomUUID()}`);
const variants=['react','preact'].flatMap(kind=>['before','after'].map(revision=>({kind,revision,directory:`${kind}-${revision}`})));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
try {
  await cp('../../packages/ui/src',snapshot,{recursive:true});
  const paths=execFileSync('git',['ls-tree','-r','--name-only',baseline,'packages/ui/src'],{cwd:resolve('../..'),encoding:'utf8'}).trim().split('\n');
  for (const path of paths) { const dest=resolve(snapshot,path.replace('packages/ui/src/','')); await mkdir(dirname(dest),{recursive:true}); await writeFile(dest,execFileSync('git',['show',`${baseline}:${path}`])); }
  for (const {kind,revision,directory} of variants) {
    const source=revision==='before'?snapshot:resolve('../../packages/ui/src');
    await build({configFile:false,plugins:[react(),tailwind(), {
      name: 'verify-widget-runtime',
      generateBundle(_options, bundle) {
        const ids = Object.values(bundle).filter(item => item.type === 'chunk').flatMap(chunk => Object.keys(chunk.modules));
        const hasReact = ids.some(id => /node_modules\/(?:\.bun\/)?react(?:@|\/)/.test(id));
        const hasPreact = ids.some(id => /node_modules\/(?:\.bun\/)?preact(?:@|\/)/.test(id));
        if (hasReact !== (kind === 'react') || hasPreact !== (kind === 'preact')) throw new Error('Incorrect runtime graph');
      },
    }],resolve:{alias:[
      ...['terminal','code-scene'].map(name=>({find:`@elide/ui/components/${name}`,replacement:`${source}/components/${name}.tsx`})),
      ...(kind==='preact'?[
        {find:/^react-dom\/client$/,replacement:'preact/compat/client'}, {find:/^react-dom$/,replacement:'preact/compat'},
        {find:/^react$/,replacement:'preact/compat'}, {find:/^react\/jsx-runtime$/,replacement:'preact/jsx-runtime'},
      ]:[]),
    ],dedupe:['preact','react','react-dom']},build:{target:'es2022',outDir:`dist/widget-perf/${directory}`,emptyOutDir:true,rollupOptions:{input:'src/perf/widgets.tsx',output:{entryFileNames:'entry.js',assetFileNames:'[name][extname]'}}}});
    await writeFile(`dist/widget-perf/${directory}/index.html`,'<!doctype html><html lang="en"><meta charset="utf-8"><title>Widget workload</title><link rel="stylesheet" href="./widgets.css"><main id="app"></main><script type="module" src="./entry.js"></script></html>');
  }
  const files=['lib/vt.ts','lib/playback.ts','components/code-lines.tsx','components/terminal-recording.tsx','components/code-block.tsx','components/code-scene.tsx'];
  await writeFile('dist/widget-perf/build.json',JSON.stringify({baseline:execFileSync('git',['rev-parse',baseline],{encoding:'utf8'}).trim(),variants,sourceHashes:await Promise.all(files.map(async file=>({file,before:hash(await readFile(`${snapshot}/${file}`)),after:hash(await readFile(`../../packages/ui/src/${file}`))}))),fixtureHash:hash(await readFile('src/perf/widgets.tsx'))},null,2));
} finally { await rm(snapshot,{recursive:true,force:true}); }
