/**
 * A small render-time highlighter for the languages API documentation shows:
 * Java, Kotlin, JSON, XML/HTML and shell. It classifies comments, strings,
 * numbers, keywords, annotations, type names and calls. It is a lexer, not a
 * grammar: fast and dependency-free, so pages stay static and the renderer
 * stays small. Unknown languages come back as one plain run.
 */

export type HighlightClass = "c" | "s" | "n" | "k" | "a" | "t" | "f" | "p";

export interface Run {
  cls?: HighlightClass;
  text: string;
}

const JAVA = new Set(
  ("abstract assert boolean break byte case catch char class const continue default do double else enum exports " +
    "extends final finally float for goto if implements import instanceof int interface long module native new " +
    "non-sealed open opens package permits private protected provides public record requires return sealed short " +
    "static strictfp super switch synchronized this throw throws to transient transitive try uses var void volatile " +
    "when while with yield true false null").split(" "),
);
const KOTLIN = new Set(
  ("abstract actual annotation as break by catch class companion const constructor continue crossinline data do " +
    "dynamic else enum expect external false final finally for fun get if import in infix init inline inner interface " +
    "internal is lateinit noinline null object open operator out override package private protected public reified " +
    "return sealed set super suspend tailrec this throw true try typealias typeof val value var vararg when where while").split(" "),
);
const SHELL = new Set("if then else elif fi for in do done while case esac function export local return".split(" "));

const LANGUAGES: Record<string, string> = {
  java: "java", kotlin: "kotlin", kt: "kotlin", kts: "kotlin", groovy: "java", scala: "java",
  json: "json", xml: "xml", html: "xml", sh: "shell", bash: "shell", shell: "shell", console: "shell",
};

export function highlight(code: string, language: string | undefined): Run[] {
  const lang = LANGUAGES[(language ?? "").toLowerCase()];
  switch (lang) {
    case "java": return lexC(code, JAVA, false);
    case "kotlin": return lexC(code, KOTLIN, true);
    case "json": return lexJson(code);
    case "xml": return lexXml(code);
    case "shell": return lexShell(code);
    default: return [{ text: code }];
  }
}

function push(runs: Run[], text: string, cls?: HighlightClass) {
  if (!text) return;
  const last = runs[runs.length - 1];
  if (last && last.cls === cls) last.text += text;
  else runs.push(cls ? { cls, text } : { text });
}

const IDENT = /[A-Za-z_$][\w$]*/y;
const NUMBER = /(?:0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)[lLfFdDuU]*/y;

function lexC(code: string, keywords: Set<string>, kotlin: boolean): Run[] {
  const runs: Run[] = [];
  let i = 0;
  while (i < code.length) {
    const c = code[i]!;
    const next = code[i + 1];
    if (c === "/" && next === "/") {
      const end = code.indexOf("\n", i);
      const stop = end < 0 ? code.length : end;
      push(runs, code.slice(i, stop), "c");
      i = stop;
    } else if (c === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      const stop = end < 0 ? code.length : end + 2;
      push(runs, code.slice(i, stop), "c");
      i = stop;
    } else if (c === '"' && code.startsWith('"""', i)) {
      const end = code.indexOf('"""', i + 3);
      const stop = end < 0 ? code.length : end + 3;
      push(runs, code.slice(i, stop), "s");
      i = stop;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < code.length && code[j] !== c && code[j] !== "\n") j += code[j] === "\\" ? 2 : 1;
      push(runs, code.slice(i, Math.min(j + 1, code.length)), "s");
      i = j + 1;
    } else if (c === "@" && /[A-Za-z]/.test(next ?? "")) {
      IDENT.lastIndex = i + 1;
      const m = IDENT.exec(code)!;
      push(runs, "@" + m[0], "a");
      i = IDENT.lastIndex;
    } else if (/\d/.test(c)) {
      NUMBER.lastIndex = i;
      const m = NUMBER.exec(code);
      const text = m ? m[0] : c;
      push(runs, text, "n");
      i += text.length;
    } else if (/[A-Za-z_$]/.test(c)) {
      IDENT.lastIndex = i;
      const word = IDENT.exec(code)![0];
      i = IDENT.lastIndex;
      if (keywords.has(word) || (!kotlin && word === "non") ) push(runs, word, "k");
      else if (/^[A-Z]/.test(word) && /[a-z]/.test(word)) push(runs, word, "t");
      else if (code[i] === "(") push(runs, word, "f");
      else push(runs, word);
    } else {
      push(runs, c);
      i++;
    }
  }
  return runs;
}

function lexJson(code: string): Run[] {
  const runs: Run[] = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([\s\S])/g;
  for (const m of code.matchAll(re)) {
    if (m[1]) {
      push(runs, m[1], m[2] ? "p" : "s");
      push(runs, m[2] ?? "");
    } else if (m[3]) push(runs, m[3], "n");
    else if (m[4]) push(runs, m[4], "k");
    else push(runs, m[5]!);
  }
  return runs;
}

function lexXml(code: string): Run[] {
  const runs: Run[] = [];
  const re = /(<!--[\s\S]*?-->)|(<\/?[\w:.-]+)|("[^"]*"|'[^']*')|(\/?>)|([\w:.-]+)(?==)|([\s\S])/g;
  let inTag = false;
  for (const m of code.matchAll(re)) {
    if (m[1]) push(runs, m[1], "c");
    else if (m[2]) {
      push(runs, m[2], "k");
      inTag = true;
    } else if (m[3] && inTag) push(runs, m[3], "s");
    else if (m[4] && inTag) {
      push(runs, m[4], "k");
      inTag = false;
    } else if (m[5] && inTag) push(runs, m[5], "p");
    else push(runs, m[0]);
  }
  return runs;
}

function lexShell(code: string): Run[] {
  const runs: Run[] = [];
  const re = /(#[^\n]*)|("(?:[^"\\]|\\.)*"|'[^']*')|(\$\{?[\w@*#?]+\}?)|(--?[\w-]+)|([A-Za-z_][\w-]*)|([\s\S])/g;
  let commandStart = true;
  for (const m of code.matchAll(re)) {
    if (m[1] && (runs.length === 0 || /\s$/.test(runs[runs.length - 1]!.text))) push(runs, m[1], "c");
    else if (m[2]) push(runs, m[2], "s");
    else if (m[3]) push(runs, m[3], "p");
    else if (m[4]) push(runs, m[4], "a");
    else if (m[5]) {
      push(runs, m[5], SHELL.has(m[5]) ? "k" : commandStart ? "f" : undefined);
      commandStart = false;
      continue;
    } else push(runs, m[0]);
    if (m[0] === "\n" || m[0] === "|" || m[0] === ";" || m[0] === "&") commandStart = true;
  }
  return runs;
}
