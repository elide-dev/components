import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { start } from './driver';

interface LogoProps { form: 'full'; variant: 'mono'; height: number; decorative: boolean }

/** Local state avoids charging React for an unrelated list rerender on updates. */
export function startReact(Logo: React.ComponentType<LogoProps>) {
  const app = document.querySelector('#app')!;
  const setters = new Map<number, React.Dispatch<React.SetStateAction<number>>>();
  const pending = new Map<number, () => void>();
  const heights = new Map<number, number>();
  let root: Root | undefined;

  function Cell({ index }: { index: number }) {
    const [height, setHeight] = React.useState(24);
    React.useLayoutEffect(() => {
      setters.set(index, setHeight);
      heights.set(index, height);
      pending.get(index)?.();
      pending.delete(index);
    }, [index, height]);
    React.useLayoutEffect(() => () => { setters.delete(index); pending.delete(index); heights.delete(index); }, [index]);
    return <div data-item={index}><Logo form="full" variant="mono" height={height} decorative /></div>;
  }

  function App({ count, ready }: { count: number; ready: () => void }) {
    React.useLayoutEffect(ready, [ready]);
    return <>{Array.from({ length: count }, (_, index) => <Cell key={index} index={index} />)}</>;
  }

  // React's commit precedes the adapter's asynchronous Lit update. Await both.
  async function settleElements(indices?: number[]) {
    const cells = indices ? indices.map(index => app.children[index]) : [...app.children];
    await Promise.all(cells.map(cell => (cell.querySelector('eld-logo') as HTMLElement & { updateComplete?: Promise<unknown> })?.updateComplete));
  }

  start({
    async mount(count) {
      if (root) throw new Error('Clear before mounting again');
      root = createRoot(app);
      await new Promise<void>(resolve => root!.render(<App count={count} ready={resolve} />));
      await settleElements();
    },
    async update(indices, height) {
      await Promise.all(indices.map(index => new Promise<void>(resolve => {
        const setter = setters.get(index);
        if (!setter) throw new Error(`Missing cell ${index}`);
        if (heights.get(index) === height) { resolve(); return; }
        pending.set(index, resolve);
        setter(height);
      })));
      await settleElements(indices);
    },
    async clear() { root?.unmount(); root = undefined; setters.clear(); pending.clear(); heights.clear(); },
  });
}
