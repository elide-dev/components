# Component inventory

Extracted from the high-fidelity mockups in `Elide Docs.dc.html` (direction
**1a**, plus the section-landing, API-reference, guide, and mobile screens).
Status: `done` shipped in `@elide/ui`, `registry` = pull via shadcn, `todo` = to
author.

Legend for source: which mockup element each maps to.

## Tier 0 — Tokens (`@elide/tokens`) · done

Palette (magenta + neutral scales), semantic light/dark roles, syntax colors,
radii, type. See the package README.

## Tier 1 — Primitives

| Component | Status | Variants / key props | Source in mockup |
| --- | --- | --- | --- |
| `Button` | **done** | variant: primary·gradient·outline·ghost·changelog; size: sm·md·icon; `render` for polymorphism | Install (gradient), Changelog (violet), nav icon buttons |
| `Badge` | **done** | variant: neutral·primary·supported·partial·missing; `dot` | version pill, "24" count, API status pills |
| `Tooltip` | **done** | — | nav icon button titles |
| `Popover` | **done** | — | language / section switchers |
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
| `CodeBlock` | **done** | variant: editor·terminal; `filename`, `lang`, `lineNumbers`, `statusBar` (vim NORMAL), `highlight`; slot: `CopyButton` | SQLite editor, terminal, snippet blocks |
| `CopyButton` | **done** | `value`, `size` | code block + copy-command |
| `CopyCommand` | **done** | `command`, prompt glyph | install one-liner |
| `AppNav` | **done** | brand · `NavLinks` · `SearchTrigger` · `ThemeToggle` · `LocaleSwitcher` · `ChangelogButton` · `InstallButton` | top nav (all pages) |
| `SectionTabs` | **done** | `items`, `active` | Start·Runtime·Toolchain·API·Resources |
| `Sidebar` | **done** | `SectionSwitcher`, `NavGroup`, `NavItem` (active, external, comingSoon), progress | left nav |
| `TableOfContents` | **done** | `items`, active-on-scroll; mono variant for API methods | right rail "On this page" |
| `AiActions` | **done** | Copy as Markdown · View as text · Open in ChatGPT/Claude | right rail panel |
| `Breadcrumbs` | **done** | `segments` | above page title |
| `PageFooterNav` | **done** | `prev?`, `next?` (right-grouped cards) | bottom prev/next |
| `CardGrid` + `FeatureCard` | **done** | cols; card: icon·title·description·badge·href | "Start here", category grid |
| `StatStrip` | **done** | `stats: {value,label}[]` | API landing metrics |
| `StatusBadge` | **done** | thin wrapper over `Badge` status tones | reference status |
| `ApiMethod` + `ParamRow` | **done** | `signature`, `status`, params, example slot | node:fs entries |
| `SupportMatrix` / `DataTable` | **done** | columns, status cells (✓/✗) | method support table |
| `CommandPalette` | registry+ | built on `Command`; groups: pages·actions; recent | ⌘K overlay |
| `MobileNav` | **done** | top bar + `Sheet` drawer + bottom "Search or ask AI" bar | mobile screens |
| `ThemeProvider` / `useTheme` | **done** | class/`data-theme` on `<html>`, persisted | dark/light toggle |

## Tier 3 — Marketing widgets (from elide.dev)

`Hero`, `LogoStrip`, `FeatureSection`, `LanguageSection` (code showcase),
`PricingCards`, `Faq`, `BlogCards`, `Footer`. All reuse Tier 1–2 + tokens; these
are what let the two sites converge. Status: `todo`, sequenced after the docs
site is on the catalog.

## Notes

- **CodeBlock** is the signature component — pull highlighting from **Shiki**
  (matches `--eld-syntax-*` and works in Astro/MDX at build time) rather than a
  runtime highlighter.
- Icons: **Lucide** everywhere (`@elide/icons`).
- Anything interactive on the Astro docs site is a **React island**; the prose
  shell stays static HTML + token CSS to keep JS minimal.

## Primitive layer setup (2026-07-06)

- Primitives are generated with the shadcn CLI in **Base UI mode** — `components.json`
  sets `"style": "base-nova"` (the `base-*` prefix selects `@base-ui/react`; `radix-*`
  / `default` would pull Radix). Add with `bunx shadcn@latest add <name> -y`.
- shadcn writes `cn` as a literal `src/lib/utils` import; rewrite it to the relative
  `../lib/utils` after generating (the repo uses relative imports, no `@/` path alias).
- Overlay primitives use `tw-animate-css` (imported in `packages/ui/src/styles.css`)
  for the `animate-in` / `fade-in` / `slide-in-*` utilities.
- Base UI overlays render through a **Portal into `<body>`**, so the theme must be on
  `<html>` (the Storybook decorator toggles `.dark` on `documentElement`; consumers do
  the same). A `.dark` class on a wrapper div would leave portaled content light.
- **`Combobox` / `Command` is deferred.** shadcn's `command` is `cmdk`-based (not Base
  UI) and drags in `input-group`/`input`. It'll be built in the **CommandPalette**
  composite cycle, on Base UI Combobox or a themed `cmdk`. Not shipped as a primitive.
- `Select`, `Accordion`, `Breadcrumb`, `Avatar` remain `registry` — add them when their
  composite needs them.
