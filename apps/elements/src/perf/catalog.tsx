import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SidebarGroup } from '@elide/ui/components/sidebar';
import { CodeSurfaceTitleBar } from '@elide/ui/components/code-surface';
import { SupportMatrix, type SupportStatus } from '@elide/ui/components/support-matrix';
import '../../../../packages/ui/src/styles.css';

const parameters = new URLSearchParams(location.search);
const count = Number(parameters.get('count') ?? 100);
const scenario = parameters.get('case') ?? 'sidebar';
if (![100, 1000].includes(count) || !['sidebar', 'chrome', 'matrix'].includes(scenario)) throw new Error('Invalid fixture');
const items = Array.from({ length: count }, (_, i) => ({ label: `Guide ${i}`, href: `#guide-${i}`, active: i === 0, comingSoon: i % 10 === 9, external: i % 7 === 6 }));
const rows = Array.from({ length: count }, (_, i) => ({ method: `method${i}()`, status: ['yes', 'no', 'partial'][i % 3] as SupportStatus, notes: `Method ${i} compatibility` }));
let root: Root | undefined;
function App({ ready }: { ready: () => void }) {
  React.useLayoutEffect(ready, [ready]);
  if (scenario === 'sidebar') return <SidebarGroup label="Guides" items={items} />;
  if (scenario === 'matrix') return <SupportMatrix rows={rows} />;
  return <>{items.map(item => <CodeSurfaceTitleBar key={item.label} title={item.label} />)}</>;
}
const driver = {
  mount() {
    root = createRoot(document.getElementById('app')!);
    return new Promise<void>(resolve => root!.render(<App ready={resolve} />));
  },
  clear() { root?.unmount(); root = undefined; },
};
declare global { interface Window { catalogDriver: typeof driver; catalogReady: Promise<void> } }
window.catalogDriver = driver;
window.catalogReady = driver.mount();
