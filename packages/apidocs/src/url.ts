/**
 * URLs from the model or the theme are untrusted: documentation comments of
 * third-party code end up in pages served from the publisher's origin. Every
 * such URL passes safeUrl() before it becomes an attribute. Only http:, https:,
 * mailto: and relative URLs survive; anything else renders as plain text.
 */

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", colon: ":", tab: "\t", newline: "\n",
  sol: "/", lpar: "(", rpar: ")", period: ".", comma: ",", semi: ";", equals: "=", num: "#", excl: "!",
  bsol: "\\", grave: "`", percnt: "%", quest: "?", commat: "@", lowbar: "_", hyphen: "-", dash: "-", plus: "+",
};

/** Decodes HTML character references: numeric (with or without the semicolon) and the common named ones. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "�";
    }
    return NAMED[body.toLowerCase()] ?? match;
  });
}

const ALLOWED_SCHEMES = new Set(["http", "https", "mailto"]);

/**
 * The URL when it is safe to put in href or src, else undefined. Decodes
 * character references until nothing changes (and rejects a URL that still
 * holds one after five rounds), drops control characters and whitespace that
 * browsers ignore inside a scheme, then allows only http, https, mailto or no
 * scheme. The result is the decoded URL: callers escape it for their format.
 */
export function safeUrl(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  // Decode to a fixed point, so a doubly encoded scheme (jav&amp;#x61;script:) cannot pass the check and be decoded
  // again by a later consumer, such as a Markdown renderer.
  let decoded = url;
  for (let round = 0; round < 5; round++) {
    const next = decodeEntities(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  if (/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/i.test(decoded)) return undefined;
  // Browsers strip leading C0 controls and spaces, and tabs and newlines anywhere, before parsing a URL.
  // eslint-disable-next-line no-control-regex
  const cleaned = decoded.replace(/^[\u0000- ]+/, "").replace(/[\t\n\r]/g, "");
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(cleaned)) return undefined;
  const scheme = /^([^:/?#]*):/.exec(cleaned);
  if (scheme && !ALLOWED_SCHEMES.has(scheme[1]!.toLowerCase())) return undefined;
  if (cleaned.startsWith("\\")) return undefined;
  return cleaned;
}

/**
 * A link destination for Markdown that no Markdown renderer can reinterpret:
 * the characters that end, escape or decode a destination (&, <, >, \, `,
 * quotes, parentheses, spaces and controls) are percent-encoded. Existing
 * percent escapes stay as they are, so anchors such as %3Cinit%3E keep working.
 */
export function markdownDestination(url: string): string {
  return url.replace(/[&<>\\`"'() \u0000-\u001f\u007f]|[^\u0000-\u007f]/g, c => encodeURIComponent(c).replace(/[!'()*]/g, x => `%${x.charCodeAt(0).toString(16).toUpperCase()}`));
}
