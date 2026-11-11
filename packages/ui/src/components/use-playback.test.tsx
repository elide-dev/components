import * as React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Playback, PlaybackState } from "../lib/playback";
import { usePlayback } from "./use-playback";

describe("usePlayback commit", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "setTimeout", "clearTimeout"] }));
  afterEach(() => vi.useRealTimers());

  function Probe({ commit, onRender, onPlayback }: {
    commit?: (committed: PlaybackState, next: PlaybackState) => boolean;
    onRender: (state: PlaybackState) => void;
    onPlayback: (playback: Playback) => void;
  }) {
    const [state, playback] = usePlayback({ duration: 10, commit });
    React.useEffect(() => { onRender(state); }, [onRender, state]);
    React.useEffect(() => onPlayback(playback), [playback, onPlayback]);
    return null;
  }

  /** One frame per act(), so React renders after each tick instead of batching them. */
  function frames(count: number) {
    for (let i = 0; i < count; i++) act(() => { vi.advanceTimersByTime(16); });
  }

  function setup(commit?: (committed: PlaybackState, next: PlaybackState) => boolean) {
    const renders: PlaybackState[] = [];
    let playback!: Playback;
    render(<Probe commit={commit} onRender={(state) => renders.push(state)} onPlayback={(value) => { playback = value; }} />);
    return { renders, get playback() { return playback; } };
  }

  it("renders every frame without a commit predicate", () => {
    const probe = setup();
    act(() => probe.playback.play());
    const before = probe.renders.length;
    frames(30);
    expect(probe.renders.length - before).toBeGreaterThanOrEqual(25);
  });

  it("skips time-only frames the predicate declines, and always renders other changes", () => {
    // Commit at most every half second of playback.
    const probe = setup((committed, next) => next.time - committed.time >= 0.5);
    act(() => probe.playback.play());
    const before = probe.renders.length;
    frames(63); // ~1 s
    const playing = probe.renders.length - before;
    expect(playing).toBeGreaterThanOrEqual(1);
    expect(playing).toBeLessThanOrEqual(3);
    act(() => probe.playback.pause());
    const last = probe.renders.at(-1)!;
    expect(last.playing).toBe(false);
    // The paused state carries the clock's latest time, not the last committed one.
    expect(last.time).toBeCloseTo(probe.playback.getState().time, 5);
  });

  it("uses an updated predicate without interrupting playback", () => {
    const renders: PlaybackState[] = [];
    let playback!: Playback;
    const onRender = (state: PlaybackState) => { renders.push(state); };
    const onPlayback = (value: Playback) => { playback = value; };
    const probe = render(<Probe commit={() => false} onRender={onRender} onPlayback={onPlayback} />);
    act(() => playback.play());
    frames(10);
    const before = renders.length;
    probe.rerender(<Probe commit={() => true} onRender={onRender} onPlayback={onPlayback} />);
    frames(10);
    expect(renders.length - before).toBeGreaterThanOrEqual(8);
    expect(playback.getState().playing).toBe(true);
  });
});
