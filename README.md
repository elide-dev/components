# components

[![codecov](https://codecov.io/gh/elide-dev/components/graph/badge.svg)](https://codecov.io/gh/elide-dev/components)

Elide's shared UI. One repository, consumed by many: the docs site (Astro) and
the marketing site both depend on it, so brand, tokens, and behavior stay in one
place and move together.

## Packages

- **[`@elide/tokens`](./packages/tokens)** — framework-agnostic design tokens
  (CSS variables, Tailwind v4 theme, typed JS object). No framework dependency.
  Depend on this alone if all you need is the palette/type/radius system.
- **`@elide/ui`** — the React/Preact component catalog, built on shadcn + Base UI
  and themed entirely from `@elide/tokens`.
- **`@elide/icons`** — _(planned)_ Lucide, re-exported for React and as raw SVG.

Apps (Storybook, and later the Astro docs site) live under `apps/`.

## Using it from another repo

```jsonc
// package.json in the docs or marketing repo
{
  "dependencies": {
    "@elide/tokens": "^0.1.0",
    "@elide/ui": "^0.1.0"
  }
}
```

```css
/* global stylesheet */
@import "@elide/tokens/fonts.css"; /* self-hosted variable fonts */
@import "tailwindcss";
@import "@elide/tokens/theme.css";
```

```tsx
import { Button, Callout } from "@elide/ui";
```

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the layering, framework-support
matrix (React + Preact), and distribution model, and
**[COMPONENTS.md](./COMPONENTS.md)** for the component inventory and porting order.

The original high-fidelity mockups these components are extracted from live in
`Elide Docs.dc.html` (open it for the visual reference).

## Develop

```bash
bun install
bun run storybook   # catalog + visual dev
bun run build       # build all packages (use `bun run build`, not `bun build`)
bun run changeset   # record a version bump before releasing
```

## Production integration

The packages ship tree-shakeable ES modules targeting ES2022. Import a leaf
component when you want an explicit dependency boundary:

```tsx
import { Button } from "@elide/ui/components/button";
import { CopyCommand } from "@elide/ui/components/copy-command";
import "@elide/ui/styles.css";
```

The stylesheet requires Tailwind CSS 4 in the consuming build. It includes
self-hosted variable WOFF2 fonts with `font-display: swap` and Unicode subsets;
unused scripts are not downloaded. Catalog story styles are excluded. For a
custom Tailwind pipeline, import the tokens/theme and scan the component sources
you use. Inter remains the body font from the design mandate, Instrument Sans
is for display text, and JetBrains Mono is for code and labels.

Colors use sRGB gradient fallbacks, OKLCH stops, Oklab interpolation, and
feature-detected relative colors. The supported browser baseline is Tailwind 4's
modern browser baseline; these enhancements do not imply legacy-browser support
or HDR output. Hover surfaces crossfade with opacity, and press/overlay motion
uses transforms without permanent GPU layer allocation. Reduced motion and
forced colors are respected. Controls suppress accidental text selection;
prose, inputs, and code remain selectable.

Use native controls and meaningful accessible names. Icon-only buttons require
an `aria-label`; dialog titles/descriptions and tab-list labels remain the
consumer's responsibility. Do not add redundant roles to native links/buttons.
ES modules work with bundlers; raw browser use needs a dependency resolver or
import map and precompiled CSS. An import map is application configuration, not
something this library injects.

## Performance example

`apps/benchmark` is a prerendered production consumer covering buttons, tabs,
dialogs, switches, cards, accordions, and copy controls. Its initial content is
available before JavaScript executes. From the repository root:

```sh
bun run build
bun run test
bun run --filter @elide/benchmark preview
# In another terminal, with Chrome installed:
bun run --filter @elide/benchmark audit
```

The test starts its own preview server and checks mobile layout, both themes,
keyboard interaction, dialog focus return, selection, reduced motion, and forced
colors. Leaf imports have a 14 KB gzip budget each (React external), including
shared class utilities. The catalog additionally fails on automated accessibility
violations. These checks supplement visual and assistive-technology review.

Lighthouse 13.6.0 scored **100 performance / 100 accessibility / 100 best
practices / 100 SEO / 100 agentic browsing** on the local production example in
mobile simulation on November 6, 2026. This is a measured example, not a guarantee
for consuming sites or Storybook. Scores depend on hosting, content, device, and
network conditions. The example includes `robots.txt` and `llms.txt`; it exposes
no agent service and does not advertise an ARD endpoint. Unknown paths return
404. Production hosting should compress responses and cache hashed assets with
`Cache-Control: public, max-age=31536000, immutable`, while allowing HTML to
revalidate.
