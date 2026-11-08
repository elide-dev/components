import * as React from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cueIndexAt, type Playback } from "../lib/playback";
import { coveragePercent, sceneStateAt, sceneTimeline, type CodeScene as Scene, type SceneFrame } from "../lib/scene";
import { cn } from "../lib/utils";
import { formatMessage } from "../i18n/format";
import { useMessages } from "../i18n/context";
import type { Messages } from "../i18n/messages";
import { CodeBlock } from "./code-block";
import { codeControlClassName } from "./code-surface-styles";
import { Terminal, type TerminalLine } from "./terminal";
import { usePlayback } from "./use-playback";

export interface CodeSceneProps {
  scene: Scene;
  /** The command the paired terminal ran: shown first, with the scene's output below it. */
  terminalCommand?: string;
  /** Start at this step (default 0). */
  initialStep?: number;
  className?: string;
}

/** Pause autoplay when it reaches a step that hits a breakpoint. */
function usePauseOnBreakpoint(playback: Playback, scene: Scene, cues: readonly number[]) {
  React.useEffect(() => {
    if (scene.pauseOnBreakpoint === false) return;
    let last = cueIndexAt(cues, playback.getState().time);
    let wasPlaying = playback.getState().playing;
    return playback.subscribe((state) => {
      const index = cueIndexAt(cues, state.time);
      const previous = last;
      last = index;
      const advancing = state.playing || (wasPlaying && state.ended);
      wasPlaying = state.playing;
      if (!advancing || index <= previous) return;
      // A delayed frame can cross several steps. Stop at the first breakpoint,
      // including one skipped by the clock, without reducing the whole scene twice.
      for (let step = previous + 1; step <= index; step++) {
        if (!scene.steps[step]?.actions.some((action) => action.type === "breakpoint" && action.state === "hit")) continue;
        playback.pause();
        playback.seek(cues[step]);
        break;
      }
    });
  }, [playback, scene, cues]);
}

/** Pause only active playback offscreen; explicit navigation cancels automatic resume. */
function useViewportPause(ref: React.RefObject<HTMLDivElement | null>, playback: Playback) {
  const suspended = React.useRef(false);
  React.useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      if (!entry.isIntersecting && playback.getState().playing) {
        suspended.current = true;
        playback.pause();
      } else if (entry.isIntersecting && suspended.current) {
        suspended.current = false;
        playback.play();
      }
    });
    observer.observe(root);
    return () => {
      suspended.current = false;
      observer.disconnect();
    };
  }, [playback, ref]);
  return suspended;
}

/** The terminal session so far: the command (if any), then everything written. */
function sessionLines(command: string | undefined, output: string): TerminalLine[] {
  const lines: TerminalLine[] = command ? [{ kind: "command", text: command }] : [];
  const written = output.replace(/\n$/, "");
  if (written) lines.push(...written.split("\n").map((text): TerminalLine => ({ kind: "output", text })));
  return lines;
}

/** Locals and call stack for the current frame (innermost first). */
function DebugPanel({ frame, messages: m }: { frame: SceneFrame; messages: Messages["codeScene"] }) {
  const locals = Object.entries(frame.locals);
  return (
    <div className="eld-scene-debug" data-code-tone="adaptive">
      <section aria-label={m.locals}>
        <h3 className="eld-scene-heading">{m.locals}</h3>
        <dl className="eld-scene-locals">
          {locals.map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-label={m.callStack}>
        <h3 className="eld-scene-heading">{m.callStack}</h3>
        <ol className="eld-scene-stack">
          {frame.stack.map((entry, depth) => (
            <li key={`${depth}:${entry.name}:${entry.file}:${entry.line}`} data-current={depth === 0 || undefined}>
              <span className="eld-scene-frame">{entry.name}</span>
              <span className="eld-scene-location">
                {entry.file}
                {entry.line ? `:${entry.line}` : ""}
                {entry.lang ? <span className="eld-scene-lang">{entry.lang}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/**
 * CodeScene — a scripted walkthrough over code: step a debugger across files
 * and languages, watch coverage fill in or hotspots heat up, flash lines as
 * hooks fire, with program output in a paired terminal. Steps are reduced to
 * state deterministically (see `sceneStateAt`), so stepping back, autoplay
 * and server rendering all agree.
 */
export function CodeScene({ scene, terminalCommand, initialStep = 0, className }: CodeSceneProps) {
  const m = useMessages().codeScene;
  const { cues, duration } = React.useMemo(() => sceneTimeline(scene), [scene]);
  const [state, playback] = usePlayback({ duration, cues, time: cues[Math.min(initialStep, cues.length - 1)] ?? 0 });
  usePauseOnBreakpoint(playback, scene, cues);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const suspended = useViewportPause(rootRef, playback);
  function interact(action: () => void) {
    suspended.current = false;
    action();
  }
  const step = Math.max(0, cueIndexAt(cues, state.time));
  const current = React.useMemo(() => sceneStateAt(scene, step), [scene, step]);
  const files = React.useMemo(
    () =>
      scene.files.map((file) => ({
        ...file,
        decorations: current.decorations[file.name],
        insights: current.insights[file.name],
      })),
    [scene.files, current],
  );
  const coverage = React.useMemo(() => coveragePercent(current.insights[current.activeFile]), [current]);
  const writes = React.useMemo(() => scene.steps.some((entry) => entry.actions.some((action) => action.type === "terminal")), [scene]);
  // Playback time advances every frame; these surfaces change only at a cue.
  // Reuse their elements so idle frames do not re-tokenize output or walk code.
  const code = React.useMemo(() => <CodeBlock files={files} activeFile={current.activeFile} statusBar={false} />, [files, current.activeFile]);
  const debug = React.useMemo(() => current.frame ? <DebugPanel frame={current.frame} messages={m} /> : null, [current.frame, m]);
  const terminal = React.useMemo(
    () => writes ? <Terminal lines={sessionLines(terminalCommand, current.terminal)} copy={terminalCommand ? "commands" : false} /> : null,
    [writes, terminalCommand, current.terminal],
  );

  const shortcuts: Record<string, () => void> = {
    ArrowRight: () => playback.step(1),
    F10: () => playback.step(1),
    ArrowLeft: () => playback.step(-1),
    " ": () => playback.toggle(),
    Home: () => playback.seek(0),
    End: () => playback.seek(cues[cues.length - 1] ?? 0),
  };

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const action = shortcuts[event.key];
    // Only when the walkthrough itself (not a control or the code) has focus.
    if (!action || event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
    interact(action);
    event.preventDefault();
  }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={m.label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-slot="code-scene"
      data-step={step}
      className={cn("eld-code-scene", className)}
    >
      {code}
      <div className="eld-scene-controls" data-code-tone="adaptive">
        <button type="button" className={codeControlClassName} aria-label={m.previous} onClick={() => interact(() => playback.step(-1))} disabled={step === 0}>
          <ChevronLeft aria-hidden />
        </button>
        <button type="button" className={codeControlClassName} aria-label={state.playing ? m.pause : m.play} onClick={() => interact(() => playback.toggle())} disabled={!scene.steps.length}>
          {state.playing ? <Pause aria-hidden className="fill-current" /> : <Play aria-hidden className="fill-current" />}
        </button>
        <button
          type="button"
          className={codeControlClassName}
          aria-label={m.next}
          onClick={() => interact(() => playback.step(1))}
          disabled={step >= scene.steps.length - 1}
        >
          <ChevronRight aria-hidden />
        </button>
        <p className="eld-scene-caption" aria-live="polite">
          <span className="eld-scene-count">{formatMessage(m.step, { current: scene.steps.length ? step + 1 : 0, total: scene.steps.length })}</span>
          <span>{current.label}</span>
        </p>
        {coverage !== undefined ? <span className="eld-scene-coverage">{formatMessage(m.coverage, { percent: `${coverage}%` })}</span> : null}
      </div>
      {debug}
      {terminal}
    </div>
  );
}
