import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const eventNames = ["Layout", "UpdateLayoutTree", "Paint", "FunctionCall", "RunTask"];
const milliseconds = microseconds => Math.round(microseconds) / 1000;

function summarize(events) {
  const groups = new Map();
  const warnings = [];
  for (const event of events) {
    if (!event || typeof event.name !== "string"
      || !event.cat?.split(",").includes("blink.user_timing")) continue;
    const match = /^eld:([^:]+):(start|end)$/.exec(event.name);
    if (!match) continue;
    if (![event.ts, event.pid, event.tid].every(Number.isFinite)) {
      warnings.push(`Invalid timestamp or thread identity for ${event.name}.`);
      continue;
    }
    const [, scenario, edge] = match;
    const key = `${scenario}:${event.pid}:${event.tid}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...event, scenario, edge });
  }

  const windows = [];
  for (const [key, marks] of groups) {
    marks.sort((a, b) => a.ts - b.ts);
    for (let index = 0; index < marks.length; index += 2) {
      const start = marks[index];
      const end = marks[index + 1];
      if (start.edge !== "start" || end?.edge !== "end" || end.ts <= start.ts) {
        warnings.push(`Unpaired, overlapping, or empty mark window for ${key}.`);
        continue;
      }

      const totals = Object.fromEntries(eventNames.map(name => [name, { count: 0, ms: 0, maxMs: 0 }]));
      for (const event of events) {
        if (!event || event.ph !== "X" || event.pid !== start.pid || event.tid !== start.tid
          || !Object.hasOwn(totals, event.name) || !Number.isFinite(event.ts)
          || !Number.isFinite(event.dur) || event.dur < 0) continue;
        const eventEnd = event.ts + event.dur;
        if (event.ts >= end.ts || eventEnd < start.ts) continue;
        // Clip boundary-spanning work to the marked interaction. Categories
        // can nest (for example, Layout inside RunTask); do not sum categories.
        const duration = Math.min(eventEnd, end.ts) - Math.max(event.ts, start.ts);
        if (duration === 0 && event.dur !== 0) continue;
        const total = totals[event.name];
        total.count++;
        total.ms += duration;
        total.maxMs = Math.max(total.maxMs, duration);
      }
      for (const total of Object.values(totals)) {
        total.ms = milliseconds(total.ms);
        total.maxMs = milliseconds(total.maxMs);
      }
      windows.push({
        scenario: start.scenario,
        pid: start.pid,
        tid: start.tid,
        windowMs: milliseconds(end.ts - start.ts),
        ...totals,
      });
    }
  }
  if (groups.size === 0) warnings.push("No eld:{scenario}:start/end user-timing marks found.");
  return { windows, warnings };
}

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("Usage: node apps/benchmark/profiling/summarize.mjs trace.json[.gz] [...]");
  process.exitCode = 1;
} else {
  const reports = [];
  for (const file of paths) {
    try {
      const bytes = await readFile(file);
      const trace = JSON.parse((file.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString("utf8"));
      const events = Array.isArray(trace) ? trace : trace?.traceEvents;
      if (!Array.isArray(events)) throw new Error("Expected a traceEvents array or an event array.");
      reports.push({ file, ...summarize(events) });
    } catch (error) {
      reports.push({ file, windows: [], error: error instanceof Error ? error.message : String(error) });
      process.exitCode = 1;
    }
  }
  console.log(JSON.stringify(reports, null, 2));
}
