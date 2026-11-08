import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLogo } from '../dist/ssr.js';
import { defineLogo, ElideLogoElement } from '../dist/logo.js';

test('SSR emits visible, named artwork and deterministic markup without client JS', () => {
  const markup = renderLogo({ variant: 'blend', height: 40 });
  assert.match(markup, /shadowrootmode="open"/);
  assert.match(markup, /role="img"/);
  assert.match(markup, /aria-label="Elide"/);
  assert.match(markup, /<svg/);
  assert.match(markup, /<style>/);
  assert.doesNotMatch(markup, /<script/);
  assert.equal(markup, renderLogo({ variant: 'blend', height: 40 }));
});

test('untrusted labels and asset prefixes are escaped', () => {
  const markup = renderLogo({ accessibleLabel: '"><script>alert(1)</script>', format: 'png', assetBase: '" onerror="alert(1)' });
  assert.doesNotMatch(markup, /<script| onerror="/);
  assert.match(markup, /&lt;script&gt;/);
});

test('decorative artwork has no accessible image role or label', () => {
  const markup = renderLogo({ decorative: true });
  assert.doesNotMatch(markup, /role="img"|aria-label=/);
  assert.match(markup, /aria-hidden="true"/);
});

test('registration is idempotent and refuses incompatible definitions', () => {
  defineLogo();
  assert.equal(customElements.get('eld-logo'), ElideLogoElement);
  assert.throws(() => defineLogo({ get: () => class Other {} }), /different constructor/);
});
