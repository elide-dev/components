# Performance acceptance contract

Optimize static rendering, low idle cost, memory retention, and smooth native
interaction. A framework change passes only when the intended delivery improves
without sacrificing visual, accessibility, localization, or behavior parity.
React/Preact remains supported for complex dashboard components; Lit support is
not a universal requirement. Static markup needs no component runtime.

## Measures and gates

| Motivation | Measurement | Acceptance |
| --- | --- | --- |
| Lightweight delivery | Complete production JS gzip/Brotli; HTML, CSS, fonts and images separately | Zero runtime JS for static fixtures. Explicit reviewed per-island byte ceilings. No React in direct Lit, no React runtime in Preact, no server renderer in client bundles. |
| Low CPU | Main-thread task milliseconds from navigation through ready/paint, and during fixed interaction workloads | Same-runner p75 regression no greater than 15% or the absolute noise allowance, whichever is larger. Report style/layout separately; do not sum overlapping task/script/layout counters. |
| Fast first draw | FCP, visible geometry with JS disabled; page-level LCP | No content hidden behind hydration. Compare FCP against baseline, reserve geometry before upgrade. Whole pages must meet LCP targets below. |
| Smoothness | Long tasks and long animation frames during a fixed native scroll/interaction sequence; trace paint/raster/compositor stages | Zero >50 ms long tasks/frames during the logo scroll/idle window. Review real-device frames before claiming smoothness; a 50 ms gate alone is insufficient for 60/120 Hz rendering. |
| Layout stability | Layout Shift entries, upgrade geometry and focused-node identity | At most 0.001 total non-input shift in the logo fixture; no visible hydration shift or lost focus. |
| Idle efficiency | Fixed idle-window task time; component timers, subscriptions, observers | No continuous component work when idle; suspend optional animation when hidden, disconnected, or reduced motion is requested. No long tasks/frames in observed idle window. |
| Memory | Post-GC JS heap, DOM nodes/documents/listeners; repeated mount/unmount | No retained DOM/listener/document growth. Logo: at most 128 KiB warmed JS heap growth after 100 cycles; investigate rising retention over successive batches. |
| Native browser behavior | Keyboard, focus, forms, links, selection, scrolling, reduced motion and forced colors | Preserve platform semantics and accessibility in Chromium, Firefox and WebKit. Native API use is a means, not a score. |

See [the executable logo gates](../apps/elements/perf/README.md#acceptance-gates)
for commands, exact byte ceilings, noise allowances and current coverage.
Ordinary CI runs deterministic byte, dependency, parity and lifecycle checks.
Timing gates require baseline/candidate runs on the same quiet performance host,
with at least seven samples, identical browser/settings and rotating variant order.
Record commit, dirty state, hardware and full distributions. Trace and observer
instrumentation run separately. Never relax ceilings or replace baselines simply
to get a green result; review the change and its user benefit.

## Promotion of additional components

Each migration adds a production fixture covering its actual use: a static
marketing page (logo, navigation, cards, badges, stats), documentation page
(callouts, code, copy controls), or interactive dashboard surface. Measure both
the server-rendered initial page and the necessary islands. Exercise keyboard
and pointer interactions, theme changes, resizing, teardown/reconnect and
background/foreground transitions. Heavy dashboards only need React/Preact
fixtures. Keep imports isolated so adding a portable component does not inflate
the logo-only entry point.

Freeze byte ceilings and absolute CPU/paint budgets from representative mobile
hardware before promoting a new fixture. Keep the static reference, React and
Preact alternatives: using native DOM or Lit does not itself establish a win.
A smaller JS heap with more shadow nodes may still increase native browser
memory. CDP JS heap excludes native DOM, renderer and GPU allocations; use
isolated browser-process/OS profiling for those, with instrumentation recorded.
Do not label heap numbers as total RAM or main-thread time as system CPU usage.

On 60 Hz and 120 Hz displays the entire frame has approximately 16.7 ms and
8.3 ms respectively, shared with browser work. Track missed presentation
deadlines on actual target devices and inspect paint/raster/layer costs; rAF
intervals and wheel task duration are not compositor FPS. Avoid blanket
`will-change` promotion, unnecessary observers and JS scroll handlers.

## Whole-page outcomes

At the 75th percentile, segmented by mobile/desktop, require **LCP ≤2.5 s,
INP ≤200 ms, CLS ≤0.1**. These are established page-level thresholds, not
component microbenchmark guarantees. Capture production field data once deployed;
synthetic clicks, local HTTP and a CPU throttle cannot certify field outcomes.
[Web Vitals guidance](https://web.dev/articles/vitals).

Long animation frames identify rendering updates delayed beyond 50 ms, including
multiple shorter tasks that together delay a frame. They complement long-task
measurements, but do not detect every missed 60/120 Hz deadline.
[Long Animation Frames API](https://developer.chrome.com/docs/web-platform/long-animation-frames).
