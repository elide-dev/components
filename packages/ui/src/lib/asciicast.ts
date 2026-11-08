/**
 * Asciicast support: parse asciinema recordings (v1, v2, v3), normalize their
 * timing, render any point in time through the lite VT with keyframed seeking,
 * and synthesize "typed" casts from static terminal transcripts.
 *
 * Format references: https://docs.asciinema.org/manual/asciicast/v2/ and /v3/.
 */
import type { TerminalLine } from "./terminal-transcript";
import { createTerminal, stripAnsi, type TerminalScreen, type VirtualTerminal } from "./vt";

export type CastEventKind = "o" | "i" | "m" | "r" | "x";

export interface CastEvent {
  /** Absolute time in seconds from the start of the recording. */
  time: number;
  kind: CastEventKind;
  data: string;
}

export interface CastMarker {
  time: number;
  label: string;
}

export interface CastTheme {
  foreground?: string;
  background?: string;
  palette?: string[];
}

export interface Cast {
  version: 1 | 2 | 3;
  cols: number;
  rows: number;
  /** Time of the last event, in seconds. */
  duration: number;
  idleTimeLimit?: number;
  title?: string;
  theme?: CastTheme;
  events: CastEvent[];
  markers: CastMarker[];
}

export class AsciicastError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsciicastError";
  }
}

type Header = Record<string, unknown>;

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseTheme(raw: unknown): CastTheme | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const theme = raw as Record<string, unknown>;
  const palette = str(theme.palette)?.split(":");
  return { foreground: str(theme.fg), background: str(theme.bg), palette };
}

function finish(header: Omit<Cast, "duration" | "markers">): Cast {
  const markers = header.events
    .filter((event) => event.kind === "m")
    .map((event) => ({ time: event.time, label: event.data }));
  const duration = header.events.length ? header.events[header.events.length - 1].time : 0;
  return { ...header, duration, markers };
}

function parseLines(text: string): unknown[] {
  const values: unknown[] = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue; // v3 allows comment lines
    try {
      values.push(JSON.parse(trimmed));
    } catch {
      throw new AsciicastError(`Invalid JSON on line ${index + 1}`);
    }
  }
  return values;
}

function toEvent(raw: unknown, time: number): CastEvent | undefined {
  if (!Array.isArray(raw) || raw.length < 3) return undefined;
  const kind = raw[1];
  if (kind !== "o" && kind !== "i" && kind !== "m" && kind !== "r" && kind !== "x") return undefined;
  return { time, kind, data: String(raw[2]) };
}

/** Parse an asciicast from its file contents (or an already-parsed v1 object). */
export function parseAsciicast(input: string | object): Cast {
  if (typeof input === "object") {
    return parseV1(input as Header);
  }
  const text = input.replace(/^\uFEFF/, "");
  // v1 is a single JSON document; v2/v3 are newline-delimited JSON.
  try {
    const whole = JSON.parse(text) as Header;
    if (whole && typeof whole === "object" && whole.version === 1) return parseV1(whole);
  } catch {
    // newline-delimited: fall through
  }
  const [header, ...rows] = parseLines(text) as [Header, ...unknown[]];
  if (!header || typeof header !== "object") throw new AsciicastError("Missing asciicast header");
  if (header.version === 2) {
    const events = rows
      .map((row) => toEvent(row, Array.isArray(row) ? Number(row[0]) : NaN))
      .filter((event): event is CastEvent => !!event && Number.isFinite(event.time));
    events.sort((a, b) => a.time - b.time);
    return finish({
      version: 2,
      cols: num(header.width) ?? 80,
      rows: num(header.height) ?? 24,
      idleTimeLimit: num(header.idle_time_limit),
      title: str(header.title),
      theme: parseTheme(header.theme),
      events,
    });
  }
  if (header.version === 3) {
    const term = (header.term ?? {}) as Header;
    let time = 0;
    const events: CastEvent[] = [];
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const interval = Number(row[0]);
      if (!Number.isFinite(interval)) continue;
      time += Math.max(0, interval);
      const event = toEvent(row, time);
      if (event) events.push(event);
    }
    return finish({
      version: 3,
      cols: num(term.cols) ?? 80,
      rows: num(term.rows) ?? 24,
      idleTimeLimit: num(header.idle_time_limit),
      title: str(header.title),
      theme: parseTheme(term.theme),
      events,
    });
  }
  throw new AsciicastError(`Unsupported asciicast version ${String(header.version)}`);
}

function parseV1(header: Header): Cast {
  if (header.version !== 1 || !Array.isArray(header.stdout)) throw new AsciicastError("Invalid asciicast v1 document");
  let time = 0;
  const events: CastEvent[] = [];
  for (const frame of header.stdout as unknown[]) {
    if (!Array.isArray(frame)) continue;
    time += Math.max(0, Number(frame[0]) || 0);
    events.push({ time, kind: "o", data: String(frame[1]) });
  }
  return finish({
    version: 1,
    cols: num(header.width) ?? 80,
    rows: num(header.height) ?? 24,
    title: str(header.title),
    events,
  });
}

export interface NormalizeOptions {
  /** Cap every pause at this many seconds (asciinema `idle_time_limit`). */
  idleTimeLimit?: number;
  /** Drop leading silence before the first output. */
  trimStart?: boolean;
}

/** Compress idle gaps and leading silence. Returns a new cast. */
export function normalizeCast(cast: Cast, options: NormalizeOptions = {}): Cast {
  const limit = options.idleTimeLimit ?? cast.idleTimeLimit;
  const offset = options.trimStart ? (cast.events.find((event) => event.kind === "o")?.time ?? 0) : 0;
  let previousSource = offset;
  let time = 0;
  const events = cast.events.map((event) => {
    const source = Math.max(event.time, offset);
    const gap = source - previousSource;
    previousSource = source;
    time += limit !== undefined && limit > 0 ? Math.min(gap, limit) : gap;
    return { ...event, time };
  });
  return finish({ ...cast, events });
}

interface Keyframe {
  /** Number of events applied. */
  index: number;
  time: number;
  terminal: VirtualTerminal;
}

/** Spacing between seek keyframes, in seconds of cast time. */
const KEYFRAME_INTERVAL = 2;

/**
 * Renders a cast at arbitrary times. Forward playback feeds only new events;
 * backward seeks restart from the nearest keyframe, which are recorded lazily
 * as playback passes them, so scrubbing stays cheap on long recordings.
 */
export class CastRenderer {
  readonly cast: Cast;
  private terminal: VirtualTerminal;
  private index = 0;
  private keyframes: Keyframe[];
  /** Last snapshot and the event count it reflects: frames without new output reuse it. */
  private cached: { index: number; screen: TerminalScreen } | undefined;

  constructor(cast: Cast) {
    this.cast = cast;
    this.terminal = createTerminal({ cols: cast.cols, rows: cast.rows });
    this.keyframes = [{ index: 0, time: 0, terminal: this.terminal.clone() }];
  }

  /** Terminal state after every event at or before `time`. */
  at(time: number): VirtualTerminal {
    const events = this.cast.events;
    const appliedTime = this.index > 0 ? events[this.index - 1].time : 0;
    if (time < appliedTime) {
      let keyframe = this.keyframes[0];
      for (const candidate of this.keyframes) {
        if (candidate.time <= time) keyframe = candidate;
        else break;
      }
      this.terminal = keyframe.terminal.clone();
      this.index = keyframe.index;
    }
    while (this.index < events.length && events[this.index].time <= time) {
      const event = events[this.index++];
      if (event.kind === "o") this.terminal.write(event.data);
      else if (event.kind === "r") {
        const match = /^(\d+)x(\d+)$/.exec(event.data.trim());
        if (match) this.terminal.resize(Number(match[1]), Number(match[2]));
      }
      const last = this.keyframes[this.keyframes.length - 1];
      if (event.time - last.time >= KEYFRAME_INTERVAL && this.index > last.index) {
        this.keyframes.push({ index: this.index, time: event.time, terminal: this.terminal.clone() });
      }
    }
    return this.terminal;
  }

  /** Screen at `time`. Returns the same object while no event has been applied, so renders can bail out. */
  screen(time: number): TerminalScreen {
    const terminal = this.at(time);
    if (this.cached?.index === this.index) return this.cached.screen;
    const screen = terminal.snapshot({ scrollback: false, positioned: true });
    this.cached = { index: this.index, screen };
    return screen;
  }
}

/** One-shot render of a cast at `time` (e.g. the SSR poster frame). */
export function frameAt(cast: Cast, time: number): TerminalScreen {
  return new CastRenderer(cast).screen(time);
}

// ---------------------------------------------------------------------------
// Synthesis: a typed session from a static transcript.

/** A transcript line to type out; see `parseTranscript`. */
export type ScriptLine = TerminalLine;

export interface SynthesizeOptions {
  /** Prompt printed before each command (may contain SGR). */
  prompt?: string;
  /** Prompt for continuation lines. */
  continuationPrompt?: string;
  cols?: number;
  rows?: number;
  /** Seconds per typed character (default 0.045). */
  typingSpeed?: number;
  /** Fractional per-character jitter, 0–1 (default 0.5). */
  jitter?: number;
  /** Pause after the prompt appears, before typing (default 0.6s). */
  thinkTime?: number;
  /** Pause between Enter and the first output line (default 0.3s). */
  outputDelay?: number;
  /** Delay between successive output lines (default 0.04s). */
  lineDelay?: number;
  /** Hold on the final frame (default 1s). */
  endHold?: number;
  /** Seed for deterministic jitter, so SSR and visual tests are stable. */
  seed?: number;
}

/** Small deterministic PRNG (mulberry32). */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a cast that types each command after its prompt, then prints its
 * output, with a marker at every command. Output may contain ANSI sequences.
 */
export function synthesizeCast(lines: readonly ScriptLine[], options: SynthesizeOptions = {}): Cast {
  const {
    prompt = "\x1b[38;2;196;181;253m$\x1b[0m ",
    continuationPrompt = "\x1b[38;2;196;181;253m>\x1b[0m ",
    typingSpeed = 0.045,
    jitter = 0.5,
    thinkTime = 0.6,
    outputDelay = 0.3,
    lineDelay = 0.04,
    endHold = 1,
    seed = 1,
  } = options;
  const next = random(seed);
  const events: CastEvent[] = [];
  let time = 0;
  const out = (data: string) => events.push({ time, kind: "o", data });
  let needsNewline = false;
  let afterCommand = false;

  lines.forEach((line, index) => {
    if (line.kind === "command") {
      if (needsNewline) {
        out("\r\n");
        needsNewline = false;
      }
      if (!line.continuation) {
        events.push({ time, kind: "m", data: line.text });
        out(prompt);
      } else {
        out(continuationPrompt);
      }
      time += line.continuation ? thinkTime / 3 : thinkTime;
      for (const ch of line.text) {
        time += typingSpeed * (1 + (next() * 2 - 1) * jitter);
        out(ch);
      }
      const continues = lines[index + 1]?.continuation === true;
      time += continues ? typingSpeed * 4 : typingSpeed * 6;
      out("\r\n");
      afterCommand = !continues;
      if (afterCommand) time += outputDelay;
    } else {
      if (needsNewline) out("\r\n");
      const text = line.kind === "comment" ? `\x1b[2m${line.text}\x1b[22m` : line.text;
      out(text.replace(/\r?\n/g, "\r\n"));
      needsNewline = true;
      time += lineDelay;
      afterCommand = false;
    }
  });
  if (needsNewline) out("\r\n");
  // End on an idle prompt, like a real session.
  out(prompt);
  const physical = lines.flatMap((line) => stripAnsi(line.text).split(/\r?\n/));
  const longest = physical.reduce((max, line) => Math.max(max, line.length + 4), 0);
  const cols = options.cols ?? Math.min(160, Math.max(40, longest));
  // Room for every line plus the trailing idle prompt.
  const rows = options.rows ?? Math.min(40, Math.max(4, physical.length + 1));
  const cast = finish({ version: 3, cols, rows, events });
  return { ...cast, duration: time + endHold };
}
