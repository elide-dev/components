/**
 * Notation comments, compatible with Shiki's transformer conventions:
 *
 *     const a = 1; // [!code ++]
 *     const b = 2; // [!code --]
 *     run();       // [!code highlight]   (or `hl`)
 *     focus();     // [!code focus:3]     (this and the next two lines)
 *     oops();      // [!code error]       / [!code warning]
 *     // [!code word:Database]            (marks the word on the next line)
 *
 * A marker on a line of its own applies to the following line(s) and the line
 * is removed. Comment syntax may be `//`, `#`, `--`, `;`, `/* *\/` or `<!-- -->`.
 * Pure: works with or without a highlighter, at build time or at runtime.
 */
import type { InlineDecoration, LineDecoration, LineDecorationKind } from "./code-model";

const KINDS: Record<string, LineDecorationKind> = {
  "++": "add",
  "--": "remove",
  highlight: "highlight",
  hl: "highlight",
  focus: "focus",
  error: "error",
  warning: "warning",
  warn: "warning",
};

const MARKER =
  /[ \t]*(?:\/\/|#|--|;|\/\*|<!--)[ \t]*\[!code[ \t]+(\+\+|--|highlight|hl|focus|error|warning|warn|word:[^\]\s]+)(?::(\d+))?\][ \t]*(?:\*\/|-->)?/g;

export interface ParsedNotations {
  code: string;
  decorations: LineDecoration[];
  inline: InlineDecoration[];
  /** 1-based source line → 1-based output line, or undefined if removed. */
  lineMap: (line: number) => number | undefined;
}

export function parseNotations(code: string): ParsedNotations {
  const source = code.split("\n");
  const out: string[] = [];
  const map: (number | undefined)[] = [];
  /** Pending notations from marker-only lines, applied to the next kept line. */
  let pending: { kind: string; count: number }[] = [];
  const applied: { line: number; kind: string; count: number }[] = [];

  for (let i = 0; i < source.length; i++) {
    const text = source[i];
    const found: { kind: string; count: number }[] = [];
    const stripped = text.replace(MARKER, (_match, kind: string, count?: string) => {
      found.push({ kind, count: count ? Math.max(1, Number(count)) : 1 });
      return "";
    });
    if (found.length && stripped.trim() === "") {
      // A marker on its own line: annotate what follows, drop this line.
      pending.push(...found);
      map.push(undefined);
      continue;
    }
    out.push(found.length ? stripped.replace(/[ \t]+$/, "") : text);
    const line = out.length;
    map.push(line);
    for (const notation of [...pending, ...found]) applied.push({ line, ...notation });
    pending = [];
  }

  const decorations: LineDecoration[] = [];
  const inline: InlineDecoration[] = [];
  for (const { line, kind, count } of applied) {
    const end = Math.min(out.length, line + count - 1);
    if (kind.startsWith("word:")) {
      const word = kind.slice(5);
      for (let n = line; n <= end; n++) {
        let at = out[n - 1].indexOf(word);
        while (at !== -1) {
          inline.push({ line: n, start: at, end: at + word.length, kind: "mark" });
          at = out[n - 1].indexOf(word, at + word.length);
        }
      }
      continue;
    }
    decorations.push({ line: count > 1 ? { start: line, end } : line, kind: KINDS[kind] });
  }
  return { code: out.join("\n"), decorations, inline, lineMap: (line) => map[line - 1] };
}

/** Parse a line-range meta string like `1,3-5` into line numbers. */
export function parseLineRanges(meta: string | readonly number[] | undefined): number[] {
  if (!meta) return [];
  if (typeof meta !== "string") return [...meta];
  const lines: number[] = [];
  for (const part of meta.replace(/[{}\s]/g, "").split(",")) {
    const range = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!range) continue;
    const start = Number(range[1]);
    const end = range[2] ? Number(range[2]) : start;
    for (let n = Math.min(start, end); n <= Math.max(start, end); n++) lines.push(n);
  }
  return lines;
}
