import type { CodeToken, InlineDecoration } from "./code-model";

/** Tokens with their starting column: a positional identity, stable across renders. */
export function withColumns(tokens: readonly CodeToken[]): { token: CodeToken; column: number }[] {
  let column = 0;
  return tokens.map((token) => {
    const entry = { token, column };
    column += token.text.length;
    return entry;
  });
}

export interface LineSegment {
  column: number;
  pieces: { token: CodeToken; column: number }[];
  decoration?: InlineDecoration;
}

/**
 * Split a line's tokens at inline decoration boundaries and group them into
 * segments, each either undecorated or covered by exactly one decoration.
 * Overlapping decorations are dropped in favor of the earlier one.
 */
export function segmentLine(tokens: readonly CodeToken[], inline: readonly InlineDecoration[]): LineSegment[] {
  const ranges = [...inline].sort((a, b) => a.start - b.start).filter((d, i, all) => i === 0 || d.start >= all[i - 1].end);
  const cuts = new Set(ranges.flatMap((d) => [d.start, d.end]));
  const segments: LineSegment[] = [];
  for (const { token, column } of withColumns(tokens)) {
    let start = 0;
    for (let i = 1; i <= token.text.length; i++) {
      if (i < token.text.length && !cuts.has(column + i)) continue;
      const at = column + start;
      const decoration = ranges.find((d) => at >= d.start && at < d.end);
      const piece = { token: { ...token, text: token.text.slice(start, i) }, column: at };
      const last = segments[segments.length - 1];
      if (last && last.decoration === decoration) last.pieces.push(piece);
      else segments.push({ column: at, pieces: [piece], decoration });
      start = i;
    }
  }
  return segments;
}
