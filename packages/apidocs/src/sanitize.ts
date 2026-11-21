/**
 * Raw nodes carry documentation-comment markup that has no node of its own
 * (<sup>, <dl>, ...). Comments are untrusted input, so the markup is parsed
 * with a small tokenizer (there is no DOM in the render bundle) and rebuilt
 * from an allowlist: known tags with a few attributes each, every value
 * escaped, every URL through safeUrl. Anything else is dropped; the content of
 * script-like elements is dropped with them, other unknown tags keep their text.
 */
import { decodeEntities, safeUrl } from "./url";

const TAGS = new Set([
  "sup", "sub", "b", "i", "em", "strong", "code", "kbd", "var", "samp", "span", "br", "p", "ul", "ol", "li", "dl", "dt",
  "dd", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "pre", "blockquote", "a", "abbr", "small", "hr",
  "s", "u", "mark", "q", "cite", "dfn", "tt",
]);
const VOID = new Set(["br", "hr"]);
/** Elements whose content is not text to show: dropped with everything inside. */
const DROP_CONTENT = new Set([
  "script", "style", "iframe", "frame", "frameset", "object", "embed", "applet", "svg", "math", "template", "noscript",
  "noembed", "noframes", "textarea", "title", "xmp", "plaintext", "head", "select", "option", "canvas", "video", "audio",
]);
const SCOPES = new Set(["row", "col", "rowgroup", "colgroup"]);

type Token =
  | { kind: "text"; text: string }
  | { kind: "start"; name: string; attrs: [string, string][]; selfClosing: boolean }
  | { kind: "end"; name: string };

/** HTML tokens, tolerating malformed markup: an unterminated tag or attribute ends the input. */
export function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const text = (s: string) => s && tokens.push({ kind: "text", text: decodeEntities(s) });
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      text(html.slice(i));
      break;
    }
    text(html.slice(i, lt));
    i = lt;
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    if (html[i + 1] === "!" || html[i + 1] === "?") {
      const end = html.indexOf(">", i);
      i = end < 0 ? html.length : end + 1;
      continue;
    }
    const closing = html[i + 1] === "/";
    const nameMatch = /^[a-zA-Z][a-zA-Z0-9:-]*/.exec(html.slice(i + (closing ? 2 : 1)));
    if (!nameMatch) {
      text("<");
      i++;
      continue;
    }
    const name = nameMatch[0].toLowerCase();
    i += (closing ? 2 : 1) + nameMatch[0].length;
    const attrs: [string, string][] = [];
    let selfClosing = false;
    let terminated = false;
    while (i < html.length) {
      while (i < html.length && /[\s/]/.test(html[i]!)) {
        if (html[i] === "/" && html[i + 1] === ">") selfClosing = true;
        i++;
      }
      if (html[i] === ">") {
        i++;
        terminated = true;
        break;
      }
      const attr = /^[^\s/>=]+/.exec(html.slice(i));
      if (!attr) break;
      i += attr[0].length;
      while (i < html.length && /\s/.test(html[i]!)) i++;
      let value = "";
      if (html[i] === "=") {
        i++;
        while (i < html.length && /\s/.test(html[i]!)) i++;
        const quote = html[i];
        if (quote === '"' || quote === "'") {
          const end = html.indexOf(quote, i + 1);
          if (end < 0) {
            i = html.length;
            break;
          }
          value = html.slice(i + 1, end);
          i = end + 1;
        } else {
          const raw = /^[^\s>]*/.exec(html.slice(i))![0];
          value = raw;
          i += raw.length;
        }
      }
      attrs.push([attr[0].toLowerCase(), decodeEntities(value)]);
    }
    if (!terminated) break;
    tokens.push(closing ? { kind: "end", name } : { kind: "start", name, attrs, selfClosing });
  }
  return tokens;
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}

function attributes(name: string, attrs: [string, string][]): string {
  let out = "";
  const seen = new Set<string>();
  for (const [key, value] of attrs) {
    if (seen.has(key)) continue;
    seen.add(key);
    let keep: string | undefined;
    if (key === "title") keep = value;
    else if (key === "href" && name === "a") keep = safeUrl(value);
    else if ((key === "colspan" || key === "rowspan") && (name === "td" || name === "th") && /^\d{1,3}$/.test(value)) keep = value;
    else if (key === "scope" && name === "th" && SCOPES.has(value.toLowerCase())) keep = value.toLowerCase();
    if (keep !== undefined) out += ` ${key}="${escapeAttr(keep)}"`;
  }
  return out;
}

/** The markup rebuilt from the allowlist. */
export function sanitize(html: string): string {
  let out = "";
  const open: string[] = [];
  let dropping: string | undefined;
  for (const token of tokenize(html)) {
    if (dropping) {
      if (token.kind === "end" && token.name === dropping) dropping = undefined;
      continue;
    }
    if (token.kind === "text") {
      out += escapeText(token.text);
    } else if (token.kind === "start") {
      if (DROP_CONTENT.has(token.name)) {
        if (!token.selfClosing) dropping = token.name;
        continue;
      }
      if (!TAGS.has(token.name)) continue;
      out += `<${token.name}${attributes(token.name, token.attrs)}>`;
      if (!VOID.has(token.name)) open.push(token.name);
    } else {
      const at = open.lastIndexOf(token.name);
      if (at < 0) continue;
      while (open.length > at) out += `</${open.pop()}>`;
    }
  }
  while (open.length) out += `</${open.pop()}>`;
  return out;
}
