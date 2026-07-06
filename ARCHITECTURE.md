# Architecture

## Goals

1. One source of truth for Elide's UI, consumed by **multiple repos** (docs site,
   marketing site, future apps).
2. **Tokens are independent** of components — usable on their own anywhere.
3. Components run in **React and Preact**. (Lit / web components are explicitly
   out of scope for components; the tokens remain usable from anything.)
4. Build **on top of shadcn's Base-UI rewrite** rather than reinventing
   primitives.
5. A published **catalog** (Storybook + Chromatic) that doubles as the review and
   visual-regression surface.

## Layers

```
┌─────────────────────────────────────────────────────────────┐
│  apps/           docs (Astro)   ·   marketing   ·   storybook │  consume
├─────────────────────────────────────────────────────────────┤
│  @elide/ui       composites (AppNav, Sidebar, CodeBlock, …)   │  React/Preact
│                  primitives  (Button, Dialog, Combobox, …)    │
├─────────────────────────────────────────────────────────────┤
│  @elide/icons    Lucide (react re-exports + raw SVG)          │  framework-agnostic
├─────────────────────────────────────────────────────────────┤
│  @elide/tokens   CSS vars · Tailwind theme · typed JS object  │  framework-agnostic
└─────────────────────────────────────────────────────────────┘
```

The **framework line** sits between `@elide/ui` (React) and everything below it.
Anything below the line is portable to any target; anything above is React/Preact.

## Framework support

| Target | Components | Tokens |
| --- | --- | --- |
| **React** (18+) | ✅ primary | ✅ |
| **Preact** | ✅ via `preact/compat` alias | ✅ |
| Anything else (Astro static, native, Figma…) | — | ✅ tokens only |

**Preact** works by aliasing `react`/`react-dom` → `preact/compat` in the
consumer's bundler. Base UI and our components are written against the React API
and render under compat within reason. We keep a Preact smoke app in CI so the
boundary can't silently break. Guidelines that keep us compat-safe:

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

## Distribution

Dual model, both backed by the same source:

1. **npm packages** (`@elide/tokens`, `@elide/ui`) — the default for the docs and
   marketing repos. Versioned with **changesets**.
2. **shadcn registry** — publish our composites as a registry so any repo can
   `shadcn add` them as vendored source when it needs to fork/customize. Good for
   the gradual marketing-site migration.

## Catalog: Storybook + Chromatic

- Storybook 8 (Vite builder) in `apps/storybook`.
- Every component ships stories covering its variants **× light/dark**.
- Addons: a11y (axe), interaction tests (`@storybook/test`).
- **Chromatic** runs on every PR for visual regression and is the review surface;
  a story is the definition of done for a component.

## Porting order

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
│  ├─ ui/                  # @elide/ui      (exemplars landed)
│  └─ icons/               # @elide/icons   (planned)
└─ apps/
   ├─ storybook/           # catalog (planned)
   └─ docs/                # Astro docs site (planned)
```
