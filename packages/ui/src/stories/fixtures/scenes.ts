// Demo walkthroughs for CodeScene. The runtime behaviour shown (cross-language
// calls, hooks, coverage, samples) is illustrative and scripted, not recorded.
import type { CodeScene } from "../../lib/scene";

const ESC = "\x1b";

/** Step a debugger from TypeScript into Kotlin and then Python, as Elide's DevTools integration does. */
export const polyglotDebugScene: CodeScene = {
  files: [
    {
      name: "app.ts",
      lang: "ts",
      code: `import { greet } from "./Greeter.kt";

const names = ["Ada", "Grace"];
for (const name of names) {
  const message = greet(name);
  console.log(message);
}`,
    },
    {
      name: "Greeter.kt",
      lang: "kt",
      code: `import elide.runtime.python

fun greet(name: String): String {
    val banner = python("format").call("banner", name)
    return "Hello, $banner!"
}`,
    },
    {
      name: "format.py",
      lang: "py",
      code: `def banner(name: str) -> str:
    return f"✨ {name.upper()} ✨"`,
    },
  ],
  steps: [
    { label: "Set a breakpoint on the call into Kotlin", actions: [{ type: "breakpoint", file: "app.ts", line: 5, state: "set" }] },
    {
      label: "Run: execution pauses at the breakpoint",
      actions: [
        { type: "breakpoint", file: "app.ts", line: 5, state: "hit" },
        { type: "frame", stack: [{ name: "<module>", file: "app.ts", line: 5, lang: "TypeScript" }], locals: { name: '"Ada"', names: '["Ada", "Grace"]' } },
      ],
    },
    {
      label: "Step into greet(), now in Kotlin",
      actions: [
        { type: "focus", file: "Greeter.kt", line: 4 },
        {
          type: "frame",
          stack: [
            { name: "greet", file: "Greeter.kt", line: 4, lang: "Kotlin" },
            { name: "<module>", file: "app.ts", line: 5, lang: "TypeScript" },
          ],
          locals: { name: '"Ada"' },
        },
      ],
    },
    {
      label: "Step into banner(), now in Python",
      actions: [
        { type: "focus", file: "format.py", line: 2 },
        {
          type: "frame",
          stack: [
            { name: "banner", file: "format.py", line: 2, lang: "Python" },
            { name: "greet", file: "Greeter.kt", line: 4, lang: "Kotlin" },
            { name: "<module>", file: "app.ts", line: 5, lang: "TypeScript" },
          ],
          locals: { name: "'Ada'" },
        },
      ],
    },
    {
      label: "Return to Kotlin with the banner",
      actions: [
        { type: "focus", file: "Greeter.kt", line: 5 },
        {
          type: "frame",
          stack: [
            { name: "greet", file: "Greeter.kt", line: 5, lang: "Kotlin" },
            { name: "<module>", file: "app.ts", line: 5, lang: "TypeScript" },
          ],
          locals: { name: '"Ada"', banner: '"✨ ADA ✨"' },
        },
      ],
    },
    {
      label: "Back in TypeScript: log the message",
      actions: [
        { type: "focus", file: "app.ts", line: 6 },
        {
          type: "frame",
          stack: [{ name: "<module>", file: "app.ts", line: 6, lang: "TypeScript" }],
          locals: { name: '"Ada"', message: '"Hello, ✨ ADA ✨!"' },
        },
        { type: "terminal", write: "Hello, ✨ ADA ✨!\n" },
      ],
    },
  ],
};

/** Lines flash as hooks observe a request (illustrative hook API). */
export const insightHooksScene: CodeScene = {
  files: [
    {
      name: "server.ts",
      lang: "ts",
      code: `import { serve } from "elide:http";
import { hooks } from "./hooks";

hooks.on("request", (event) => event.tag("route", event.route));
hooks.on("query", (event) => event.time());

serve({ port: 3000 }, async (request) => {
  const user = await db.get(request.params.id);
  return Response.json(user);
});`,
    },
  ],
  steps: [
    { label: "Server listening", actions: [{ type: "terminal", write: `${ESC}[36mListening${ESC}[0m on http://localhost:3000\n` }] },
    {
      label: "GET /users/1 arrives: the request hook fires",
      actions: [
        { type: "flash", line: 4, tone: "insight", label: "request hook" },
        { type: "terminal", write: `${ESC}[2m→${ESC}[0m GET /users/1\n` },
      ],
    },
    { label: "The handler runs", actions: [{ type: "focus", line: 7 }, { type: "flash", line: 7, tone: "info" }] },
    {
      label: "db.get() queries: the query hook times it",
      actions: [
        { type: "focus", line: 8 },
        { type: "flash", line: 5, tone: "insight", label: "query hook" },
        { type: "terminal", write: `  ${ESC}[35mquery${ESC}[0m users.get ${ESC}[2m1.2ms${ESC}[0m\n` },
      ],
    },
    {
      label: "Response sent, tagged with its route",
      actions: [
        { type: "focus", line: 9 },
        { type: "flash", line: 9, tone: "success" },
        { type: "terminal", write: `${ESC}[2m←${ESC}[0m ${ESC}[32m200${ESC}[0m in 4ms  ${ESC}[2mroute=/users/:id${ESC}[0m\n` },
      ],
    },
  ],
};

/** Coverage fills in as a test run executes. */
export const coverageScene: CodeScene = {
  files: [
    {
      name: "math.ts",
      lang: "ts",
      code: `export function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}`,
    },
  ],
  steps: [
    {
      label: "Instrument: five executable lines, none run yet",
      actions: [{ type: "coverage", lines: { 2: 0, 3: 0, 4: 0, 8: 0, 9: 0 } }],
    },
    {
      label: "clamp(5, 0, 10) stays in range",
      actions: [
        { type: "coverage", lines: { 2: 1, 3: 1, 4: 1 }, branches: { 2: [1, 2], 3: [1, 2] } },
        { type: "terminal", write: `${ESC}[32m✓${ESC}[0m clamp keeps values in range\n` },
      ],
    },
    {
      label: "clamp(-1, 0, 10) returns the minimum",
      actions: [
        { type: "coverage", lines: { 2: 1 }, branches: { 2: [2, 2] } },
        { type: "terminal", write: `${ESC}[32m✓${ESC}[0m clamp returns the minimum\n` },
      ],
    },
    {
      label: "mean([2, 4]) averages; the empty-array branch is never taken",
      actions: [
        { type: "coverage", lines: { 8: 1, 9: 1 }, branches: { 8: [1, 2] } },
        { type: "terminal", write: `${ESC}[32m✓${ESC}[0m mean averages values\n${ESC}[33m!${ESC}[0m 2 partially covered branches\n` },
      ],
    },
  ],
};

/** Profiler samples accumulate and the hotspot heats up. */
export const hotspotScene: CodeScene = {
  files: [
    {
      name: "render.ts",
      lang: "ts",
      code: `export function render(rows: { values: number[] }[]) {
  const out: string[] = [];
  for (const row of rows) {
    const cells = row.values.map(format);
    out.push(cells.join(" | "));
  }
  return out.join("\\n");
}

function format(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}`,
    },
  ],
  steps: [
    {
      label: "Start sampling while rendering 10,000 rows",
      actions: [{ type: "profile", samples: { 3: 2, 4: 3, 11: 9 } }],
    },
    { label: "More samples: format() is taking most of the time", actions: [{ type: "profile", samples: { 4: 4, 5: 3, 11: 26 } }] },
    {
      label: "Hotspot: toLocaleString() builds a formatter per call",
      actions: [
        { type: "profile", samples: { 4: 2, 5: 2, 11: 41 } },
        { type: "flash", line: 11, tone: "warning", label: "hotspot" },
        { type: "terminal", write: `${ESC}[33mhotspot${ESC}[0m render.ts:11 ${ESC}[2m(83% of samples)${ESC}[0m\n` },
      ],
    },
  ],
};
