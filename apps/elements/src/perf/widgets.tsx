import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Terminal } from '@elide/ui/components/terminal';
import { CodeScene } from '@elide/ui/components/code-scene';
import { elideHelpCast } from '../../../../packages/ui/src/stories/fixtures/help-cast';
import type { CodeScene as Scene } from '../../../../packages/ui/src/lib/scene';
import '@elide/ui/styles.css';
const scenario = new URLSearchParams(location.search).get('case');
const scene: Scene = { files: [{ name: 'example.sh', lang: 'bash', code: Array.from({length: 100}, (_, i) => `echo "Line ${i}"`).join('\n') }], steps: [
  { label: 'Inspect the current frame', duration: 20, actions: [{type:'focus', line: 10}, {type:'terminal', write:'Ready\n'}, {type:'frame', stack:[{name:'main',file:'example.sh',line:10}], locals:{status:'ready'}}] },
  { label: 'Complete', actions: [{type:'terminal',write:'Done\n'}] },
] };
let root: ReturnType<typeof createRoot>;
const paint = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function App({ready}:{ready:()=>void}) {
  React.useEffect(ready, [ready]);
  return scenario === 'terminal' ? <Terminal title="Elide help" code="elide help" recording={{cast:elideHelpCast, rows:30, poster:0.5}} /> : <CodeScene scene={scene} terminalCommand="bash example.sh" />;
}
const driver = {
  mount: () => new Promise<void>(resolve => { root=createRoot(document.getElementById('app')!); root.render(<App ready={resolve}/>); }),
  clear: () => root.unmount(),
  async run() {
    if (scenario === 'terminal') {
      const slider = document.querySelector('input[type=range]') as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      for (let i=0;i<120;i++) {
        setter.call(slider, .4 + 4.4*i/119);
        slider.dispatchEvent(new Event('input',{bubbles:true}));
        slider.dispatchEvent(new Event('change',{bubbles:true}));
        await paint();
      }
    } else {
      (document.querySelector('button[aria-label="Play walkthrough"]') as HTMLButtonElement).click();
      for (let i=0;i<120;i++) await paint();
      (document.querySelector('button[aria-label="Pause walkthrough"]') as HTMLButtonElement).click();
    }
    await paint();
  },
};
declare global { interface Window { widgetDriver:typeof driver; widgetReady:Promise<void> } }
window.widgetDriver=driver;
window.widgetReady=driver.mount();
