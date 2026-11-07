# Component inventory

Extracted from the high-fidelity mockups in `Elide Docs.dc.html` (direction
**1a**, plus the section-landing, API-reference, guide, and mobile screens).
Status: `done` shipped in `@elide/ui`, `registry` = pull via shadcn, `todo` = to
author.

Legend for source: which mockup element each maps to.

## Tier 0 — Tokens (`@elide/tokens`) · done

Palette (royal purple, muted rose, original magenta, and neutrals), semantic light/dark roles, syntax colors,
radii, type. See the package README.

## Tier 1 — Primitives

| Component | Status | Variants / key props | Source in mockup |
| --- | --- | --- | --- |
| `Button` | **done** | variant: primary·gradient·outline·ghost·changelog; size: sm·md·icon; `render` for polymorphism | Install (gradient), Changelog (violet), nav icon buttons |
| `Badge` | **done** | variant: neutral·primary·supported·partial·missing; `dot` | version pill, "24" count, API status pills |
| `Tooltip` | **done** | — | nav icon button titles |
| `Popover` | **done** | — | language / section switchers |
| `AnchoredPopover` | **done** | `trigger`, `title`, `positioning`, `side`; native CSS anchor positioning with floating fallback | opt-in contextual panels |
| `DropdownMenu` | **done** | — | locale menu, "Ask AI" split |
| `Dialog` | **done** | — | modal base |
| `Sheet` / `Drawer` | **done** | side | **mobile nav drawer** |
| `Tabs` | **done** | — | (content tabbing) |
| `Select` / `NativeSelect` | **done** | — | forms |
| `Combobox` / `Command` | deferred | — | **⌘K command palette** — deferred to CommandPalette composite (see note) |
| `Switch` | **done** | — | theme toggle option |
| `Separator` | **done** | orientation | nav dividers |
| `ScrollArea` | **done** | — | sidebar / palette scroll |
| `Accordion` | **done** | — | FAQ, collapsible nav groups |
| `Breadcrumb` | registry | — | page breadcrumbs |
| `NavigationMenu` | **done** | — | primary nav links |
| `Avatar` | registry | — | (marketing) |

## Tier 2 — Docs composites

| Component | Status | Composition / props | Source |
| --- | --- | --- | --- |
| `Callout` | **done** | tone: note·tip·important·warning·caution; `title` | guide admonitions |
| `CodeBlock` | **done** | `code`+`lang` or build-time `lines`/`inline` from `highlightCode()`, `files` (tabs), `[!code …]` notations, `highlight` ranges, `decorations` (highlight · add · remove · breakpoint · cursor · warning · error · focus · flash · fold), `annotations` (code tour), `lineLinks`, `maxLines`, `wrap`, `caption`, `actions`, `statusBar`, `chrome`. `variant="terminal"` is deprecated → `Terminal` | SQLite editor, snippet blocks |
| `CodeGroup` | **done** | tabs over code surfaces; `syncKey` syncs and remembers the choice page-wide; `labels`, `defaultValue` | bun · npm · pnpm, TS · Python · Kotlin |
| `Terminal` | **done** | `code`/`lines` (commands · ANSI output · comments · `exitCode`), `prompt` (glyph or user/host/cwd), zsh-style command highlighting with `commandHref`/`subcommands`, `wrap` (default on · toggle), `copy` (commands · transcript; per-command buttons), `chrome`, `recording` (asciicast `src`/`cast` or `synthesize`; poster, autoplay, speed, markers, `rows`) | terminal samples, recorded runs |
| `CodeSample` | **done** | `layout`: below · beside (container query ≥ 48rem) · tabs; `labels` | code + its run |
| `CopyButton` | **done** | `value`, `size` | code block + copy-command |
| `CopyCommand` | **done** | `command`, prompt glyph | install one-liner |
| `AppNav` | **done** | brand · `NavLinks` · `SearchTrigger` · `ThemeToggle` · `LocaleSwitcher` · `ChangelogButton` · `InstallButton` | top nav (all pages) |
| `SectionTabs` | **done** | `items`, `active` | Start·Runtime·Toolchain·API·Resources |
| `Sidebar` | **done** | `SectionSwitcher`, `NavGroup`, `NavItem` (active, external, comingSoon), progress | left nav |
| `TableOfContents` | **done** | `items`, active-on-scroll; mono variant for API methods | right rail "On this page" |
| `DeferredContent` | **done** | `intrinsicBlockSize`; opt-in offscreen layout/paint containment | long document bodies |
| `ReadingProgress` | **done** | decorative root scroll-timeline indicator; reduced-motion and print aware | long documents |
| `AiActions` | **done** | Copy as Markdown · View as text · Open in ChatGPT/Claude | right rail panel |
| `Breadcrumbs` | **done** | `segments` | above page title |
| `PageFooterNav` | **done** | `prev?`, `next?` (right-grouped cards) | bottom prev/next |
| `CardGrid` + `FeatureCard` | **done** | `columns` maximum; container-aware wrapping; card: icon·title·description·badge·href | "Start here", category grid |
| `StatStrip` | **done** | `stats: {value,label}[]`, `columns` maximum; container-aware wrapping | API landing metrics |
| `StatusBadge` | **done** | thin wrapper over `Badge` status tones | reference status |
| `ApiMethod` + `ParamRow` | **done** | `signature`, `status`, params, example slot | node:fs entries |
| `SupportMatrix` / `DataTable` | **done** | columns, status cells (✓/✗) | method support table |
| `CommandPalette` | **done** | Base UI dialog + grouped actions, filtering, keyboard navigation | ⌘K overlay |
| `MobileNav` | **done** | top bar + `Sheet` drawer + bottom "Search or ask AI" bar | mobile screens |
| `ThemeProvider` / `useTheme` | **done** | class/`data-theme` on `<html>`, persisted | dark/light toggle |
| `ElideLogo` | **done** | form: square·full; variant: gradient·mono·blend; format: svg·png·webp·avif; `linked`, `height`, `decorative`, `assetBase` | brand mark; artwork from `@elide/brand` |

## Tier 3 — Marketing widgets (from elide.dev)

`Hero`, `LogoStrip`, `FeatureSection`, `LanguageSection` (code showcase),
`PricingCards`, `Faq`, `BlogCards`, `Footer`. All reuse Tier 1–2 + tokens; these
are what let the two sites converge. Status: `todo`, sequenced after the docs
site is on the catalog.

## Notes

- **Highlighting** is Shiki (JS regex engine, fine-grained grammars, a theme of
  `--eld-syntax-*` variables emitted as `tk-*` classes). Preferred: call
  `highlightCode(code, lang, { twoslash })` from `@elide/ui/components/shiki`
  at build time and spread the result into `<CodeBlock>`; the client then never
  loads Shiki. Otherwise `CodeBlock` renders plain text (SSR-identical, no
  hydration mismatch) and upgrades with a lazily imported, idle-scheduled
  Shiki chunk; `preloadHighlighter()` makes cached grammars apply before paint.
  Shell languages use the built-in shell tokenizer. Twoslash is an optional
  build-time peer and never enters browser bundles. C++ and Ruby grammars are
  left out (each ~900 KB). Regenerate story fixtures with
  `bun scripts/generate-code-fixtures.ts` in `packages/ui`.
- **Code rows** are CSS grids (`[marks] [number] [prompt] [content]`) rendered
  by `CodeLines` for both surfaces. Numbers, prompts and gutter glyphs are
  pseudo-elements, so selection and copy return only the code; wrapped lines
  hang under their content; numbers stay sticky while unwrapped code scrolls.
  All rows share `--code-line-height`.
- **Window chrome**: `chrome="auto"` (default) shows macOS controls unless the
  page inlines `codeChromeScript` in `<head>`, which sets `data-os` on `<html>`;
  CSS then shows Windows or GNOME controls. Markup never depends on script, so
  SSR and hydration agree and visual snapshots stay deterministic.
- **Terminal** renders output through a built-in lite VT (`lib/vt.ts`: SGR incl.
  256/truecolor, cursor movement, erase, scroll regions, alt screen, DEC line
  drawing, OSC 8 links) and commands through a positional shell tokenizer
  (`lib/shell-tokens.ts`). Recordings are asciicast v1–v3 on a shared clock
  (`lib/playback.ts`) with an SSR poster; the grid scales to its container
  (no measurement), changed rows remount so playback causes no layout shift,
  and playback pauses offscreen. Full-screen TUIs are out of scope for the
  lite VT. Budgets (gzip, React external) are enforced by
  `apps/benchmark/bundle-check.ts`, measured with code splitting: CodeBlock ≤
  24 KB (Shiki and the terminal runtime load lazily or not at all), Terminal ≤
  31 KB, CodeSample/CodeGroup ≤ 25 KB, the lazy Shiki runtime ≤ 64 KB (never
  the TypeScript compiler).
  `apps/benchmark/code.html` is the Lighthouse and `code-check.mjs` target.
  Roadmap: scripted scenes (stepping, coverage, hotspots), then editable
  `onRun`.
- **Recording fixtures** (`src/stories/fixtures/casts.ts`) are real Elide runs:
  a bash script prints a prompt, types the command with small sleeps, then
  `eval`s it; capture with `asciinema rec --headless --window-size 72x12
  --idle-time-limit 1.5 -c ./session.sh out.cast`, drop `timestamp`/`env`
  from the header, and add an `"m"` marker event before each typed command.
- Icons: **Lucide** via `lucide-react`; `@elide/icons` is planned.
- Anything interactive on the Astro docs site is a **React island**; the prose
  shell stays static HTML + token CSS to keep JS minimal.

## Cloud component priorities

Audit: `elide-dev/cloud` checkout `85ade74` on `feat/dashboard-posthog`, November
6, 2026. These are proposed additions, not installed components. The dashboard
uses Astro, React and Base UI/base-nova; the separate admin app uses Radix,
new-york and shadcn-admin-kit/ra-core. Keep its data adapters and primitive
conventions separate when sharing presentation.

| Priority | Addition | Existing cloud need |
| --- | --- | --- |
| 1 | [Field](https://ui.shadcn.com/docs/components/base/field), Input, Label, Textarea, Checkbox | Account, domain and repository forms assemble labels/errors manually; automatic indexing uses a raw checkbox. Promote the dashboard's private Base UI controls into a tested shared family. |
| 2 | [AlertDialog](https://ui.shadcn.com/docs/components/base/alert-dialog) | Hostname removal uses `window.confirm`; repository offboarding needs a consistent confirmation flow with cancellation, pending and error states. |
| 3 | [Table](https://ui.shadcn.com/docs/components/base/table) and Pagination | Usage/billing tables and repository/agent cursor navigation are private implementations. Start with semantic presentation; keep Astro tables server-rendered. Admin already has a data-table controller. |
| 4 | Progress, Meter, Spinner, Skeleton | Indexing progress and billing quota bars need distinct progress/meter semantics; private skeletons need shared reduced-motion behavior. |
| 5 | Card, Empty and error-state composition | General cards and empty/error states repeat across resources. Preserve retry links and trace IDs; FeatureCard is a navigation tile rather than a generic panel. |
| 6 | Avatar and a distinct AppSidebar family | Dashboard already has a Base UI avatar and a large collapsible/mobile application sidebar. Preserve the existing docs Sidebar API. |
| 7 | [Combobox](https://ui.shadcn.com/docs/components/base/combobox) | Searchable resource selectors and membership lookups can share a primitive; keep ra-core reference/data adaptation inside admin. |

Evidence is in cloud's `apps/dashboard/src/components/islands/` (`account-form`,
`hostname-manager`, `repository-manager`, `agent-sessions`, `domain-ui`), its
private `components/ui/` and `components/astro/` families, and the admin
`components/admin/` controls. Its overview also copies tab-trigger styles to
keep filters as normal links; exporting shared variants can remove that drift
without adding hydration. Existing CopyButton/CopyCommand can replace its DNS
copy helper without another dependency.

For compatible extensions, [ReUI's Base UI Stepper](https://reui.io/docs/components/base/stepper)
fits the existing domain-provisioning SetupSteps. Its Timeline/Tree/Filters may
be useful for future activity and resource views. Free primitives are
[MIT licensed](https://github.com/keenthemes/reui/blob/main/LICENSE.md); premium
blocks have separate terms. Add a data-grid engine only when sorting, selection,
editing or virtualization requirements justify it. Cloud already uses an admin
kit; another kit is unnecessary. Official [Trace](https://ui.shadcn.com/docs/components/base/trace)
and [Resizable](https://ui.shadcn.com/docs/components/base/resizable) are later
options for run details and log panes; charts/date pickers should follow an
actual metrics workflow.

Before adopting the refreshed library, advance cloud's `vendor/components`
submodule from `909b59f` and import `@elide/ui/platform.css` in the dashboard's
custom Tailwind stylesheet. This audit did not change the cloud checkout.

## Primitive layer setup (2026-07-06)

- Primitives are generated with the shadcn CLI in **Base UI mode** — `components.json`
  sets `"style": "base-nova"` (the `base-*` prefix selects `@base-ui/react`; `radix-*`
  / `default` would pull Radix). Add with `bunx shadcn@latest add <name> -y`.
- shadcn writes `cn` as a literal `src/lib/utils` import; rewrite it to the relative
  `../lib/utils` after generating (the repo uses relative imports, no `@/` path alias).
- Popups and dialogs use shared transitions in `platform.css`, including
  `@starting-style`, discrete transitions, and Base UI lifecycle fallbacks.
  Sheets and accordions retain `tw-animate-css` utilities. Both are included by
  `packages/ui/src/styles.css`.
- Base UI overlays render through a **Portal into `<body>`**, so the theme must be on
  `<html>` (the Storybook decorator toggles `.dark` on `documentElement`; consumers do
  the same). A `.dark` class on a wrapper div would leave portaled content light.
- **`Combobox` / `Command` is deferred.** The current `CommandPalette` composite
  uses a Base UI dialog with its own filtering and keyboard navigation.
- `Breadcrumb` and `Avatar` remain `registry` — add them when their composite needs them.
