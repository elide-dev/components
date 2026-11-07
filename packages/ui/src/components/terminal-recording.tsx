import * as React from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import {
  CastRenderer,
  normalizeCast,
  parseAsciicast,
  synthesizeCast,
  type Cast,
  type CastMarker,
  type SynthesizeOptions,
} from "../lib/asciicast";
import { lineText, type CodeLine } from "../lib/code-model";
import { cueIndexAt, type Playback, type PlaybackState } from "../lib/playback";
import { resolveRecording } from "../lib/recording-source";
import type { TerminalLine } from "../lib/terminal-transcript";
import { cn } from "../lib/utils";
import { formatMessage } from "../i18n/format";
import { useMessages } from "../i18n/context";
import { useLocale } from "../i18n/locale-context";
import type { Messages } from "../i18n/messages";
import { CodeLines } from "./code-lines";
import { codeControlClassName, codeSurfaceElevStyle } from "./code-surface-styles";
import { prefersReducedMotion, usePlayback } from "./use-playback";

export interface TerminalRecordingOptions {
  /** URL of an asciicast (`.cast`), fetched when the player nears the viewport. */
  src?: string | URL;
  /** An inline asciicast: file contents, a v1 object, or a parsed `Cast`. Keep the reference stable. */
  cast?: string | Cast | object;
  /** Type out the terminal's own transcript instead of loading a recording. */
  synthesize?: boolean | SynthesizeOptions;
  /** Frame shown before playback: the final frame (default), the first, or a time in seconds. */
  poster?: "last" | "first" | number;
  /** Start automatically: on load (`true`) or once scrolled into view. Never under reduced motion. */
  autoplay?: boolean | "visible";
  loop?: boolean;
  /** Initial playback rate (default 1). */
  speed?: number;
  /** Cap idle pauses at this many seconds (default: the recording's own limit, else 2). */
  idleTimeLimit?: number;
  /**
   * Visible rows; defaults to the tallest content the recording produces. Set it
   * for `src` recordings to reserve their height before they load.
   */
  rows?: number;
  /** Show the controls bar (default true). */
  controls?: boolean;
  onTimeUpdate?: (time: number) => void;
  /** Fires when playback reaches a marker (or a synthesized command). */
  onMarker?: (marker: CastMarker) => void;
}

/** A URL string, or full options. */
export type TerminalRecordingSource = string | URL | TerminalRecordingOptions;

export interface TerminalRecordingProps {
  source: TerminalRecordingSource;
  /** The terminal's static transcript: typed out by `synthesize`. */
  script: readonly TerminalLine[];
  /** ANSI prompt used when synthesizing. */
  prompt?: string;
  /** Static body shown until a remote recording loads (and during SSR). */
  fallback?: React.ReactNode;
}

const SPEEDS = [1, 1.5, 2, 4, 0.5] as const;

function isCast(value: unknown): value is Cast {
  return !!value && typeof value === "object" && Array.isArray((value as Cast).events) && "markers" in value;
}

/**
 * Tallest content (rows) a cast produces, sampled across its timeline, plus
 * its final transcript. Sampling is capped so long casts stay cheap.
 */
function measure(cast: Cast): { rows: number; transcript: string } {
  const probe = new CastRenderer(cast);
  let rows = 1;
  const samples = Math.min(24, Math.max(1, cast.events.length));
  for (let i = 0; i <= samples; i++) {
    const screen = probe.screen((cast.duration * i) / samples);
    let last = screen.lines.length - 1;
    while (last >= 0 && screen.lines[last].tokens.every((token) => !token.text.trim())) last--;
    rows = Math.max(rows, last + 1, screen.cursor.visible ? screen.cursor.row + 1 : 0);
  }
  const final = probe.at(cast.duration).snapshot({ trim: true, cursor: false });
  const transcript = final.lines.map((line) => lineText(line).trimEnd()).join("\n").trimEnd();
  return { rows: Math.min(rows, cast.rows), transcript };
}

/** Where the player is relative to the viewport (prefetch margin, half-visible, onscreen). */
function useViewport(ref: React.RefObject<HTMLDivElement | null>) {
  const [state, setState] = React.useState({ near: false, visible: false, onscreen: true });
  React.useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver !== "function") {
      setState({ near: true, visible: true, onscreen: true });
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        setState((previous) => ({
          // Prefetch a little before the player is on screen; once near, stay loaded.
          near: previous.near || entry.isIntersecting,
          visible: entry.intersectionRatio >= 0.5,
          onscreen: entry.isIntersecting,
        }));
      },
      { rootMargin: "200px 0px", threshold: [0, 0.5] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return state;
}

type Remote = { status: "idle" | "loading" } | { status: "ready"; cast: Cast } | { status: "error" };

/** Resolve the recording (inline, synthesized or fetched) into a normalized cast. */
function useCast(options: TerminalRecordingOptions, script: readonly TerminalLine[], prompt: string | undefined, load: boolean) {
  const { src, cast: inlineCast, synthesize, idleTimeLimit } = options;
  const synthesizeKey = typeof synthesize === "object" ? JSON.stringify(synthesize) : String(synthesize ?? "");
  const local = React.useMemo((): { cast?: Cast; error?: boolean } => {
    try {
      if (inlineCast !== undefined) return { cast: isCast(inlineCast) ? inlineCast : parseAsciicast(inlineCast as string | object) };
      if (synthesizeKey && synthesizeKey !== "false") {
        const extra = synthesizeKey.startsWith("{") ? (JSON.parse(synthesizeKey) as SynthesizeOptions) : {};
        return { cast: synthesizeCast(script, { prompt, ...extra }) };
      }
    } catch {
      return { error: true };
    }
    return {};
  }, [inlineCast, synthesizeKey, script, prompt]);

  const [remote, setRemote] = React.useState<Remote>({ status: "idle" });
  const srcKey = src ? String(src) : "";
  React.useEffect(() => {
    if (!srcKey || local.cast || !load) return;
    const controller = new AbortController();
    setRemote({ status: "loading" });
    fetch(srcKey, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((text) => setRemote({ status: "ready", cast: parseAsciicast(text) }))
      .catch(() => {
        if (!controller.signal.aborted) setRemote({ status: "error" });
      });
    return () => controller.abort();
  }, [srcKey, local.cast, load]);

  const raw = local.cast ?? (remote.status === "ready" ? remote.cast : undefined);
  const cast = React.useMemo(
    () => raw && normalizeCast(raw, { idleTimeLimit: idleTimeLimit ?? raw.idleTimeLimit ?? 2 }),
    [raw, idleTimeLimit],
  );
  return { cast, failed: !!local.error || remote.status === "error", loading: remote.status === "loading" };
}

/**
 * Notify `onTimeUpdate` / `onMarker` from the playback clock itself (a
 * subscription), so consumers hear about every tick without effects that
 * forward render state to the parent.
 */
function usePlaybackCallbacks(playback: Playback, markers: readonly CastMarker[], options: TerminalRecordingOptions) {
  const callbacks = React.useRef(options);
  React.useEffect(() => {
    callbacks.current = options;
  });
  React.useEffect(() => {
    const cues = markers.map((marker) => marker.time);
    let last = cueIndexAt(cues, playback.getState().time);
    return playback.subscribe((state) => {
      callbacks.current.onTimeUpdate?.(state.time);
      const index = cueIndexAt(cues, state.time);
      if (index !== last && index >= 0 && state.playing) callbacks.current.onMarker?.(markers[index]);
      last = index;
    });
  }, [playback, markers]);
}

/** The marker before (or at the start of the current one, when past it) and after `time`. */
function adjacentMarkers(markers: readonly CastMarker[], time: number): { previous?: CastMarker; next?: CastMarker } {
  const index = cueIndexAt(markers.map((marker) => marker.time), time);
  if (index < 0) return { next: markers[0] };
  // As media players do: "previous" first returns to the current marker's start.
  const previous = time - markers[index].time > 1 || index === 0 ? markers[index] : markers[index - 1];
  return { previous, next: markers[index + 1] };
}

/** Frame shown before playback. */
function posterTimeFor(cast: Cast | undefined, poster: TerminalRecordingOptions["poster"] = "last"): number {
  if (!cast) return 0;
  if (poster === "first") return 0;
  if (poster === "last") return cast.duration;
  return Math.min(Math.max(0, poster), cast.duration);
}

/** `m:ss` with locale digits. */
function useTimeFormat(locale: string) {
  return React.useMemo(() => {
    const numbers = new Intl.NumberFormat(locale);
    const twoDigits = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 });
    return {
      number: (value: number) => numbers.format(value),
      time: (seconds: number) => {
        const whole = Math.max(0, Math.floor(seconds));
        return `${numbers.format(Math.floor(whole / 60))}:${twoDigits.format(whole % 60)}`;
      },
    };
  }, [locale]);
}

/** Previous/next marker buttons; a button without a target is `invisible` (keeps its space). */
function MarkerButtons({ markers, time, label, onSeek }: { markers: readonly CastMarker[]; time: number; label: string; onSeek: (time: number) => void }) {
  const { previous, next } = adjacentMarkers(markers, time);
  const button = (marker: CastMarker | undefined, fallback: CastMarker, icon: React.ReactNode) => (
    <button
      type="button"
      className={cn(codeControlClassName, !marker && "invisible")}
      aria-label={formatMessage(label, { label: (marker ?? fallback).label })}
      onClick={() => marker && onSeek(marker.time)}
    >
      {icon}
    </button>
  );
  return (
    <>
      {button(previous, markers[0], <SkipBack aria-hidden />)}
      {button(next, markers[markers.length - 1], <SkipForward aria-hidden />)}
    </>
  );
}

/** Scrubber with decorative marker ticks. */
function Scrubber({ cast, markers, time, label, valueText, onSeek }: { cast?: Cast; markers: readonly CastMarker[]; time: number; label: string; valueText: string; onSeek: (time: number) => void }) {
  const duration = cast?.duration ?? 0;
  return (
    <div dir="ltr" className="relative mx-1 flex h-7 min-w-0 flex-1 items-center">
      <input
        type="range"
        min={0}
        max={duration}
        step={0.01}
        value={time}
        disabled={!cast}
        aria-label={label}
        aria-valuetext={valueText}
        onChange={(event) => onSeek(Number(event.currentTarget.value))}
        className="h-1 w-full cursor-pointer accent-[var(--code-prompt)] disabled:cursor-default"
      />
      {duration > 0
        ? markers.map((marker) => (
            // Decorative: the marker buttons are the targets (ticks on a track
            // cannot meet the 24px target size without overlapping it).
            <span
              key={`${marker.time}:${marker.label}`}
              aria-hidden
              className="pointer-events-none absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--code-syntax-line-number)]"
              style={{ left: `${(marker.time / duration) * 100}%` }}
            />
          ))
        : null}
    </div>
  );
}

interface ControlsProps {
  state: PlaybackState;
  cast: Cast | undefined;
  markers: readonly CastMarker[];
  failed: boolean;
  messages: Messages["terminal"];
  locale: string;
  onToggle: () => void;
  onRestart: () => void;
  onSeek: (time: number) => void;
  onSpeed: () => void;
}

/** Play/pause, restart, marker navigation, scrubber, time and speed. */
function RecordingControls({ state, cast, markers, failed, messages: m, locale, onToggle, onRestart, onSeek, onSpeed }: ControlsProps) {
  const format = useTimeFormat(locale);
  const elapsed = format.time(state.time);
  const total = format.time(cast?.duration ?? 0);
  const speedLabel = `${format.number(state.speed)}×`;
  return (
    <div data-slot="terminal-controls" className="flex items-center gap-1 border-t px-2 py-1" style={codeSurfaceElevStyle}>
      <button type="button" className={codeControlClassName} aria-label={state.playing ? m.pause : m.play} onClick={onToggle} disabled={failed}>
        {state.playing ? <Pause aria-hidden className="fill-current" /> : <Play aria-hidden className="fill-current" />}
      </button>
      <button type="button" className={codeControlClassName} aria-label={m.restart} onClick={onRestart} disabled={!cast}>
        <RotateCcw aria-hidden />
      </button>
      {markers.length ? <MarkerButtons markers={markers} time={state.time} label={m.jumpTo} onSeek={onSeek} /> : null}
      {failed ? (
        <span role="status" className="flex-1 px-1 font-mono text-[0.6875rem] text-[var(--code-syntax-line-number)]">
          {m.unavailable}
        </span>
      ) : (
        <Scrubber cast={cast} markers={markers} time={state.time} label={m.seek} valueText={formatMessage(m.position, { elapsed, total })} onSeek={onSeek} />
      )}
      <span aria-hidden className="shrink-0 font-mono text-[0.6875rem] tabular-nums text-[var(--code-syntax-line-number)]">
        {`${elapsed} / ${total}`}
      </span>
      <button
        type="button"
        className={cn(codeControlClassName, "min-w-9 font-mono text-[0.6875rem] tabular-nums")}
        aria-label={formatMessage(m.speed, { speed: speedLabel })}
        onClick={onSpeed}
        disabled={!cast}
      >
        {speedLabel}
      </button>
    </div>
  );
}

/**
 * The terminal grid (hidden from AT; the transcript speaks for it), or the
 * static fallback until a recording loads. `reserve` keeps the grid's height.
 */
function RecordingScreen({ lines, gridStyle, reserve, fallback }: { lines?: CodeLine[]; gridStyle: React.CSSProperties; reserve: boolean; fallback: React.ReactNode }) {
  if (lines) {
    return (
      <pre dir="ltr" aria-hidden className="eld-code-body eld-terminal-screen" style={gridStyle}>
        <CodeLines lines={lines} variant="terminal" links={false} remountChangedRows />
      </pre>
    );
  }
  return (
    <pre dir="ltr" className={cn("eld-code-body", reserve && "eld-terminal-screen")} style={reserve ? gridStyle : undefined}>
      {fallback}
    </pre>
  );
}

/** Pointer affordance over the poster (keyboard and AT users have the controls bar). No scrim. */
function PosterPlayButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" tabIndex={-1} aria-hidden onClick={onClick} className="absolute inset-0 flex touch-manipulation items-center justify-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-[var(--code-background-elev)] text-[var(--code-syntax-default)] shadow-lg ring-1 ring-[var(--code-border)] transition-transform duration-[var(--eld-motion-press)] ease-[var(--eld-motion-ease-out)] active:scale-95 motion-reduce:transition-none">
        <Play aria-hidden className="size-5 translate-x-px fill-current" />
      </span>
    </button>
  );
}

/**
 * Plays an asciicast inside a `Terminal` through the lite VT. Renders a poster
 * frame on the server, fetches remote recordings lazily, scales the terminal
 * grid to its container (no measurement), and pauses while offscreen.
 */
export function TerminalRecording({ source, script, prompt, fallback }: TerminalRecordingProps) {
  const m = useMessages().terminal;
  const { locale } = useLocale();
  const options = resolveRecording<TerminalRecordingOptions>(source);
  const { poster, autoplay = false, loop = false, controls = true } = options;

  const rootRef = React.useRef<HTMLDivElement>(null);
  const viewport = useViewport(rootRef);
  const [requested, setRequested] = React.useState(false);
  const { cast, failed, loading } = useCast(options, script, prompt, viewport.near || requested);
  const renderer = React.useMemo(() => cast && new CastRenderer(cast), [cast]);
  const measured = React.useMemo(() => cast && measure(cast), [cast]);
  const posterTime = posterTimeFor(cast, poster);
  const markers = React.useMemo(() => cast?.markers ?? [], [cast]);
  const cues = React.useMemo(() => markers.map((marker) => marker.time), [markers]);

  const [state, playback] = usePlayback({ duration: cast?.duration ?? 0, cues, loop, speed: options.speed, time: posterTime });
  usePlaybackCallbacks(playback, markers, options);
  const pendingPlay = React.useRef(false);
  const autoplayed = React.useRef(false);
  const pausedOffscreen = React.useRef(false);
  /** The reader has used the player (hides the poster's play overlay). */
  const [interacted, setInteracted] = React.useState(false);

  React.useEffect(() => {
    if (!cast) return;
    playback.setDuration(cast.duration);
    playback.seek(posterTime);
    if (pendingPlay.current) {
      pendingPlay.current = false;
      playback.play();
    }
  }, [cast, playback, posterTime]);

  React.useEffect(() => {
    if (!cast || autoplayed.current || !autoplay) return;
    if (autoplay === "visible" && !viewport.visible) return;
    autoplayed.current = true;
    if (!prefersReducedMotion()) playback.play();
  }, [cast, autoplay, viewport.visible, playback]);

  // Spend no frames on a player nobody can see; resume where it left off.
  React.useEffect(() => {
    if (!viewport.onscreen && playback.getState().playing) {
      pausedOffscreen.current = true;
      playback.pause();
    } else if (viewport.onscreen && pausedOffscreen.current) {
      pausedOffscreen.current = false;
      playback.play();
    }
  }, [viewport.onscreen, playback]);

  function toggle() {
    setInteracted(true);
    pausedOffscreen.current = false;
    if (!cast) {
      pendingPlay.current = true;
      setRequested(true);
      return;
    }
    playback.toggle();
  }

  function restart() {
    setInteracted(true);
    playback.seek(0);
    playback.play();
  }

  function seek(time: number) {
    setInteracted(true);
    playback.seek(time);
  }

  function cycleSpeed() {
    const index = SPEEDS.indexOf(state.speed as (typeof SPEEDS)[number]);
    playback.setSpeed(SPEEDS[(index + 1) % SPEEDS.length]);
  }

  function stepMarker(direction: 1 | -1) {
    const resume = playback.getState().playing;
    playback.step(direction);
    if (resume) playback.play();
  }

  const shortcuts: Record<string, () => void> = {
    " ": toggle,
    k: toggle,
    ArrowLeft: () => playback.seekBy(-5),
    ArrowRight: () => playback.seekBy(5),
    Home: () => playback.seek(0),
    End: () => playback.seek(cast?.duration ?? 0),
    m: () => stepMarker(1),
    M: () => stepMarker(-1),
  };

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    // Controls handle their own keys; only the focused screen maps shortcuts.
    const action = shortcuts[event.key];
    if (event.target !== event.currentTarget || !cast || !action) return;
    action();
    event.preventDefault();
  }

  const rows = options.rows ?? measured?.rows ?? 0;
  // Same object while no event applies, so the screen skips re-rendering between output events.
  const screen = renderer?.screen(state.time);
  const lines = React.useMemo<CodeLine[]>(
    () => (screen ? Array.from({ length: rows }, (_, row) => screen.lines[row] ?? { tokens: [] }) : []),
    [screen, rows],
  );
  const showOverlay = !!cast && !interacted && !state.playing && state.time === posterTime;
  const gridStyle = { "--eld-cols": cast?.cols ?? 80, "--eld-rows": rows } as React.CSSProperties;

  return (
    <div ref={rootRef} data-slot="terminal-recording" data-playing={state.playing || undefined} className="eld-terminal-player">
      <div
        role="group"
        aria-label={m.recording}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--code-prompt)]"
      >
        <RecordingScreen lines={screen ? lines : undefined} gridStyle={gridStyle} reserve={!!options.rows} fallback={fallback} />
        {measured ? <pre className="sr-only whitespace-pre">{measured.transcript}</pre> : null}
        {showOverlay ? <PosterPlayButton onClick={toggle} /> : null}
        {loading ? (
          <span role="status" className="sr-only">
            {m.loading}
          </span>
        ) : null}
      </div>
      {controls ? (
        <RecordingControls
          state={state}
          cast={cast}
          markers={markers}
          failed={failed}
          messages={m}
          locale={locale}
          onToggle={toggle}
          onRestart={restart}
          onSeek={seek}
          onSpeed={cycleSpeed}
        />
      ) : null}
    </div>
  );
}
