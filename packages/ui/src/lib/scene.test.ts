import { describe, expect, it } from "vitest";
import { coveragePercent, sceneStateAt, sceneTimeline, type CodeScene } from "./scene";

const scene: CodeScene = {
  files: [
    { name: "app.ts", lang: "ts", code: "a\nb\nc" },
    { name: "greet.kt", lang: "kt", code: "x\ny" },
  ],
  steps: [
    { label: "Set a breakpoint", actions: [{ type: "breakpoint", line: 2, state: "set" }] },
    {
      label: "Run",
      duration: 2,
      actions: [
        { type: "breakpoint", line: 2, state: "hit" },
        { type: "frame", stack: [{ name: "main", file: "app.ts", line: 2 }], locals: { name: '"Ada"' } },
        { type: "coverage", lines: { 1: 1, 2: 1, 3: 0 } },
      ],
    },
    {
      label: "Step into Kotlin",
      actions: [
        { type: "focus", file: "greet.kt", line: 1 },
        { type: "flash", line: 1, tone: "insight", label: "hook" },
        { type: "profile", samples: { 1: 3, 2: 1 } },
        { type: "terminal", write: "Hello\n" },
      ],
    },
    { label: "More samples", actions: [{ type: "profile", file: "greet.kt", samples: { 1: 1 } }, { type: "coverage", file: "app.ts", lines: { 3: 2 }, branches: { 2: [1, 2] } }] },
  ],
};

describe("scenes", () => {
  it("lays steps out on a timeline", () => {
    const { cues, duration } = sceneTimeline(scene);
    expect(cues.map((cue) => +cue.toFixed(6))).toEqual([0, 1.6, 3.6, 5.2]);
    expect(duration).toBeCloseTo(6.8);
  });

  it("starts empty", () => {
    const state = sceneStateAt(scene, -1);
    expect(state).toMatchObject({ step: -1, activeFile: "app.ts", terminal: "", breakpointHit: false });
    expect(state.decorations["app.ts"]).toEqual([]);
  });

  it("sets, hits and releases breakpoints; the hit moves the arrow", () => {
    expect(sceneStateAt(scene, 0).decorations["app.ts"]).toEqual([{ line: 2, kind: "breakpoint" }]);
    const hit = sceneStateAt(scene, 1);
    expect(hit.breakpointHit).toBe(true);
    expect(hit.decorations["app.ts"]).toEqual([{ line: 2, kind: "breakpoint-hit" }]);
    expect(hit.frame).toEqual({ stack: [{ name: "main", file: "app.ts", line: 2 }], locals: { name: '"Ada"' } });
    // On the next step the hit is over: the breakpoint stays set.
    expect(sceneStateAt(scene, 2).decorations["app.ts"]).toEqual([{ line: 2, kind: "breakpoint" }]);
  });

  it("follows focus across files, flashes only on its own step, and accumulates output", () => {
    const state = sceneStateAt(scene, 2);
    expect(state.activeFile).toBe("greet.kt");
    expect(state.decorations["greet.kt"]).toEqual([
      { line: 1, kind: "cursor" },
      { line: 1, kind: "flash", tone: "insight", label: "hook" },
    ]);
    expect(state.terminal).toBe("Hello\n");
    expect(sceneStateAt(scene, 3).decorations["greet.kt"]).toEqual([{ line: 1, kind: "cursor" }]);
  });

  it("accumulates coverage (with branches) and profile samples", () => {
    const state = sceneStateAt(scene, 3);
    expect(state.insights["app.ts"].coverage).toEqual({ 1: { hits: 1 }, 2: { hits: 1, branches: { covered: 1, total: 2 } }, 3: { hits: 2 } });
    expect(state.insights["greet.kt"].profile).toEqual({ total: 5, lines: { 1: { self: 4, total: 4 }, 2: { self: 1, total: 1 } } });
    expect(coveragePercent(sceneStateAt(scene, 1).insights["app.ts"])).toBe(67);
    expect(coveragePercent(state.insights["app.ts"])).toBe(100);
    expect(coveragePercent(state.insights["greet.kt"])).toBeUndefined();
  });

  it("is pure: stepping back equals replaying", () => {
    expect(sceneStateAt(scene, 1)).toEqual(sceneStateAt(scene, 1));
    expect(sceneStateAt(scene, 99).step).toBe(3);
  });
});
