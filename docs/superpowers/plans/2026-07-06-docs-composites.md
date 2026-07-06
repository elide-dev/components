# Docs Composites — Cycle 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Stand up Storybook-Vitest testing, then ship `ThemeProvider`/`useTheme`, `Breadcrumbs`, and `PageFooterNav` with story-based interaction tests, on `feat/docs-composites` toward a PR.

**Architecture:** Components live in `@elide/ui`, themed from `@elide/tokens`. Tests are Storybook stories run in Vitest browser mode (real Chromium) via `@storybook/addon-vitest`; assertions live in `play` functions.

**Tech Stack:** Bun + Turbo, React 19, Base UI, Storybook 10.4.6, Vitest 4.1.10 (browser mode), Playwright 1.61.1, ESLint flat, Chromatic, GitHub Actions.

## Global Constraints

- No hardcoded color — only token-backed utilities from `@elide/tokens`.
- Bun scripts (`bun run …`); filtered turbo via `bunx turbo run <task> --filter=…`.
- Commit per task on `feat/docs-composites`; open a PR at the end. Co-author trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Every component: exported from `packages/ui/src/index.ts`, has a story with a `play` test,
  and ends green on `bun run build` + `bun run lint` + `bun run test`.
- Pin test deps: `@storybook/addon-vitest@^10.4.6`, `vitest@^4.1.10`, `@vitest/browser@^4.1.10`,
  `@vitest/coverage-v8@^4.1.10`, `playwright@^1.61.1`.

---

## File Structure

- **Create** `apps/storybook/vitest.config.ts` — Vitest browser config + Storybook plugin.
- **Create** `apps/storybook/.storybook/vitest.setup.ts` — Storybook project annotations for tests.
- **Modify** `apps/storybook/.storybook/main.ts` — register `@storybook/addon-vitest`.
- **Modify** `apps/storybook/package.json` — test deps + `test` script.
- **Modify** `packages/ui/package.json` — (no test deps; ui has no stories run here).
- **Modify** `turbo.json` — add a `test` task.
- **Modify** root `package.json` — `test` script (`turbo run test`).
- **Create** `.github/workflows/check.test.yml` + **modify** `on.pr.yml`, `on.push.yml`.
- **Create** `packages/ui/src/components/theme-provider.tsx`, `breadcrumbs.tsx`, `page-footer-nav.tsx`.
- **Create** `packages/ui/src/stories/{Theme,Breadcrumbs,PageFooterNav}.stories.tsx`.
- **Modify** `packages/ui/src/index.ts`, `COMPONENTS.md`.

---

### Task 1: Test infrastructure

**Files:** create `apps/storybook/vitest.config.ts`, `apps/storybook/.storybook/vitest.setup.ts`; modify `apps/storybook/.storybook/main.ts`, `apps/storybook/package.json`, `turbo.json`, root `package.json`.

- [ ] **Step 1: Add deps** to `apps/storybook/package.json` devDependencies (versions above) and a `"test": "vitest run"` script. `bun install`.
- [ ] **Step 2: Verify the plugin import path** — read `node_modules/@storybook/addon-vitest/package.json` `exports` and use the documented `@storybook/addon-vitest/vitest-plugin` (or the actual subpath it exposes). Record it.
- [ ] **Step 3: `vitest.config.ts`** — browser mode, chromium, headless, using Storybook's `storybookTest` plugin pointed at `.storybook`, with `vitest.setup.ts` as setup file. Concrete shape:

```ts
import { defineConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

export default defineConfig({
  plugins: [storybookTest({ configDir: ".storybook" })],
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      provider: "playwright",
      headless: true,
      instances: [{ browser: "chromium" }],
    },
    setupFiles: [".storybook/vitest.setup.ts"],
  },
});
```

- [ ] **Step 4: `.storybook/vitest.setup.ts`**:

```ts
import { beforeAll } from "vitest";
import { setProjectAnnotations } from "@storybook/react-vite";
import * as preview from "./preview";

const project = setProjectAnnotations([preview]);
beforeAll(project.beforeAll);
```

- [ ] **Step 5: Register addon** in `.storybook/main.ts` `addons`: add `"@storybook/addon-vitest"`.
- [ ] **Step 6: Root `test` script + turbo task** — root `package.json`: `"test": "turbo run test"`; `turbo.json` `tasks.test` (dependsOn `^build`, no cache or outputs).
- [ ] **Step 7: Install Playwright chromium locally** — `bunx playwright install chromium` — and run `bun run test`. Expected: existing primitive stories run as tests and pass (0 failures). Fix config until green.
- [ ] **Step 8: CI `check.test.yml`** — reusable workflow mirroring `check.lint.yml`, but: install deps, `bunx playwright install --with-deps chromium`, then `bun run test`. Wire a `test` job into `on.pr.yml` and `on.push.yml` (permissions: contents read, secrets: inherit). Run `actionlint` — clean.
- [ ] **Step 9: Commit** `feat(test): Storybook + Vitest browser-mode testing and CI`.

---

### Task 2: ThemeProvider / useTheme

**Files:** create `packages/ui/src/components/theme-provider.tsx`, `packages/ui/src/stories/Theme.stories.tsx`; modify `packages/ui/src/index.ts`, `COMPONENTS.md`.

**Interfaces produced:** `ThemeProvider` (props: `children`, `defaultTheme?: "light" | "dark"`, `storageKey?: string`), `useTheme(): { theme: "light" | "dark"; setTheme: (t) => void; toggle: () => void }`.

- [ ] **Step 1: Implement** `theme-provider.tsx`:
  - React context holding `theme`. On mount, initialize from `localStorage[storageKey]` (default `"eld-theme"`) or `matchMedia("(prefers-color-scheme: dark)")`.
  - Effect writes `.dark` class + `data-theme` on `document.documentElement` and persists to `localStorage`.
  - `useTheme` throws if used outside provider.
  - No `window`/`document` access during render (guard effects) for SSR safety.
- [ ] **Step 2: Export** from `index.ts`: `export { ThemeProvider, useTheme } from "./components/theme-provider";`.
- [ ] **Step 3: Story + play test** `Theme.stories.tsx` — a story rendering a `Button` wired to `useTheme().toggle()` inside `ThemeProvider`. `play`:

```ts
import { expect, userEvent, within } from "storybook/test";
// ...
play: async ({ canvasElement }) => {
  const btn = within(canvasElement).getByRole("button");
  const before = document.documentElement.classList.contains("dark");
  await userEvent.click(btn);
  await expect(document.documentElement.classList.contains("dark")).toBe(!before);
},
```

- [ ] **Step 4: Verify** `bun run build && bun run lint && bun run test` — green. Mark `ThemeProvider` done in `COMPONENTS.md`.
- [ ] **Step 5: Commit** `feat(ui): ThemeProvider + useTheme`.

---

### Task 3: Breadcrumbs

**Files:** create `packages/ui/src/components/breadcrumbs.tsx`, `packages/ui/src/stories/Breadcrumbs.stories.tsx`; modify `index.ts`, `COMPONENTS.md`.

**Interfaces produced:** `Breadcrumbs` (props: `segments: { label: string; href?: string }[]` & `React.ComponentProps<"nav">`), `type BreadcrumbSegment`.

- [ ] **Step 1: Implement** `breadcrumbs.tsx`:
  - `<nav aria-label="Breadcrumb">` → `<ol class="flex items-center gap-1.5 text-sm">`.
  - Each non-final segment: `href` → `<a class="text-muted-foreground hover:text-foreground">`; else `<span class="text-muted-foreground">`. Separator `<ChevronRight class="h-4 w-4 text-muted-foreground/60">` between items (lucide-react).
  - Final segment: `<span class="text-foreground font-medium" aria-current="page">`.
- [ ] **Step 2: Export** `export { Breadcrumbs, type BreadcrumbSegment } from "./components/breadcrumbs";`.
- [ ] **Step 3: Story + play test** `Breadcrumbs.stories.tsx` — segments `[{label:"Runtime",href:"#"},{label:"Guides",href:"#"},{label:"Debugging"}]`. `play`: assert all three labels present; the "Debugging" node has `aria-current="page"`; "Runtime" is a link (`getByRole("link", { name: "Runtime" })`).
- [ ] **Step 4: Verify** build + lint + test green; visual diff vs mockup breadcrumb. Mark done in `COMPONENTS.md`.
- [ ] **Step 5: Commit** `feat(ui): Breadcrumbs`.

---

### Task 4: PageFooterNav

**Files:** create `packages/ui/src/components/page-footer-nav.tsx`, `packages/ui/src/stories/PageFooterNav.stories.tsx`; modify `index.ts`, `COMPONENTS.md`.

**Interfaces produced:** `PageFooterNav` (props: `prev?: { label: string; href: string }`, `next?: { label: string; href: string }` & `React.ComponentProps<"nav">`).

- [ ] **Step 1: Implement** `page-footer-nav.tsx`:
  - `<nav class="flex items-stretch justify-between gap-4">` (if only `next`, prev slot is an empty spacer so next stays right; use `justify-between` with a placeholder `<span />` when `prev` absent).
  - Card: `<a class="group flex flex-col gap-1 rounded-xl border p-4 hover:bg-[var(--hover)] ...">`; prev has `ArrowLeft` + eyebrow "Previous"; next is `text-right` with eyebrow "Next" + `ArrowRight`. Eyebrow `text-xs text-muted-foreground`; label `text-sm font-medium text-foreground`.
- [ ] **Step 2: Export** `export { PageFooterNav } from "./components/page-footer-nav";`.
- [ ] **Step 3: Story + play tests** `PageFooterNav.stories.tsx`:
  - `Both`: prev + next; `play` asserts both labels + hrefs (links by name).
  - `NextOnly`: only `next`; `play` asserts no "Previous" text and the next link exists.
- [ ] **Step 4: Verify** build + lint + test green; visual diff vs mockup prev/next. Mark done in `COMPONENTS.md`.
- [ ] **Step 5: Commit** `feat(ui): PageFooterNav`.

---

## Final: PR

- [ ] Cold-cache `bun run build`, `bun run lint`, `bun run test` all green; actionlint clean.
- [ ] Visual-diff the three composites against their mockup regions (Chrome DevTools MCP; re-serve Storybook static on :6099).
- [ ] Push `feat/docs-composites`; open a PR into `main` summarizing the test setup + 3 composites, and noting Sidebar/AppNav/SectionTabs/TableOfContents follow.
