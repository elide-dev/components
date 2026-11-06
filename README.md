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
@import "@elide/ui/platform.css";
@source "./node_modules/@elide/ui/src/components"; /* relative to this stylesheet */
@custom-variant dark (&:where(.dark, .dark *));
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

## Updating dependencies and shadcn

The shadcn CLI is pinned to **4.23.0** in `@elide/ui`. Components are owned source,
not a versioned shadcn runtime. Inspect registry changes before applying them:

```sh
bun --bun run --cwd packages/ui shadcn info
bun --bun run --cwd packages/ui shadcn add dialog select --dry-run
bun --bun run --cwd packages/ui shadcn add dialog --diff src/components/dialog.tsx
```

Our `base-nova` components preserve the upstream Base UI composition while
customizing tokens, animation and accessibility. Merge relevant upstream changes
selectively; blanket overwrite or preset application would replace those choices.
The docs `Sidebar` has a different API from shadcn's application sidebar.
See the [CLI documentation](https://ui.shadcn.com/docs/cli) and
[cloud component priorities](./COMPONENTS.md#cloud-component-priorities).

The November 6, 2026 refresh updates Storybook to 10.6.6, Tailwind to 4.3.5,
Vitest to 5.1.0, Vite to 8.3.6, React's Vite plugin to 6.2.1, Playwright to 1.65.0,
Lucide to 1.70.0, Chromatic to 18.14.2, globals to 17.14.0, and jsdom to 31.0.0.
Base UI 1.9.0 and React 19.3.1 were already current. Keep these coupled packages
aligned across workspaces when updating them.

Workspace TypeScript remains 6.0.3 because tsup's declaration generation uses its
JavaScript compiler API; TypeScript 7 at the root does not provide that API.
The newer shadcn `cn` package was checked against 30,753 repository class cases
without a mismatch, but its full merger measured 11,031 bytes gzip versus 8,783
for the existing helper. Keep `clsx` + `tailwind-merge` until a library-safe
migration improves the delivery cost as well as merge performance.

Scoped `glob@13` and `minimatch@10` overrides select 14.0.4 and 11.0.5 together
to fix their matching/traversal advisories. Their used APIs and repository
patterns were checked; remove the overrides when upstream consumers upgrade.
`bun audit` still reports two development-tool findings: the Codecov build
plugin's Zod 3 dependency ([advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5))
and shadcn's unpatched deepmerge dependency
([advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)). Neither is a
component runtime dependency. Do not force Zod 4 into the plugin's Zod 3 API
contract or silently replace deepmerge to make the audit count disappear.

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
custom Tailwind pipeline, import the tokens/theme and `@elide/ui/platform.css`,
then scan the component sources you use. Inter remains the body font from the design mandate, Instrument Sans
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

## Preact

`@elide/ui` supports Preact 11.2 through `preact/compat`. Its published imports,
types, and React peer dependencies retain the React API contract; there is no
separate native Preact build. The maintained [`apps/preact`](./apps/preact)
consumer checks typechecking, production bundling, SSR/hydration, and representative
keyboard and overlay focus behavior in Chromium. React remains the primary
full-catalog test environment.

Keep the React peer packages installed for dependency resolution; the aliases
replace their runtime code in the application bundles.

Use [`@preact/preset-vite`](https://preactjs.com/guide/v11/getting-started/#aliasing-react-to-preact)
to configure JSX and runtime aliases. For SSR, bundle dependencies that import
React so their imports pass through those aliases too:

```ts
// vite.config.ts
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [preact()],
  resolve: { dedupe: ["preact"] },
  ssr: { noExternal: true },
});
```

`noExternal: true` is the simple configuration used by our fixture. Applications
can narrow it to their React-using dependency graph; leaving a dependency external
can bypass the bundler aliases and load React on the server. Render the server
tree with `preact-render-to-string`, then hydrate it with Preact.

For other bundlers, apply these exact aliases in both client and server builds:

| Import | Replacement |
| --- | --- |
| `react`, `react-dom` | `preact/compat` |
| `react-dom/client` | `preact/compat/client` |
| `react/jsx-runtime` | `preact/jsx-runtime` |
| `react/jsx-dev-runtime` | `preact/jsx-dev-runtime` |

TypeScript needs matching resolution independently of the bundler. `skipLibCheck`
accommodates Base UI's React-specific declarations; application code can retain
strict typechecking:

```jsonc
// tsconfig.json; paths are relative to this file
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "skipLibCheck": true,
    "paths": {
      "react": ["./node_modules/preact/compat"],
      "react-dom": ["./node_modules/preact/compat"],
      "react-dom/*": ["./node_modules/preact/compat/*"],
      "react/jsx-runtime": ["./node_modules/preact/jsx-runtime"],
      "react/jsx-dev-runtime": ["./node_modules/preact/jsx-runtime"]
    }
  }
}
```

The existing CSS setup applies unchanged. Run the maintained consumer locally
with `bun run test:preact`; it also rejects React runtime modules in the generated
bundles. Validate the components and framework integration used by your app;
this smoke suite is not exhaustive catalog or cross-browser coverage.

## Progressive platform features

The theme sets `color-scheme` so native browser controls match the selected mode.
Supported browsers use `light-dark()` for paired colors and `alpha()` to adjust
opacity without converting wide-gamut overrides. Filled button borders use
`background-clip: border-area`. Each enhancement retains its existing CSS fallback
and preserves the approved palette.

`CardGrid` and `StatStrip` wrap to fit their parent, with `columns` setting a maximum.
Named container queries refine cell spacing; set `--eld-density: compact` on their
container or an ancestor for tighter spacing where style queries are supported.
Dialog footers respond to dialog width. The intrinsic grid layout works without
container queries. Overlays use interruptible opacity/scale transitions,
`@starting-style`, and discrete transitions where supported; Base UI's lifecycle
attributes supply the fallback. Reduced motion disables overlay animation.

`AnchoredPopover` opts into CSS anchor positioning with Base UI focus management,
Escape/outside dismissal, and accessible naming. Unsupported browsers use the
existing floating positioner; `positioning="floating"` explicitly selects it.
An already open or focused instance retains its floating renderer during
hydration to preserve focus and child state.
Use the existing `Popover` for virtual anchors or custom clipping boundaries.

```tsx
import { AnchoredPopover, Button, DeferredContent, ReadingProgress } from "@elide/ui";

<>
  <AnchoredPopover trigger={<Button>Project details</Button>} title="Project details">
    <p>Details and actions for this project.</p>
  </AnchoredPopover>
  <ReadingProgress />
  <section>
    {/* Keep headings outside containment; estimate the body's real height. */}
    <h2 id="configuration">Configuration</h2>
    <DeferredContent intrinsicBlockSize="42rem">{/* Expensive body */}</DeferredContent>
  </section>
</>
```

`DeferredContent` skips offscreen layout/paint, not React rendering or network
requests. Avoid wrapping sticky/fixed content or non-portaled overlays. Printing
restores full rendering. `ReadingProgress` follows the root document scroll
timeline without JavaScript scroll listeners; it is decorative and hidden for
reduced motion, printing, or unsupported browsers. Pair it with headings and a
table of contents for accessible navigation.

## Performance example

`apps/benchmark` is a prerendered production consumer covering buttons, tabs,
dialogs, switches, cards, accordions, and copy controls. Its initial content is
available before JavaScript executes. `/platform.html` exercises container
layouts, native/floating overlays, reduced motion, and long-document rendering.
From the repository root:

```sh
bun run build
bun run test
bun run --filter @elide/benchmark preview
# In another terminal, with Chrome installed:
bun run --filter @elide/benchmark audit
# Optional local cross-browser sweep (CI runs Chromium):
bun apps/benchmark/node_modules/playwright/cli.js install firefox webkit
BROWSERS=chromium,firefox,webkit bun --cwd apps/benchmark platform-check.mjs
```

The test starts its own preview server and checks mobile layout, both themes,
keyboard interaction, dialog focus return, selection, reduced motion, and forced
colors. Leaf imports have a 14 KB gzip budget each (React external), including
shared class utilities. Platform checks compare enhanced and fallback theme
colors, test native/floating and nested focus behavior, viewport collision,
responsive containers, scroll progress, print, and reduced motion. The catalog additionally fails on automated accessibility
violations. These checks supplement visual and assistive-technology review.

Lighthouse 13.6.0 scored **100 performance / 100 accessibility / 100 best
practices / 100 SEO / 100 agentic browsing** on both local production examples in
mobile simulation on November 6, 2026. These are measured examples, not a guarantee
for consuming sites or Storybook. Scores depend on hosting, content, device, and
network conditions. The example includes `robots.txt` and `llms.txt`; it exposes
no agent service and does not advertise an ARD endpoint. Unknown paths return
404. Production hosting should compress responses and cache hashed assets with
`Cache-Control: public, max-age=31536000, immutable`, while allowing HTML to
revalidate.
