# Catalog optimization and terminal fidelity, November 8, 2026

This round extends the [initial code/logo optimization](./OPTIMIZATION.md) across
React/Preact surfaces. Changes are selective: a smaller component tree is not
automatically faster or smaller in retained heap.

## Accepted changes

Grouped sidebar items now share a localization subscription and render their
native rows directly. The standalone SidebarItem API remains available. Code
surface title bars reuse immutable native window-control markup without three
extra decorative component instances per title bar. Neither change adds DOM
nodes, caches user data, or alters routing, focus, theme, or localization behavior.

Seven interleaved baseline/candidate trials, isolated production React/Preact
pages, Chromium 158, Apple M5 Max, 4× CPU slowdown, 900×900 viewport. Complete
fixture heap includes runtime and input data. Large cases are stress tests, not
claims about a typical page or total browser RAM.

| Case | Mounted JS heap, median | Startup task time, median |
| --- | --- | --- |
| React, 100 sidebar items | 1.74 → 1.73 MiB (−0.9%) | 119.1 → 119.0 ms |
| Preact, 100 sidebar items | 1.38 → 1.35 MiB (−2.6%) | 86.1 → 86.2 ms |
| React, 1,000 sidebar items | 2.71 → 2.52 MiB (−7%) | 175.6 → 172.2 ms |
| Preact, 1,000 sidebar items | 2.49 → 2.09 MiB (−16%) | 127.0 → 124.4 ms |
| React, 100 title bars | 2.09 → 1.96 MiB (−6%) | 119.3 → 117.7 ms |
| Preact, 100 title bars | 1.68 → 1.53 MiB (−9%) | 84.3 → 86.9 ms |
| React, 1,000 title bars | 6.25 → 4.99 MiB (−20%) | 291.8 → 285.5 ms |
| Preact, 1,000 title bars | 5.70 → 4.20 MiB (−26%) | 262.8 → 255.9 ms |

The material benefit is heap reduction. Timing differences are small, with
overlapping ranges; these are not demonstrated smoothness/FPS improvements.
HTML and viewport PNGs match exactly in both runtimes at both densities. DOM,
document and listener counts return to their warm empty baseline after remount.

[All 112 final trials, source hashes and artifact hashes](./results/2026-11-08-catalog-optimization.json).
[Medians, p75, ranges and regression checks](./results/2026-11-08-catalog-summary.json).
The summarizer rejects incomplete/duplicate evidence and p75 regressions beyond
the larger of 15% or the existing absolute noise allowance.

AiActions also now keeps one copy-feedback timer, cancels it on unmount, ignores
stale writes, and only reports success after the clipboard write succeeds.
Deterministic lifecycle tests cover repeated clicks, rejected/unavailable writes,
and completion after unmount. CopyButton already cleaned up its timer and retains
its existing implementation; there is no claimed mounted-heap win for this fix.

## Rejected experiments

- Memoizing the three SupportMatrix status icon elements reduced heap only
  ~1% at 1,000 rows, increased overhead at 100 rows, and slightly worsened CPU.
  Reverted. [Exploration data](./results/2026-11-08-catalog-exploration.json).
- Flattening the remaining CodeRow/LineTokens boundaries reduced bundle bytes
  but yielded ~5.4 MiB mounted React heap at 1,000 lines versus ~5.0 MiB for the
  earlier optimized renderer. Separating recording attributes from ordinary
  token props did not remove the regression. Both row-flattening variants were
  reverted; retained component/element graphs matter more than component count.

## Catalog audit

| Surface | Decision |
| --- | --- |
| CodeBlock, Terminal, CodeScene | Keep the measured shared token-rendering improvement and lighter title-bar chrome. Preserve row boundaries. |
| Sidebar/SidebarGroup/SidebarItem | Optimize grouped rows; preserve standalone API, locale updates and native link behavior. |
| AiActions / CopyButton / CopyCommand | Fix AiActions timer accumulation and stale feedback; existing CopyButton cleanup retained. |
| SupportMatrix | Revert low-value icon memoization. |
| Badge, StatusBadge, Callout, CardGrid, StatStrip, Breadcrumbs, PageFooterNav, SectionTabs | Already primarily native markup with no idle loops. No blanket memoization or extra caches. |
| TableOfContents | Existing passive, frame-throttled scroll spy; retain dynamic-layout correctness rather than introduce unproven position caches. |
| CommandPalette | Existing memoized active rows and indexed group offsets retained; avoid a persistent search-index allocation without a representative need. |
| CodeGroup, theme/i18n providers | Existing scoped subscriptions and memoized context values retained. |
| Dialog, menus, selects, tabs, switches, popovers, tooltips, navigation overlays | Keep Base UI accessibility/focus behavior and React/Preact support. No speculative rewrites. |
| DeferredContent, ReadingProgress | Existing native CSS containment/scroll behavior retained. |
| Lit logo | Keep the earlier measured resize-style improvement; no additional Lit migration in this round. |

## Terminal help-viewer bug

A real `elide help` PTY capture reproduces the high-fidelity case: block-art
logo, borders, ANSI runs and animated background decorations. Recording snapshots
now carry VT column/advance metadata, with drawn cells separated from ordinary
text runs. Playback positions those runs at their recorded columns instead of
accumulating rounded inline-block advances. Ordinary text is still rendered in
runs, not one element per character. Wide characters and cursor widths use the
VT's cells; transcript text remains unchanged.

The production regression test seeks through seven captured frames at four
viewport widths, checking all border/logo glyphs against their columns and
against previous frames. Maximum observed error across the full capture after
the fix: Chromium **0.090 px**, Firefox **0.00008 px**, WebKit **0.016 px**;
the enforced bound is **0.125 px**. The earlier Chromium logo-only measurement
reached **0.498 px**. `HelpFidelity` is also available in Terminal Storybook.

The fidelity runtime measured 31,028 gzip bytes in the isolated Terminal bundle.
Its reviewed ceiling increases from 31,000 to **31,100 B** for the new cell
positioning behavior. Other byte gates remain unchanged. Keeping a 100 B feature
allowance is preferable to the measured memory regression from flattening rows.

Production checks cover no-JS text, hydration, selection, highlighting, playback
and offscreen suspension in Chromium, Firefox and WebKit. Layout Shift API
certification remains Chromium-only where the API is supported.

## Reproduce

Build dependencies with `bun run test:elements`, then from `apps/elements`:

```sh
node perf/catalog-build.mjs 44f6c9c
node perf/catalog-run.mjs 7 sidebar,chrome
node perf/catalog-summary.mjs .profiles/<catalog-run>/results.json
```

Omit the case list to include the current SupportMatrix as a control. The raw
exploration report records the rejected memoized version; it is not shipped.
Do not run unrelated builds/tests during performance capture.

From `apps/benchmark`, after building the production fixture:

```sh
BROWSERS=chromium,firefox,webkit node terminal-alignment-check.mjs
```
