/**
 * Signature layout. A signature that fits on a line stays on one line. A
 * longer one puts each parameter on its own indented line, and a long type
 * declaration starts its extends, implements and permits clauses on new lines,
 * so signatures read the same way on every page.
 *
 * A signature the source formatter laid out arrives with its line breaks and is
 * shown as it came. The formatters the JVM tools run (google-java-format, ktfmt)
 * stop at 100 columns and leave a shorter signature on one line, so this uses
 * the same width: a one-line signature of 81 to 100 columns is one the formatter
 * chose to keep, and is not broken again here. The signature box sizes its text
 * so 100 columns fit (apidocs.css, "the declaration specimen").
 */
import type { Token } from "./model";

export const WIDTH = 100;
const INDENT = "    ";

export function layoutSignature(tokens: Token[]): Token[] {
  // A signature that already has line breaks was laid out by the source formatter: it is shown as it came.
  if (tokens.some(t => t.text.includes("\n"))) return tokens;
  const length = tokens.reduce((n, t) => n + t.text.length, 0);
  if (length <= WIDTH) return tokens;
  const name = tokens.findIndex(t => t.kind === "name");
  if (name < 0) return tokens;
  const out = tokens.slice(0, name + 1);
  let parens = 0;
  let angles = 0;
  let params = false;
  for (let i = name + 1; i < tokens.length; i++) {
    const token = tokens[i]!;
    const next = tokens[i + 1];
    if (token.kind === "punct") {
      let text = "";
      for (let c = 0; c < token.text.length; c++) {
        const ch = token.text[c]!;
        if (ch === "<") angles++;
        else if (ch === ">") angles--;
        if (ch === "(" ) {
          parens++;
          if (parens === 1 && !params && angles === 0) {
            params = true;
            const empty = token.text[c + 1] === ")";
            text += empty ? "(" : "(\n" + INDENT;
            continue;
          }
        } else if (ch === ")") {
          parens--;
          if (parens === 0 && params && angles === 0 && token.text[c - 1] !== "(") {
            text += "\n)";
            continue;
          }
        } else if (ch === "," && parens === 1 && angles === 0 && params) {
          text += ",\n" + INDENT;
          if (token.text[c + 1] === " ") c++;
          continue;
        } else if (ch === " " && parens === 0 && angles === 0 && next?.kind === "keyword"
          && (next.text === "extends" || next.text === "implements" || next.text === "permits")
          && c === token.text.length - 1) {
          text += "\n" + INDENT;
          continue;
        }
        text += ch;
      }
      out.push({ ...token, text });
    } else {
      out.push(token);
    }
  }
  return out;
}
