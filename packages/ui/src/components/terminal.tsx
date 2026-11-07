import * as React from "react";
import { linkify, type CodeLine } from "../lib/code-model";
import { tokenizeShell, type ShellTokenizeOptions } from "../lib/shell-tokens";
import {
  commandText,
  parseTranscript,
  transcriptText,
  type TerminalLine,
  type TranscriptMode,
} from "../lib/terminal-transcript";
import { cn } from "../lib/utils";
import { renderAnsi } from "../lib/vt";
import { formatMessage } from "../i18n/format";
import { useMessages } from "../i18n/context";
import { CodeLines } from "./code-lines";
import { CodeSurface, CodeSurfaceTitleBar } from "./code-surface";
import { CodeSurfaceActions } from "./code-surface-actions";
import type { CodeChrome } from "./code-surface-styles";
import { CopyButton } from "./copy-button";
import { TerminalRecording, type TerminalRecordingSource } from "./terminal-recording";

export type { TerminalLine, TranscriptMode } from "../lib/terminal-transcript";
export type { TerminalRecordingOptions, TerminalRecordingSource } from "./terminal-recording";

export interface TerminalPrompt {
  /** Prompt glyph (default `$`). Also recognized when parsing `code`. */
  symbol?: string;
  user?: string;
  host?: string;
  /** Working directory, shown before the glyph and in the title bar. */
  cwd?: string;
}

export interface TerminalProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title" | "children"> {
  /**
   * The session as text. Lines starting with a prompt (`$`, `❯`, `%`, or your
   * `prompt.symbol`) are commands; `# …` lines are comments; everything else is
   * output, which may contain ANSI color codes. Without any prompt, every line
   * is treated as a command. See `parse`.
   */
  code?: string;
  /** Explicit lines; takes precedence over `code`. */
  lines?: TerminalLine[];
  /** How `code` is split (default `auto`). */
  parse?: TranscriptMode;
  /** Prompt glyph, or a full prompt with user/host/cwd. */
  prompt?: string | TerminalPrompt;
  /** Title bar label; defaults to `user@host: cwd`, else the localized "Terminal". */
  title?: string;
  /** Shell name shown as a badge (e.g. `zsh`, `bash`). */
  lang?: string;
  /** What the copy button copies: just the commands (default), the full transcript, or nothing. */
  copy?: "commands" | "transcript" | false;
  /** Soft-wrap long lines like a real terminal (default true), or show a toggle. */
  wrap?: boolean | "toggle";
  /** Link command words, e.g. to CLI reference docs. */
  commandHref?: ShellTokenizeOptions["commandHref"];
  /** Subcommands to highlight per command (defaults cover elide, git, npm, bun, …). */
  subcommands?: ShellTokenizeOptions["subcommands"];
  /** Attach a recording (asciicast URL or options) to play in place of the static transcript. */
  recording?: TerminalRecordingSource;
  /** Window controls; `auto` follows the viewer's OS (see `codeChromeScript`). */
  chrome?: CodeChrome;
  /** @deprecated Use `chrome="none"`. */
  windowControls?: boolean;
  /** Pre-rendered body override (e.g. build-time highlighted markup). */
  children?: React.ReactNode;
}

/** Prompt glyph color as truecolor SGR, matching `--code-prompt` for synthesized casts. */
const PROMPT_SGR = "\x1b[38;2;196;181;253m";
const CWD_SGR = "\x1b[36m";

function promptParts(prompt: TerminalProps["prompt"]): TerminalPrompt & { symbol: string } {
  if (typeof prompt === "string") return { symbol: prompt };
  return { ...prompt, symbol: prompt?.symbol ?? "$" };
}

function titleFor(prompt: TerminalPrompt): string | undefined {
  const who = [prompt.user, prompt.host].filter(Boolean).join("@");
  if (who && prompt.cwd) return `${who}: ${prompt.cwd}`;
  return who || prompt.cwd || undefined;
}

/**
 * Transcript → model rows. Consecutive output renders together so ANSI state
 * carries across lines, as in a terminal; URLs in output become links.
 */
function toCodeLines(
  transcript: readonly TerminalLine[],
  prompt: TerminalPrompt & { symbol: string },
  shell: ShellTokenizeOptions,
): CodeLine[] {
  const rows: CodeLine[] = [];
  let output: string[] = [];
  const flush = () => {
    if (!output.length) return;
    const rendered = renderAnsi(output.join("\n"));
    // renderAnsi trims trailing blank lines; keep intentional ones.
    while (rendered.length < output.length) rendered.push({ tokens: [] });
    for (const line of linkify(rendered)) rows.push({ ...line, kind: "output" });
    output = [];
  };
  for (const line of transcript) {
    if (line.kind === "output") {
      output.push(line.text);
      continue;
    }
    flush();
    if (line.kind === "comment") {
      rows.push({ kind: "comment", tokens: [{ text: line.text }] });
      continue;
    }
    rows.push({
      kind: "command",
      prompt: line.continuation ? ">" : prompt.symbol,
      cwd: line.continuation ? undefined : prompt.cwd,
      exitCode: line.exitCode,
      tokens: tokenizeShell(line.text, { ...shell, continuation: line.continuation }),
    });
  }
  flush();
  return rows;
}

/** Each command (with its continuation lines) keyed by its first row index. */
function commandsByRow(transcript: readonly TerminalLine[]): Map<number, string> {
  const commands = new Map<number, string>();
  let start = -1;
  let row = 0;
  // Every transcript line is one row (output keeps blank lines).
  for (const line of transcript) {
    if (line.kind === "command") {
      if (line.continuation && start >= 0) commands.set(start, `${commands.get(start)}\n${line.text}`);
      else {
        start = row;
        commands.set(row, line.text);
      }
    }
    row++;
  }
  return commands;
}

interface SessionOptions {
  code: string;
  lines?: TerminalLine[];
  parse: TranscriptMode;
  symbol: string;
  cwd?: string;
  copy: TerminalProps["copy"];
  commandHref?: ShellTokenizeOptions["commandHref"];
  subcommands?: ShellTokenizeOptions["subcommands"];
}

/** Transcript, rendered rows, per-command copy targets and the copy-all value. */
function useTerminalSession({ code, lines, parse, symbol, cwd, copy, commandHref, subcommands }: SessionOptions) {
  const transcript = React.useMemo(
    () => lines ?? parseTranscript(code, { mode: parse, prompts: symbol === "$" ? undefined : [symbol, "$", "❯", "%"] }),
    [lines, code, parse, symbol],
  );
  const rows = React.useMemo(
    () => toCodeLines(transcript, { symbol, cwd }, { commandHref, subcommands }),
    [transcript, symbol, cwd, commandHref, subcommands],
  );
  const perCommand = React.useMemo(() => {
    const commands = commandsByRow(transcript);
    return copy !== false && commands.size > 1 ? commands : undefined;
  }, [transcript, copy]);
  const copyValue = copy === "transcript" ? transcriptText(transcript, symbol) : commandText(transcript);
  return { transcript, rows, perCommand, copyValue };
}

/** `chrome`, honoring the deprecated `windowControls={false}`. */
function resolveChrome(chrome: CodeChrome | undefined, windowControls: boolean | undefined): CodeChrome {
  return chrome ?? (windowControls === false ? "none" : "auto");
}

/** The prompt as ANSI, so synthesized recordings show the same cwd and glyph. */
function ansiPrompt({ symbol, cwd }: TerminalPrompt & { symbol: string }): string {
  return `${cwd ? `${CWD_SGR}${cwd}\x1b[0m ` : ""}${PROMPT_SGR}${symbol}\x1b[0m `;
}

/** The static transcript (a scroll group when unwrapped), or a recording that falls back to it. */
function TerminalBody({
  recording,
  transcript,
  prompt,
  label,
  scrollable,
  custom,
  children,
}: {
  recording?: TerminalRecordingSource;
  transcript: readonly TerminalLine[];
  prompt: TerminalPrompt & { symbol: string };
  label: string;
  scrollable: boolean;
  custom: boolean;
  children: React.ReactNode;
}) {
  if (recording) return <TerminalRecording source={recording} script={transcript} prompt={ansiPrompt(prompt)} fallback={children} />;
  return (
    <pre
      dir="ltr"
      className={cn("eld-code-body", custom && "px-4")}
      tabIndex={scrollable ? 0 : undefined}
      role={scrollable ? "group" : undefined}
      aria-label={scrollable ? label : undefined}
    >
      {children}
    </pre>
  );
}

/**
 * Terminal — a realistic shell session on the dark code surface: prompts,
 * zsh-style command highlighting, ANSI-colored output, wrapping like a real
 * terminal, and copy that yields only the runnable commands. Attach
 * `recording` to replay a real asciinema capture (or a synthesized typing
 * session) in place.
 */
export function Terminal({
  code = "",
  lines,
  parse = "auto",
  prompt: promptProp,
  title,
  lang,
  copy = "commands",
  wrap = true,
  commandHref,
  subcommands,
  recording,
  chrome: chromeProp,
  windowControls,
  children,
  className,
  ...props
}: TerminalProps) {
  const m = useMessages();
  const chrome = resolveChrome(chromeProp, windowControls);
  const prompt = promptParts(promptProp);
  const { symbol, cwd } = prompt;
  const [wrapped, setWrapped] = React.useState(wrap !== false);
  const { transcript, rows, perCommand, copyValue } = useTerminalSession({ code, lines, parse, symbol, cwd, copy, commandHref, subcommands });
  const exitLabel = React.useCallback((status: number) => formatMessage(m.terminal.exitCode, { code: status }), [m.terminal.exitCode]);
  const rowAction = React.useCallback(
    (_line: CodeLine, index: number) => {
      const command = perCommand?.get(index);
      return command ? (
        <CopyButton value={command} label="" copyLabel={m.terminal.copyCommand} className="eld-row-action px-1 py-0.5" />
      ) : null;
    },
    [perCommand, m.terminal.copyCommand],
  );
  const body = children ?? (
    <CodeLines
      lines={rows}
      variant="terminal"
      lang="shell-session"
      wrap={wrapped}
      exitLabel={exitLabel}
      rowAction={perCommand ? rowAction : undefined}
    />
  );
  const label = title ?? titleFor(prompt) ?? m.codeBlock.terminal;

  return (
    <CodeSurface chrome={chrome} data-slot="terminal" className={className} {...props}>
      <CodeSurfaceTitleBar
        chrome={chrome}
        title={label}
        actions={
          <CodeSurfaceActions
            lang={lang}
            wrapped={wrap === "toggle" ? wrapped : undefined}
            onWrapChange={setWrapped}
            copyValue={copy === false ? undefined : copyValue}
            copyLabel={copy === "commands" ? m.terminal.copyCommands : undefined}
          />
        }
      />
      <TerminalBody recording={recording} transcript={transcript} prompt={prompt} label={label} scrollable={!wrapped} custom={!!children}>
        {body}
      </TerminalBody>
    </CodeSurface>
  );
}
