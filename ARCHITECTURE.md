# Architecture

## Direction

The target architecture is **selective Lit Web Components with thin React
adapters**, alongside static HTML/SVG and the existing React/Base UI catalog.
Optimize shipped bytes, update locality, CPU, and retained memory while preserving
visual and accessibility quality. The implementation and support matrix below
describe the established catalog. The first additive slice is now available in
[`@elide/elements`](./packages/elements/README.md): the Lit logo, explicit SSR,
and a React/Preact adapter. Other migrations remain planned.

See [Web Components architecture](./docs/web-components-architecture.md) for
package boundaries, Shadow DOM CSS, rendering and SSR contracts, performance
acceptance criteria, and the migration sequence. This supersedes the previous
decision to exclude Lit. Migration is component-by-component, not a catalog rewrite.

## Goals

1. One source of truth for Elide's UI, consumed by **multiple repos** (docs site,
   marketing site, future apps).
2. **Tokens are independent** of components — usable on their own anywhere.
3. Portable components use native custom elements and Lit; **React and Preact**
   remain supported through tested adapters. Static content needs no client runtime.
4. Retain **shadcn + Base UI** for behavior-heavy React primitives until a native
   replacement passes equivalent accessibility, behavior, and performance checks.
5. A published **catalog** (Storybook + Chromatic) that doubles as the review and
   visual-regression surface.

## Current layers

```
┌─────────────────────────────────────────────────────────────┐
│  apps/           docs (Astro)   ·   marketing   ·   storybook │  consume
├─────────────────────────────────────────────────────────────┤
│  @elide/ui       composites (AppNav, Sidebar, CodeBlock, …)   │  React/Preact
│                  primitives  (Button, Dialog, Combobox, …)    │
├─────────────────────────────────────────────────────────────┤
│  @elide/icons    Lucide (react re-exports + raw SVG)          │  framework-agnostic
├─────────────────────────────────────────────────────────────┤
│  @elide/brand    logo geometry · svg/png/webp/avif renditions │  framework-agnostic
├─────────────────────────────────────────────────────────────┤
│  @elide/tokens   CSS vars · Tailwind theme · typed JS object  │  framework-agnostic
└─────────────────────────────────────────────────────────────┘
```

Today the **framework line** sits between `@elide/ui` (React) and everything below
it. The target adds `@elide/elements` below that line and React adapters in
`@elide/ui`; dependencies must never flow from elements back into React packages.

## Current framework support

| Target | Components | Tokens |
| --- | --- | --- |
| **React** (19.2.8+) | ✅ primary, tested | ✅ |
| **Preact** (11.2) | Supported via `preact/compat`; maintained Chromium consumer smoke | ✅ |
| Plain browser / static HTML | Opt-in `eld-logo` pilot; explicit SSR | ✅ |
| Non-web consumers (native, Figma…) | — | ✅ tokens only |

**Preact** uses the same published React API through `preact/compat`, configured
in the consumer's bundler and TypeScript resolver. The aliases must apply to
client and server builds, including transitive dependencies and JSX runtimes.
See the [consumer setup](./README.md#preact) and [`apps/preact`](./apps/preact).
That fixture checks a production build without the React runtime, typechecking,
SSR/hydration, and representative keyboard and overlay focus behavior in Chromium.
React remains the primary full-catalog test environment; the Preact smoke does
not cover every component or browser. Validate application-specific integration.
Guidelines that keep us compat-safe:

- No React-internal imports; only the public API.
- Prefer `ref` callbacks / `useRef`; avoid `findDOMNode` and legacy context.
- No `react-dom/server` assumptions in components (SSR is the app's concern).

## Building on shadcn + Base UI

The behavior-heavy, accessible primitives (Dialog, Popover, DropdownMenu,
Combobox/Command, Tooltip, Tabs, Select, Sheet, NavigationMenu, ScrollArea,
Accordion) are **generated from the shadcn Base-UI registry**, not hand-authored:

```bash
bunx shadcn@latest add dialog popover command tabs tooltip
```

We then (a) point shadcn's `components.json` at `@elide/ui` and our Tailwind
config, and (b) re-theme the generated files by deleting shadcn's default color
vars and letting them inherit from `@elide/tokens`. Leaf/presentational pieces
that shadcn doesn't own (Callout, CodeBlock, StatStrip, ApiMethod, the docs
composites) are authored by hand in the same CVA + tokens style — see
`packages/ui/src/components/{button,badge,callout}.tsx` for the established
pattern.

**Styling:** Tailwind v4, with the theme bridged from tokens
(`@elide/tokens/theme.css`). Component internals use utility classes; every color
/ radius / font resolves to a token `var()`, so dark mode is a class toggle and
consumers can retheme by overriding tokens only.
Shared rules in `@elide/ui/platform.css` provide intrinsic/container layouts,
overlay transitions, optional native anchors, and document rendering features.
`@elide/ui/styles.css` includes them; custom Tailwind pipelines must import them.

Migrated elements use scoped CSS and inherited tokens instead of relying on
global Tailwind selectors inside shadow roots. Tailwind remains supported for
consumer layouts and unmigrated React components. The target CSS contract is
defined in the [Web Components design](./docs/web-components-architecture.md#css-and-theming).

## Distribution

Dual model, both backed by the same source:

1. **npm packages** (`@elide/tokens`, `@elide/ui`) — the default for the docs and
   marketing repos. Versioned with **changesets**.
2. **shadcn registry** — publish our composites as a registry so any repo can
   `shadcn add` them as vendored source when it needs to fork/customize. Good for
   the gradual marketing-site migration.

## Catalog: Storybook + Chromatic

- Storybook 10 (Vite builder) in `apps/storybook`.
- Every component ships stories covering its variants **× light/dark**.
- Addons: a11y (axe), interaction tests (`@storybook/test`).
- **Chromatic** runs on every PR for visual regression and is the review surface;
  a story is the definition of done for a component.

## Porting order

The original catalog development order below remains useful for React components.
For Lit adoption, follow the gated [migration sequence](./docs/web-components-architecture.md#migration-sequence).

Leaf → composite → template, so dependencies land before dependents:

1. Tokens (done) → 2. leaf primitives (Button, Badge, Callout, CodeBlock,
CopyButton) → 3. Base-UI primitives via registry (Tooltip, Popover, Dialog,
Command, Tabs…) → 4. docs composites (AppNav, Sidebar, TOC, PageFooterNav) →
5. page templates (article, section landing, API reference) → 6. marketing
widgets. See COMPONENTS.md.

## Repo layout

```
components/
├─ package.json            # bun workspaces + turbo
├─ bun.lock
├─ ARCHITECTURE.md
├─ COMPONENTS.md
├─ packages/
│  ├─ tokens/              # @elide/tokens  (done)
│  ├─ brand/               # @elide/brand   (done)
│  ├─ ui/                  # @elide/ui      (exemplars landed)
│  └─ icons/               # @elide/icons   (planned)
└─ apps/
   ├─ storybook/           # catalog + browser interaction/a11y tests
   ├─ benchmark/           # prerendered production consumers + platform checks
   ├─ preact/              # compat consumer, SSR/hydration + Chromium smoke
   └─ docs/                # Astro docs site (planned)
```
