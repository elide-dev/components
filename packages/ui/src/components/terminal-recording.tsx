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
import { cueIndexAt } from "../lib/playback";
import type { TerminalLine } from "../lib/terminal-transcript";
import { cn } from "../lib/utils";
import { formatMessage } from "../i18n/format";
import { useMessages } from "../i18n/context";
import { useLocale } from "../i18n/locale-context";
import { CodeLines } from "./code-lines";
import { codeControlClassName, codeSurfaceElevStyle } from "./code-surface";
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

export function resolveRecording(source: TerminalRecordingSource): TerminalRecordingOptions {
  return typeof source === "string" || source instanceof URL ? { src: source } : source;
}

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

type Remote = { status: "idle" | "loading" } | { status: "ready"; cast: Cast } | { status: "error" };

/**
 * Plays an asciicast inside a `Terminal` through the lite VT. Renders a poster
 * frame on the server, fetches remote recordings lazily, scales the terminal
 * grid to its container (no measurement), and pauses while offscreen.
 */
export function TerminalRecording({ source, script, prompt, fallback }: TerminalRecordingProps) {
  const m = useMessages().terminal;
  const { locale } = useLocale();
  const options = resolveRecording(source);
  const { src, cast: inlineCast, synthesize, poster = "last", autoplay = false, loop = false, controls = true } = options;
  const synthesizeKey = typeof synthesize === "object" ? JSON.stringify(synthesize) : String(synthesize ?? "");

  // ---- source → cast ----------------------------------------------------------
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

  const rootRef = React.useRef<HTMLDivElement>(null);
  const [wantLoad, setWantLoad] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [onscreen, setOnscreen] = React.useState(true);
  const [remote, setRemote] = React.useState<Remote>({ status: "idle" });
  const srcKey = src ? String(src) : "";

  React.useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof IntersectionObserver !== "function") {
      setWantLoad(true);
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        // Prefetch a little before the player is on screen.
        if (entry.isIntersecting) setWantLoad(true);
        setOnscreen(entry.isIntersecting);
        setVisible(entry.intersectionRatio >= 0.5);
      },
      { rootMargin: "200px 0px", threshold: [0, 0.5] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!srcKey || local.cast || !wantLoad) return;
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
  }, [srcKey, local.cast, wantLoad]);

  const raw = local.cast ?? (remote.status === "ready" ? remote.cast : undefined);
  const failed = local.error || remote.status === "error";
  const idleTimeLimit = options.idleTimeLimit;
  const cast = React.useMemo(
    () => raw && normalizeCast(raw, { idleTimeLimit: idleTimeLimit ?? raw.idleTimeLimit ?? 2 }),
    [raw, idleTimeLimit],
  );
  const renderer = React.useMemo(() => cast && new CastRenderer(cast), [cast]);
  const measured = React.useMemo(() => cast && measure(cast), [cast]);
  const posterTime = cast ? (poster === "first" ? 0 : poster === "last" ? cast.duration : Math.min(Math.max(0, poster), cast.duration)) : 0;
  const markers = React.useMemo(() => cast?.markers ?? [], [cast]);
  const cues = React.useMemo(() => markers.map((marker) => marker.time), [markers]);

  // ---- playback -------------------------------------------------------------------
  const [state, playback] = usePlayback({
    duration: cast?.duration ?? 0,
    cues,
    loop,
    speed: options.speed,
    time: posterTime,
  });
  const pendingPlay = React.useRef(false);
  const autoplayed = React.useRef(false);
  const pausedOffscreen = React.useRef(false);
  const [started, setStarted] = React.useState(false);

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
    if (autoplay === "visible" && !visible) return;
    autoplayed.current = true;
    if (prefersReducedMotion()) return;
    setStarted(true);
    playback.play();
  }, [cast, autoplay, visible, playback]);

  // Spend no frames on a player nobody can see; resume where it left off.
  React.useEffect(() => {
    if (!onscreen && playback.getState().playing) {
      pausedOffscreen.current = true;
      playback.pause();
    } else if (onscreen && pausedOffscreen.current) {
      pausedOffscreen.current = false;
      playback.play();
    }
  }, [onscreen, playback]);

  const { onTimeUpdate, onMarker } = options;
  React.useEffect(() => {
    onTimeUpdate?.(state.time);
  }, [state.time, onTimeUpdate]);
  const markerIndex = cueIndexAt(cues, state.time);
  const lastMarker = React.useRef(markerIndex);
  React.useEffect(() => {
    if (markerIndex !== lastMarker.current && markerIndex >= 0 && state.playing) onMarker?.(markers[markerIndex]);
    lastMarker.current = markerIndex;
  }, [markerIndex, markers, onMarker, state.playing]);

  function toggle() {
    setStarted(true);
    pausedOffscreen.current = false;
    if (!cast) {
      pendingPlay.current = true;
      setWantLoad(true);
      return;
    }
    playback.toggle();
  }

  function restart() {
    setStarted(true);
    playback.seek(0);
    playback.play();
  }

  function jump(marker: CastMarker) {
    setStarted(true);
    playback.seek(marker.time);
  }

  // Previous: the current marker's start when past it (as media players do), else the one before.
  const previousMarker = markerIndex < 0
    ? undefined
    : state.time - markers[markerIndex].time > 1 || markerIndex === 0
      ? markers[markerIndex]
      : markers[markerIndex - 1];
  const nextMarker = markers[markerIndex + 1];

  function cycleSpeed() {
    const index = SPEEDS.indexOf(state.speed as (typeof SPEEDS)[number]);
    playback.setSpeed(SPEEDS[(index + 1) % SPEEDS.length]);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    // Controls handle their own keys; only the focused screen maps shortcuts.
    if (event.target !== event.currentTarget || !cast) return;
    const resume = state.playing;
    switch (event.key) {
      case " ":
      case "k":
        toggle();
        break;
      case "ArrowLeft":
        playback.seekBy(-5);
        break;
      case "ArrowRight":
        playback.seekBy(5);
        break;
      case "Home":
        playback.seek(0);
        break;
      case "End":
        playback.seek(cast.duration);
        break;
      case "m":
      case "M":
        playback.step(event.key === "m" ? 1 : -1);
        if (resume) playback.play();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  // ---- render -----------------------------------------------------------------------
  const rows = options.rows ?? measured?.rows ?? 0;
  // Same object while no event applies, so the screen skips re-rendering between output events.
  const screen = renderer?.screen(state.time);
  const lines = React.useMemo<CodeLine[]>(
    () => (screen ? Array.from({ length: rows }, (_, row) => screen.lines[row] ?? { tokens: [] }) : []),
    [screen, rows],
  );
  const numbers = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const twoDigits = React.useMemo(() => new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }), [locale]);
  const formatTime = (seconds: number) => {
    const whole = Math.max(0, Math.floor(seconds));
    return `${numbers.format(Math.floor(whole / 60))}:${twoDigits.format(whole % 60)}`;
  };
  const speedLabel = `${numbers.format(state.speed)}×`;
  const elapsed = formatTime(state.time);
  const total = formatTime(cast?.duration ?? 0);
  const position = formatMessage(m.position, { elapsed, total });
  const showOverlay = !!cast && !started && !state.playing;
  const gridStyle = {
    "--eld-cols": cast?.cols ?? 80,
    "--eld-rows": rows,
  } as React.CSSProperties;

  return (
    <div ref={rootRef} data-slot="terminal-recording" data-playing={state.playing || undefined} className="eld-terminal-player">
      <div
        role="group"
        aria-label={m.recording}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--code-prompt)]"
      >
        {screen ? (
          <pre dir="ltr" aria-hidden className="eld-code-body eld-terminal-screen" style={gridStyle}>
            <CodeLines lines={lines} variant="terminal" links={false} remountChangedRows />
          </pre>
        ) : (
          <pre
            dir="ltr"
            className={cn("eld-code-body", options.rows && "eld-terminal-screen")}
            style={options.rows ? gridStyle : undefined}
          >
            {fallback}
          </pre>
        )}
        {measured ? <pre className="sr-only whitespace-pre">{measured.transcript}</pre> : null}
        {showOverlay ? (
          // Pointer affordance only (keyboard and AT users have the controls bar).
          // No scrim: the finished output is what the reader came for.
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={toggle}
            className="absolute inset-0 flex touch-manipulation items-center justify-center"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-[var(--code-background-elev)] text-[var(--eld-syntax-default)] shadow-lg ring-1 ring-[var(--code-border)] transition-transform duration-[var(--eld-motion-press)] ease-[var(--eld-motion-ease-out)] active:scale-95 motion-reduce:transition-none">
              <Play aria-hidden className="size-5 translate-x-px fill-current" />
            </span>
          </button>
        ) : null}
        {remote.status === "loading" ? (
          <span role="status" className="sr-only">
            {m.loading}
          </span>
        ) : null}
      </div>

      {controls ? (
        <div data-slot="terminal-controls" className="flex items-center gap-1 border-t px-2 py-1" style={codeSurfaceElevStyle}>
          <button type="button" className={codeControlClassName} aria-label={state.playing ? m.pause : m.play} onClick={toggle} disabled={failed}>
            {state.playing ? <Pause aria-hidden className="fill-current" /> : <Play aria-hidden className="fill-current" />}
          </button>
          <button type="button" className={codeControlClassName} aria-label={m.restart} onClick={restart} disabled={!cast}>
            <RotateCcw aria-hidden />
          </button>
          {markers.length ? (
            <>
              {/* Without a target a button is `invisible`: out of focus order and the
                  accessibility tree, but still holding its space so nothing shifts. */}
              <button
                type="button"
                className={cn(codeControlClassName, !previousMarker && "invisible")}
                aria-label={formatMessage(m.jumpTo, { label: (previousMarker ?? markers[0]).label })}
                onClick={() => previousMarker && jump(previousMarker)}
              >
                <SkipBack aria-hidden />
              </button>
              <button
                type="button"
                className={cn(codeControlClassName, !nextMarker && "invisible")}
                aria-label={formatMessage(m.jumpTo, { label: (nextMarker ?? markers[markers.length - 1]).label })}
                onClick={() => nextMarker && jump(nextMarker)}
              >
                <SkipForward aria-hidden />
              </button>
            </>
          ) : null}
          {failed ? (
            <span role="status" className="flex-1 px-1 font-mono text-[0.6875rem] text-[var(--eld-syntax-line-number)]">
              {m.unavailable}
            </span>
          ) : (
            <div dir="ltr" className="relative mx-1 flex h-7 min-w-0 flex-1 items-center">
              <input
                type="range"
                min={0}
                max={cast?.duration ?? 0}
                step={0.01}
                value={state.time}
                disabled={!cast}
                aria-label={m.seek}
                aria-valuetext={position}
                onChange={(event) => {
                  setStarted(true);
                  playback.seek(Number(event.currentTarget.value));
                }}
                className="h-1 w-full cursor-pointer accent-[var(--code-prompt)] disabled:cursor-default"
              />
              {cast && cast.duration > 0
                ? markers.map((marker) => (
                    // Decorative: the marker buttons beside the track are the targets
                    // (ticks on a track cannot meet the 24px target size without overlapping it).
                    <span
                      key={`${marker.time}:${marker.label}`}
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--eld-syntax-line-number)]"
                      style={{ left: `${(marker.time / cast.duration) * 100}%` }}
                    />
                  ))
                : null}
            </div>
          )}
          <span aria-hidden className="shrink-0 font-mono text-[0.6875rem] tabular-nums text-[var(--eld-syntax-line-number)]">
            {`${elapsed} / ${total}`}
          </span>
          <button
            type="button"
            className={cn(codeControlClassName, "min-w-9 font-mono text-[0.6875rem] tabular-nums")}
            aria-label={formatMessage(m.speed, { speed: speedLabel })}
            onClick={cycleSpeed}
            disabled={!cast}
          >
            {speedLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
