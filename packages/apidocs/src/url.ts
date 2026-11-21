/**
 * URLs from the model or the theme are untrusted: documentation comments of
 * third-party code end up in pages served from the publisher's origin. Every
 * such URL passes safeUrl() before it becomes an attribute. Only http:, https:,
 * mailto: and relative URLs survive; anything else renders as plain text.
 */

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", colon: ":", tab: "\t", newline: "\n",
  sol: "/", lpar: "(", rpar: ")", period: ".", comma: ",", semi: ";", equals: "=", num: "#", excl: "!",
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
 * character references, drops control characters and whitespace that browsers
 * ignore inside a scheme, then allows only http, https, mailto or no scheme.
 */
export function safeUrl(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  const decoded = decodeEntities(url);
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
