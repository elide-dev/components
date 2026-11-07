import { Prism, normalizeTokens } from "prism-react-renderer";
import type { CodeLine, CodeToken } from "../lib/code-model";
import { tokenizeShell, type ShellTokenizeOptions } from "../lib/shell-tokens";
import { ensureGrammars } from "./prism-languages";

/** Map the friendly `lang` prop to a Prism grammar id (falls back to plain text). */
const LANG_ALIASES: Record<string, string> = {
  ts: "typescript",
  typescript: "typescript",
  tsx: "tsx",
  js: "javascript",
  javascript: "javascript",
  jsx: "jsx",
  json: "json",
  bash: "bash",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  terminal: "bash",
  css: "css",
  html: "markup",
  xml: "markup",
  md: "markdown",
  markdown: "markdown",
  py: "python",
  python: "python",
  yaml: "yaml",
  yml: "yaml",
  sql: "sql",
  go: "go",
};

export function prismLang(lang?: string): string {
  if (!lang) return "text";
  return LANG_ALIASES[lang.toLowerCase()] ?? lang.toLowerCase();
}

/** Shell code goes through the positional shell tokenizer, line by line. */
function shellLines(code: string, options?: ShellTokenizeOptions): CodeLine[] {
  let continuation = false;
  return code.split("\n").map((text) => {
    const tokens = tokenizeShell(text, { ...options, continuation });
    continuation = /\\\s*$/.test(text);
    return { tokens };
  });
}

/**
 * Highlight `code` into model lines. Token colors come from `.token.*` and
 * `.sh-*` classes in code-surface.css (themed by `--eld-syntax-*`), which keeps
 * server-rendered HTML small compared with per-token inline styles.
 */
export function highlightLines(code: string, lang?: string, options?: ShellTokenizeOptions): CodeLine[] {
  const grammarId = prismLang(lang);
  if (grammarId === "bash") return shellLines(code, options);
  ensureGrammars();
  const grammar = Prism.languages[grammarId];
  if (!grammar) return code.split("\n").map((text) => ({ tokens: text ? [{ text }] : [] }));
  return normalizeTokens(Prism.tokenize(code, grammar)).map((line) => ({
    tokens: line
      .filter((token) => !token.empty)
      .map((token): CodeToken => {
        const types = token.types.filter((type) => type !== "plain");
        return types.length ? { text: token.content, style: { className: `token ${types.join(" ")}` } } : { text: token.content };
      }),
  }));
}
