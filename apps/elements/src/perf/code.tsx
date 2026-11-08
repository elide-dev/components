import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CodeLines } from '@elide/ui/components/code-lines';
import type { CodeLine } from '../../../../packages/ui/src/lib/code-model';

const count = Number(new URLSearchParams(location.search).get('count') ?? 100);
if (![100, 1000].includes(count)) throw new Error('Invalid row count');
// Pre-highlighted input: isolates rendering from grammar compilation/downloads.
const lines: CodeLine[] = Array.from({ length: count }, (_, i) => ({ tokens: [
  { text: 'const', style: { className: 'tk-keyword' } }, { text: ' result' },
  { text: ' = ' },
  { text: 'await', style: { className: 'tk-keyword' } }, { text: ' client' },
  { text: '.' },
  { text: 'fetch', style: { className: 'tk-function' } },
  { text: '(' },
  { text: `"/projects/${i}"`, style: { className: 'tk-string' } },
  { text: ')' },
  { text: ';' }, { text: ' // response', style: { className: 'tk-comment' } },
] }));
let root: Root | undefined;
function App({ ready }: { ready: () => void }) {
  React.useLayoutEffect(ready, [ready]);
  return <pre className="eld-code-body"><CodeLines lines={lines} lineNumbers lang="typescript" /></pre>;
}
const driver = {
  mount() {
    root = createRoot(document.getElementById('app')!);
    return new Promise<void>(resolve => root!.render(<App ready={resolve} />));
  },
  clear() { root?.unmount(); root = undefined; },
};
declare global {
  interface Window { codeDriver: typeof driver; codeReady: Promise<void> }
}
window.codeDriver = driver;
window.codeReady = driver.mount().then(() => { performance.mark('eld:ready'); });
