/**
 * A static server for the audits, configured as a good static host would be,
 * so that Lighthouse scores the pages rather than a bare development server:
 *
 * - brotli or gzip for text responses, chosen from Accept-Encoding;
 * - Cache-Control: a year for assets/, revalidate for everything else; strong ETags and 304s;
 * - a real 404 status, with the site's 404.html (or 404.md for Accept: text/markdown) when it has one;
 * - correct Content-Type for .md, .txt, .xml, .json, .woff2 and the rest.
 *
 * The "agent" profile adds what a host can do for agents on top of static
 * files: Accept: text/markdown negotiation onto each page's .md twin with
 * Vary: Accept, and RFC 8288 Link headers for the Markdown alternate,
 * llms.txt and sitemap.xml. It needs nothing the renderer does not already
 * write. It does not serve HTTP/2 (Bun.serve speaks HTTP/1.1 without TLS).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

export type HostProfile = "static" | "agent";

export const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/** element-list and other extensionless files are plain text. */
const typeOf = (file: string) => CONTENT_TYPES[extname(file)] ?? "text/plain; charset=utf-8";
const compressible = (type: string) => /^(text\/|application\/(json|xml|javascript)|image\/svg)/.test(type);

export interface AuditServer {
  url: string;
  port: number;
  stop(): void;
}

interface Body {
  bytes: Uint8Array;
  etag: string;
  br?: Uint8Array;
  gzip?: Uint8Array;
}

/** Starts a server on a free port. The directory may be empty or missing at start: files are read per request. */
export function serve(dir: string, profile: HostProfile = "static"): AuditServer {
  const root = resolve(dir);
  const cache = new Map<string, { mtime: number; body: Body }>();
  const load = (file: string): Body => {
    const mtime = statSync(file).mtimeMs;
    const hit = cache.get(file);
    if (hit && hit.mtime === mtime) return hit.body;
    const bytes = new Uint8Array(readFileSync(file));
    const body: Body = { bytes, etag: `"${createHash("sha1").update(bytes).digest("base64url")}"` };
    cache.set(file, { mtime, body });
    return body;
  };
  const encode = (body: Body, encoding: "br" | "gzip") => {
    if (encoding === "br") return (body.br ??= new Uint8Array(brotliCompressSync(body.bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } })));
    return (body.gzip ??= new Uint8Array(gzipSync(body.bytes, { level: 9 })));
  };
  const find = (pathname: string): string | undefined => {
    let path: string;
    try {
      path = decodeURIComponent(pathname);
    } catch {
      return undefined;
    }
    const file = resolve(root, "." + path);
    if (file !== root && !file.startsWith(root + "/")) return undefined;
    if (existsSync(file) && statSync(file).isDirectory()) return existsSync(join(file, "index.html")) ? join(file, "index.html") : undefined;
    return existsSync(file) ? file : undefined;
  };

  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(request) {
      const url = new URL(request.url);
      const accept = request.headers.get("accept") ?? "";
      const wantsMarkdown = profile === "agent" && prefersMarkdown(accept);
      const headers = new Headers();
      let status = 200;
      let file = find(url.pathname);
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
      if (!file) {
        status = 404;
        const notFound = wantsMarkdown && existsSync(join(root, "404.md")) ? join(root, "404.md") : existsSync(join(root, "404.html")) ? join(root, "404.html") : undefined;
        if (!notFound) return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
        file = notFound;
      }
      if (profile === "agent" && file.endsWith(".html") && status === 200) {
        const twin = file.replace(/\.html$/, ".md");
        const twinUrl = url.pathname.endsWith("/") ? "index.md" : url.pathname.split("/").pop()!.replace(/\.html$/, ".md");
        headers.set("vary", "Accept, Accept-Encoding");
        if (existsSync(twin)) {
          const links = [`<${twinUrl}>; rel="alternate"; type="text/markdown"`, `</llms.txt>; rel="describedby"; type="text/plain"`];
          if (existsSync(join(root, "sitemap.xml"))) links.push(`</sitemap.xml>; rel="sitemap"; type="application/xml"`);
          headers.set("link", links.join(", "));
          if (wantsMarkdown) file = twin;
        }
      }
      const type = typeOf(file);
      const body = load(file);
      headers.set("content-type", type);
      headers.set("etag", body.etag);
      headers.set("x-content-type-options", "nosniff");
      if (!headers.has("vary")) headers.set("vary", "Accept-Encoding");
      const relativePath = file.slice(root.length + 1);
      headers.set("cache-control", status !== 200 ? "no-store" : relativePath.startsWith("assets/") ? "public, max-age=31536000" : "public, max-age=0, must-revalidate");
      if (status === 200 && request.headers.get("if-none-match") === body.etag) return new Response(null, { status: 304, headers });
      let bytes = body.bytes;
      if (compressible(type) && bytes.length > 512) {
        const accepted = request.headers.get("accept-encoding") ?? "";
        const encoding = /\bbr\b/.test(accepted) ? "br" : /\bgzip\b/.test(accepted) ? "gzip" : undefined;
        if (encoding) {
          bytes = encode(body, encoding);
          headers.set("content-encoding", encoding);
        }
      }
      return new Response(request.method === "HEAD" ? null : (bytes as unknown as BodyInit), { status, headers });
    },
  });
  return { url: `http://127.0.0.1:${server.port}/`, port: server.port!, stop: () => server.stop(true) };
}

/** Whether an Accept header ranks text/markdown at or above text/html. */
export function prefersMarkdown(accept: string): boolean {
  const q = (type: string) => {
    for (const part of accept.split(",")) {
      const [media, ...params] = part.trim().split(";").map(s => s.trim());
      if (media?.toLowerCase() !== type) continue;
      const qp = params.find(p => p.startsWith("q="));
      return qp ? Number(qp.slice(2)) : 1;
    }
    return -1;
  };
  const md = q("text/markdown");
  return md > 0 && md >= q("text/html");
}
