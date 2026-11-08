import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import '@elide/tokens/tokens.css';

// Delay registration for the fixture to observe and compare pre-upgrade nodes.
Object.assign(window, {
  upgradeLogo: () => import('@elide/elements/define/logo'),
});
