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
    return playback.subscribe((state) => {
      const index = cueIndexAt(cues, state.time);
      if (index !== last && state.playing && sceneStateAt(scene, index).breakpointHit) playback.pause();
      last = index;
    });
  }, [playback, scene, cues]);
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
            <li key={`${entry.name}:${entry.file}:${entry.line}`} data-current={depth === 0 || undefined}>
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
  const coverage = coveragePercent(current.insights[current.activeFile]);
  const writes = scene.steps.some((entry) => entry.actions.some((action) => action.type === "terminal"));

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
    if (!action || event.target !== event.currentTarget) return;
    action();
    event.preventDefault();
  }

  return (
    <div
      role="group"
      aria-label={m.label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-slot="code-scene"
      data-step={step}
      className={cn("eld-code-scene", className)}
    >
      <CodeBlock files={files} activeFile={current.activeFile} statusBar={false} />
      <div className="eld-scene-controls" data-code-tone="adaptive">
        <button type="button" className={codeControlClassName} aria-label={m.previous} onClick={() => playback.step(-1)} disabled={step === 0}>
          <ChevronLeft aria-hidden />
        </button>
        <button type="button" className={codeControlClassName} aria-label={state.playing ? m.pause : m.play} onClick={() => playback.toggle()}>
          {state.playing ? <Pause aria-hidden className="fill-current" /> : <Play aria-hidden className="fill-current" />}
        </button>
        <button
          type="button"
          className={codeControlClassName}
          aria-label={m.next}
          onClick={() => playback.step(1)}
          disabled={step >= scene.steps.length - 1}
        >
          <ChevronRight aria-hidden />
        </button>
        <p className="eld-scene-caption" aria-live="polite">
          <span className="eld-scene-count">{formatMessage(m.step, { current: step + 1, total: scene.steps.length })}</span>
          <span>{current.label}</span>
        </p>
        {coverage !== undefined ? <span className="eld-scene-coverage">{formatMessage(m.coverage, { percent: `${coverage}%` })}</span> : null}
      </div>
      {current.frame ? <DebugPanel frame={current.frame} messages={m} /> : null}
      {writes ? <Terminal lines={sessionLines(terminalCommand, current.terminal)} copy={terminalCommand ? "commands" : false} /> : null}
    </div>
  );
}
