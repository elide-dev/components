/**
 * An Astro site's search index (assets/search-index.json, paths already in the Astro form), fetched once per site and
 * shared by the search island and the hover cards. Keyed by URL: the client router can move between sites (versions)
 * without a page load.
 */
import type { Entry } from "../client/search";

const indexes = new Map<string, Promise<Entry[]>>();

export function loadIndex(root: string): Promise<Entry[]> {
  const url = `${root}assets/search-index.json`;
  let index = indexes.get(url);
  if (!index) {
    index = fetch(url).then(r => (r.ok ? (r.json() as Promise<Entry[]>) : [])).catch(() => []);
    indexes.set(url, index);
  }
  return index;
}
