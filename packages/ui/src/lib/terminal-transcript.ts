/**
 * Terminal transcripts: split a sample like
 *
 *     $ elide run app.ts
 *     Hello from Elide!
 *
 * into commands, output and comments, so commands can be highlighted as shell,
 * output rendered as ANSI, and "copy" can yield just the runnable commands.
 */
import { stripAnsi } from "./vt";

export interface TerminalLine {
  kind: "command" | "output" | "comment";
  text: string;
  /** Continuation of the previous command (after a trailing `\`), shown after PS2. */
  continuation?: boolean;
  /** Exit status of a command, shown as a green (0) or red status dot. */
  exitCode?: number;
}

/**
 * - `auto`: if any line starts with a prompt, prompt lines are commands and the
 *   rest is output; otherwise every line is a command (a plain command listing).
 * - `commands`: every non-comment line is a command, prompts optional.
 * - `output`: everything is output (e.g. a log excerpt).
 */
export type TranscriptMode = "auto" | "commands" | "output";

export const DEFAULT_PROMPTS = ["$", "❯", "%"] as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * In a session, `# …` is an annotation only at the start, after another
 * comment, or after a blank line; right after a command or output it is more
 * likely output (a Markdown heading, a printed script).
 */
function isAnnotationSlot(previous: TerminalLine | undefined): boolean {
  return !previous || previous.kind === "comment" || (previous.kind === "output" && previous.text === "");
}

export function parseTranscript(
  code: string,
  options: { mode?: TranscriptMode; prompts?: readonly string[] } = {},
): TerminalLine[] {
  const prompts = options.prompts?.length ? options.prompts : DEFAULT_PROMPTS;
  const promptPattern = new RegExp(`^(?:${prompts.map(escapeRegExp).join("|")})(?: |$)`);
  const rows = code.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  let mode = options.mode ?? "auto";
  if (mode === "auto") mode = rows.some((row) => promptPattern.test(row)) ? "auto" : "commands";

  const lines: TerminalLine[] = [];
  let continuing = false;
  for (const row of rows) {
    if (mode === "output") {
      lines.push({ kind: "output", text: row });
      continue;
    }
    if (continuing) {
      lines.push({ kind: "command", text: row, continuation: true });
      continuing = /\\$/.test(row);
      continue;
    }
    const prompt = promptPattern.exec(row);
    if (prompt) {
      const text = row.slice(prompt[0].length);
      lines.push({ kind: "command", text });
      continuing = /\\$/.test(text);
    } else if (/^#(?: |$)/.test(row) && (mode === "commands" || isAnnotationSlot(lines[lines.length - 1]))) {
      lines.push({ kind: "comment", text: row });
    } else if (mode === "commands" && row.trim() !== "") {
      lines.push({ kind: "command", text: row });
      continuing = /\\$/.test(row);
    } else {
      lines.push({ kind: "output", text: row });
    }
  }
  return lines;
}

/** The runnable commands, one per line (continuations kept), for copying. */
export function commandText(lines: readonly TerminalLine[]): string {
  return lines
    .filter((line) => line.kind === "command")
    .map((line) => line.text)
    .join("\n");
}

/** A plain-text transcript with prompts, output stripped of escape codes. */
export function transcriptText(lines: readonly TerminalLine[], prompt = "$"): string {
  return lines
    .map((line) => {
      if (line.kind === "command") return `${line.continuation ? ">" : prompt} ${line.text}`;
      return stripAnsi(line.text);
    })
    .join("\n");
}
