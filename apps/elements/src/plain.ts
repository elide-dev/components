import '@elide/tokens/tokens.css';
import '@elide/elements/define/logo';

document.querySelector('#app')!.innerHTML = `
  <eld-logo variant="blend" height="40"></eld-logo>
  <eld-logo form="square" variant="mono" height="40"></eld-logo>
  <eld-logo variant="blend" format="webp" height="40"></eld-logo>
  <div data-theme="light"><eld-logo variant="blend" format="webp" height="40"></eld-logo></div>`;
