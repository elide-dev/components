import { describe, expect, it } from "vitest";
import { createPlayback, cueIndexAt, type PlaybackClock } from "./playback";

/** Manual clock: `advance(ms)` moves time and runs the pending frame. */
function manualClock() {
  let now = 0;
  let pending: (() => void) | undefined;
  const clock: PlaybackClock = {
    now: () => now,
    requestFrame: (callback) => {
      pending = callback;
      return 1;
    },
    cancelFrame: () => {
      pending = undefined;
    },
  };
  return {
    clock,
    advance(ms: number) {
      now += ms;
      const run = pending;
      pending = undefined;
      run?.();
    },
    get scheduled() {
      return pending !== undefined;
    },
  };
}

describe("cueIndexAt", () => {
  it("finds the last cue at or before a time", () => {
    expect(cueIndexAt([1, 2, 3], 0.5)).toBe(-1);
    expect(cueIndexAt([1, 2, 3], 1)).toBe(0);
    expect(cueIndexAt([1, 2, 3], 2.5)).toBe(1);
    expect(cueIndexAt([1, 2, 3], 9)).toBe(2);
  });
});

describe("createPlayback", () => {
  it("does not leave a pending frame when a subscriber pauses at a breakpoint", () => {
    const harness = manualClock();
    const playback = createPlayback({ duration: 10, clock: harness.clock });
    playback.subscribe(state => { if (state.playing && state.time >= 1) playback.pause(); });
    playback.play();
    harness.advance(1000);
    expect(playback.getState().playing).toBe(false);
    expect(harness.scheduled).toBe(false);
  });

  it("advances with the clock, scaled by speed", () => {
    const { clock, advance } = manualClock();
    const playback = createPlayback({ duration: 10, clock });
    playback.play();
    advance(1000);
    expect(playback.getState().time).toBeCloseTo(1);
    playback.setSpeed(2);
    advance(1000);
    expect(playback.getState().time).toBeCloseTo(3);
  });

  it("stops at the end and restarts from zero on the next play", () => {
    const { clock, advance } = manualClock();
    const playback = createPlayback({ duration: 2, clock });
    playback.play();
    advance(5000);
    expect(playback.getState()).toMatchObject({ time: 2, playing: false, ended: true });
    playback.play();
    expect(playback.getState()).toMatchObject({ time: 0, playing: true, ended: false });
  });

  it("wraps around when looping", () => {
    const { clock, advance } = manualClock();
    const playback = createPlayback({ duration: 2, clock, loop: true });
    playback.play();
    advance(2500);
    expect(playback.getState().time).toBeCloseTo(0.5);
    expect(playback.getState().playing).toBe(true);
  });

  it("pauses and stops scheduling frames", () => {
    const harness = manualClock();
    const playback = createPlayback({ duration: 10, clock: harness.clock });
    playback.play();
    harness.advance(500);
    playback.pause();
    expect(harness.scheduled).toBe(false);
    harness.advance(5000);
    expect(playback.getState().time).toBeCloseTo(0.5);
  });

  it("seeks within bounds and keeps playing from the new position", () => {
    const { clock, advance } = manualClock();
    const playback = createPlayback({ duration: 10, clock });
    playback.seek(-3);
    expect(playback.getState().time).toBe(0);
    playback.seek(42);
    expect(playback.getState().time).toBe(10);
    playback.seek(4);
    playback.play();
    advance(1000);
    expect(playback.getState().time).toBeCloseTo(5);
    playback.seekBy(-2);
    advance(500);
    expect(playback.getState().time).toBeCloseTo(3.5);
  });

  it("steps between cues and pauses", () => {
    const { clock, advance } = manualClock();
    const playback = createPlayback({ duration: 10, clock, cues: [6, 2, 4] });
    playback.play();
    advance(1000);
    playback.step(1);
    expect(playback.getState()).toMatchObject({ time: 2, playing: false });
    playback.step(1);
    expect(playback.getState().time).toBe(4);
    playback.step(1);
    playback.step(1); // no cue after 6: stays
    expect(playback.getState().time).toBe(6);
    playback.seek(5);
    playback.step(-1); // between cues: back to the current cue's start
    expect(playback.getState().time).toBe(4);
    playback.step(-1);
    expect(playback.getState().time).toBe(2);
    playback.step(-1);
    expect(playback.getState().time).toBe(0);
  });

  it("notifies subscribers and stops after dispose", () => {
    const { clock } = manualClock();
    const playback = createPlayback({ duration: 10, clock });
    const seen: number[] = [];
    const unsubscribe = playback.subscribe((state) => seen.push(state.time));
    playback.seek(3);
    unsubscribe();
    playback.seek(4);
    expect(seen).toEqual([3]);
    playback.dispose();
    expect(playback.getState().playing).toBe(false);
  });

  it("clamps the position when the duration shrinks", () => {
    const { clock } = manualClock();
    const playback = createPlayback({ duration: 10, clock, time: 8 });
    playback.setDuration(5);
    expect(playback.getState()).toMatchObject({ time: 5, duration: 5 });
  });
});
