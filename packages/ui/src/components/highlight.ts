import type { CodeLine } from "../lib/code-model";
import { tokenizeShell, type ShellTokenizeOptions } from "../lib/shell-tokens";

/**
 * Synchronous highlighting that needs no grammar download: shell languages go
 * through the positional shell tokenizer; everything else starts as plain text
 * and is upgraded by Shiki (see ./shiki.ts) once it has loaded.
 */
const SHELL = new Set(["bash", "sh", "shell", "zsh", "console", "terminal", "shellscript", "shellsession", "fish", "ksh"]);

export function isShellLang(lang: string | undefined): boolean {
  return !!lang && SHELL.has(lang.toLowerCase());
}

/** Shell code, line by line, following `\` continuations. */
export function shellLines(code: string, options?: ShellTokenizeOptions): CodeLine[] {
  let continuation = false;
  return code.split("\n").map((text) => {
    const tokens = tokenizeShell(text, { ...options, continuation });
    continuation = /\\\s*$/.test(text);
    return { tokens };
  });
}

/** Unhighlighted lines (the SSR and pre-Shiki state; same text, so no layout change on upgrade). */
export function plainLines(code: string): CodeLine[] {
  return code.split("\n").map((text) => ({ tokens: text ? [{ text }] : [] }));
}

/** Lines available synchronously: shell-highlighted, or plain. */
export function syncLines(code: string, lang: string | undefined): CodeLine[] {
  return isShellLang(lang) ? shellLines(code) : plainLines(code);
}
