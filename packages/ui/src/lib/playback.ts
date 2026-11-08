/**
 * Playback clock shared by terminal recordings and (later) code scenes.
 *
 * Framework-neutral: time advances on injected frame callbacks, so tests drive
 * it deterministically and React binds it through `usePlayback`. Time is in
 * seconds. Cues are sorted timestamps (recording markers, scene steps) that
 * `step()` moves between, so every timeline is both auto-playable and
 * manually steppable.
 */

export interface PlaybackState {
  /** Current position in seconds, clamped to [0, duration]. */
  time: number;
  duration: number;
  playing: boolean;
  speed: number;
  /** Reached the end without looping; `play()` restarts from 0. */
  ended: boolean;
}

export interface PlaybackClock {
  now(): number;
  requestFrame(callback: () => void): unknown;
  cancelFrame(handle: unknown): void;
}

export interface PlaybackOptions {
  duration: number;
  cues?: readonly number[];
  speed?: number;
  loop?: boolean;
  /** Starting position; defaults to 0. */
  time?: number;
  clock?: PlaybackClock;
}

export interface Playback {
  getState(): PlaybackState;
  subscribe(listener: (state: PlaybackState) => void): () => void;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(time: number): void;
  seekBy(delta: number): void;
  /** Move to the next (1) or previous (-1) cue and pause there. */
  step(direction: 1 | -1): void;
  setSpeed(speed: number): void;
  setDuration(duration: number): void;
  setCues(cues: readonly number[]): void;
  setLoop(loop: boolean): void;
  dispose(): void;
}

/** Tolerance so a position sitting exactly on a cue counts as "at" it. */
const EPSILON = 1e-3;

/** Index of the last cue at or before `time`, or -1 when before the first. */
export function cueIndexAt(cues: readonly number[], time: number): number {
  let index = -1;
  for (let i = 0; i < cues.length; i++) {
    if (cues[i] <= time + EPSILON) index = i;
    else break;
  }
  return index;
}

export function defaultClock(): PlaybackClock {
  const hasFrames = typeof requestAnimationFrame === "function";
  return {
    now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
    requestFrame: (callback) => (hasFrames ? requestAnimationFrame(callback) : setTimeout(callback, 16)),
    cancelFrame: (handle) => {
      if (hasFrames) cancelAnimationFrame(handle as number);
      else clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
  };
}

export function createPlayback(options: PlaybackOptions): Playback {
  const clock = options.clock ?? defaultClock();
  let cues = [...(options.cues ?? [])].sort((a, b) => a - b);
  let loop = options.loop ?? false;
  let state: PlaybackState = {
    duration: Math.max(0, options.duration),
    time: 0,
    playing: false,
    speed: options.speed ?? 1,
    ended: false,
  };
  state.time = clamp(options.time ?? 0);
  const listeners = new Set<(state: PlaybackState) => void>();
  let frame: unknown;
  /** Wall-clock anchor: at `anchorNow` ms the position was `anchorTime` s. */
  let anchorNow = 0;
  let anchorTime = 0;

  function clamp(time: number) {
    return Math.min(Math.max(0, time), state.duration);
  }

  function emit(next: Partial<PlaybackState>) {
    state = { ...state, ...next };
    for (const listener of listeners) listener(state);
  }

  function reanchor() {
    anchorNow = clock.now();
    anchorTime = state.time;
  }

  function stopFrames() {
    if (frame !== undefined) clock.cancelFrame(frame);
    frame = undefined;
  }

  function tick() {
    frame = undefined;
    if (!state.playing) return;
    let time = anchorTime + ((clock.now() - anchorNow) / 1000) * state.speed;
    if (time >= state.duration) {
      if (loop && state.duration > 0) {
        time %= state.duration;
        anchorNow = clock.now();
        anchorTime = time;
      } else {
        emit({ time: state.duration, playing: false, ended: true });
        return;
      }
    }
    emit({ time });
    // Subscribers can pause/dispose synchronously at a breakpoint.
    if (state.playing && frame === undefined) frame = clock.requestFrame(tick);
  }

  const playback: Playback = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play() {
      if (state.playing) return;
      const time = state.ended || state.time >= state.duration ? 0 : state.time;
      emit({ time, playing: true, ended: false });
      reanchor();
      stopFrames();
      frame = clock.requestFrame(tick);
    },
    pause() {
      if (!state.playing) return;
      stopFrames();
      emit({ playing: false });
    },
    toggle() {
      if (state.playing) playback.pause();
      else playback.play();
    },
    seek(time) {
      // play() restarts from 0 whenever the position is at the end, so a seek
      // never needs to preserve `ended`.
      emit({ time: clamp(time), ended: false });
      reanchor();
    },
    seekBy(delta) {
      playback.seek(state.time + delta);
    },
    step(direction) {
      playback.pause();
      if (cues.length === 0) return;
      const current = cueIndexAt(cues, state.time);
      let target: number;
      if (direction > 0) {
        target = current + 1;
        if (target >= cues.length) return;
      } else {
        // From between cues, "previous" means the start of the current cue.
        const onCue = current >= 0 && Math.abs(cues[current] - state.time) <= EPSILON;
        target = onCue ? current - 1 : current;
        if (target < 0) {
          playback.seek(0);
          return;
        }
      }
      playback.seek(cues[target]);
    },
    setSpeed(speed) {
      if (!(speed > 0) || speed === state.speed) return;
      reanchor();
      emit({ speed });
    },
    setDuration(duration) {
      const next = Math.max(0, duration);
      if (next === state.duration) return;
      state = { ...state, duration: next };
      emit({ time: clamp(state.time) });
      reanchor();
    },
    setCues(next) {
      cues = [...next].sort((a, b) => a - b);
    },
    setLoop(next) {
      loop = next;
    },
    dispose() {
      stopFrames();
      listeners.clear();
      state = { ...state, playing: false };
    },
  };
  return playback;
}
