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
| `CodeBlock` | **done** | variant: editor·terminal; `filename`, `lang`, `lineNumbers`, `statusBar` (vim NORMAL), `highlight`; slot: `CopyButton` | SQLite editor, terminal, snippet blocks |
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

- **CodeBlock** currently uses `prism-react-renderer`; import `CopyButton` from
  its own leaf entry point when highlighting is unnecessary.
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
