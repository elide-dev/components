# Web Components architecture

Status: target design, November 8, 2026. The catalog remains React/Preact, with an
additive [Lit logo pilot](../packages/elements/README.md) implementing the first
element, registration, SSR, and React adapter exports below. Core extraction,
interactive components, and broader migration remain planned.

Elide will implement selected portable components as Lit custom elements, with
scoped CSS and thin React adapters. Static content keeps a zero-client-JavaScript
path. Success means less shipped code, less work per interaction, bounded memory,
and unchanged visual and accessibility quality on real websites.

For website delivery, the primary priorities are static rendering, low startup
and idle overhead, smooth scrolling, layout stability, and native browser
behavior. Frequent component updates are a secondary workload. A bulk-update
microbenchmark is not the acceptance criterion for static website components.

## Website delivery policy

1. **Ship HTML, SVG, and CSS by default.** Build/server rendering may use React,
   Preact, or Lit; do not hydrate a static component just because its authoring
   implementation has a runtime. Prefer ordinary static markup for simple brand
   and content components. Declarative shadow DOM is available when style
   encapsulation is useful, not mandatory for every presentational element.
2. **Use native behavior where it matches the product.** Links, buttons, forms,
   and disclosure controls should retain browser semantics. Evaluate native
   dialog/popover behavior for suitable overlays and CSS sticky positioning,
   scroll timelines, container queries, and anchor positioning for appropriate
   layouts. Feature-test enhancements and preserve keyboard/accessibility
   behavior; do not remove tested Base UI implementations merely to use a newer API.
3. **Hydrate small, necessary islands.** Preact/compat is a candidate for reusing
   the React catalog with lower client-runtime overhead; its compatibility must
   remain tested. Lit is a candidate for portable standalone behavior and scoped
   styling. Neither choice is required for static HTML, and neither guarantees
   smoother scrolling than equivalent already-rendered DOM.
4. **Budget browser work, not just framework work.** Keep DOM/shadow structure
   lean; avoid layout reads interleaved with writes, large paint effects, and
   blanket layer promotion. Use CSS/WAAPI for motion where appropriate and honor
   reduced motion. Consider `content-visibility` with reserved intrinsic size at
   large section boundaries; it does not eliminate JavaScript initialization.
5. **Validate the actual page.** Reserve image and component geometry, control
   font loading/fallback metrics, and test slow assets. Prioritize FCP/LCP, CLS,
   startup long tasks, idle work, real-device scrolling, and essential-control
   responsiveness over synthetic bulk rerender throughput. Measure native DOM
   memory as well as JS heap before making total-memory claims.

Removing virtual DOM reconciliation is a mechanism, not a performance result.
Lit still evaluates templates and schedules updates. DOM size, style calculation,
layout, paint, allocation, and application logic remain costs. Promotion requires
measurements against the current optimized React implementation.

## Rendering boundaries

| Content | Default delivery | Runtime ownership |
| --- | --- | --- |
| Logos, static badges, prose, static code | Server/build-rendered HTML or SVG; optionally declarative shadow DOM | No hydration unless behavior or properties must change |
| Copy controls and self-contained interactive widgets | SSR markup plus an individually imported Lit element | Element owns internal state and DOM updates |
| Playback and other frequent updates | SSR poster/transcript plus a bounded Lit surface | Framework-neutral model drives local rendering |
| Existing dialogs, menus, forms, complex composites | Existing React/Base UI implementation | React until a replacement meets all gates |

Use custom-element boundaries around coherent widgets, not every text node,
terminal cell, icon, or layout wrapper. Shadow roots and element instances have
costs. Prefer native HTML inside components and CSS for layout and animation.

## Package boundaries

```text
@elide/brand     @elide/tokens     @elide/core (when shared logic is extracted)
       \              |              /
                 @elide/elements
                  /           \
       HTML/site consumers    @elide/ui adapters + retained React/Base UI

@elide/elements/ssr -> server-only rendering integration
```

| Package | Responsibility | Forbidden dependencies |
| --- | --- | --- |
| `@elide/brand` | Geometry, artwork descriptors, assets; no rendering runtime | Lit, React |
| `@elide/tokens` | Plain CSS variables, optional fonts, Tailwind bridge | Lit, React |
| `@elide/core` | Extracted playback/parsing and locale data/formatting with narrow exports | Lit, React, browser globals during module evaluation |
| `@elide/elements` | Lit classes, scoped styles, DOM controllers, explicit registration | React, React DOM, Base UI React, lucide-react, runtime Tailwind merging |
| `@elide/ui` | React adapters, React context bridges, existing catalog | No restriction on existing React dependencies |

Do not create a generic core framework. Extract only code needed by two renderers:
`lib/playback.ts` is already a useful model. Preserve existing UI subpaths through
re-exports when moving framework-neutral code. Separate locale catalogs from any
provider so importing one language cannot import React or all languages. Use raw
SVG geometry for element icons; share only the icons actually consumed.

Proposed exports:

```text
@elide/elements/logo           class and types; no registration
@elide/elements/define/logo    browser registration; side effect
@elide/elements/copy-command   class and types
@elide/elements/define/copy-command
@elide/elements/ssr            server-only integration
@elide/ui/elements/logo        additive React adapter during pilot
```

Use `eld-*` tags, starting with `eld-logo`. Publish ESM and declarations with Lit
external to library builds so consumers deduplicate its runtime. Registration
modules are explicitly listed in `sideEffects`; a root import must not register
the entire catalog. Repeated registration of the same constructor is harmless;
an incompatible constructor for an existing tag must produce an actionable error,
not silently bind a wrapper to the wrong implementation. Initially support one
major version per tag per document; do not depend on scoped registries.

Generate a Custom Elements Manifest for properties, attributes, events, slots,
parts, and CSS variables. Test exported artifacts in an external consumer, not
only workspace source. Add new packages to release build filters, Changesets,
and the explicit dependency order in `scripts/publish.ts` when implemented.

## CSS and theming

Keep `tokens.css` as the global theme contract. Keep fonts opt-in and document
scoped. The Tailwind bridge remains a consumer convenience; elements must work
without Tailwind, preflight, `@elide/ui/styles.css`, or a React theme provider.

Use component-local Lit `static styles`, composed from small shared style
modules. Lit handles stylesheet adoption and its supported fallback; avoid a
custom stylesheet registry. Do not insert a full utility bundle into each root.
CSS variables and inherited properties carry theme values across shadow roots;
global selectors do not. [Lit styles](https://lit.dev/docs/components/styles/)

| Current rule | Target owner |
| --- | --- |
| Palette, semantic colors, typography tokens | Document or nearest themed container |
| Font faces, body background, document scrolling, print layout | Document stylesheet |
| Box sizing, native control font inheritance, focus, disabled and forced-color styles | Small internal base styles plus component rules |
| Utility classes defining component layout and variants | Explicit scoped selectors with token values |
| Container layout and code surface rules in `platform.css` | Extract rules for the relevant element; retain document rules globally |
| Consumer spacing, flex/grid placement, outer dimensions | Custom-element host |
| Intentional customization of internals | Documented component variables and a minimal `::part()` surface |

Use open shadow roots by default for testing and integration. Do not use
`all: initial`, broad resets of slotted content, or blanket containment. Define
host display, intrinsic dimensions, overflow, and baseline behavior per component;
these are part of visual parity. Preserve native `[hidden]` behavior when setting
host display. Scope containment to measured surfaces where it cannot clip focus
rings, overlays, or affect intrinsic sizing.

Resolve defaults at the point of use, for example
`color: var(--eld-logo-color, var(--foreground, currentColor))`. Avoid assigning
public customization variables on every host, which would mask inherited values.
Use logical properties, `:dir(rtl)` where appropriate, reduced-motion and
forced-colors rules. `::slotted()` styles the assigned element, not arbitrary
descendants: the consumer owns slotted prose styling and React-owned children.

Theme changes should normally cost CSS work only. Replace internal ancestor
`.dark` selectors with inherited semantic values. For paired light/dark raster
logos, add theme-scoped display variables in the shared theme layer and consume
them inside the shadow root. Set both values at each explicit light/dark scope
so nested themes work. Do not substitute OS preference for the site's theme or
attach a document MutationObserver to every logo.

Preserve existing token names and values during migration. The new scoped rules
are checked against old renderings. Once a component switches to its adapter,
delete its obsolete React-only styling where no other component consumes it.
Keep shadow-root CSS self-contained rather than reaching back into legacy rules.

## Public component contract

Attributes carry small serializable configuration such as `variant`, `size`,
`disabled`, and `asset-base`. Properties carry typed objects and arrays. Never
serialize recordings, token arrays, or callbacks into attributes. Reflect only
state with a documented styling or HTML purpose; do not reflect every clock tick.
Avoid repurposing built-in HTMLElement properties such as `title`; an adapter can
map the old logo `title` prop to a distinct accessible-label property.

Define immutable input semantics for data properties: replace the reference to
update, or call a documented incremental method for streaming data. Use native
`input`/`change` when their semantics apply; otherwise publish typed `eld-*`
CustomEvents with minimal `detail`. Public events crossing a component boundary
use `bubbles: true` and `composed: true`. Property assignment must not emit a
user-change event. Document cancellation and controlled/uncontrolled behavior
per component rather than adding a universal two-way binding system.

Use slots for consumer-owned content, not Lit TemplateResults or ReactNodes in
the portable API. A React adapter maps named content props into slotted children.
React owns those light-DOM nodes; Lit owns shadow internals. Never let both
renderers update the same subtree.

Document methods such as `focus()`, `play()`, `pause()`, and `seek()` only where
they represent meaningful capabilities. Define readiness through Lit's
`updateComplete` and explicit data-ready events where needed, not polling.

## Update and resource ownership

Lit batches reactive changes asynchronously. A render can still reevaluate an
entire template; avoid tying a large surface to a property changing every frame.
[Lit update lifecycle](https://lit.dev/docs/components/lifecycle/)

Keep semantic state separate from visual frame state. Playback owns time and
cues; the renderer updates changed rows or segments. A timestamp change must not
retokenize a transcript, rebuild all rows, or notify a React parent every frame.
Use stable keyed lists when identity changes, retain unchanged data references,
and cache expensive derivations by their actual inputs. Bound caches by bytes or
entries with explicit eviction. No unbounded recording, token, or locale caches.

Begin with normal Lit rendering. Add a custom directive or imperative DOM island
only after profiling identifies a hot path. Such an island has exclusive DOM
ownership, explicit cleanup, and tests for selection, focus, and hydration.
Do not build a second renderer or adopt a signals dependency speculatively.

Use animation-frame scheduling only for active visual work, batching reads before
writes. Skip unchanged output. Pause work while disconnected or the document is
hidden; offscreen autoplay also suspends according to the component's documented
policy. Offscreen paint containment alone does not stop JavaScript work. Use CSS
or the Web Animations API for decorative motion, respecting reduced motion.

Connection-scoped controllers own external listeners, observers, requests, and
subscriptions. Cancel on disconnect and recreate safely on reconnect. Abort stale
requests and ignore late results. Share expensive resources only with explicit
ownership/refcounts; avoid one global listener or worker per instance. A worker
is appropriate for measured parsing/highlighting bottlenecks; compare transfer
and startup costs first. Never move DOM operations into the worker contract.

Large terminals require bounded history and incremental updates. Windowing is
optional and must preserve a usable accessible transcript, copy/search behavior,
and a complete static export. Native DOM adoption must not mean mounting every
cell in an arbitrarily large recording.

## Server rendering and progressive enhancement

Every website-facing component defines its initial HTML, no-JavaScript behavior,
upgrade behavior, and loading policy. Logos and critical content are visible
before any definition module loads. A server-rendered custom-element tag alone
does not satisfy this requirement.

Use ordinary SVG/HTML for simple static output where possible. For shared Lit
templates, evaluate `@lit-labs/ssr` with declarative shadow DOM behind the
server-only export. Lit SSR is experimental; pin compatible dependencies and
contain this dependency behind integration tests. Resolve asynchronous data
before rendering. [Lit SSR status](https://lit.dev/docs/ssr/overview/)

For dynamic SSR elements, load hydration support before Lit or element imports;
hydrate the existing DOM rather than recreating it. Server and client receive the
same initial data, locale, IDs, and theme. Verify focus and node identity survive
upgrade. Static output can omit definitions and hydration entirely.
[Lit hydration](https://lit.dev/docs/ssr/client-usage/)

Definition loading is per tag/module: registering a tag may upgrade all matching
instances. Visibility loading is therefore not a guarantee of per-instance lazy
work. Each expensive component still defers its own work until needed. Load
essential controls early; lazy widgets must remain useful before upgrade and
must not lose the first activation. Do not add a generic event replay system.

Reserve geometry before upgrade and provide component-level critical styles
with SSR markup. Test slow/failed scripts, CSP, and JavaScript disabled. Content
must not be hidden globally with `:not(:defined)`. Server output escapes text and
serialized data; prohibit untrusted `unsafeHTML` and dynamic executable CSS.

Astro integration and React SSR are separate acceptance cases. A React wrapper
does not itself SSR Lit internals. Keep the existing SSR-safe React export until
the chosen server path passes the consumer fixture. This avoids trading a
working static logo for an empty custom element.

## Accessibility and native behavior

Prefer native buttons, links, inputs, details, and semantic text within the
appropriate DOM scope. A shadow-internal button is not automatically a submitter
for an outer form; wrapping it does not recreate native button semantics.
Form-associated elements must explicitly support values, validation, disabled
fieldsets, reset, restoration, labels, and submission through tested platform
integration. `ElementInternals` supports form participation and default semantics;
individual features still require compatibility validation.
[ElementInternals](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals)

Choose a single accessible owner for each widget. A logo host can carry its name
and image role while hiding its internal artwork; theme-swapped images must not
lose the name or announce twice. Interactive widgets must route labels to their
actual accessible control. Do not assume `aria-labelledby` strings can resolve
across roots. Keep related labels and controls in the same scope or implement a
tested explicit bridge. SSR semantics must work before JS initializes internals.

Test keyboard navigation, focus restoration, composed event paths, zoom, touch,
selection, RTL, reduced motion, and forced colors. Use axe plus manual VoiceOver
and NVDA smoke checks for migrated interactive patterns; snapshots alone cannot
prove accessibility. Native dialog/popover/top-layer APIs are future candidates,
not substitutes for validating focus, dismissal, positioning, and naming.

## React and Preact compatibility

Use `@lit/react` for property/event adaptation and typed JSX. Keep React context
bridges outside the portable layer: resolve messages, locale, and direction at
the adapter and pass stable explicit values. Subscribe only to needed state;
neither theme changes nor playback frames should cause catalog-wide React work.
[Lit React integration](https://lit.dev/docs/frameworks/react/)

Ship pilot adapters under additive `@elide/ui/elements/*` exports. Keep current
exports while testing. `className` and style move to a custom-element host;
existing SVG/image refs, descendant selectors, and `Button render={<a />}` are
not transparently compatible. Publish a prop/ref/style migration table per
component. Preserve a legacy export or use a versioned breaking change where
required. Do not claim drop-in compatibility based only on matching prop names.

Extend the existing Preact production/SSR fixture explicitly; compatibility
through `preact/compat` is not inferred from React success. Measure adapters too:
pages retaining React pay for both runtimes, so conversion is not automatically
a page-level byte saving.

## Validation and performance gates

The [performance acceptance contract](./performance-gates.md) defines the
static-first metrics, executable logo budgets, and per-component promotion
requirements. Release comparisons require at least seven samples; the earlier
five-sample exploration below is diagnostic evidence, not gate certification.

The production benchmark is the decision surface, not Storybook's development
bundle. Extend `apps/benchmark` and its existing profiling method with equivalent
React, Preact, Lit, and static cases. Include Lit and React runtimes in complete
consumer comparisons; report incremental component costs separately. Existing
bundle budgets that externalize React are not fair runtime comparisons.

| Gate | Acceptance condition |
| --- | --- |
| Dependency isolation | Plain element consumer contains no React, React DOM, Base UI React, JSX runtime, or unrelated elements/locales/grammars |
| Static delivery | Static logo/page variant ships zero component runtime JS; visible and correctly named with JS disabled |
| Visual parity | Existing story variants compared at identical fonts, viewport, DPR, theme, and browser; differences reviewed, not hidden by blanket tolerance |
| Upgrade | No component-attributable layout shift; no replacement of focused content; hydration/console errors fail |
| Idle and teardown | No active playback timers when idle/hidden/disconnected; listeners and subscriptions return to baseline after repeated reconnects |
| Local updates | Unchanged rows keep node identity; unrelated components do not render; property writes do not create event loops |
| Bundle growth | Record gzip and Brotli totals for eager graph, lazy chunks, CSS, and SSR HTML; freeze reviewed per-fixture byte ceilings after first pilot |
| Runtime benefit | Static delivery is judged by shipped bytes, initial rendering, layout stability, idle work, and page responsiveness; update-driven migrations additionally require measured update CPU/allocation benefit |

Run at least five measured samples after warmup on fixed browser versions,
viewport, hardware, and throttle settings; compare medians and spread. Capture
cold startup separately. Measure 1, 100, and 1,000 small instances; a fixed 30-second
playback workload; and 100 mount/unmount/reconnect cycles. Compare retained heap
after controlled GC in the lab, allocations during the workload, detached nodes,
DOM counts, layout/style/paint time, and total main-thread time. GC-specific
memory readings are diagnostics, not portable web API guarantees.

For an update-driven migration, the initial target is at least 20% lower median
update CPU and no retained-heap regression outside measured noise. This is a
project target, not a measured result or a requirement to adopt a static logo.
Report smaller improvements and reconsider migration value; do not weaken tests
or silently change the baseline. Establish absolute frame-work and byte budgets from the first fixture
on representative mobile hardware before broad adoption. Automated CI enforces
deterministic size/behavior gates; timing and heap gates run on a controlled
performance runner, with traces retained for review.

Website field monitoring should target p75 INP at or below 200 ms, measured by
device class. This is a page outcome, not a guarantee one component can provide;
synthetic key dispatch and frame interval scripts are not field INP.
[INP guidance](https://web.dev/articles/inp)

Test Chromium, Firefox, and WebKit, plus real iOS Safari for touch/focus/scroll.
At pilot implementation, record exact minimum supported browser versions in the
consumer fixture. The required baseline is custom elements, Shadow DOM, CSS
variables, and declarative shadow DOM for that SSR path. Detect optional native
features and provide functional fallbacks; do not select newer APIs merely for
novelty. Keep static HTML/SVG available where the SSR baseline is unavailable.

## Migration sequence

1. **Baseline and contracts.** Record current logo and playback visuals, bundles,
   profiles, and SSR behavior. Inventory CSS/ref consumers. Establish browser
   versions and performance hardware. No runtime export replacement.
2. **Logo vertical slice.** Add `@elide/elements`, per-element registration,
   scoped CSS, additive React adapter, plain HTML and SSR consumers. Reuse brand
   paths/gradients/aspect ratios. Preserve the separate legacy mark/wordmark cuts,
   all formats, `assetBase`, raster density ladders, decorative/named modes,
   nested themes, sizes, and multiple instances. Prove both zero-JS static output
   and dynamic theme/property changes before expanding the platform.
3. **Interactive slice.** Port `CopyCommand` with a native button, raw SVG icon,
   clipboard failure handling, polite feedback, explicit messages, and reconnect
   cleanup. Validate slots, events, React/Preact, SSR, and first interaction.
4. **Static website performance slice.** Compare representative header, hero,
   cards, navigation, and long-form content pages with static output and minimal
   interactive islands. Measure first paint, layout stability, slow loading,
   scroll/paint work, idle overhead, and native browser behavior. Compare Preact
   and Lit only where a client runtime is actually required. Playback is a later,
   separate experiment if frequently updating components need migration.
5. **Selective promotion.** Migrate badges, separators, callouts, or other website
   components when usage and evidence justify it. Replace compatible exports only
   after all gates pass; document breaking DOM/ref changes. Keep rollback through
   the legacy entry until consumers migrate.
6. **Complex widgets later.** Consider forms, menus, tabs, and overlays separately.
   Keep Base UI where it provides better verified behavior. No deadline or quota
   requires every component to become a custom element.

Implementation PRs include the consumer-facing contract, visual comparisons,
accessibility results, production bundle graph, and relevant performance traces.
The first three slices establish the system; no wholesale CSS or catalog rewrite
is required before they can deliver useful portable components.
