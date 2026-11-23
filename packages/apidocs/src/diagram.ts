/**
 * Inline SVG for a diagram figure. The SVG shares the page's id namespace and stylesheet, so after sanitizeSvg every
 * id is prefixed with a namespace drawn from the SVG's content (with the references to it: #fragment hrefs, url(#…)
 * values and aria-labelledby/aria-describedby lists), and only the d-* color classes survive, so a diagram can neither
 * clash with an id of the page nor pick up the page's own styles. Pure: render.js uses it.
 */

const COLOR_CLASS = /^d-(?:fill|stroke|text)-[a-z-]+$/;

export function namespaceSvg(svg: string): string {
  let hash = 2166136261;
  for (let i = 0; i < svg.length; i++) hash = Math.imul(hash ^ svg.charCodeAt(i), 16777619) >>> 0;
  const ns = `dg${hash.toString(36)}-`;
  const ids = new Set([...svg.matchAll(/\sid="([^"]*)"/g)].map(m => m[1]!));
  const ref = (id: string) => (ids.has(id) ? ns + id : id);
  return svg
    .replace(/\sid="([^"]*)"/g, (_, id: string) => ` id="${ns}${id}"`)
    .replace(/\s((?:xlink:)?href)="#([^"]*)"/g, (_, attr: string, id: string) => ` ${attr}="#${ref(id)}"`)
    .replace(/url\(#([^)]*)\)/g, (_, id: string) => `url(#${ref(id)})`)
    .replace(/\s(aria-(?:labelledby|describedby))="([^"]*)"/g, (_, attr: string, list: string) => ` ${attr}="${list.split(/\s+/).filter(Boolean).map(ref).join(" ")}"`)
    .replace(/\sclass="([^"]*)"/g, (_, list: string) => {
      const kept = list.split(/\s+/).filter(c => COLOR_CLASS.test(c));
      return kept.length ? ` class="${kept.join(" ")}"` : "";
    });
}
