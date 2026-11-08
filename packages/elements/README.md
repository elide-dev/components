# Elide elements

The first portable component is `<eld-logo>`, built with Lit and the exact
geometry from `@elide/brand`. It requires neither React nor Tailwind. The existing
React logo, legacy mark, and standalone wordmark remain available unchanged.

## Browser usage

```ts
import '@elide/tokens/tokens.css'; // theme variables; no Tailwind compilation
import '@elide/elements/define/logo';
```

```html
<eld-logo form="full" variant="blend" height="40" accessible-label="Elide"></eld-logo>
<eld-logo form="square" variant="mono" decorative></eld-logo>
```

The definition entry registers the tag; `@elide/elements/logo` exports
`ElideLogoElement` and `defineLogo()` without registering it. Use one version per
document. Incompatible duplicate registrations throw rather than silently using
the wrong constructor. Inputs can be set before upgrade through ordinary HTML
attributes or updated afterward as typed properties.

| Property | Attribute | Default |
| --- | --- | --- |
| `form` | `form` | `full` (`full`, `square`) |
| `variant` | `variant` | `gradient` (`gradient`, `mono`, `blend`) |
| `format` | `format` | `svg` (`svg`, `png`, `webp`, `avif`) |
| `linked` | `linked` | false; use an external SVG image |
| `height` | `height` | 24 px; width follows artwork aspect |
| `accessibleLabel` | `accessible-label` | `Elide` |
| `decorative` | `decorative` | false; hide the artwork from assistive technology |
| `assetBase` | `asset-base` | `/brand` |

Boolean attributes use HTML presence semantics: omit `decorative` for false;
`decorative="false"` still means true. Invalid form/variant/format values fall
back to defaults, as do nonpositive/nonfinite heights. Properties do not reflect
back to attributes. Await `element.updateComplete` to observe an update.

SVG is inline by default. For linked SVG or raster formats, serve
`@elide/brand/assets` beneath `assetBase`. Raster images include 2x/3x source sets.
Both theme cuts may download; CSS chooses the visible image, independently of OS
preference. Theme selection uses inherited `--eld-brand-light-display` and
`--eld-brand-dark-display` variables from tokens. Explicit light subtrees reset
these asset selectors; this does not add a complete nested light palette to the
existing token system.

## Styling and semantics

Classes/styles target the custom-element host. Use `--eld-logo-height` to resize
the artwork through CSS, and `--eld-logo-color` or `color` for mono/blend fills.
The default color is `--foreground` when tokens are present. `::part(artwork)`
exposes the named visual frame. Internal SVG selectors do not cross the shadow
boundary. The host is inline-block with a middle baseline alignment.

The internal frame owns the accessible image name, including in no-JavaScript
SSR and when raster theme cuts swap. Do not add a second image role/name to the
host; use `accessible-label` and `decorative`. Native `title` retains its usual
HTML meaning. Put the logo inside an ordinary link for navigation.

## React and Preact

```tsx
import { ElideLogo } from '@elide/ui/elements/logo';

<ElideLogo variant="blend" height={40} title="Elide" />
```

This additive adapter accepts the existing logo props, maps `title` to the
accessible label and `markOnly` to square form, and forwards a ref to
`ElideLogoElement`. It does not replace `@elide/ui/components/elide-logo`.
Changing native SVG/image refs or descendant CSS is a consumer migration.
Existing React HTML event props are attached to the host. Preact uses the same
`preact/compat` setup documented in the root README.

The adapter is for client rendering. Ordinary React SSR emits a host without
its shadow content. Use the existing React logo for React SSR, or the explicit
server renderer below for a static website. No general React/Lit SSR integration
is claimed by this pilot.

## Server rendering

```ts
// Node/server entry, deliberately unavailable through browser export conditions.
import { renderLogo } from '@elide/elements/ssr';
const markup = renderLogo({ variant: 'blend', height: 40 });
```

Insert this trusted rendered markup through the site's HTML output mechanism.
The helper escapes input strings and emits declarative shadow DOM, SVG/images,
accessible semantics, and critical styles. The page still loads token CSS once.
Static use requires **no client JavaScript** in browsers supporting declarative
shadow DOM. Plain brand SVG assets remain an alternative for other contexts.

For later interactive updates, load hydration support **before any Lit import**:

```ts
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
await import('@elide/elements/define/logo');
```

Install `@lit-labs/ssr-client` in the consumer if upgrading SSR markup. The fixture
pins version 1.1.8; the server package pins `@lit-labs/ssr` 4.1.0. These Lit Labs
APIs remain experimental. The stylesheet contains dynamic size values, so a
strict CSP deployment must explicitly validate its inline-style policy.

## Validation and scope

Run `bun run test:elements` from the root. The production consumer verifies:
no React/server runtime in the plain bundle; a 14 KB gzip JS ceiling including
Lit; no-JavaScript SSR; retained SVG identity/geometry through hydration; theme
selection; accessible/decorative modes; property updates; and 60 comparisons
against the existing React rendering per browser. Pixel comparisons permit at
most 0.1 mean absolute error per 8-bit channel for antialiasing differences.

Run `BROWSERS=firefox,webkit node check.mjs` in `apps/elements` after building to
exercise the other installed Playwright engines. `bun run test:preact` verifies
adapter property updates in the existing Preact client/hydration fixture.
Storybook's `Brand/ElideLogoElement` stories provide the visual review surface.

This is the logo vertical slice. CopyCommand, playback, generated custom-element
manifests, and broader migration remain subsequent work in the
[architecture](../../docs/web-components-architecture.md). No CPU or memory
improvement is claimed from this static-logo pilot.
