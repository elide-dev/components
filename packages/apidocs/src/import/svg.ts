/**
 * SVG files from a suite are untrusted: opened directly, an SVG runs its scripts on the site's origin. A suite's SVG is
 * rebuilt on copy from an allowlist: drawing elements (shapes, paths, groups, text, gradients, patterns, markers,
 * clip paths and masks, defs, symbol, title, desc, and use) with presentation attributes. Everything else is dropped
 * with its content: script, style, foreignObject, image, animation, links. An href survives only as a same-document
 * #fragment, and a url() value only as url(#fragment); a value with a backslash (a CSS escape) or a control character is
 * dropped, and the style attribute and element always are. Comments, the XML prolog and processing instructions are
 * dropped; a DOCTYPE (which can declare entities), CDATA, an unknown entity or markup that does not parse rejects
 * the file. The output is the rebuilt markup, every value escaped.
 */

const ELEMENTS = new Set([
  "svg", "g", "defs", "symbol", "use", "title", "desc", "path", "rect", "circle", "ellipse", "line", "polyline",
  "polygon", "text", "tspan", "textPath", "linearGradient", "radialGradient", "stop", "clipPath", "mask", "pattern", "marker",
]);

/** Attributes that are names or prose, never read as CSS: only control characters refuse them. */
const TEXT_ATTRIBUTES = new Set([
  "id", "class", "version", "role", "aria-label", "aria-hidden", "aria-labelledby", "aria-describedby", "focusable",
  "xml:space", "lang", "xml:lang",
]);

/** Attributes whose values are geometry or presentation, which a browser may read as CSS: checked by safeValue. */
const ATTRIBUTES = new Set([
  "viewBox", "width", "height", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "fx", "fy",
  "d", "points", "transform", "pathLength", "preserveAspectRatio",
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray",
  "stroke-dashoffset", "stroke-opacity", "stroke-miterlimit", "opacity", "color", "visibility", "display", "overflow",
  "clip-path", "clip-rule", "mask", "marker-start", "marker-mid", "marker-end", "vector-effect", "paint-order",
  "shape-rendering", "text-rendering", "color-interpolation",
  "font-family", "font-size", "font-weight", "font-style", "font-variant", "text-anchor", "dominant-baseline",
  "alignment-baseline", "baseline-shift", "letter-spacing", "word-spacing", "text-decoration", "dx", "dy", "rotate",
  "textLength", "lengthAdjust", "startOffset",
  "offset", "stop-color", "stop-opacity", "gradientUnits", "gradientTransform", "spreadMethod",
  "patternUnits", "patternContentUnits", "patternTransform", "clipPathUnits", "maskUnits", "maskContentUnits",
  "markerWidth", "markerHeight", "markerUnits", "refX", "refY", "orient",
]);

/** Namespace declarations the output keeps: SVG's own and XLink's, nothing else. */
const NAMESPACES: Record<string, string> = { xmlns: "http://www.w3.org/2000/svg", "xmlns:xlink": "http://www.w3.org/1999/xlink" };

const PREDEFINED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export type SvgResult = { ok: true; svg: string } | { ok: false; reason: string };

/** The SVG rebuilt from the allowlist, or why it cannot be. */
export function sanitizeSvg(source: string): SvgResult {
  let i = 0;
  let out = "";
  const open: string[] = [];
  /** The element whose content is being dropped, with its nesting depth. */
  let dropping: { name: string; depth: number } | undefined;
  let root = false;
  const text = (raw: string): string | undefined => {
    const decoded = decode(raw);
    return decoded === undefined ? undefined : escape(decoded);
  };
  while (i < source.length) {
    const lt = source.indexOf("<", i);
    const chunk = source.slice(i, lt < 0 ? source.length : lt);
    if (chunk) {
      const t = text(chunk);
      if (t === undefined) return { ok: false, reason: "it uses an entity other than the five XML ones or a character reference" };
      if (!dropping && open.length) out += t;
      else if (!open.length && chunk.trim() && !dropping) return { ok: false, reason: "it has text outside the svg element" };
    }
    if (lt < 0) break;
    i = lt;
    if (source.startsWith("<!--", i)) {
      const end = source.indexOf("-->", i + 4);
      if (end < 0) return { ok: false, reason: "a comment is not closed" };
      i = end + 3;
      continue;
    }
    if (source.startsWith("<?", i)) {
      const end = source.indexOf("?>", i + 2);
      if (end < 0) return { ok: false, reason: "a processing instruction is not closed" };
      i = end + 2;
      continue;
    }
    if (source.startsWith("<!", i)) return { ok: false, reason: "it has a DOCTYPE or CDATA section, which can declare entities or hide markup" };
    const tag = /^<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[A-Za-z_][\w:.-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>/.exec(source.slice(i));
    if (!tag) return { ok: false, reason: "its markup does not parse as XML" };
    i += tag[0].length;
    const [, closing, name, attrText, selfClosing] = tag as unknown as [string, string, string, string, string];
    if (closing) {
      if (open[open.length - 1] !== name) return { ok: false, reason: `</${name}> does not close the open element` };
      open.pop();
      if (dropping) {
        if (open.length < dropping.depth) dropping = undefined;
        continue;
      }
      out += `</${name}>`;
      continue;
    }
    if (!open.length) {
      if (root) return { ok: false, reason: "it has more than one root element" };
      if (name !== "svg") return { ok: false, reason: `its root element is <${name}>, not <svg>` };
      root = true;
    }
    const keep = !dropping && ELEMENTS.has(name);
    if (!keep && !dropping && !selfClosing) dropping = { name, depth: open.length + 1 };
    if (keep) {
      const attrs = attributes(name, attrText, !open.length);
      if (attrs === undefined) return { ok: false, reason: "an attribute value uses an unknown entity" };
      out += `<${name}${attrs}${selfClosing ? "/>" : ">"}`;
    }
    if (!selfClosing) open.push(name);
  }
  if (!root) return { ok: false, reason: "it has no <svg> element" };
  if (open.length) return { ok: false, reason: `<${open[open.length - 1]}> is not closed` };
  return { ok: true, svg: out + "\n" };
}

function attributes(element: string, text: string, isRoot: boolean): string | undefined {
  let out = isRoot ? ` xmlns="${NAMESPACES.xmlns}"` : "";
  const seen = new Set<string>();
  for (const m of text.matchAll(/([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const name = m[1]!;
    // XML turns a literal tab, newline or carriage return in an attribute into a space before anything reads it (path
    // data is often written over several lines); the same characters written as references stay, and are refused.
    const value = decode((m[2] ?? m[3] ?? "").replace(/[\t\n\r]/g, " "));
    if (value === undefined) return undefined;
    if (seen.has(name)) continue;
    seen.add(name);
    let keep: string | undefined;
    if (name === "xmlns:xlink" && isRoot && value === NAMESPACES["xmlns:xlink"]) keep = value;
    else if (name === "href" || name === "xlink:href") keep = /^#[\w.:-]+$/.test(value.trim()) && (element === "use" || element === "textPath" || element.endsWith("Gradient") || element === "pattern") ? value.trim() : undefined;
    else if (TEXT_ATTRIBUTES.has(name)) keep = /[\u0000-\u001f\u007f]/.test(value) ? undefined : value;
    else if (ATTRIBUTES.has(name)) keep = safeValue(value);
    if (keep !== undefined) out += ` ${name}="${escape(keep).replace(/"/g, "&quot;")}"`;
  }
  return out;
}

/**
 * A presentation or geometry value, which a browser may read as CSS, unless it could reach outside the document. Nothing
 * is removed before the test, since CSS decodes escapes rather than ignoring them: a backslash or a control character
 * refuses the value; a value that mentions url must be exactly one same-document url(#id); and expression, @import,
 * javascript:, vbscript: and data: refuse it.
 */
function safeValue(value: string): string | undefined {
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return undefined;
  const lower = value.toLowerCase();
  if (lower.includes("url")) return /^\s*url\(\s*['"]?#[\w.:-]+['"]?\s*\)\s*$/i.test(value) ? value : undefined;
  if (/expression|@import|javascript:|vbscript:|data:/.test(lower)) return undefined;
  return value;
}

/** Text with the five XML entities and character references decoded; undefined for any other entity. */
function decode(text: string): string | undefined {
  let failed = false;
  const decoded = text.replace(/&(#x[0-9a-f]+|#\d+|[A-Za-z][\w.-]*);/gi, (_, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) return String.fromCodePoint(code);
      failed = true;
      return "";
    }
    const named = PREDEFINED[body];
    if (named === undefined) failed = true;
    return named ?? "";
  });
  // A bare & that starts no reference stays text: the output escapes it.
  return failed ? undefined : decoded;
}

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
