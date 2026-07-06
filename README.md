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
@import "@elide/tokens/fonts.css"; /* must be first — remote @import */
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
