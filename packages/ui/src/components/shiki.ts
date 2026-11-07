/**
 * Shiki highlighting for Elide code surfaces.
 *
 * - Build time (Astro, MDX, RSC, scripts): `await highlightCode(code, lang)`
 *   returns serializable lines and decorations to spread into `<CodeBlock>`,
 *   optionally with Twoslash type hovers.
 * - Runtime: `CodeBlock` imports this module lazily when it meets an
 *   unhighlighted language; `preloadHighlighter()` warms it so blocks highlight
 *   before first paint.
 *
 * Uses Shiki's JavaScript regex engine (no WASM) and fine-grained grammars, and
 * a theme whose colors are `--code-syntax-*` variables (light or dark per surface), emitted as classes.
 */
import {
  createHighlighterCore,
  type HighlighterCore,
  type LanguageRegistration,
  type ThemeRegistration,
  type ThemedToken,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { CodeLine, CodeToken, InlineDecoration, LineDecoration } from "../lib/code-model";
import { parseNotations } from "../lib/notations";
import { isShellLang, shellLines } from "./highlight";
import { registeredLanguages, setSyncHighlighter } from "./highlight-registry";

type Loader = () => Promise<{ default: LanguageRegistration[] }>;

/**
 * Built-in grammars: the languages Elide runs and documents, plus the config
 * and data formats around them. Each is a static import, so bundlers emit one
 * lazy chunk per grammar and nothing else. Shell (bash, sh, zsh, …) needs no
 * grammar: the positional shell tokenizer handles it. JavaScript and JSX use
 * the TypeScript and TSX grammars (supersets; identical tokens), saving two
 * ~170 KB chunks. Add others with
 * `registerLanguage()` from `./highlight-registry`.
 */
const GRAMMARS: Record<string, Loader> = {
  typescript: () => import("shiki/langs/typescript.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  kotlin: () => import("shiki/langs/kotlin.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  pkl: () => import("shiki/langs/pkl.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  jsonc: () => import("shiki/langs/jsonc.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  xml: () => import("shiki/langs/xml.mjs"),
  diff: () => import("shiki/langs/diff.mjs"),
};

const ALIASES: Record<string, string> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  javascript: "typescript",
  js: "typescript",
  mjs: "typescript",
  cjs: "typescript",
  jsx: "tsx",
  py: "python",
  kt: "kotlin",
  kts: "kotlin",
  yml: "yaml",
  htm: "html",
  svg: "xml",
  pom: "xml",
  patch: "diff",
};

/** Grammar loader for a Shiki id: built in, or registered by the consumer. */
function grammarFor(id: string): Loader | undefined {
  return GRAMMARS[id] ?? (registeredLanguages().grammars.get(id) as Loader | undefined);
}

/** Supported grammar ids (shell languages use the built-in shell tokenizer). */
export function supportedLanguages(): string[] {
  return [...Object.keys(GRAMMARS), ...registeredLanguages().grammars.keys()];
}

/** Resolve a friendly `lang` to a grammar id, or undefined if unsupported. */
export function resolveLanguage(lang: string | undefined): string | undefined {
  if (!lang) return undefined;
  const id = lang.toLowerCase();
  const resolved = ALIASES[id] ?? registeredLanguages().aliases.get(id) ?? id;
  return grammarFor(resolved) ? resolved : undefined;
}

const v = (name: string) => `var(--code-syntax-${name})`;

/** TextMate theme whose colors are the design-system syntax tokens. */
export const elideTheme: ThemeRegistration = {
  name: "elide",
  type: "dark",
  colors: { "editor.foreground": v("default"), "editor.background": "var(--code-background)" },
  fg: v("default"),
  bg: "var(--code-background)",
  settings: [
    { settings: { foreground: v("default") } },
    { scope: ["comment", "punctuation.definition.comment", "string.comment"], settings: { foreground: v("comment"), fontStyle: "italic" } },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.control", "keyword.operator.new", "keyword.operator.expression", "variable.language", "entity.name.tag", "markup.heading", "punctuation.definition.template-expression"],
      settings: { foreground: v("keyword") },
    },
    { scope: ["string", "string.template", "punctuation.definition.string", "constant.other.symbol", "markup.inline.raw", "string.regexp"], settings: { foreground: v("string") } },
    { scope: ["constant.numeric", "constant.language", "constant.character", "constant.other", "support.constant", "markup.inserted"], settings: { foreground: v("number") } },
    { scope: ["entity.name.function", "support.function", "meta.function-call entity.name.function", "variable.function", "markup.deleted"], settings: { foreground: v("function") } },
    {
      scope: ["entity.name.type", "entity.name.class", "entity.name.namespace", "entity.other.inherited-class", "support.type", "support.class", "storage.type.primitive", "entity.name.type.module"],
      settings: { foreground: v("type") },
    },
    {
      scope: ["variable.parameter", "variable.other.property", "variable.other.object.property", "meta.object-literal.key", "support.variable.property", "entity.other.attribute-name", "variable.other.member", "meta.property-name", "support.type.property-name"],
      settings: { foreground: v("param") },
    },
    { scope: ["keyword.operator", "punctuation", "meta.brace"], settings: { foreground: v("default") } },
    { scope: ["markup.bold"], settings: { fontStyle: "bold" } },
    { scope: ["markup.italic"], settings: { fontStyle: "italic" } },
    { scope: ["markup.underline.link"], settings: { fontStyle: "underline" } },
  ],
};

/** Theme color → class (styled in code-surface.css), keeping server HTML small. */
const COLOR_CLASS: Record<string, string> = {
  [v("comment")]: "tk-comment",
  [v("keyword")]: "tk-keyword",
  [v("string")]: "tk-string",
  [v("number")]: "tk-number",
  [v("function")]: "tk-function",
  [v("type")]: "tk-type",
  [v("param")]: "tk-param",
};

/** Convert Shiki themed tokens into code-model lines. */
export function tokensToLines(tokens: ThemedToken[][]): CodeLine[] {
  return tokens.map((line) => ({
    tokens: line.map((token): CodeToken => {
      const classes: string[] = [];
      const colorClass = token.color ? COLOR_CLASS[token.color.toLowerCase()] ?? COLOR_CLASS[token.color] : undefined;
      if (colorClass) classes.push(colorClass);
      const style = token.fontStyle ?? 0;
      if (style & 1 && colorClass !== "tk-comment") classes.push("tk-italic");
      if (style & 2) classes.push("tk-bold");
      if (style & 4) classes.push("tk-underline");
      return classes.length ? { text: token.content, style: { className: classes.join(" ") } } : { text: token.content };
    }),
  }));
}

/**
 * Per-line tokenize budget (vscode-textmate stops a line when it runs out and
 * leaves the rest unstyled). The first line also pays for compiling the
 * grammar's regexes, so slow machines can exceed Shiki's 500 ms default.
 * Runtime keeps a generous guard against pathological lines; build time
 * passes 0 (no limit) so output never depends on machine speed.
 */
export const RUNTIME_TOKENIZE_LIMIT = 2000;

let core: Promise<HighlighterCore> | undefined;
const loaded = new Set<string>();

function getCore(): Promise<HighlighterCore> {
  core ??= createHighlighterCore({ themes: [elideTheme], langs: [], engine: createJavaScriptRegexEngine({ forgiving: true }) }).then(
    (highlighter) => {
      setSyncHighlighter({
        highlight(code, lang) {
          if (isShellLang(lang)) return shellLines(code);
          const id = resolveLanguage(lang);
          if (!id || !loaded.has(id)) return undefined;
          return tokensToLines(highlighter.codeToTokensBase(code, { lang: id, theme: "elide", tokenizeTimeLimit: RUNTIME_TOKENIZE_LIMIT }));
        },
      });
      return highlighter;
    },
  );
  return core;
}

async function ensureLanguage(highlighter: HighlighterCore, id: string): Promise<void> {
  if (loaded.has(id)) return;
  const grammar = await grammarFor(id)!();
  await highlighter.loadLanguage(...grammar.default);
  loaded.add(id);
}

/** Load Shiki and the given languages so code blocks highlight before first paint. */
export async function preloadHighlighter(langs: readonly string[] = ["typescript"]): Promise<void> {
  const highlighter = await getCore();
  await Promise.all(langs.map(resolveLanguage).filter((id): id is string => !!id).map((id) => ensureLanguage(highlighter, id)));
}

/**
 * Highlight to model lines (plain lines for unsupported languages).
 * `timeLimit` is the per-line tokenize budget in ms (0: none).
 */
export async function highlightToLines(code: string, lang: string | undefined, timeLimit = RUNTIME_TOKENIZE_LIMIT): Promise<CodeLine[]> {
  if (lang && isShellLang(lang)) return shellLines(code);
  const id = resolveLanguage(lang);
  if (!id) return code.split("\n").map((text) => ({ tokens: text ? [{ text }] : [] }));
  const highlighter = await getCore();
  await ensureLanguage(highlighter, id);
  return tokensToLines(highlighter.codeToTokensBase(code, { lang: id, theme: "elide", tokenizeTimeLimit: timeLimit }));
}

export interface TwoslashOptions {
  /**
   * A TypeScript module exposing the JavaScript compiler API. Defaults to
   * `typescript` when it provides one (TypeScript ≤ 6), else
   * `@typescript/typescript6` (alongside native TypeScript 7).
   */
  typescript?: unknown;
  /** Directory of the compiler's `lib.*.d.ts` files (derived when possible). */
  tsLibDirectory?: string;
  /** Options forwarded to the twoslasher, e.g. `compilerOptions`. */
  compilerOptions?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Import an optional build-time module without letting bundlers resolve it:
 * the specifier is assembled at runtime, so browser bundles never include
 * Twoslash or the TypeScript compiler behind it.
 */
function importOptional(...parts: string[]): Promise<unknown> {
  const specifier = parts.join("");
  return import(/* @vite-ignore */ /* webpackIgnore: true */ specifier);
}

interface CompilerApi {
  module: unknown;
  /** Directory containing the compiler's `lib.*.d.ts` files. */
  libDirectory?: string;
}

/**
 * A TypeScript module with the JavaScript compiler API (native TypeScript 7
 * has none) and its lib directory. Node only: used by Twoslash at build time.
 */
async function compilerApi(provided: unknown, libDirectory?: string): Promise<CompilerApi> {
  const usable = (candidate: unknown) => {
    const module = (candidate as { default?: unknown })?.default ?? candidate;
    return typeof (module as { createProgram?: unknown })?.createProgram === "function" ? module : undefined;
  };
  if (provided) return { module: usable(provided) ?? provided, libDirectory };
  const { createRequire } = (await importOptional("node:", "module")) as typeof import("node:module");
  const { dirname, join } = (await importOptional("node:", "path")) as typeof import("node:path");
  const { existsSync } = (await importOptional("node:", "fs")) as typeof import("node:fs");
  const require = createRequire(join(process.cwd(), "noop.js"));
  const hasLibs = (directory: string | undefined) => !!directory && existsSync(join(directory, "lib.es5.d.ts"));
  const resolveDirectory = (from: NodeJS.Require, specifier: string) => {
    try {
      return dirname(from.resolve(specifier));
    } catch {
      return undefined;
    }
  };
  /** Where `lib.*.d.ts` live: beside the compiler, in `typescript/lib`, or in TS 7's platform package. */
  const findLibs = (compilerDirectory: string | undefined) => {
    const typescriptDirectory = resolveDirectory(require, "typescript/package.json");
    const platform = typescriptDirectory
      ? resolveDirectory(createRequire(join(typescriptDirectory, "package.json")), `@typescript/typescript-${process.platform}-${process.arch}/package.json`)
      : undefined;
    return [compilerDirectory, typescriptDirectory && join(typescriptDirectory, "lib"), platform && join(platform, "lib")].find(hasLibs);
  };
  for (const specifier of [["type", "script"].join(""), ["@typescript/", "typescript6"].join("")]) {
    const module = usable(await importOptional(specifier).catch(() => undefined));
    if (!module) continue;
    return { module, libDirectory: libDirectory ?? findLibs(resolveDirectory(require, specifier)) };
  }
  throw new Error("Twoslash needs TypeScript's JavaScript compiler API: install `typescript` (≤ 6) or `@typescript/typescript6`.");
}

export interface HighlightOptions {
  /** Parse `[!code ++]`-style notation comments into decorations (default true). */
  notations?: boolean;
  /** TypeScript type hovers and errors (build time only; requires the `twoslash` package). */
  twoslash?: boolean | TwoslashOptions;
}

/** Serializable highlight result: spread it into `<CodeBlock {...result} />`. */
export interface HighlightedCode {
  /** Source with notation comments and Twoslash markup removed. */
  code: string;
  lang?: string;
  lines: CodeLine[];
  decorations: LineDecoration[];
  inline: InlineDecoration[];
}

interface TwoslashNode {
  type: string;
  line: number;
  character: number;
  length: number;
  text?: string;
  docs?: string;
}

/**
 * Highlight `code` for a code block. Runs anywhere (Node at build time or the
 * browser); Twoslash needs Node with `twoslash` and `typescript` installed.
 */
export async function highlightCode(code: string, lang?: string, options: HighlightOptions = {}): Promise<HighlightedCode> {
  let source = code.replace(/\n$/, "");
  const inline: InlineDecoration[] = [];
  const decorations: LineDecoration[] = [];
  if (options.twoslash) {
    const { typescript, tsLibDirectory, ...twoslashOptions } = options.twoslash === true ? ({} as TwoslashOptions) : options.twoslash;
    // `twoslash/core` takes the compiler as an argument instead of importing `typescript` itself.
    const { createTwoslasher } = (await importOptional("two", "slash/core")) as {
      createTwoslasher: (options: { tsModule: unknown; tsLibDirectory?: string; vfsRoot: string }) => (code: string, extension: string, options?: object) => { code: string; nodes: TwoslashNode[] };
    };
    const extension = lang === "tsx" ? "tsx" : lang === "js" || lang === "javascript" ? "js" : "ts";
    const compiler = await compilerApi(typescript, tsLibDirectory);
    const twoslash = createTwoslasher({ tsModule: compiler.module, tsLibDirectory: compiler.libDirectory, vfsRoot: process.cwd() })(
      source,
      extension,
      twoslashOptions,
    );
    source = twoslash.code.replace(/\n$/, "");
    for (const node of twoslash.nodes) {
      // A `^?` query and the hover it repeats share a position: keep one.
      if (inline.some((d) => d.line === node.line + 1 && d.start === node.character)) continue;
      if ((node.type === "hover" || node.type === "query") && node.text) {
        const payload = node.docs ? `${node.text}\n\n${node.docs}` : node.text;
        inline.push({ line: node.line + 1, start: node.character, end: node.character + node.length, kind: "hover", payload });
      } else if (node.type === "error" && node.text) {
        inline.push({ line: node.line + 1, start: node.character, end: node.character + node.length, kind: "hover", tone: "danger", payload: node.text });
        decorations.push({ line: node.line + 1, kind: "error", label: node.text });
      }
    }
  }
  if (options.notations !== false) {
    const parsed = parseNotations(source);
    source = parsed.code;
    // Twoslash positions refer to the pre-notation source: follow removed lines.
    const remapped = inline.flatMap((decoration) => {
      const line = parsed.lineMap(decoration.line);
      return line ? [{ ...decoration, line }] : [];
    });
    const remappedLines = decorations.flatMap((decoration) => {
      const line = typeof decoration.line === "number" ? parsed.lineMap(decoration.line) : undefined;
      return line ? [{ ...decoration, line }] : [];
    });
    inline.splice(0, inline.length, ...remapped, ...parsed.inline);
    decorations.splice(0, decorations.length, ...remappedLines, ...parsed.decorations);
  }
  // Build-time output must be complete and deterministic: no tokenize time limit.
  const lines = await highlightToLines(source, lang, 0);
  return { code: source, lang, lines, decorations, inline };
}
