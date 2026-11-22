/**
 * What a server adds around a page for programs and AI agents: the page's Markdown twin for a request that asks
 * for Markdown, Link headers that point at the other forms, and a 404 that says where to start.
 */

/** Whether an Accept header prefers Markdown to HTML: text/markdown with a higher q, or no HTML at all. */
export function prefersMarkdown(accept: string | null | undefined): boolean {
  const q = (type: string) => {
    for (const part of (accept ?? "").split(",")) {
      const [name, ...params] = part.trim().split(";");
      if (name?.trim().toLowerCase() !== type) continue;
      const value = params.map(p => p.trim()).find(p => p.startsWith("q="));
      return value ? Number(value.slice(2)) || 0 : 1;
    }
    return -1;
  };
  const markdown = q("text/markdown");
  return markdown > 0 && markdown > q("text/html");
}

/**
 * The Link header for a page: its Markdown twin, llms.txt and the model. `base` is the site's base path. No
 * canonical link: the page declares its own, and a second one that differs in form reads as a conflict.
 */
export function linkHeader(base: string, page: string): string {
  return [
    `<${base}${page}.md>; rel="alternate"; type="text/markdown"`,
    `<${base}llms.txt>; rel="alternate"; type="text/markdown"; title="llms.txt"`,
    `<${base}api.json>; rel="alternate"; type="application/json"; title="api.json"`,
  ].join(", ");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A 404 response that points at the site's overview and llms.txt, as Markdown or HTML by the Accept header. */
export function notFound(base: string, title: string, accept: string | null | undefined): Response {
  const headers = { vary: "Accept", "cache-control": "public, max-age=60" };
  if (prefersMarkdown(accept)) {
    // The wording of the static renderer's 404.md (notFoundMarkdown), which a route with the model sends instead.
    const body = `# Not found\n\nThere is no such page in ${title}. Start at the [overview](${base}index.md), or read [llms.txt](${base}llms.txt), which lists every page as Markdown.\n`;
    return new Response(body, { status: 404, headers: { ...headers, "content-type": "text/markdown; charset=utf-8" } });
  }
  const name = escapeHtml(title);
  const body = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Not found (${name})</title><meta name="robots" content="noindex"><link rel="alternate" type="text/markdown" href="${base}llms.txt"></head><body><main><h1>Not found</h1><p>There is no such page in ${name}. Start at the <a href="${base}">overview</a>, or read <a href="${base}llms.txt">llms.txt</a>, which lists every page as Markdown.</p></main></body></html>\n`;
  return new Response(body, { status: 404, headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
}
