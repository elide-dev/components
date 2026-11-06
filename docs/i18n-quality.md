# Internationalization quality checks — November 6, 2026

The pre-change baseline was `93f831e`. Checks below use production builds, not
Storybook development timing. Raw Lighthouse reports and Chrome DevTools MCP
traces remain in ignored local audit directories; the compact trace samples are
committed in [2026-11-06-i18n.csv](../apps/benchmark/profiling/2026-11-06-i18n.csv).

## Browser and accessibility checks

- All 318 UI unit tests and 75 Storybook browser tests passed locally, including
  the seven new internationalization stories with automated accessibility checks.
- The production locale fixture passed in Chromium, Firefox and WebKit across
  all 12 locales. It checks SSR without JavaScript, hydration errors, translated
  portal names, RTL keyboard navigation, inline-start sheets, switch movement,
  LTR command/code ordering, mobile page overflow and unclipped code metadata.
- The Preact consumer also verifies Hebrew SSR/hydration and translated portal
  language, direction and close controls through the existing compatibility path.
- Existing production checks for theme fallbacks, native/floating overlays,
  focus restoration, reduced motion, forced colors and stable text geometry pass.
- Chrome DevTools MCP was used for both performance tracing and a mobile Hebrew
  screenshot/accessibility-tree review. The review exposed wrapping and contrast
  issues in code metadata; those were fixed rather than suppressing audit checks.

## Bundles

Sizes are minified and gzipped, with React external for component/provider
consumers. They measure the public package entry points after building.

| Consumer | Before | After |
| --- | ---: | ---: |
| Button | 10,037 B | 10,037 B |
| CopyCommand | 11,512 B | 11,856 B |
| One locale (data-only) | — | 718–1,101 B |
| Hebrew provider plus catalog | — | 2,285 B |

CopyCommand adds 344 B gzip for the expanded English fallback catalog and
localized, direction-safe composition. Existing 14 KB leaf budgets remain in
force. Each locale has a 1.6 KB gzip ceiling; the provider example has a 6.5 KB
ceiling and verifies that unrelated catalogs are absent. No dependency, runtime
translation compiler, browser polyfill or font pack was added.

## Rendering profiles

The existing MCP protocol and interaction drivers were used at 1440×1000,
4× CPU slowdown, without network throttling, for three samples per scenario and
revision. Navigation/font loading and palette entrance/exit are outside the
marked interaction windows.

| Median interaction metric | Before | After |
| --- | ---: | ---: |
| Scroll layout passes / time | 0 / 0 ms | 0 / 0 ms |
| Command-navigation layout passes / time | 0 / 0 ms | 0 / 0 ms |
| Scroll main-thread task time | 996.2 ms | 683.7 ms |
| Command-navigation main-thread task time | 577.2 ms | 405.5 ms |
| Command-navigation FunctionCall time | 225.6 ms | 153.4 ms |
| Command-navigation paint time | 201.5 ms | 156.5 ms |

Neither revision had animation-frame intervals above 25 ms. The earlier samples
were noisier (command task time ranged 402.7–578.7 ms versus 396.0–407.0 ms), so
the lower medians should **not** be attributed to internationalization as a speed
improvement. The useful result is retained zero-layout interaction behavior with
no observed regression in these workloads. This is not a field INP measurement
or a guarantee for every device, dataset or consuming application.

## Lighthouse and agent-facing behavior

Lighthouse 13.6.0 mobile simulation reports 100 in all five categories on `/`
and `/platform.html`. The final `/i18n.html` fixture scored 99, 100 and 100 for
performance in three samples (median 100), and 100 for accessibility, best
practices, SEO and agentic browsing in every sample. Its total blocking time
varied from 10.5 to 95 ms; the outlier is retained rather than discarded.
All use a fresh production Vite preview with the current MPA configuration. An older preview process still had SPA fallback enabled and
returned HTML for a missing ARD URL; it is not a valid hosting configuration for
this benchmark. Unknown routes, including an unimplemented ARD endpoint, return
404 with the current configuration.

The example preserves prerendered content, semantic landmarks and accessible
names, keyboard operation, `robots.txt` and `llms.txt`. Local Lighthouse's agentic
category is **not** a hosted [is-agentic.com](https://is-agentic.com/methodology)
score. That service evaluates a public deployed URL; no new public deployment or
external score is claimed here. Authentication, crawler access, CDN headers and
locale routing must also be verified on the consuming site's actual deployment.

The CSS review used [good-css](https://good-css.com/) and
[web.dev's internationalization guidance](https://web.dev/learn/design/internationalization):
logical spacing and borders, intrinsic wrapping, content selection, reduced-motion
guards and progressive fallbacks. Centered transforms and explicit physical
popup sides remain physical intentionally; global `will-change` and layout
animation were not introduced.
