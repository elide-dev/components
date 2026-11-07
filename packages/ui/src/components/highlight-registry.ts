import type { CodeLine } from "../lib/code-model";

/** Loads a Shiki grammar module, e.g. `() => import("shiki/langs/go.mjs")`. */
export type GrammarLoader = () => Promise<{ default: unknown[] }>;

const extraGrammars = new Map<string, GrammarLoader>();
const extraAliases = new Map<string, string>();

/**
 * Add a language beyond the built-in set (TS/JS, Python, Kotlin, Java, Pkl,
 * JSON, YAML, TOML, SQL, HTML, CSS, XML, diff; shell uses its own tokenizer).
 * Lives here, not in the Shiki module, so registering costs nothing until a
 * block actually needs the grammar:
 *
 *     registerLanguage("go", () => import("shiki/langs/go.mjs"), ["golang"]);
 */
export function registerLanguage(id: string, loader: GrammarLoader, aliases: readonly string[] = []): void {
  extraGrammars.set(id.toLowerCase(), loader);
  for (const alias of aliases) extraAliases.set(alias.toLowerCase(), id.toLowerCase());
}

/** Languages registered with `registerLanguage`. */
export function registeredLanguages(): { grammars: ReadonlyMap<string, GrammarLoader>; aliases: ReadonlyMap<string, string> } {
  return { grammars: extraGrammars, aliases: extraAliases };
}

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
