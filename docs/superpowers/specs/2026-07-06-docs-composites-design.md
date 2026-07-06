# Design: Docs-shell composites — cycle 1 (test setup + ThemeProvider + Breadcrumbs + PageFooterNav)

**Date:** 2026-07-06
**Status:** Approved
**Branch / delivery:** `feat/docs-composites` → PR into `main`.

## Goal

Stand up the component test toolchain, then ship the first docs-shell composites —
`ThemeProvider`/`useTheme`, `Breadcrumbs`, `PageFooterNav` — each with a story that
doubles as an interaction test. Later PRs add `Sidebar`, `AppNav`, `SectionTabs`,
`TableOfContents`.

## Background

- `@elide/ui`: Bun + Turbo, tsup `--dts`, ESLint flat, themed from `@elide/tokens`.
  10 Base UI primitives already shipped. Storybook 10 (`apps/storybook`), Chromatic
  visual tests, GitHub Actions CI (build / lint / storybook / chromatic).
- No unit/interaction test framework exists yet.
- Authoritative visual source: `Elide Docs.dc.html` (rendered in Chrome for diffing).

## Non-goals

- No `Sidebar`, `AppNav`, `SectionTabs`, `TableOfContents` this cycle (next PRs).
- No `CommandPalette`, API-reference, or marketing components.
- No package publishing.

## Test infrastructure

- **Approach:** Storybook 10 + the Vitest addon. Every story runs as a test in Vitest
  **browser mode** (real Chromium via Playwright); interaction assertions live in each
  story's `play` function. This reuses stories, renders Base UI portals/focus correctly,
  and complements Chromatic (visual) rather than duplicating it.
- **Packages** (in `apps/storybook`): `vitest`, `@vitest/browser`, `playwright`,
  `@storybook/addon-vitest` (exact versions pinned at implementation, verified against
  the Storybook 10 docs).
- **Config:** a `vitest.config.ts` using Storybook's Vitest plugin + browser provider
  (chromium, headless), a `.storybook/vitest.setup.ts`, and `@storybook/addon-vitest`
  registered in `.storybook/main.ts`.
- **Scripts:** `test` = `vitest run` (app + a root Turbo `test` task).
- **CI:** new reusable `check.test.yml` — installs Playwright Chromium, runs the tests —
  wired into `on.pr.yml` and `on.push.yml`.

## Components (all in `packages/ui/src`, exported from `index.ts`, themed from tokens)

### `ThemeProvider` / `useTheme` (`components/theme-provider.tsx`)
- `ThemeProvider` sets `.dark` class + `data-theme` on `document.documentElement`,
  persists the choice to `localStorage` (key `eld-theme`), and initializes from stored
  value or `prefers-color-scheme`.
- `useTheme()` → `{ theme: "light" | "dark", setTheme(t), toggle() }`.
- SSR-safe: no `window` access during render; effects apply on mount.
- Rationale for document-level: Base UI overlays portal to `<body>`, so theme must live
  on the root element (matches the Storybook decorator already in place).

### `Breadcrumbs` (`components/breadcrumbs.tsx`)
- Props: `segments: { label: string; href?: string }[]`, plus standard `nav` attrs.
- Renders `<nav aria-label="Breadcrumb">` → ordered list; non-final segments are links
  (or plain text if no `href`), separated by a chevron (`lucide-react` `ChevronRight`);
  the final segment is plain text with `aria-current="page"`.
- Tokens: `text-muted-foreground`, hover `text-foreground`; current is `text-foreground`.
- Mockup source: the breadcrumb above the page title (`Runtime › Guides › Debugging`).

### `PageFooterNav` (`components/page-footer-nav.tsx`)
- Props: `prev?: { label: string; href: string }`, `next?: { label: string; href: string }`.
- Two bordered cards: prev (left, back arrow + "Previous" eyebrow) and next (right-aligned,
  "Next" eyebrow + forward arrow). Either may be absent; a lone `next` stays right-aligned.
- Tokens: `border`, `bg-card` hover, `text-muted-foreground` eyebrow, `text-foreground` label.
- Mockup source: the bottom prev/next "related pages" cards.

## Testing (per component, as story `play` functions)

- **Breadcrumbs:** renders all segment labels; the last item has `aria-current="page"`;
  non-final items with `href` are links.
- **PageFooterNav:** prev/next labels + `href`s render; with only `next`, no prev card
  exists and next is right-aligned.
- **ThemeProvider:** a story with a toggle button; `play` clicks it and asserts
  `document.documentElement.classList` flips `dark`, and `useTheme().theme` updates.

## Definition of done (this PR)

- Test toolchain runs: `bun run test` executes story tests in Chromium and passes.
- `ThemeProvider`/`useTheme`, `Breadcrumbs`, `PageFooterNav` implemented, exported, themed
  from tokens (no hardcoded color), each with a story + `play` test.
- `check.test.yml` added and wired into both CI entrypoints; actionlint clean.
- `bun run build`, `bun run lint`, `bun run test` green locally; composites visually match
  their mockup regions.
- `COMPONENTS.md` statuses updated. PR opened into `main`.
