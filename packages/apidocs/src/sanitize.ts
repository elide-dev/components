/**
 * Raw nodes carry markup from documentation comments that has no node of its
 * own (<sup>, <span>, ...). The stock doclet emits such markup verbatim; these
 * pages keep it but drop anything executable: script, style and iframe-like
 * elements, event-handler attributes and javascript: URLs.
 */
const BLOCKED = "script|style|iframe|object|embed|link|meta|base|form";
const PAIRED = new RegExp(`<\\s*(${BLOCKED})\\b[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, "gi");
const SINGLE = new RegExp(`<\\s*\\/?\\s*(?:${BLOCKED})\\b[^>]*>`, "gi");
const HANDLERS = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const SCRIPT_URLS = /\s(href|src|action|formaction|xlink:href)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]*)/gi;

export function sanitize(html: string): string {
  return html.replace(PAIRED, "").replace(SINGLE, "").replace(HANDLERS, "").replace(SCRIPT_URLS, "");
}
