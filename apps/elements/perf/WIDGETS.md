# Terminal, CodeScene and CodeBlock quality pass

The baseline for this round is `3262c98`. The work keeps existing markup and
visual design while reducing repeated work during playback and tab navigation.

## Behavior

- Terminal's VT caches one rendered variant per live row in a WeakMap. Changes
  invalidate the affected rows; cursor and positioning options are part of the
  cache lookup. Unchanged rows retain identity, allowing recording-row rendering
  to skip them. Ordinary CodeBlock rows keep their existing component boundaries.
- Recording requests are tied to their source URL and aborted responses cannot
  replace a newer recording. Prefetching has a 200px margin; playback visibility
  uses the actual viewport. Restarting during a viewport transition still pauses
  offscreen. Resized recordings use the current screen's column count.
- CodeScene reuses code, debugger and terminal surfaces between execution cues.
  It pauses offscreen, respects explicit navigation, and stops at the first
  breakpoint crossed by a delayed frame, including a jump to the end.
- CodeBlock highlights the active file first, cancels unnecessary pending work,
  and reuses completed highlighting on tab revisits. Hidden panels retain their
  source for SSR. Provided highlighting takes precedence over earlier upgrades;
  removing tabs keeps a visible panel, and boolean wrap updates apply immediately.
- Browser shortcuts remain available; CodeScene also preserves composition events. Empty scenes cannot
  start playback. A clock subscriber that pauses at a breakpoint leaves no extra
  animation frame scheduled.

## Evidence

Seven paired engine trials, ten replays per trial on Apple M5 Max / Node 24.22.1:

| VT workload | Before → after median | Change |
| --- | --- | --- |
| Real Elide help capture | 33.54 → 8.04 ms | −76% |
| Sparse screen edits | 112.23 → 9.35 ms | −92% |
| Scrolling output | 96.22 → 16.60 ms | −83% |
| Full-screen redraws | 49.25 → 50.69 ms | +2.9% |

These are engine measurements, separate from browser rendering. All 695 retained
frames match the baseline exactly. The help capture reuses 1,630 of 1,890
same-position rows across events. [Raw engine evidence](./results/2026-11-08-vt-snapshots.json).

Seven interleaved production browser trials, Chromium 158 at 4× CPU slowdown:

| 120-frame workload | React task time | Preact task time |
| --- | --- | --- |
| Help-viewer scrubbing | 434.39 → 390.03 ms (−10%) | 435.47 → 363.46 ms (−17%) |
| CodeScene holding a step | 206.39 → 52.48 ms (−75%) | 193.18 → 41.79 ms (−78%) |

Terminal mounted JS heap rises 0.3% / 0.9% in React/Preact; post-scrub heap changes
−0.8% / +0.4%. CodeScene post-work heap falls 12.9% / 15.6%. This measures a scene
holding one execution step; it does not claim the same saving during every cue
transition. These CPU figures include browser task work and the fixture driver,
not a measurement of displayed FPS or field INP.

All 56 trials pass warmed teardown checks. Exact HTML and viewport PNGs match in
both runtimes. The p75 CPU/startup/heap/DOM comparisons show no regressions beyond
the larger of 15% or the metric's absolute allowance. [Raw browser results](./results/2026-11-08-widgets.json)
and [summary, ranges, p75 gates and parity hashes](./results/2026-11-08-widgets-summary.json).

Deterministic component checks also establish:

- 12 file tabs invoke highlighting once on initial mount, once for each newly
  visited tab, and zero times on revisits.
- 30 between-cue animation ticks cause zero additional CodeBlock/Terminal renders
  within CodeScene, while the next cue still updates both surfaces.
- Old snapshots remain intact across later edits; cursor movement, Unicode,
  erase/insert/delete, scrolling, alternate screens, resize, reset and clone work.

Recording rows receive only their own line and display options, preventing
memoized rows from retaining old screen arrays. The row cache adds metadata and
retained row tokens. Whole-browser RAM, GPU
memory, field INP and actual display deadlines are not certified by these tests.
Terminal's isolated eager bundle is 31,431 B gzip (React external); its gate
moves from 31,100 to 31,500 B. Other byte budgets are unchanged.

## Reproduction

Build the workspace dependencies first. From `apps/elements`:

```sh
node perf/vt-paired.mjs 3262c98
node perf/widgets-build.mjs 3262c98
node perf/widgets-run.mjs 7
node perf/widgets-summary.mjs .profiles/<widgets-run>/results.json
```

The browser fixture uses production React and Preact builds at 4× CPU slowdown.
Each trial drives 120 help-viewer scrub positions or 120 real animation frames
between scene steps. Before/after variants rotate in order, use fresh browser
contexts, and record startup, task/script/layout work, mounted and post-work JS
heap, plus warmed teardown DOM/document/listener counts. It compares exact HTML
and viewport PNGs after each workload. Timings include the benchmark driver.
Run captures without concurrent builds or tests.

Validation: the full UI suite passed 475 tests before the additional viewport-race
regression; the final focused terminal/row suites and 31 affected Storybook tests
also pass. Production SSR/hydration, selection, autoplay, offscreen suspension and
cell alignment pass in Chromium, Firefox and WebKit. Preact client/SSR checks,
lint/i18n, consumer typechecking and all byte gates pass. Layout Shift API checks
remain conditional on browser support; Chromium reported zero shift.
