/**
 * The annotated code model: one framework-neutral shape that every code and
 * terminal surface renders through. Producers (Shiki, the shell tokenizer, the
 * ANSI/VT interpreter in `vt.ts`) emit `CodeLine`s; decorations and insights
 * layer on top without knowing which producer made the tokens.
 *
 * Types only — no React, no DOM — so build-time tooling (Astro/MDX, scripts)
 * can produce documents without pulling in the component runtime.
 */

/** A color: a CSS color string, typically a `var(--eld-*)` reference or hex. */
export type CodeColor = string;

/**
 * Visual style of a run of text. A superset that both syntax-highlighter
 * themes and ANSI SGR attributes map onto.
 */
export interface TokenStyle {
  color?: CodeColor;
  background?: CodeColor;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** Rendered as transparent text that still occupies its cells (SGR 8). */
  hidden?: boolean;
  /** Extra class names (e.g. Shiki `tk-keyword`) for consumers that style by class. */
  className?: string;
}

export interface CodeToken {
  text: string;
  /** VT cell position/advance, present on positioned recording snapshots. */
  column?: number;
  columns?: number;
  style?: TokenStyle;
  /** The terminal cursor sits on this token (always a single cell). */
  cursor?: boolean;
  /** Render as a link (OSC 8 hyperlinks, auto-linked URLs, command docs). */
  href?: string;
}

export interface CodeLine {
  tokens: CodeToken[];
  /** 1-based source line number, when the line maps to source. */
  number?: number;
  /** Terminal row role. Commands render a prompt that is never selected or copied. */
  kind?: "command" | "output" | "comment";
  /** Prompt glyph before a command (`$`, `❯`, or `>` for continuations). */
  prompt?: string;
  /** Working directory shown before the prompt glyph. */
  cwd?: string;
  /** Exit status of the command, shown as a status dot. */
  exitCode?: number;
}

/** Inclusive 1-based line range. */
export interface LineRange {
  start: number;
  end: number;
}

export type DecorationTone = "info" | "success" | "warning" | "danger" | "insight";

export type LineDecorationKind =
  | "highlight"
  | "add"
  | "remove"
  | "focus"
  | "warning"
  | "error"
  | "fold"
  | "cursor"
  | "flash"
  | "breakpoint"
  | "breakpoint-hit";

export interface LineDecoration {
  /** A single 1-based line or an inclusive range. */
  line: number | LineRange;
  kind: LineDecorationKind;
  tone?: DecorationTone;
  /** Short visible label (gutter chip) and accessible description. */
  label?: string;
  data?: Record<string, unknown>;
}

export interface InlineDecoration {
  line: number;
  /** 0-based column range within the line's text, end-exclusive. */
  start: number;
  end: number;
  kind: "mark" | "hover" | "link" | "annotation" | "flash";
  tone?: DecorationTone;
  /** Hover text, annotation id, href, … depending on `kind`. */
  payload?: unknown;
}

export interface CoverageLine {
  hits: number;
  branches?: { covered: number; total: number };
}

export interface ProfileLine {
  /** Samples attributed to this line alone. */
  self: number;
  /** Samples including callees. */
  total: number;
}

export interface TraceFrame {
  name: string;
  file?: string;
  line?: number;
  lang?: string;
}

export interface TraceStep {
  file?: string;
  line: number;
  stack?: TraceFrame[];
  locals?: Record<string, string>;
  stdout?: string;
}

/** Runtime insight data keyed by 1-based line number. */
export interface CodeInsights {
  coverage?: Record<number, CoverageLine>;
  profile?: { total: number; lines: Record<number, ProfileLine> };
  trace?: TraceStep[];
}

export interface CodeDocument {
  lines: CodeLine[];
  decorations?: LineDecoration[];
  inline?: InlineDecoration[];
  insights?: CodeInsights;
}

/** Plain text of a line (token texts joined). */
export function lineText(line: CodeLine): string {
  return line.tokens.map((token) => token.text).join("");
}

/** Whether `line` (1-based) falls within a decoration's line or range. */
export function decorationCovers(decoration: LineDecoration, line: number): boolean {
  const target = decoration.line;
  return typeof target === "number" ? target === line : line >= target.start && line <= target.end;
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]}]/g;

/** Split plain-text runs at URLs into linked tokens (existing links are left alone). */
export function linkify(lines: readonly CodeLine[]): CodeLine[] {
  return lines.map((line) => {
    if (!line.tokens.some((token) => !token.href && token.text.includes("://"))) return line;
    const tokens: CodeToken[] = [];
    for (const token of line.tokens) {
      if (token.href || !token.text.includes("://")) {
        tokens.push(token);
        continue;
      }
      let last = 0;
      for (const match of token.text.matchAll(URL_PATTERN)) {
        const start = match.index ?? 0;
        if (start > last) tokens.push({ ...token, text: token.text.slice(last, start) });
        tokens.push({ ...token, text: match[0], href: match[0] });
        last = start + match[0].length;
      }
      if (last < token.text.length) tokens.push({ ...token, text: token.text.slice(last) });
    }
    return { ...line, tokens };
  });
}
