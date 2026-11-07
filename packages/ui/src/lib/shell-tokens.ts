/**
 * Shell command tokenizer with zsh-syntax-highlighting semantics: the command
 * word in each pipeline segment (after `|`, `&&`, `;`, `$(`, `sudo`, `VAR=x`, …)
 * is distinguished from its flags, paths, strings, variables, redirections and
 * operators. Positional, so it needs no hand-maintained list of command names,
 * unlike a regex grammar. Emits code-model tokens styled by `sh-*` classes.
 */
import type { CodeToken } from "./code-model";

export type ShellTokenKind =
  | "command"
  | "precommand"
  | "builtin"
  | "keyword"
  | "subcommand"
  | "flag"
  | "arg"
  | "path"
  | "glob"
  | "string"
  | "variable"
  | "assignment"
  | "redirect"
  | "operator"
  | "substitution"
  | "comment"
  | "continuation";

export interface ShellTokenizeOptions {
  /** The line continues a previous command (after a trailing `\`), so it starts with arguments. */
  continuation?: boolean;
  /** Known subcommands per command, e.g. `{ elide: ["run", "build"] }`. */
  subcommands?: Readonly<Record<string, readonly string[]>>;
  /** Link command words (e.g. to CLI reference docs). */
  commandHref?: (command: string) => string | undefined;
}

const PRECOMMANDS = new Set(["sudo", "doas", "env", "command", "exec", "nohup", "nice", "time", "xargs", "builtin", "noglob", "nocorrect", "watch", "npx", "bunx"]);
const BUILTINS = new Set(["cd", "echo", "export", "source", ".", "set", "unset", "alias", "read", "printf", "eval", "exit", "return", "pwd", "pushd", "popd", "test", "type", "which", "local", "shift", "trap", "ulimit", "umask", "wait", "kill", "jobs", "fg", "bg", "history", "true", "false"]);
/** Keywords after which a command is expected again. */
const COMMAND_KEYWORDS = new Set(["if", "then", "else", "elif", "while", "until", "do", "!", "{", "[["]);
const OTHER_KEYWORDS = new Set(["fi", "for", "done", "case", "esac", "function", "in", "select", "}", "]]"]);

/** Subcommands highlighted out of the box. */
export const DEFAULT_SUBCOMMANDS: Readonly<Record<string, readonly string[]>> = {
  elide: ["run", "serve", "build", "install", "test", "init", "add", "remove", "lsp", "mcp", "info", "help", "pkl", "javac", "kotlinc", "jar", "native-image", "project", "repl"],
  git: ["add", "branch", "checkout", "clone", "commit", "diff", "fetch", "init", "log", "merge", "pull", "push", "rebase", "reset", "restore", "rev-parse", "show", "stash", "status", "switch", "tag"],
  npm: ["install", "i", "run", "test", "exec", "init", "publish", "ci", "uninstall", "update"],
  pnpm: ["install", "add", "run", "test", "exec", "dlx", "remove", "update"],
  yarn: ["install", "add", "run", "test", "dlx", "remove", "upgrade"],
  bun: ["install", "add", "run", "test", "build", "x", "remove", "update", "init", "create"],
  docker: ["build", "run", "exec", "pull", "push", "compose", "ps", "images", "logs", "stop"],
  cargo: ["build", "run", "test", "add", "install", "new", "check", "publish"],
  kubectl: ["apply", "get", "describe", "logs", "delete", "exec", "port-forward"],
};

const REDIRECT = /^(?:\d*[<>]&(?:\d+|-)(?![^\s|&;()<>])|\d*(?:>>|>&|>\||<<<|<<-|<<|<&|<>|>|<)|&>>|&>)/;
const OPERATOR = /^(?:\|\||\|&|&&|;;|\||;|&|\(|\))/;

function token(text: string, kind: ShellTokenKind | undefined, href?: string): CodeToken {
  const out: CodeToken = { text };
  if (kind) out.style = { className: `sh-${kind}` };
  if (href) out.href = href;
  return out;
}

function classifyArgument(word: string): ShellTokenKind {
  if (/^-{1,2}[A-Za-z0-9]/.test(word)) return "flag";
  if (/[*?]|\[[^\]]*\]/.test(word)) return "glob";
  if (/^(?:\.{1,2}\/|\/|~)/.test(word) || word.includes("/") || /\.[A-Za-z][A-Za-z0-9]{0,6}$/.test(word)) return "path";
  return "arg";
}

/** Tokenize one command line (without its prompt). */
export function tokenizeShell(line: string, options: ShellTokenizeOptions = {}): CodeToken[] {
  const subcommands = options.subcommands ?? DEFAULT_SUBCOMMANDS;
  const tokens: CodeToken[] = [];
  let expectCommand = !options.continuation;
  let afterPrecommand = false;
  let command: string | undefined;
  let positional = 0;
  let redirectTarget = false;
  /** Paren depth of each open `$(`, so its `)` closes the substitution. */
  const substitutions: number[] = [];
  let depth = 0;
  let inBacktick = false;
  let i = 0;

  const push = (text: string, kind?: ShellTokenKind, href?: string) => {
    if (!text) return;
    const last = tokens[tokens.length - 1];
    // Merge adjacent plain whitespace to keep the DOM small.
    if (!kind && !href && last && !last.style && !last.href) last.text += text;
    else tokens.push(token(text, kind, href));
  };

  const startSegment = () => {
    expectCommand = true;
    afterPrecommand = false;
    command = undefined;
    positional = 0;
  };

  /** Variable reference starting at `start` (`$NAME`, `${…}`, `$1`, `$?`), or its length 0. */
  const variableLength = (start: number): number => {
    const rest = line.slice(start);
    const match = /^\$(?:\{[^}]*\}?|[A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!-])/.exec(rest);
    return match ? match[0].length : 0;
  };

  while (i < line.length) {
    const ch = line[i];
    const rest = line.slice(i);

    if (/\s/.test(ch)) {
      const ws = /^\s+/.exec(rest)![0];
      // A trailing backslash continues the command on the next line.
      push(ws);
      i += ws.length;
      continue;
    }
    if (ch === "\\" && /^\\\s*$/.test(rest)) {
      push(rest, "continuation");
      break;
    }
    if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]))) {
      push(rest, "comment");
      break;
    }
    if (rest.startsWith("$(") && !rest.startsWith("$((")) {
      push("$(", "substitution");
      substitutions.push(depth++);
      startSegment();
      i += 2;
      continue;
    }
    if (ch === ")" && substitutions.length && substitutions[substitutions.length - 1] === depth - 1) {
      substitutions.pop();
      depth--;
      push(")", "substitution");
      expectCommand = false;
      i += 1;
      continue;
    }
    if (ch === "`") {
      push("`", "substitution");
      inBacktick = !inBacktick;
      if (inBacktick) startSegment();
      else expectCommand = false;
      i += 1;
      continue;
    }
    const redirect = REDIRECT.exec(rest);
    if (redirect) {
      push(redirect[0], "redirect");
      // `2>&1` / `<&-` duplicate or close a descriptor: no file follows.
      redirectTarget = !/&(?:\d+|-)$/.test(redirect[0]);
      i += redirect[0].length;
      continue;
    }
    const operator = OPERATOR.exec(rest);
    if (operator) {
      push(operator[0], "operator");
      redirectTarget = false;
      if (operator[0] === "(") depth++;
      if (operator[0] === ")") depth = Math.max(0, depth - 1);
      if (operator[0] !== ")") startSegment();
      i += operator[0].length;
      continue;
    }

    // A word: runs of literal text, quotes and variables, up to whitespace or an operator.
    const wordStart = i;
    const parts: { text: string; kind?: ShellTokenKind }[] = [];
    let literal = "";
    const flushLiteral = () => {
      if (literal) parts.push({ text: literal });
      literal = "";
    };
    while (i < line.length) {
      const c = line[i];
      if (/\s/.test(c) || /[|&;()<>`]/.test(c)) break;
      if (c === "\\") {
        // A trailing backslash is a continuation (handled by the outer loop).
        if (/^\\\s*$/.test(line.slice(i))) break;
        literal += line.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === "'") {
        flushLiteral();
        const end = line.indexOf("'", i + 1);
        const stop = end === -1 ? line.length : end + 1;
        parts.push({ text: line.slice(i, stop), kind: "string" });
        i = stop;
        continue;
      }
      if (c === '"') {
        flushLiteral();
        let j = i + 1;
        let text = '"';
        while (j < line.length && line[j] !== '"') {
          const length = line[j] === "$" ? variableLength(j) : 0;
          if (length) {
            parts.push({ text, kind: "string" });
            parts.push({ text: line.slice(j, j + length), kind: "variable" });
            text = "";
            j += length;
            continue;
          }
          if (line[j] === "\\" && j + 1 < line.length) {
            text += line.slice(j, j + 2);
            j += 2;
            continue;
          }
          text += line[j++];
        }
        if (j < line.length) text += '"';
        parts.push({ text, kind: "string" });
        i = j + 1;
        continue;
      }
      if (c === "$") {
        if (line.startsWith("$(", i) && !line.startsWith("$((", i)) break;
        const length = variableLength(i);
        if (length) {
          flushLiteral();
          parts.push({ text: line.slice(i, i + length), kind: "variable" });
          i += length;
          continue;
        }
      }
      literal += c;
      i += 1;
    }
    flushLiteral();
    const word = line.slice(wordStart, i);
    if (!word) {
      // Unconsumed metacharacter: emit as-is so text is never lost.
      push(line[i]);
      i += 1;
      continue;
    }
    const plain = parts.length === 1 && parts[0].kind === undefined;

    if (redirectTarget) {
      redirectTarget = false;
      for (const part of parts) push(part.text, part.kind ?? "path");
      continue;
    }

    if (expectCommand && plain) {
      const assignment = /^([A-Za-z_][A-Za-z0-9_]*)(=)(.*)$/.exec(word);
      if (assignment) {
        push(assignment[1], "assignment");
        push("=", "operator");
        if (assignment[3]) push(assignment[3], classifyArgument(assignment[3]) === "path" ? "path" : undefined);
        continue;
      }
      if (afterPrecommand && word.startsWith("-")) {
        push(word, "flag");
        continue;
      }
      if (COMMAND_KEYWORDS.has(word)) {
        push(word, "keyword");
        startSegment();
        continue;
      }
      if (OTHER_KEYWORDS.has(word)) {
        push(word, "keyword");
        expectCommand = false;
        continue;
      }
      if (PRECOMMANDS.has(word)) {
        push(word, "precommand");
        afterPrecommand = true;
        continue;
      }
      expectCommand = false;
      afterPrecommand = false;
      command = word.split("/").pop();
      positional = 0;
      if (BUILTINS.has(word)) push(word, "builtin");
      else push(word, "command", options.commandHref?.(word));
      continue;
    }
    if (expectCommand) {
      // A quoted or variable command word ("$EDITOR" file): still the command.
      expectCommand = false;
      for (const part of parts) push(part.text, part.kind ?? "command");
      continue;
    }

    if (plain) {
      const kind = classifyArgument(word);
      if (kind === "flag") {
        const eq = word.indexOf("=");
        if (eq > 0) {
          push(word.slice(0, eq), "flag");
          push("=", "operator");
          const value = word.slice(eq + 1);
          if (value) push(value, classifyArgument(value) === "path" ? "path" : undefined);
        } else push(word, "flag");
        continue;
      }
      if (positional === 0 && command && subcommands[command]?.includes(word)) {
        push(word, "subcommand");
        positional++;
        continue;
      }
      positional++;
      push(word, kind === "arg" ? undefined : kind);
      continue;
    }
    positional++;
    for (const part of parts) push(part.text, part.kind);
  }
  return tokens;
}
