# Design: `@elide/ui` Base UI primitive layer (Phase 0 + 1)

**Date:** 2026-07-06
**Status:** Approved
**Scope:** Set up the shadcn-with-Base-UI flow, then ship the full primitive layer
used by the docs design. Docs-shell composites (AppNav, Sidebar, TOC, …) and
content components (CodeBlock+Shiki, ⌘K CommandPalette, …) are **later cycles**.

## Goal

Give `@elide/ui` a themed, tested set of interactive primitives built on
`@base-ui/react`, generated through the shadcn CLI and re-themed entirely from
`@elide/tokens` — the same model the existing `Button`/`Badge`/`Callout` follow.

## Background

- Monorepo: Bun workspaces + Turbo. UI package builds with `tsup --dts`; stories
  run in Storybook 10 (`apps/storybook`). Tailwind v4 (no config file; `@source`
  directives in `packages/ui/src/styles.css`).
- `@base-ui/react@1.6.0` is installed (resolvable via Bun's isolated `.bun` store).
- shadcn CLI v4 supports Base UI as a first-class primitive layer; Base UI is the
  recommended default for new projects.
- The authoritative visual source is `Elide Docs.dc.html` (renders in Chrome via
  its `dc-runtime`). Each primitive maps to a mockup region per `COMPONENTS.md`.

## Non-goals

- No composites this cycle (AppNav, SectionTabs, Sidebar, TableOfContents,
  Breadcrumbs, PageFooterNav, CardGrid, ApiMethod, SupportMatrix, MobileNav).
- No `ThemeProvider`/`useTheme` yet — deferred to the composites cycle (pairs with
  the AppNav theme toggle). Storybook's decorator handles theme for these stories.
- No Shiki / CodeBlock work; no marketing widgets.

## Architecture & setup (Phase 0)

1. **`components.json` in `packages/ui`.** Base UI primitive layer, Tailwind v4,
   `iconLibrary: lucide`, `tsx: true`, `rsc: false`. Aliases:
   - `utils` → existing `src/lib/utils` (`cn`) — do **not** let shadcn overwrite it.
   - `ui` / `components` → `src/components`
   - `hooks` → `src/hooks` (created if a primitive needs it)
   If `shadcn init` refuses because `packages/ui` is a library (not an app),
   author `components.json` by hand — a supported path.
2. **Tokens stay the single source of truth.** Before adding components, confirm
   every var shadcn primitives reference resolves from our theme:
   `--background/foreground`, `--card`, `--popover`, `--muted`, `--accent`,
   `--primary`, `--border`, `--input`, `--ring`, `--destructive`, and `--radius`.
   Add any missing var to `@elide/tokens` (`tokens.css` + `@theme inline` in
   `theme.css`) — most notably `--radius` if shadcn expects it. shadcn must **not**
   write a competing `:root` color block into `styles.css`.
3. **Verify the loop on one primitive (Tooltip) first** before scaling out:
   generated → re-themed → exported → story → build → visual diff.

## Per-primitive workflow (Phase 1, repeatable)

For each primitive:
1. `bunx shadcn@latest add <name>` → lands in `src/components/<name>.tsx`.
2. **Re-theme:** delete any shadcn default color vars / hardcoded palette; ensure
   it uses token-backed utilities (`bg-popover`, `text-foreground`, `border`,
   `ring-ring`, etc.). Match radii/shadows/spacing to the mockup region.
3. **Re-export** the component (+ its prop/types) from `src/index.ts`.
4. **Story** in `src/stories/<Name>.stories.tsx` covering the key states, rendered
   in both light and dark (Storybook theme decorator already exists).
5. `bun run build` + `bun run lint` clean.
6. Render the story and pixel-diff against the mockup region (Chrome DevTools MCP;
   static servers on :6099 Storybook / :6098 mockup).

### Primitive list (11) and mockup source

| Primitive | Mockup use |
| --- | --- |
| Tooltip | nav icon-button titles |
| Popover | language / section switchers |
| DropdownMenu | locale menu, "Ask AI" split |
| Dialog | modal base |
| Sheet | mobile nav drawer (Base UI Dialog, side variant) |
| Separator | nav dividers |
| ScrollArea | sidebar / palette scroll |
| Switch | theme toggle option |
| Tabs | content tabbing |
| NavigationMenu | primary nav links |
| Command | ⌘K palette base |

## Risks / to verify empirically

1. **Import package name.** shadcn Base UI templates may import
   `@base-ui-components/react` (older scope) vs the installed `@base-ui/react`.
   Reconcile on the first `add`: prefer rewriting generated imports to
   `@base-ui/react`; only add the other package if it is genuinely a distinct,
   required dependency. Record the decision.
2. **Command / ⌘K.** shadcn "Command" historically wraps `cmdk`, not a
   Radix/Base UI primitive. With Base UI it may map to Base UI **Combobox** or
   still pull `cmdk`. Use whatever the Base UI registry ships. If Command isn't
   cleanly available on Base UI, build it on Base UI Combobox, or **defer just
   Command** to the CommandPalette composite cycle and note it (do not block the
   other 10).
3. **Missing Base UI primitives.** If any of the 11 isn't in Base UI / the
   registry at 1.6, note it and either hand-author on the nearest Base UI
   primitive or defer that one with a written reason. No silent drops.
4. **`cn` collision.** shadcn may try to scaffold its own `lib/utils`. Point the
   alias at the existing file and diff — keep ours.

## Definition of done (this cycle)

- `components.json` committed to `packages/ui`; tokens cover all shadcn-expected vars.
- Each of the 11 primitives (minus any explicitly deferred with a reason):
  generated, re-themed from tokens (no hardcoded color), exported from `@elide/ui`,
  with a light+dark Storybook story.
- `bun run build` and `bun run lint` pass clean from a cold cache.
- Each primitive visually matches its mockup region (diff screenshots reviewed).
- Any deferral (e.g. Command) documented in `COMPONENTS.md` status + this spec.
