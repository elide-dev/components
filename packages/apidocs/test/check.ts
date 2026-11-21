/**
 * Checks a rendered site against the portability rules: every link is
 * relative and names its file, and its target file and anchor exist; no
 * absolute URL except the model's externals and the theme's own links; no
 * module scripts and no fetch. Returns every problem found.
 */
import type { Output } from "../src/render";

export interface CheckOptions {
  /** URL prefixes allowed as absolute links: the model's externals, theme links, the base URL. */
  allowed: string[];
}

const ATTRS = /\s(href|src)="([^"]*)"/g;

export function checkSite(out: Output, options: CheckOptions): string[] {
  const errors: string[] = [];
  const ids = new Map<string, Set<string>>();
  const idsOf = (file: string) => {
    let set = ids.get(file);
    if (!set) {
      set = new Set();
      const html = out[file];
      if (typeof html === "string") for (const m of html.matchAll(/\sid="([^"]*)"/g)) set.add(unescape(m[1]!));
      ids.set(file, set);
    }
    return set;
  };
  for (const [file, content] of Object.entries(out)) {
    if (typeof content !== "string") continue;
    if (file.endsWith(".html") || file.endsWith(".js")) {
      if (/type="module"/.test(content)) errors.push(`${file}: module script`);
      if (/\bfetch\s*\(/.test(content)) errors.push(`${file}: uses fetch`);
      if (/\bimport\s*\(/.test(content)) errors.push(`${file}: dynamic import`);
    }
    if (!file.endsWith(".html")) continue;
    for (const m of content.matchAll(ATTRS)) {
      const url = unescape(m[2]!);
      if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//")) {
        if (!options.allowed.some(prefix => url.startsWith(prefix))) errors.push(`${file}: absolute URL ${url}`);
        continue;
      }
      if (url === "" || url.startsWith("#")) {
        errors.push(`${file}: link does not name its file: "${url}"`);
        continue;
      }
      const [path, anchor] = splitAnchor(url);
      if (path.endsWith("/")) {
        errors.push(`${file}: link names a directory: ${url}`);
        continue;
      }
      const target = join(file, decodeURIComponent(path));
      if (!(target in out)) {
        errors.push(`${file}: link to a missing file ${url}`);
        continue;
      }
      if (anchor !== undefined && target.endsWith(".html") && !idsOf(target).has(decodeURIComponent(anchor))) {
        errors.push(`${file}: link to a missing anchor ${url}`);
      }
    }
  }
  return errors;
}

function splitAnchor(url: string): [string, string | undefined] {
  const at = url.indexOf("#");
  return at < 0 ? [url, undefined] : [url.slice(0, at), url.slice(at + 1)];
}

function unescape(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

/** Resolves a relative URL against the file that contains it. */
function join(from: string, relative: string): string {
  const parts = from.split("/").slice(0, -1);
  for (const segment of relative.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment !== "." && segment !== "") parts.push(segment);
  }
  return parts.join("/");
}
