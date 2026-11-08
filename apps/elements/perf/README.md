# Logo performance benchmark

The [optimization round](./OPTIMIZATION.md) records paired CPU/memory results
for the shared React/Preact code renderer and direct Lit logo sizing.
The [catalog follow-up](./CATALOG.md) covers navigation, code-surface chrome,
clipboard cleanup, rejected experiments, and the terminal help-viewer fix.

Compare static SVG, the current React logo, Preact/compat, direct Lit, and the React-to-Lit
adapter using isolated production builds. This measures the logo adoption cost;
it does not establish performance for playback, menus, or the whole catalog.

## Run

From the repository root:

```sh
# Builds dependencies and all fixtures; runs correctness checks, not timed profiling.
bun run test:elements

cd apps/elements

# Five samples, 1/100/1000 logos, 20 updates per scenario, 4x CPU slowdown.
# Includes allocation sampling and 100 mount/unmount cycles at 100 instances.
node perf/run.mjs

# Website-oriented run: initial render, JS heap, idle work, and native wheel input.
# No component-update or mount/unmount workload; static pages get no DOM driver.
node perf/run.mjs --static-ui

# Use the output path printed by the runner.
node perf/summarize.mjs .profiles/<run>/results.json
```

Run on an otherwise idle machine, without concurrent builds/tests or browser
activity. Each run writes raw results and metadata into an ignored `.profiles`
directory. The runner rotates implementation order between samples and saves
each completed trial. The summarizer rejects incomplete runs. Timing and heap
values are diagnostic results by default. The explicit release gate below runs
only against a comparable baseline; ordinary CI gates bytes and behavior.

## Acceptance gates

The contract is [documented here](../../../docs/performance-gates.md). These are
logo-fixture budgets, not certification of the whole component catalog.

CI enforces complete gzip JS ceilings (including each runtime and driver):
static **0 B**, Lit **12,000 B**, Preact **22,000 B**, React/adapter **85,000 B**.
It also checks no retained DOM nodes, documents, or listeners after 20 warmed
100-logo mount/unmount cycles, alongside existing visual, SSR, and locality tests.

For release measurements, save runs from the baseline and candidate worktrees
on the same idle machine, browser, viewport, and throttle. Use seven or more
samples and identical options in each worktree:

```sh
node perf/run.mjs --static-ui --samples=7
node perf/gate.mjs /path/to/baseline/results.json /path/to/candidate/results.json

# Separate rendering diagnostics; do not use these CPU/heap values for comparisons.
node perf/run.mjs --static-ui --rendering --samples=7
node perf/gate.mjs /path/to/baseline-rendering/results.json /path/to/candidate-rendering/results.json

# Separate retention pass; includes 100 warmed cycles at count=100.
node perf/run.mjs --samples=7 --counts=100
node perf/gate.mjs /path/to/baseline-retention/results.json /path/to/candidate-retention/results.json
```

The gate fails incomplete, duplicate, incompatible, or missing measurements.
It compares p75 startup task time, FCP, scrolling task time, idle task time,
mounted JS heap and DOM counts against the same implementation's baseline.
A regression fails above **15% AND the metric's absolute noise allowance**:
5 ms task work, 16 ms FCP, 2 ms idle work, 64 KiB JS heap, 4 DOM nodes.
These are initial engineering guardrails, not statistically proven noise bounds.
Keep the raw distribution; investigate failures and repeat paired runs on an idle
machine rather than automatically updating the baseline. The comparison alone
does not certify an improvement or a good absolute page experience.

Rendering runs require zero long tasks/long animation frames starting during the
scroll/idle window and at most 0.001 total non-input layout shift per trial.
This sums all shifts (stricter than session-window CLS). Unsupported observation
APIs fail certification. Startup long frames remain in the raw report for review;
the 1,000-logo stress case is not given a fictitious universal startup deadline.
Retention runs allow no DOM/listener/document growth and at most 128 KiB warmed
JS heap growth after 100 cycles. This finite workload cannot prove leak freedom.
The idle window is two seconds: it catches continuous work, not slow timers.

The five-sample historical results predate these gates and cannot certify them.
Use traces and real-device testing for paint/raster/compositor work; these gates
do not claim FPS, total process memory, or field INP measurements.

For a quick harness check or a separately instrumented trace:

```sh
node perf/run.mjs --samples=1 --counts=100 --steps=4 --cycles=5 --cpu=1
node perf/run.mjs --samples=1 --counts=100 --steps=4 --cycles=5 --cpu=4 --trace
node ../benchmark/profiling/summarize.mjs .profiles/<trace-run>/*.json.gz
```

Use at least five samples for comparisons. A trace run incurs extra overhead;
do not combine it with untraced timing samples. The existing trace summarizer
reports paint/layout/task events inside the marked workloads. Raw traces can
also be opened in Chrome DevTools. `--steps` must be positive and even so each
workload restores its initial size/theme. `--counts` selects from 1,100,1000;
omitting 100 also omits allocation sampling and teardown churn.

To rebuild only these fixtures after building the library packages, use
`bun run build:perf` in `apps/elements`. `bun run test:perf` validates their
workload contracts. Both the fixture builds and their correctness checks are
also included in the normal elements build/test pipeline.

## Comparison contract

| Page | Startup | Update driver |
| --- | --- | --- |
| Static | Exact existing React SVG output rendered at build time; zero shipped JS | Test-injected native DOM edits, installed after startup is measured |
| React | Current production component plus React/React DOM | Local state in each logo cell; updating one does not rerender the list |
| Preact | Same component and local-state driver through `preact/compat` | Same workload, no React runtime in its graph |
| Lit | Production element plus Lit | Set properties on selected instances; await `updateComplete` |
| Adapter | Production React wrapper plus both runtimes | Local React state followed by the Lit update |

All variants render the same full mono logo at 24px, with identical fixed cell
layout and minimal CSS. The fixture supplies only the foreground rule the React
logo needs; it does not burden React with the full catalog stylesheet. The
monochrome artwork also avoids generated gradient-ID differences in the static
reference. The normal consumer tests cover all the other visual variants.
At 1,000 instances most logos are below the fold; this workload includes their
DOM/layout costs but is not a scrolling or virtualization benchmark.

Each variant is built in a separate Vite invocation. Module-graph assertions
reject React in the Lit entry, Lit in the legacy React entry, and SSR code in
all client entries. The Preact entry additionally requires Preact and excludes
React and Lit. `dist/perf/bundles.json` records final raw/gzip/Brotli bytes
per resource, including the benchmark driver and the complete runtime. These
figures differ from the plain consumer budget, which has a different driver.
Inline CSS is already included in HTML size; do not add it again. Static HTML
size scales with count and must be included in transfer comparisons.

The isolated pages answer the cost of choosing an implementation for a page.
They do not estimate the incremental bytes when an application already has
React or Lit loaded. That requires profiling the actual application graph.

## Workloads and measurements

Each trial uses a fresh browser context, HTTP cache disabled, fixed viewport/DPR,
and a recorded Chromium version and CPU throttle. The browser process and OS
caches can still be warm. Local HTTP has no network throttling, so calculated
compressed sizes and observed encoded response bytes are distinct measurements.
CPU slowdown is not a simulation of mobile memory bandwidth or GPU behavior.

- **Startup:** navigation to component-ready and FCP, encoded body bytes, and
  CDP main-thread/script/layout/style durations collected before any GC or
  static test-driver injection. Static readiness is DOMContentLoaded; dynamic
  readiness is completion of the initial render. These are not identical
  lifecycle events. FCP is the common visual milestone for these logo-only pages.
- **One/all updates:** alternate height between 32px and 24px for one item or all
  items. Warm each scenario first, then collect task/script/layout/style time
  and counts. Each step allows paint between updates. Reported wall time includes
  frame waits and is not a useful throughput metric by itself.
- **Theme:** toggle an inherited foreground variable. Correctness tests require
  no component DOM mutations; CSS recalculation/paint can still cost time.
- **Idle:** measure main-thread work over two seconds with no component actions. Browser
  and test-protocol housekeeping can produce nonzero work.
- **Mounted memory:** retained JS heap after forced GC, allocated heap capacity,
  DOM nodes, documents, and JS event listeners. Whole-page heap includes the
  driver/runtime and is not a per-component allocation figure. JS heap excludes
  native DOM/style/layout memory: a flat static-page JS heap does not make a
  large SVG document free. These figures do not measure total renderer memory.
- **Allocations:** a separate instrumented repetition at 100 instances using
  CDP heap sampling, including collected objects. Sampled bytes are estimates;
  zero means no allocation was sampled, not that no allocation occurred. These
  measurements are never folded into the uninstrumented timing results.
- **Teardown:** warm mount/unmount once, collect GC and counters, then repeat
  mounting/removing 100 instances for 100 cycles and collect again. Retention
  deltas can include JIT or runtime caches. A flat DOM count is useful evidence,
  not proof that no detached DOM or other resource leaks exist; heap snapshots
  and repeated longer runs are the next step if retained heap keeps growing.

Mutation observers and identity checks run outside timed intervals. CI verifies
matching geometry, correct theme, no unrelated DOM writes on single-item
updates, SVG identity, no-op update completion, and remount behavior. The runner
also checks locality/identity in every trial. No profiler or forced GC runs
inside a normal timed update window.

CDP task duration includes script and browser work, plus harness overhead. Its
script/layout/style subsets overlap that total: do not add them together. For
paint details, use a separate trace run. Synthetic updates and FCP here are not
field INP, and a screenshot parity test is not a performance test.

The protocol measurements use [Performance](https://chromedevtools.github.io/devtools-protocol/tot/Performance/),
[HeapProfiler](https://chromedevtools.github.io/devtools-protocol/tot/HeapProfiler/),
and [Memory](https://chromedevtools.github.io/devtools-protocol/tot/Memory/).
The retained-heap and allocation mechanisms are Chromium laboratory tooling;
cross-browser correctness coverage does not imply cross-browser performance.

## Reading results

Compare medians and min/max spread, not a single favorable sample. Report
startup, update CPU, retained memory, and bytes separately. A direct Lit win
does not imply a React adapter win: the adapter pays for two runtimes and both
update systems. At 1,000 instances this is a stress test, not a typical website.

The next representative benchmark should run the same terminal recording through
both renderers only if update throughput becomes a migration priority. For the
current static website goal, first measure a representative page with static
content, fonts/images, and minimal interactive islands. No catalog migration
should depend solely on these small-component results.

`--static-ui` measures initial rendering, mounted JS heap, a two-second idle window
(500ms in the historical results),
and native wheel input on pages taller than the viewport. It skips component
updates, allocation sampling, and teardown churn. All five implementations run
in each sample; static output does not receive the injected update driver.
Scrolling permits two animation frames between wheel events. Its task duration
is not FPS, dropped-frame count, or field INP; use `--trace` for timeline review
and real-device testing for a smoothness claim. Non-scrollable cases report N/A.

## Initial measurements

The [60 trial records](./results/2026-11-08-logo.csv) and
[environment, bundle sizes, and source hashes](./results/2026-11-08-environment.json)
capture the November 8, 2026 run: headless Chromium 158.0.8127.18, Apple M5 Max,
macOS arm64, 900×900 viewport, 4x CPU slowdown, five samples per implementation
and density. The harness was measured in the working tree based on `03006fc`;
the recorded source hashes identify the benchmark files. No trials were omitted.

At **100 instances**, the medians and ranges were:

| Implementation | Startup task ms | 20 single-item updates, task ms | 20 all-item updates, task ms | Mounted JS heap KiB |
| --- | --- | --- | --- | --- |
| Static/native test driver | 44.4 [31.1–51.3] | 44.4 [35.9–51.7] | 83.2 [57.9–92.5] | 692.0 [692.0–692.0] |
| React | 78.0 [73.1–171.3] | 51.3 [48.5–91.6] | 92.5 [90.3–158.5] | 1837.7 [1834.3–1839.5] |
| Direct Lit | 38.7 [35.4–71.6] | 51.5 [43.8–75.7] | 127.0 [117.7–216.8] | 1123.1 [1123.1–1123.2] |
| React adapter | 85.9 [81.8–125.4] | 64.1 [53.6–78.6] | 174.1 [167.5–240.4] | 1905.5 [1905.4–1905.5] |

Direct Lit reduced startup task time and retained JS heap in this fixture, but
single-item update times overlapped React's and bulk updates were slower. At
1,000 instances the median all-item workload was 606.8ms for React, 931.1ms for
Lit, and 1220.7ms for the adapter. The spreads are substantial; these are local
laboratory observations, not portable speedup ratios.

At 100 instances, the CDP DOM counter was 414 for React and 2,036 for Lit
(including its template/shadow infrastructure). Lit's lower JS heap therefore
does not establish lower total browser memory; native DOM/style memory remains
outside that heap figure.

All implementations retained SVG identity, wrote no unrelated component DOM
during a single-item update, and needed no component DOM mutations for a theme
change. Nevertheless, CSS theme work was measurable: at 100 instances, median
task time for 20 toggles was 54.9ms for React and 83.8ms for Lit. Avoiding a
virtual DOM does not eliminate browser style/layout/paint work.

After 100 mount/unmount cycles at 100 instances, all four returned to their warm
empty-state DOM node counts. Median JS heap growth was 2.9 KiB for static,
41.2 KiB for React, 10.3 KiB for Lit, and 69.8 KiB for the adapter. This does not
prove leak freedom; additional cycles and heap snapshots are needed to determine
whether any retained allocation continues growing.

Final compressed JavaScript, including each benchmark driver and full runtime,
was 80,774 bytes gzip for React, 10,596 for Lit, 79,275 for the adapter, and zero
for static output. Static HTML still costs bytes: at 1,000 instances it was
47,044 bytes gzip. The adapter includes both runtimes yet is slightly smaller
than this legacy entry, which also includes its existing utility dependencies.
These isolated-page totals must not be mistaken for incremental app costs.

The evidence supports direct portable/static delivery for the logo, but does
not justify replacing React components on update-performance grounds. Investigate
the Lit bulk-update and CSS costs, then measure a shared playback workload before
promoting this approach for frequently updating surfaces.

## Static UI and Preact comparison

The website-oriented follow-up adds **Preact 11.2.0 through compat**, using the
same component/driver and rejecting React in its bundle. The
[75 trial records](./results/2026-11-08-static-ui.csv) and
[environment and sources](./results/2026-11-08-static-ui-environment.json) capture
five samples per implementation at 1/100/1,000 instances, using the same Chromium,
machine, viewport, and 4x CPU slowdown as above. The static page receives no
update driver in this mode. These are fresh same-run comparisons; do not combine
their medians with the earlier update-mode run.

At 100 logos, median [min, max]:

| Implementation | Startup task ms | FCP ms | Native wheel task ms | Mounted JS heap KiB |
| --- | --- | --- | --- | --- |
| Static HTML/SVG | 44.3 [32.5–57.4] | 48 [36–64] | 60.5 [51.2–67.7] | 588.7 |
| React | 102.0 [72.8–136.2] | 108 [80–144] | 60.4 [43.5–74.5] | 1838.6 |
| Preact/compat | 62.8 [41.0–64.9] | 64 [44–68] | 63.7 [38.6–74.4] | 1473.0 |
| Direct Lit | 52.3 [36.0–64.6] | 56 [40–68] | 55.5 [40.0–75.7] | 1123.1 |
| React adapter | 118.1 [76.7–160.6] | 124 [84–172] | 63.9 [42.0–85.3] | 1905.6 |

At 1,000 logos, Preact's median startup task time was 135.9ms versus React's
186.1ms and Lit's 179.4ms. Preact's advantage is workload-dependent, not a claim
that its virtual DOM is universally faster. Native wheel timings overlap widely
at each density and do not identify a smoothness winner. Static HTML paints
progressively: at 1,000 inline SVGs its median FCP was 56ms, even though total
startup task time reached 248.8ms while the large document finished parsing.

This run's compressed client JS totals, including drivers, were 80,997 bytes
gzip for React, 20,023 for Preact, 10,738 for Lit, 79,454 for the adapter, and zero
for static. Preact retains the existing React component through compat with a
smaller runtime, but still uses a virtual DOM. It is actively maintained:
[11.2.0 was released on November 6](https://github.com/preactjs/preact/releases),
including bundle-size improvements. Its core uses native DOM event listeners;
compat bridges React API differences. [Preact differences](https://preactjs.com/guide/v11/differences-to-react/)

For static websites, prioritize generated HTML/SVG/CSS and native controls first.
Equivalent unhydrated HTML does not become smoother because a different library
generated it on the server. Use Preact for a small existing-React island or Lit
for a portable standalone element when behavior requires client code, with
page-level measurements deciding between them. The next acceptance surface is a
representative static page with fonts/images, slow loading, layout stability,
native scrolling, and essential interaction—not repeated logo resizing.
