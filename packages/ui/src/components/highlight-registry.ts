import type { CodeLine } from "../lib/code-model";

/**
 * A tiny, dependency-free hand-off point between `CodeBlock` and the lazily
 * loaded Shiki module. Once Shiki has loaded (or `preloadHighlighter()` ran),
 * it registers a synchronous highlighter here, so later code blocks highlight
 * in a layout effect, before paint, without importing Shiki statically.
 */
export interface SyncHighlighter {
  /** Highlighted lines, or undefined when the language is not loaded yet. */
  highlight(code: string, lang: string): CodeLine[] | undefined;
}

let current: SyncHighlighter | undefined;

export function setSyncHighlighter(highlighter: SyncHighlighter): void {
  current = highlighter;
}

export function getSyncHighlighter(): SyncHighlighter | undefined {
  return current;
}
