/**
 * Code scenes: scripted walkthroughs over one or more files — stepping a
 * debugger across languages, coverage filling in during a test run, profiling
 * hotspots heating up, lines flashing as hooks fire.
 *
 * A scene is a list of steps; each step is a list of actions. The state at a
 * step is a pure reduction of every step up to it, so stepping backwards,
 * scrubbing, server rendering and testing are all the same operation.
 */
import type { CodeInsights, DecorationTone, LineDecoration, LineRange, TraceFrame } from "./code-model";

export interface SceneFile {
  name: string;
  lang?: string;
  code: string;
}

export type SceneAction =
  /** Move the current-line arrow (and switch to its file). */
  | { type: "focus"; file?: string; line: number }
  /** Pulse a line or range for this step, e.g. "an Insight hook fired here". */
  | { type: "flash"; file?: string; line: number | LineRange; tone?: DecorationTone; label?: string }
  /** Set, hit (pause here) or clear a breakpoint. */
  | { type: "breakpoint"; file?: string; line: number; state: "set" | "hit" | "clear" }
  /** Replace the debugger frame: call stack (innermost first) and locals. */
  | { type: "frame"; stack: TraceFrame[]; locals?: Record<string, string> }
  /** Add line hit counts (0 marks an executable line not yet run) and branch coverage. */
  | { type: "coverage"; file?: string; lines: Record<number, number>; branches?: Record<number, [covered: number, total: number]> }
  /** Add profiler samples per line. */
  | { type: "profile"; file?: string; samples: Record<number, number> }
  /** Show a file without moving the arrow. */
  | { type: "select"; file: string }
  /** Append output (may contain ANSI) to the paired terminal. */
  | { type: "terminal"; write: string };

export interface SceneStep {
  /** Announced and shown as the step's caption. */
  label: string;
  actions: SceneAction[];
  /** Seconds this step holds during autoplay (default 1.6). */
  duration?: number;
}

export interface CodeScene {
  files: SceneFile[];
  steps: SceneStep[];
  /** Pause autoplay on steps that hit a breakpoint (default true). */
  pauseOnBreakpoint?: boolean;
}

export interface SceneFrame {
  stack: TraceFrame[];
  locals: Record<string, string>;
}

export interface SceneState {
  /** Index of the applied step (-1 before the first). */
  step: number;
  label?: string;
  activeFile: string;
  /** Per-file line decorations: breakpoints, the current line, this step's flashes. */
  decorations: Record<string, LineDecoration[]>;
  /** Per-file coverage and profile data, in the code model's insight shape. */
  insights: Record<string, CodeInsights>;
  frame?: SceneFrame;
  /** Everything written to the terminal so far. */
  terminal: string;
  /** This step hit a breakpoint. */
  breakpointHit: boolean;
}

export const DEFAULT_STEP_DURATION = 1.6;

/** Start time of each step and the total duration, for a playback clock. */
export function sceneTimeline(scene: CodeScene): { cues: number[]; duration: number } {
  const cues: number[] = [];
  let time = 0;
  for (const step of scene.steps) {
    cues.push(time);
    time += step.duration ?? DEFAULT_STEP_DURATION;
  }
  return { cues, duration: time };
}

/** State after applying steps `0..step` (pass -1 for the initial state). */
export function sceneStateAt(scene: CodeScene, step: number): SceneState {
  const first = scene.files[0]?.name ?? "";
  let activeFile = first;
  const breakpoints = new Map<string, Map<number, "set" | "hit">>();
  const coverage: Record<string, Record<number, number>> = {};
  const branches: Record<string, Record<number, [number, number]>> = {};
  const samples: Record<string, Record<number, number>> = {};
  let focus: { file: string; line: number } | undefined;
  let frame: SceneFrame | undefined;
  let terminal = "";
  let flashes: { file: string; decoration: LineDecoration }[] = [];
  let breakpointHit = false;
  const last = Math.min(step, scene.steps.length - 1);

  for (let index = 0; index <= last; index++) {
    const current = index === last;
    flashes = [];
    breakpointHit = false;
    // Hits are momentary: a breakpoint hit in an earlier step is just "set" again.
    for (const lines of breakpoints.values()) for (const [line, state] of lines) if (state === "hit") lines.set(line, "set");
    for (const action of scene.steps[index].actions) {
      const file = ("file" in action && action.file) || activeFile;
      switch (action.type) {
        case "focus":
          activeFile = file;
          focus = { file, line: action.line };
          break;
        case "select":
          activeFile = action.file;
          break;
        case "flash":
          if (current) flashes.push({ file, decoration: { line: action.line, kind: "flash", tone: action.tone, label: action.label } });
          break;
        case "breakpoint": {
          const lines = breakpoints.get(file) ?? new Map();
          breakpoints.set(file, lines);
          if (action.state === "clear") lines.delete(action.line);
          else lines.set(action.line, action.state);
          if (action.state === "hit") {
            activeFile = file;
            focus = { file, line: action.line };
            breakpointHit = current;
          }
          break;
        }
        case "frame":
          frame = { stack: action.stack, locals: action.locals ?? {} };
          break;
        case "coverage": {
          const lines = (coverage[file] ??= {});
          for (const [line, hits] of Object.entries(action.lines)) lines[Number(line)] = (lines[Number(line)] ?? 0) + hits;
          for (const [line, branch] of Object.entries(action.branches ?? {})) (branches[file] ??= {})[Number(line)] = branch;
          break;
        }
        case "profile": {
          const lines = (samples[file] ??= {});
          for (const [line, count] of Object.entries(action.samples)) lines[Number(line)] = (lines[Number(line)] ?? 0) + count;
          break;
        }
        case "terminal":
          terminal += action.write;
          break;
      }
    }
  }

  const decorations: Record<string, LineDecoration[]> = {};
  const insights: Record<string, CodeInsights> = {};
  for (const { name } of scene.files) {
    const list: LineDecoration[] = [];
    for (const [line, state] of breakpoints.get(name) ?? []) list.push({ line, kind: state === "hit" ? "breakpoint-hit" : "breakpoint" });
    if (focus?.file === name && !list.some((d) => d.kind === "breakpoint-hit" && d.line === focus!.line)) list.push({ line: focus.line, kind: "cursor" });
    list.push(...flashes.filter((flash) => flash.file === name).map((flash) => flash.decoration));
    decorations[name] = list;

    const fileInsights: CodeInsights = {};
    if (coverage[name]) {
      fileInsights.coverage = Object.fromEntries(
        Object.entries(coverage[name]).map(([line, hits]) => {
          const branch = branches[name]?.[Number(line)];
          return [line, branch ? { hits, branches: { covered: branch[0], total: branch[1] } } : { hits }];
        }),
      );
    }
    if (samples[name]) {
      const total = Object.values(samples[name]).reduce((sum, count) => sum + count, 0);
      fileInsights.profile = {
        total,
        lines: Object.fromEntries(Object.entries(samples[name]).map(([line, count]) => [line, { self: count, total: count }])),
      };
    }
    insights[name] = fileInsights;
  }

  return {
    step: last,
    label: last >= 0 ? scene.steps[last].label : undefined,
    activeFile,
    decorations,
    insights,
    frame,
    terminal,
    breakpointHit,
  };
}

/** Line coverage of a file's insights, as a 0–100 percentage (undefined without data). */
export function coveragePercent(insights: CodeInsights | undefined): number | undefined {
  const lines = insights?.coverage ? Object.values(insights.coverage) : [];
  if (!lines.length) return undefined;
  return Math.round((lines.filter((line) => line.hits > 0).length / lines.length) * 100);
}
