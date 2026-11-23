/** Search ranking, shared by the client bundle and its tests. */

/** A search index entry: [label, kind, path from the site root, context, summary]. */
export type Entry = [label: string, kind: string, path: string, context: string, summary: string];

// Guides lead: someone who types a topic wants the page that explains it. Sections rank with members.
const KIND_RANK: Record<string, number> = { guide: 0, section: 3, package: 0, method: 3, function: 3, field: 4, property: 4, constructor: 5, enumConstant: 4, annotationElement: 4 };

/** Ranks entries: exact name, prefix, word start, substring; types before members; shorter first. */
export function search(entries: Entry[], query: string, limit = 40): Entry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: [number, Entry][] = [];
  for (const entry of entries) {
    const label = entry[0];
    const name = label.split("(")[0]!.toLowerCase();
    const simple = name.slice(name.lastIndexOf(".") + 1);
    let score: number;
    if (simple === q || name === q) score = 0;
    else if (simple.startsWith(q)) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (wordStart(label, q)) score = 3;
    else if (name.includes(q)) score = 4;
    else if (`${entry[3]}.${label}`.toLowerCase().includes(q)) score = 5;
    else continue;
    scored.push([score * 10 + (KIND_RANK[entry[1]] ?? 1) + Math.min(label.length, 80) / 100, entry]);
  }
  scored.sort((a, b) => a[0] - b[0]);
  return scored.slice(0, limit).map(s => s[1]);
}

function wordStart(label: string, q: string): boolean {
  // Camel-case and dotted word starts: "rt" matches "ResolvedType".
  const starts = label.replace(/[^A-Za-z0-9]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(" ").map(w => w[0]?.toLowerCase()).join("");
  return starts.includes(q) || label.toLowerCase().split(/[.(\s]/).some(part => part.startsWith(q));
}

/** A text directive's term: percent-encoded, with the directive's own syntax ("-", ",", "&") encoded too. */
function term(text: string): string {
  return encodeURIComponent(text).replace(/-/g, "%2D").replace(/,/g, "%2C").replace(/&/g, "%26");
}

/**
 * A URL fragment that opens the page at `sentence`, highlighted (a text fragment): the whole sentence when it is short,
 * else its first and last four words, which the browser matches across what lies between. A cut sentence ("…") ends at
 * its last whole word. After an anchor it follows the anchor: "#member:~:text=...".
 */
export function textFragment(sentence: string, afterAnchor: boolean): string {
  const words = sentence.replace(/…$/, "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const directive = words.length <= 8 ? term(words.join(" ")) : `${term(words.slice(0, 4).join(" "))},${term(words.slice(-4).join(" "))}`;
  return `${afterAnchor ? "" : "#"}:~:text=${directive}`;
}
