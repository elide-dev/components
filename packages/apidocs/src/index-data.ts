/**
 * What the index pages list (src/indexes.tsx, and their Markdown twins): every package, every type, every
 * declaration from A to Z, and everything deprecated. Pure data, in a fixed order: names compare by code point, after
 * a case-insensitive comparison, so the order never depends on the runtime's locale.
 */
import type { Deprecation, Inline, Member, Package, Type, TypeAlias } from "./model";
import { packagePage, type Site, typePage } from "./site";
import { memberTitle, typeKindWord } from "./structure";

export function compareNames(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x !== y) return x < y ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** One row of an index: what to show and where it leads (an id the site resolves, or a page). */
export interface IndexEntry {
  name: string;
  /** What it is and where: "method in Shapes", "class in com.example.geo". */
  where: string;
  id: string;
  /** A page without an anchor, for entries without a model id (guides). */
  page?: string;
  summary?: Inline[];
  type?: Type;
  deprecation?: Deprecation;
}

const MEMBER_WORD: Record<Member["kind"], string> = {
  constructor: "constructor", method: "method", field: "field", enumConstant: "enum constant",
  annotationElement: "element", function: "function", property: "property",
};

function simpleName(type: Type): string {
  return type.name.split(".").pop()!;
}

export interface PackageRow {
  pkg: Package;
  counts: { word: string; count: number }[];
}

/** Every package, by name, with its types counted by kind. */
export function packageRows(site: Site): PackageRow[] {
  return [...site.packages].sort((a, b) => compareNames(a.name, b.name)).map(pkg => {
    const counts = new Map<string, number>();
    for (const type of pkg.types ?? []) {
      const word = typeKindWord(type);
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    return { pkg, counts: [...counts.entries()].sort((a, b) => compareNames(a[0], b[0])).map(([word, count]) => ({ word, count })) };
  });
}

/** Every type, nested ones too, by simple name. */
export function typeRows(site: Site): IndexEntry[] {
  const rows: IndexEntry[] = [];
  for (const entry of site.types.values()) {
    rows.push({ name: simpleName(entry.type), where: `${typeKindWord(entry.type)} in ${entry.pkg.name || "the default package"}`, id: entry.type.id, summary: entry.type.doc?.summary, type: entry.type, deprecation: entry.type.deprecated });
  }
  return rows.sort((a, b) => compareNames(a.name, b.name) || compareNames(a.where, b.where) || compareNames(a.id, b.id));
}

function memberEntry(member: Member, owner: string): IndexEntry {
  return { name: memberTitle(member), where: `${MEMBER_WORD[member.kind]} in ${owner}`, id: member.id, summary: member.doc?.summary, deprecation: member.deprecated };
}

function aliasEntry(alias: TypeAlias, pkg: Package): IndexEntry {
  return { name: alias.name, where: `type alias in ${pkg.name}`, id: alias.id, summary: alias.doc?.summary, deprecation: alias.deprecated };
}

/** Every declaration, grouped by first letter (non-letters under "#"); overloads stay separate. */
export function letterGroups(site: Site): { letter: string; entries: IndexEntry[] }[] {
  const all: IndexEntry[] = [];
  for (const pkg of site.packages) {
    for (const type of pkg.types ?? []) {
      all.push({ name: simpleName(type), where: `${typeKindWord(type)} in ${pkg.name || "the default package"}`, id: type.id, summary: type.doc?.summary, type, deprecation: type.deprecated });
      for (const member of type.members ?? []) all.push(memberEntry(member, type.name));
    }
    for (const member of [...(pkg.functions ?? []), ...(pkg.properties ?? [])]) all.push(memberEntry(member, pkg.name));
    for (const alias of pkg.typeAliases ?? []) all.push(aliasEntry(alias, pkg));
  }
  all.sort((a, b) => compareNames(a.name, b.name) || compareNames(a.where, b.where) || compareNames(a.id, b.id));
  const groups = new Map<string, IndexEntry[]>();
  for (const entry of all) {
    const first = entry.name.replace(/^[<@]/, "")[0]?.toUpperCase() ?? "#";
    const letter = /[A-Z]/.test(first) ? first : "#";
    (groups.get(letter) ?? groups.set(letter, []).get(letter)!).push(entry);
  }
  return [...groups.entries()].sort((a, b) => (a[0] === "#" ? 1 : b[0] === "#" ? -1 : compareNames(a[0], b[0]))).map(([letter, entries]) => ({ letter, entries }));
}

/** Guides first on the A-Z page, in reading order. */
export function guideEntries(site: Site): IndexEntry[] {
  return site.guides.map(entry => ({ name: entry.guide.title, where: "guide", id: entry.guide.id, page: entry.page, summary: entry.guide.summary }));
}

/** Everything deprecated, grouped by kind; within a group, "for removal" first, then by name. */
export function deprecatedGroups(site: Site): { id: string; title: string; entries: IndexEntry[] }[] {
  const groups: Record<string, IndexEntry[]> = { packages: [], types: [], members: [] };
  for (const pkg of site.packages) {
    if (pkg.deprecated) groups.packages!.push({ name: pkg.name, where: "package", id: pkg.id, summary: pkg.doc?.summary, deprecation: pkg.deprecated });
    for (const type of pkg.types ?? []) {
      if (type.deprecated) groups.types!.push({ name: type.name, where: `${typeKindWord(type)} in ${pkg.name}`, id: type.id, summary: type.doc?.summary, type, deprecation: type.deprecated });
      for (const member of type.members ?? []) if (member.deprecated) groups.members!.push(memberEntry(member, type.name));
    }
    for (const member of [...(pkg.functions ?? []), ...(pkg.properties ?? [])]) if (member.deprecated) groups.members!.push(memberEntry(member, pkg.name));
    for (const alias of pkg.typeAliases ?? []) if (alias.deprecated) groups.types!.push(aliasEntry(alias, pkg));
  }
  const order = (a: IndexEntry, b: IndexEntry) =>
    Number(!a.deprecation?.forRemoval) - Number(!b.deprecation?.forRemoval) || compareNames(a.name, b.name) || compareNames(a.id, b.id);
  return [
    { id: "deprecated-packages", title: "Packages", entries: groups.packages!.sort(order) },
    { id: "deprecated-types", title: "Types", entries: groups.types!.sort(order) },
    { id: "deprecated-members", title: "Members", entries: groups.members!.sort(order) },
  ].filter(g => g.entries.length > 0);
}

export { packagePage, typePage };
