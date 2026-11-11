import * as React from "react";
import { createPlayback, type Playback, type PlaybackState } from "../lib/playback";

export interface UsePlaybackOptions {
  duration: number;
  cues?: readonly number[];
  loop?: boolean;
  speed?: number;
  /** Initial position (e.g. the poster frame). Later changes are applied with `seek`. */
  time?: number;
  /**
   * While playing, whether a time-only change is worth a render. The clock
   * ticks every animation frame; a consumer whose output changes less often
   * (a recording between output events) returns false to skip the render.
   * State changes other than time always render.
   */
  commit?: (committed: PlaybackState, next: PlaybackState) => boolean;
}

/**
 * Binds a `Playback` clock to React state. The clock is created once; option
 * changes are pushed into it. Playback pauses while the document is hidden.
 */
export function usePlayback(options: UsePlaybackOptions): [PlaybackState, Playback] {
  // Created once, lazily; later option changes are pushed in by the effects below.
  const [playback] = React.useState(() =>
    createPlayback({
      duration: options.duration,
      cues: options.cues,
      loop: options.loop,
      speed: options.speed,
      time: options.time,
    }),
  );
  const [state, setState] = React.useState(() => playback.getState());

  const commit = React.useRef(options.commit);
  React.useEffect(() => {
    commit.current = options.commit;
  }, [options.commit]);

  React.useEffect(() => {
    let committed = playback.getState();
    setState(committed);
    const unsubscribe = playback.subscribe((next) => {
      // (`ended` only changes with `playing`.)
      const timeOnly =
        next.playing &&
        committed.playing &&
        next.speed === committed.speed &&
        next.duration === committed.duration;
      if (timeOnly && commit.current && !commit.current(committed, next)) return;
      committed = next;
      setState(next);
    });
    const onVisibility = () => {
      if (document.hidden) playback.pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
      playback.pause();
    };
  }, [playback]);

  React.useEffect(() => playback.setDuration(options.duration), [playback, options.duration]);
  React.useEffect(() => playback.setLoop(options.loop ?? false), [playback, options.loop]);
  React.useEffect(() => {
    if (options.speed) playback.setSpeed(options.speed);
  }, [playback, options.speed]);
  const cueKey = options.cues?.join(",") ?? "";
  React.useEffect(() => {
    playback.setCues(cueKey ? cueKey.split(",").map(Number) : []);
  }, [playback, cueKey]);

  return [state, playback];
}

/**
 * Whether the user asks for reduced motion, read at call time (false during
 * SSR). Read it when deciding to start motion, not from state that settles a
 * commit later, so autoplay can't slip through on the first render.
 */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
