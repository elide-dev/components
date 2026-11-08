import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { ElideLogo as Legacy } from '@elide/ui/components/elide-logo';
import { ElideLogo } from '@elide/ui/elements/logo';
import '@elide/ui/styles.css';

const forms = ['full', 'square'] as const;
const variants = ['gradient', 'mono', 'blend'] as const;
const formats = ['svg', 'png', 'webp', 'avif', 'linked'] as const;

function App() {
  const [height, setHeight] = React.useState<number | undefined>(location.search.includes('default') ? undefined : 40);
  return <>
    <button onClick={() => setHeight(height === 40 ? 72 : 40)}>Resize</button>
    {forms.flatMap(form => variants.flatMap(variant => formats.map(format => {
      const props = { form, variant, format: format === 'linked' ? 'svg' as const : format, linked: format === 'linked', height };
      const key = `${form}-${variant}-${format}`;
      return <div key={key} data-case={key} style={{ display: 'flex', gap: 16, padding: 8 }}>
        <div data-legacy style={{ width: 320 }}><Legacy {...props} /></div>
        <div data-element style={{ width: 320 }}><ElideLogo {...props} /></div>
      </div>;
    })))}
  </>;
}

createRoot(document.querySelector('#app')!).render(<App />);
