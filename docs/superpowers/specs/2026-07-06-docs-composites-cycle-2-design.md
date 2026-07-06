# Docs composites — cycle 2 (parallelized)

Ports the remaining Tier-2 docs composites (groups A + B + C from `COMPONENTS.md`)
from the authoritative `Elide Docs.dc.html` mockup. `CommandPalette` (group D)
stays deferred — it needs the Command-primitive decision (Base UI Combobox vs.
themed cmdk) and gets its own cycle.

Work is fanned out across parallel Sonnet-5 agents. This document is the shared
contract every agent reads.

## Scope

| # | Composite | Mockup source (line refs in `Elide Docs.dc.html`) |
| --- | --- | --- |
| A1 | `AppNav` | NAV, L64–88 (brand + DOCS pill · nav links · search trigger · theme toggle · locale · changelog · install) |
| A2 | `SectionTabs` | SECTION TABS, L90–99 (Start·Runtime·Toolchain·API·Resources + version dot) |
| A3 | `Sidebar` (`SectionSwitcher`, `SidebarGroup`, `SidebarItem`) | SIDEBAR, L102–123 & L667–698 |
| A4 | `TableOfContents` | RIGHT RAIL "On this page", L184–190; FLOATING/MINI TOC L896, L1027 |
| A5 | `MobileNav` | MOBILE, L202–297 (app bar + bottom "Search or ask AI" bar + Sheet drawer) |
| B1 | `CardGrid` + `FeatureCard` | "Start here" cards L236–239; section-landing card grid (2a) |
| B2 | `StatStrip` | 2a compatibility stat strip |
| B3 | `AiActions` | "Use with AI" panel, L191–195 |
| B4 | `CopyCommand` | install one-liner `curl elide.sh \| bash`, L234 |
| C1 | `ApiMethod` + `ParamRow` | 2b node:fs reference, L461–582 |
| C2 | `SupportMatrix` (`DataTable`) | SUPPORT MATRIX, L566 |
| C3 | `StatusBadge` | API status pills — thin wrapper over existing `Badge` status tones |

## Shared contract (every agent obeys)

1. **Files, scoped.** Each agent creates **only**:
   - `packages/ui/src/components/<kebab-name>.tsx`
   - `packages/ui/src/stories/<PascalName>.stories.tsx`
   - `packages/ui/src/components/<kebab-name>.test.tsx` (jsdom unit test)

   Agents **must not** edit `src/index.ts`, `package.json`, `styles.css`,
   `turbo.json`, `components.json`, `@elide/tokens`, or anything under
   `.github/`. The integrator (main session) wires exports and runs the
   aggregate build. `styles.css` already `@source`-globs `./components` and
   `./stories`, so no CSS change is needed.

2. **Theme only from tokens.** Use the CSS variables the mockup uses
   (`var(--nav-bg)`, `var(--border)`, `var(--border-strong)`, `var(--fg)`,
   `var(--fg-muted)`, `var(--fg-subtle)`, `var(--primary)`, `var(--primary-soft)`,
   `var(--bg)`, `var(--bg-elev)`, `var(--bg-elev2)`, `var(--brand)`, `--code-*`,
   `--syn-*`). Never hardcode a raw hex from the mockup. The one exception the
   mockup itself makes is the **changelog violet** (`#9747ff`) — reuse the
   existing `Button` `variant="changelog"` rather than re-inlining it.
   Tailwind utility classes map to tokens already (`bg-background`, `text-muted-foreground`,
   `border-border`, …); prefer them, and use `style={{}}` with `var(--…)` only
   where no utility exists. Follow the idiom already in `callout.tsx` /
   `breadcrumbs.tsx` / `page-footer-nav.tsx`.

3. **Composition over new primitives.** Reuse shipped components — `Button`,
   `Badge`, `Tooltip`, `Popover`, `DropdownMenu`, `Sheet`, `NavigationMenu`,
   `Separator`, `ScrollArea`, `Breadcrumbs`. Group A also has `Accordion`,
   `Select`, and `Avatar` available (pre-generated in Phase 0). Do not add new
   npm dependencies; if you think you need one, stop and flag it.

4. **Icons:** `lucide-react` only. Relative imports (`../lib/utils`,
   `./button`) — no `@/` alias.

5. **Props:** typed, exported `interface`/`type`; sensible defaults; data-driven
   (arrays of items) so consumers pass content. Match the variants/props already
   listed in `COMPONENTS.md` for the component. Forward `className` and merge with
   `cn(...)`. `aria-*`: nav landmarks (`<nav aria-label>`), `aria-current="page"`
   for active items, accessible names on icon-only buttons.

6. **Story:** `title: "Composites/<Name>"`, `layout` param as fits, realistic
   Elide content (not lorem). Include a `play` interaction test where the
   component is interactive (toggle, open drawer, switch tab) using
   `expect`/`userEvent`/`within`/`waitFor` from `storybook/test`. Assert exact
   expected values, not "not-equal-to-before" (see the ThemeProvider lesson).

7. **Unit test (`*.test.tsx`, jsdom):** Testing Library — `render`, query by
   role/text, `userEvent` for interaction, assert with `@testing-library/jest-dom`
   matchers. Cover: renders provided items, active/current state, external-link /
   `comingSoon` variants, and any callback (`onSelect`, `onOpenChange`). Keep it
   to component logic — visual fidelity is the story/Chromatic's job.

8. **Verify your own slice** with `bunx tsc --noEmit -p packages/ui/tsconfig.json`
   and `bunx eslint packages/ui/src/components/<name>.tsx packages/ui/src/stories/<Name>.stories.tsx packages/ui/src/components/<name>.test.tsx`.
   Do **not** run the full Playwright/browser suite (the integrator runs it once
   to avoid 11 concurrent browsers). Return a short report: files created,
   exported symbol names + types (so the integrator can write `index.ts`), and
   any dep/primitive you had to flag.

## Test infrastructure (Phase 0, integrator)

A second Vitest project runs pure unit tests in **jsdom** alongside the existing
Storybook browser-mode suite:

- `packages/ui/vitest.config.ts` — `environment: "jsdom"`, `globals: true`,
  `setupFiles` loading `@testing-library/jest-dom`, `include: ["src/**/*.test.{ts,tsx}"]`,
  coverage via `@vitest/coverage-v8` emitting `lcov` + `json` + `text` into
  `packages/ui/coverage/`, `coverage.include: ["src/components/**"]`.
- devDeps added to `packages/ui`: `vitest`, `jsdom`, `@testing-library/react`,
  `@testing-library/user-event`, `@testing-library/jest-dom`, `@vitest/coverage-v8`.
- `packages/ui` scripts: `"test": "vitest run"`, `"test:coverage": "vitest run --coverage"`.
- `turbo.json` `test` task already fans across workspaces → picks up the new
  `packages/ui` test automatically; `apps/storybook` browser suite also emits
  coverage to `apps/storybook/coverage/`.
- Proven before fan-out with a unit test against an already-shipped component
  (`badge.test.tsx`) so agents have a green target to copy.

## Codecov (Phase 1, dedicated agent)

- `codecov.yml` at repo root: carryforward flags `ui-unit` (jsdom) and
  `ui-browser` (Storybook), reasonable `project`/`patch` targets (informational,
  not blocking initially), ignore `**/*.stories.tsx` and `src/stories/**`.
- CI: in `.github/workflows/check.test.yml`, after the test run, upload both
  `coverage/lcov.info` reports to Codecov with `codecov/codecov-action`
  (SHA-pinned, matching the repo's pinning convention), flagged per project,
  `fail_ci_if_error: false`, token from `secrets.CODECOV_TOKEN` (user provides).
- README: add the Codecov badge.
- This agent owns CI + `codecov.yml` only; it does **not** touch component files
  or the vitest configs (the integrator sets `coverage` output in those).

## Phasing

- **Phase 0 (integrator, sequential):** stand up jsdom test infra + prove it;
  pre-generate `Accordion`, `Select`, `Avatar` via the shadcn Base-UI flow
  (interactive, Button-overwrite gotcha) and export them; `bun run build` green.
- **Phase 1 (parallel, Sonnet 5):** 12 composite agents + 1 Codecov agent, per
  the contract above.
- **Phase 2 (integrator):** wire `index.ts` exports; `bun run build` + `lint` +
  both test suites; fix seams; visual-verify a couple via the browser MCP;
  update `COMPONENTS.md`; commit logically; open PR; address Copilot/Chromatic.

## Non-goals

- `CommandPalette` (group D) — deferred.
- Tier-3 marketing widgets.
- No new runtime npm deps. No Shiki yet (CodeBlock already shipped without it;
  syntax highlighting is a separate future task).
