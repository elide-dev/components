# Rendering profiles

Use the production `/performance.html` fixture to compare changes through the
official [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp).
It contains 80 document sections and 250 commands. Keep the browser version,
viewport, CPU throttle, and machine conditions consistent across revisions.

From the repository root, build the benchmark and its dependencies, then serve it:

```sh
bun run build --filter=@elide/benchmark...
bun --cwd apps/benchmark --bun run preview --port 4173
```

Create `apps/benchmark/.profiles` for local trace files; this directory is ignored
by Git. Open `http://127.0.0.1:4173/performance.html` with MCP. Use the returned
page ID wherever the server's tool schema requests one.

1. Call `emulate` with `cpuThrottlingRate: 4` and `viewport: "1440x1000x1"` in
   the same call. Keep other emulation settings consistent; this tool replaces
   prior settings on each call.
2. Call `performance_start_trace` with `reload: true` and `autoStop: false`.
3. Call `evaluate_script` with `waitForStableDom: false` and this function:

   ```js
   async () => {
     await document.fonts.ready;
     await new Promise(resolve => setTimeout(resolve, 250));
   }
   ```

4. Call `evaluate_script` with `sourcePath` set to the absolute path of
   `scroll.js` or `commands.js` in this directory, `format: "function"`, and
   `waitForStableDom: false`. Save its returned frame-interval diagnostics with
   the sample. The files contain function expressions, not ES modules.
5. Call `performance_stop_trace` with `filePath` set to an absolute path ending in
   `apps/benchmark/.profiles/scroll-before-1.json.gz`.
6. Repeat from step 2 for three samples per scenario and revision. Reloading
   resets search and scroll state. Avoid builds, tests, and unrelated browser
   activity during capture. Compare the samples and their spread.

```sh
node apps/benchmark/profiling/summarize.mjs apps/benchmark/.profiles/*.json.gz
```

The summary accepts `.json` and `.json.gz` traces and reports every valid
`eld:{scenario}:start`/`end` window. Only complete trace events on the marks'
process and thread are counted. Boundary-spanning event durations are clipped
to the window. Counts include events overlapping the window; `ms` and `maxMs`
are inclusive durations. Categories nest, so their totals must not be added
together. Missing or invalid mark pairs produce warnings rather than invented
zero-cost samples; malformed files produce an error and a nonzero exit status.

The scroll driver advances across the document on 181 animation frames. The
command driver opens the palette, lets its entrance settle, and dispatches 90
ArrowDown events before closing it. Their timing windows exclude navigation,
font loading, and the palette's entrance and exit. These synthetic events and
animation-frame intervals are **not INP measurements or proof of real-world
frame rates**. Inspect the trace and follow up with real pointer, keyboard, and
scroll interactions on representative devices.

`performance-check.mjs` runs with the benchmark's normal test command in CI.
It asserts stable geometry, scroll-spy behavior after layout changes, filtering,
selection, and focus. Timing comparisons stay local because noisy millisecond
thresholds would make CI unreliable.

## November 6, 2026 measurements

The [recorded samples](./2026-11-06.csv) compare components from `c852f44` with
the changes accompanying this report, using the same fixture on macOS arm64,
headless Chrome 157, Chrome DevTools MCP 1.12.0, a 1440×1000 viewport, 4× CPU
slowdown, and no network throttling. These are medians of three local samples;
the scrolling window is approximately 3.05 seconds and command navigation is
approximately 1.53 seconds.

| Interaction metric | Before | After |
| --- | ---: | ---: |
| Scroll: layout passes | 79 | 0 |
| Scroll: layout time | 48.6 ms | 0 ms |
| Scroll: main-thread task time | 809.4 ms | 717.0 ms |
| Commands: layout passes | 90 | 0 |
| Commands: layout time | 33.6 ms | 0 ms |
| Commands: FunctionCall time | 265.6 ms | 149.6 ms |
| Commands: paint time | 130.5 ms | 172.7 ms |
| Commands: main-thread task time | 562.0 ms | 402.3 ms |

TOC links now retain the same font weight as their active state changes. Command
rows are memoized, group offsets replace repeated index searches, and the return
indicator retains its space using `visibility`. An intermediate version using
SVG opacity still caused a layout pass on every selection change in Chrome.

Command paint time increased in these samples, while total main-thread task time
fell about 28%. Keeping the indicators mounted adds DOM nodes; the overall
measurement favors the change for this navigation workload. It does not measure
palette opening, filtering, or memory consumption. Neither baseline nor final
samples had animation-frame intervals above 25 ms, so these results show reduced
work and extra frame-budget headroom, not a demonstrated dropped-frame fix.
