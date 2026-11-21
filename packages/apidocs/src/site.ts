/**
 * The site's structure, computed once per render: every page's path, where
 * each model id lands, and the relative links between pages. Pages are named by
 * their path without an extension ("fixture/java/Shape"); the HTML page adds
 * ".html" and its Markdown twin ".md". Every link is relative and names its
 * file, so the output works from file://, from any path prefix and inside a jar.
 */
import type { Member, Model, Package, Ref, Token, Type } from "./model";
import { safeUrl } from "./url";

/** Where an id lands: its page and, for a member, the anchor on that page. */
export interface Target {
  page: string;
  anchor?: string;
  label: string;
}

export interface TypeEntry {
  type: Type;
  pkg: Package;
  page: string;
  /** Nested types, in name order. */
  nested: Type[];
  /** Types in this model that extend or implement this one. */
  subtypes: Type[];
}

export interface Site {
  model: Model;
  packages: Package[];
  types: Map<string, TypeEntry>;
  targets: Map<string, Target>;
  /** The default language for code blocks: the module's first. */
  language: string;
}

export const INDEX = "index";

export function packagePage(pkg: Package): string {
  return pkg.name ? `${pkg.name.split(".").join("/")}/index` : "default-package/index";
}

export function typePage(pkg: Package, type: Type): string {
  return `${packagePage(pkg).slice(0, -"index".length)}${type.name}`;
}

export function buildSite(model: Model): Site {
  const packages = model.packages ?? [];
  const types = new Map<string, TypeEntry>();
  const targets = new Map<string, Target>();
  for (const pkg of packages) {
    targets.set(pkg.id, { page: packagePage(pkg), label: pkg.name || "(default package)" });
    for (const type of pkg.types ?? []) {
      const page = typePage(pkg, type);
      types.set(type.id, { type, pkg, page, nested: [], subtypes: [] });
      targets.set(type.id, { page, label: type.name });
      for (const member of type.members ?? []) {
        targets.set(member.id, { page, anchor: member.anchor, label: memberLabel(member) });
      }
    }
    for (const fn of [...(pkg.functions ?? []), ...(pkg.properties ?? [])]) {
      targets.set(fn.id, { page: packagePage(pkg), anchor: fn.anchor, label: memberLabel(fn) });
    }
    for (const alias of pkg.typeAliases ?? []) {
      targets.set(alias.id, { page: packagePage(pkg), anchor: alias.name, label: alias.name });
    }
  }
  for (const entry of types.values()) {
    const outer = entry.type.enclosing && types.get(entry.type.enclosing);
    if (outer) outer.nested.push(entry.type);
    const supers = [entry.type.superclass, ...(entry.type.interfaces ?? [])];
    for (const tokens of supers) {
      const ref = tokens?.find(t => t.kind === "type")?.ref;
      const parent = ref && types.get(ref);
      if (parent) parent.subtypes.push(entry.type);
    }
  }
  return { model, packages, types, targets, language: model.module.languages?.[0] ?? "java" };
}

function memberLabel(member: Member): string {
  return member.kind === "constructor" || member.kind === "method" || member.kind === "annotationElement" || member.kind === "function"
    ? `${member.name}()`
    : member.name;
}

/** The path from one page's directory to the site root: "../../". */
export function rootOf(page: string): string {
  return "../".repeat(page.split("/").length - 1);
}

/** A relative link from one page to another page's file. */
export function relative(from: string, to: string, ext: string): string {
  const fromDirs = from.split("/").slice(0, -1);
  const toParts = to.split("/");
  let common = 0;
  while (common < fromDirs.length && common < toParts.length - 1 && fromDirs[common] === toParts[common]) common++;
  return "../".repeat(fromDirs.length - common) + toParts.slice(common).join("/") + ext;
}

/** An anchor as a URL fragment, escaped as the JDK doclet escapes it. */
export function fragment(anchor: string): string {
  return anchor.replace(/[<> "%]/g, c => encodeURIComponent(c));
}

export function isAbsolute(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url);
}

/**
 * Where a reference to id (with an external url) points from a page, or
 * undefined when it resolves nowhere and should render as plain code.
 */
export function resolve(site: Site, from: string, ext: string, id: string | undefined, url?: string): string | undefined {
  if (id) {
    const target = site.targets.get(id);
    if (target) {
      const file = relative(from, target.page, ext);
      return target.anchor ? `${file}#${fragment(target.anchor)}` : file;
    }
  }
  const safe = safeUrl(url);
  if (safe) return isAbsolute(safe) || safe.startsWith("//") ? safe : rootOf(from) + safe;
  return undefined;
}

export function resolveRef(site: Site, from: string, ext: string, ref: Ref): string | undefined {
  return resolve(site, from, ext, ref.id, ref.url);
}

export function resolveToken(site: Site, from: string, ext: string, token: Token): string | undefined {
  return token.ref || token.url ? resolve(site, from, ext, token.ref, token.url) : undefined;
}

/** A reference's text: its own, the target's label, or the id's last segment. */
export function refLabel(site: Site, ref: Ref): string {
  if (ref.text) return ref.text;
  const target = site.targets.get(ref.id);
  if (target) return target.label;
  const tail = ref.id.split("#").pop()!;
  return tail.slice(tail.lastIndexOf(".", tail.indexOf("(") < 0 ? tail.length : tail.indexOf("(")) + 1).replace(/\$/g, ".");
}

/** Whether a type is an exception: its superclass chain reaches java.lang.Throwable. */
export function isThrowable(type: Type): boolean {
  return (type.ancestors ?? []).some(a => a.id === "java.lang.Throwable") || type.id === "java.lang.Throwable";
}

/** Tokens as plain text. */
export function tokenText(tokens: Token[] | undefined): string {
  return (tokens ?? []).map(t => t.text).join("");
}
