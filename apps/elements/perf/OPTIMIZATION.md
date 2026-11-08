# CPU and memory optimization, November 8, 2026

Baseline: `7a7fe5b`. Two focused changes passed parity and lifecycle checks:

- Shared `CodeLines` renders native token nodes directly instead of retaining
  two stateless React components per token. CodeBlock, Terminal and CodeScene
  consume this renderer. No cache, mutable shared state, or new DOM nodes.
- Lit logo sizing uses local width/height declarations rather than private
  inherited variables. The public CSS height override remains supported.

Seven interleaved baseline/candidate samples per case, Chromium 158, Apple M5 Max,
4× CPU slowdown, 900×900 viewport, fresh contexts and disabled HTTP cache. Results
are local laboratory observations, not field INP/FPS or total renderer memory.
Builds/tests ran outside measurement windows. Initial sequential captures were
discarded for CPU comparisons because unchanged controls slowed substantially.

## Code rendering

Pre-highlighted input uses 12 tokens per line, including ordinary unstyled
punctuation. Initial exploratory input overrepresented styled punctuation; only
the final representative fixture is reported here. Each run also performs ten
mount/unmount cycles and checks DOM/document/listener retention.

| Case | Startup task time, median | Mounted JS heap, median |
| --- | --- | --- |
| React, 100 lines | 94.4 → 89.8 ms | 1.89 → 1.58 MiB (−16%) |
| React, 1,000 lines | 227.6 → 217.4 ms | 8.05 → 5.04 MiB (−37%) |
| Preact, 100 lines | 60.7 → 60.5 ms | 1.67 → 1.30 MiB (−22%) |
| Preact, 1,000 lines | 216.6 → 209.1 ms | 9.30 → 5.64 MiB (−39%) |

The strongest result is retained JS heap. CPU differences are small and sample
ranges overlap; do not generalize these numbers to an entire documentation page.
DOM counts are unchanged, and HTML plus viewport PNGs match byte-for-byte for
both runtimes at both densities. The benchmark excludes grammar loading and
tokenization; it does not establish terminal playback throughput.

[All 56 trials and artifact hashes](./results/2026-11-08-code-optimization.json).
[Medians, p75 and ranges](./results/2026-11-08-code-optimization-summary.json).

## Logo sizing

At 100 direct Lit logos, 20 bulk resizes:

| Metric | Before | After |
| --- | ---: | ---: |
| Median main-thread task time | 110.63 ms | 90.83 ms (−18%) |
| Median style recalculation | 32.17 ms | 18.53 ms (−42%) |
| Median layout | 15.78 ms | 15.75 ms |
| Median startup task time | 34.87 ms | 35.36 ms |
| Median mounted JS heap | 1,129,176 B | 1,140,860 B |

This is a resize-work improvement, not a static-startup win. The tradeoff is
about 11.4 KiB additional JS heap per 100 instances. DOM counts and initial
pixels are unchanged; all samples return to baseline DOM/document/listener
counts after 100 warm mount/unmount cycles. The adapter benefits from the same
sizing code, but these paired numbers measure direct Lit only.

[All 14 trials and source/artifact hashes](./results/2026-11-08-logo-optimization.json).

## Reproduce

Build dependencies with `bun run test:elements`, then from `apps/elements`:

```sh
# Both variants use identical build settings and input in a single capture.
node perf/code-build.mjs 7a7fe5b
node perf/code-run.mjs 7
node perf/code-compare.mjs .profiles/<code-run>/results.json
node perf/logo-paired.mjs 7a7fe5b
```

The build reads the baseline component with `git show`, builds it alongside the
current source, and removes its temporary source file. It never checks out or
overwrites working changes. Every runtime is isolated in its own page. Raw local
runs include parity artifacts; checked-in reports retain their SHA-256 hashes.

Validation: 52 targeted unit tests, 30 browser stories, Preact client/SSR tests,
UI lint/i18n checks, and logo parity/SSR/hydration in Chromium, Firefox and WebKit.
The production code fixture checks hydration, selection, highlighting and
offscreen playback suspension across all three engines. Layout Shift observation
is enforced in Chromium; unsupported engines are explicitly not certified for it.
