/**
 * Builders for the hand-written sample models. They produce exactly what the
 * doclet (Java) and the Dokka plugin (Kotlin) write: signatures as tokens,
 * documentation as trees. `md` turns a short marked-up string into inlines:
 * `code`, *emphasis*, **strong**, [[id]] or [[id|label]] for a declaration
 * link, [[guide:slug|label]] or [[guide:slug#section|label]] for a link to a
 * guide or one of its sections, [label](url) for a URL link.
 */
import type { AdmonitionTone, Block, Deprecation, Doc, Guide, Inline, Member, Note, Param, Ref, Token, Type, TypeParam } from "../src/model";

// ---- Tokens.

export const kw = (text: string): Token => ({ kind: "keyword", text });
export const nm = (text: string): Token => ({ kind: "name", text });
export const pu = (text: string): Token => ({ kind: "punct", text });
export const tp = (text: string): Token => ({ kind: "typeParam", text });
export const lit = (text: string): Token => ({ kind: "literal", text });
export const prm = (text: string): Token => ({ kind: "param", text });
export function ty(text: string, ref?: string, url?: string): Token {
  return { kind: "type", text, ...(ref ? { ref } : {}), ...(url ? { url } : {}) };
}
export function an(text: string, ref?: string, url?: string): Token {
  return { kind: "annotation", text, ...(ref ? { ref } : {}), ...(url ? { url } : {}) };
}

/** Tokens from parts; strings are punctuation, and adjacent punctuation merges. */
export function tk(...parts: (Token | Token[] | string)[]): Token[] {
  const out: Token[] = [];
  for (const part of parts.flat()) {
    const token = typeof part === "string" ? pu(part) : part;
    const last = out[out.length - 1];
    if (token.kind === "punct" && last?.kind === "punct") out[out.length - 1] = pu(last.text + token.text);
    else if (token.text) out.push(token);
  }
  return out;
}

export const JDK = "https://docs.oracle.com/en/java/javase/25/docs/api/java.base/";
export const KOTLIN = "https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/";
export const jdk = (pkg: string, name: string) => ty(name, `${pkg}.${name}`, `${JDK}${pkg.replace(/\./g, "/")}/${name}.html`);
export const kt = (name: string) => ty(name, `kotlin/${name}///PointingToDeclaration/`, `${KOTLIN}-${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`).slice(1)}/`);

// ---- Documentation.

export function md(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\[([^\]]+)\]\(([^)]+)\)/g;
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > at) out.push({ kind: "text", text: text.slice(at, m.index) });
    if (m[1]) out.push({ kind: "code", text: m[1] });
    else if (m[2]) out.push({ kind: "strong", children: md(m[2]) });
    else if (m[3]) out.push({ kind: "emphasis", children: md(m[3]) });
    else if (m[4]?.startsWith("guide:")) {
      // A guide link: prose, not code. The section, if any, follows a #.
      const [id, section] = m[4].split("#");
      out.push({ kind: "link", target: { id: id!, ...(section ? { section } : {}) }, children: md(m[5] ?? id!) });
    } else if (m[4]) {
      const label = m[5] ?? linkLabel(m[4]);
      out.push({ kind: "link", target: { id: m[4] }, code: true, children: [{ kind: "text", text: label }] });
    } else out.push({ kind: "link", url: m[7]!, children: md(m[6]!) });
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push({ kind: "text", text: text.slice(at) });
  return out;
}

/** The label {@link} would show: Type, Type.member(Simple, Types), or a Kotlin DRI's last name. */
function linkLabel(id: string): string {
  if (id.includes("/")) return id.split("/").filter(Boolean).filter(p => p !== "PointingToDeclaration" && !p.startsWith("#"))[1] ?? id;
  const [owner, member] = id.split("#");
  const type = owner!.slice(owner!.lastIndexOf(".") + 1).replace(/\$/g, ".");
  if (!member) return /^[a-z]/.test(type) ? owner! : type;
  const simple = member.replace(/\(([^)]*)\)/, (_, ps: string) => `(${ps.split(",").filter(Boolean).map(p => p.slice(p.lastIndexOf(".") + 1)).join(", ")})`);
  return `${type}.${simple}`;
}

export const P = (text: string): Block => ({ kind: "paragraph", children: md(text) });
export const UL = (...items: (string | Block[])[]): Block => ({ kind: "list", items: items.map(i => (typeof i === "string" ? [P(i)] : i)) });
export const OL = (...items: string[]): Block => ({ kind: "list", ordered: true, items: items.map(i => [P(i)]) });
export const CODE = (language: string | undefined, text: string): Block => ({ kind: "code", ...(language ? { language } : {}), text });
export const H = (level: number, text: string): Block => ({ kind: "heading", level, children: md(text) });
export const QUOTE = (text: string): Block => ({ kind: "quote", children: [P(text)] });
export const RAW = (html: string, text: string): Block => ({ kind: "raw", html, text });
export function TABLE(caption: string, head: string[], rows: string[][]): Block {
  return { kind: "table", caption: md(caption), head: [head.map(h => [P(h)])], rows: rows.map(r => r.map(c => [P(c)])) };
}

/** An admonition: a tone, the text as paragraphs (or blocks), and an optional title. */
export function ADMON(tone: AdmonitionTone, body: string | Block[], title?: string): Block {
  return { kind: "admonition", tone, ...(title ? { title: md(title) } : {}), children: typeof body === "string" ? blocks(body) : body };
}

/** A guide, as an extractor writes it: the id is guide: and the slug. */
export function guide(spec: { slug: string; title: string; summary: string; body: Block[]; group?: string; order?: number; source?: Guide["source"] }): Guide {
  return {
    id: `guide:${spec.slug}`, slug: spec.slug, title: spec.title, summary: md(spec.summary),
    ...(spec.group ? { group: spec.group } : {}),
    ...(spec.order !== undefined ? { order: spec.order } : {}),
    body: spec.body,
    ...(spec.source ? { source: spec.source } : {}),
  };
}

export interface DocSpec {
  body?: string | Block[];
  notes?: [Note["kind"], string | Block[]][];
  see?: (string | Inline[])[];
  inheritedFrom?: Ref;
}

/** A doc tree; the summary is the body's first sentence. */
export function doc(spec: DocSpec | string): Doc {
  const s = typeof spec === "string" ? { body: spec } : spec;
  const body = typeof s.body === "string" ? s.body.split("\n\n").map(P) : (s.body ?? []);
  const first = body[0];
  let summary: Inline[] = [];
  if (first?.kind === "paragraph") {
    for (const node of first.children ?? []) {
      if (node.kind === "text" && /\.(\s|$)/.test(node.text)) {
        summary.push({ kind: "text", text: node.text.slice(0, node.text.search(/\.(\s|$)/) + 1) });
        break;
      }
      summary.push(node);
    }
  }
  return {
    ...(summary.length ? { summary } : {}),
    ...(body.length ? { body } : {}),
    ...(s.notes?.length ? { notes: s.notes.map(([kind, b]) => ({ kind, body: typeof b === "string" ? [P(b)] : b })) } : {}),
    ...(s.see?.length ? { see: s.see.map(e => (typeof e === "string" ? md(e) : e)) } : {}),
    ...(s.inheritedFrom ? { inheritedFrom: s.inheritedFrom } : {}),
  };
}

export const blocks = (text: string): Block[] => text.split("\n\n").map(P);
export const deprecated = (text: string, since?: string, forRemoval?: boolean): Deprecation => ({
  doc: blocks(text), ...(since ? { since } : {}), ...(forRemoval ? { forRemoval } : {}),
});

// ---- Members.

export interface ParamSpec {
  name: string;
  type: Token[];
  doc?: string;
  varargs?: boolean;
  nullness?: Param["nullness"];
  defaultValue?: string;
  annotations?: Token[][];
}

export interface MemberSpec {
  name: string;
  kind?: Member["kind"];
  mods?: string[];
  annotations?: Token[][];
  typeParams?: { name: string; bounds?: Token[][]; doc?: string }[];
  receiver?: ParamSpec;
  params?: ParamSpec[];
  returns?: { type: Token[]; doc?: string; nullness?: Param["nullness"] };
  type?: Token[];
  nullness?: Param["nullness"];
  throws?: { type: Token[]; doc?: string; declared?: boolean }[];
  constant?: string;
  defaultValue?: string;
  overrides?: Ref;
  implicit?: boolean;
  doc?: DocSpec | string;
  deprecated?: Deprecation;
  since?: string;
  line?: number;
  file?: string;
  /**
   * Lay the signature out as the source formatter does when it is too long for one line: google-java-format
   * (one parameter per line at +8, throws on its own continuation line) or ktfmt (one parameter per line at
   * +4, the closing parenthesis and return type on their own line). The newlines and indentation go in the
   * punctuation tokens, as the doclet and the Dokka plugin write them after running the formatter.
   */
  wrap?: boolean;
}

function params(list: ParamSpec[] | undefined): Param[] {
  return (list ?? []).map(p => ({
    name: p.name, type: p.type,
    ...(p.varargs ? { varargs: true } : {}),
    ...(p.defaultValue ? { defaultValue: p.defaultValue } : {}),
    ...(p.nullness ? { nullness: p.nullness } : {}),
    ...(p.annotations ? { annotations: p.annotations } : {}),
    ...(p.doc ? { doc: blocks(p.doc) } : {}),
  }));
}

function typeParams(list: MemberSpec["typeParams"]): TypeParam[] {
  return (list ?? []).map(t => ({ name: t.name, ...(t.bounds ? { bounds: t.bounds } : {}), ...(t.doc ? { doc: blocks(t.doc) } : {}) }));
}

function typeParamTokens(list: MemberSpec["typeParams"], keyword: string): Token[] {
  if (!list?.length) return [];
  return tk("<", ...list.flatMap((t, i) => [
    ...(i ? [pu(", ")] : []), tp(t.name),
    ...(t.bounds?.length ? [pu(` ${keyword} `), ...t.bounds.flatMap((b, j) => [...(j ? [pu(" & ")] : []), ...b])] : []),
  ]), ">");
}

/** The JDK doclet's anchor: the name and erased parameter types. */
function javaAnchor(spec: MemberSpec): string {
  if (spec.kind === "field" || spec.kind === "enumConstant") return spec.name;
  const name = spec.kind === "constructor" ? "<init>" : spec.name;
  const types = (spec.params ?? []).map(p => {
    const head = p.type.find(t => t.kind === "type" || t.kind === "typeParam" || t.kind === "keyword")!;
    const base = head.kind === "type" && head.ref ? head.ref.replace(/\$/g, ".") : head.text;
    const array = p.type.some(t => t.kind === "punct" && t.text.includes("[]"));
    return base + (p.varargs ? "..." : array ? "[]" : "");
  });
  return `${name}(${types.join(",")})`;
}

function base(owner: string, spec: MemberSpec, anchor: string, id: string, signature: Token[], kind: Member["kind"]): Member {
  return {
    id, anchor, kind, name: spec.name,
    ...(spec.mods?.length ? { modifiers: spec.mods } : {}),
    ...(spec.annotations?.length ? { annotations: spec.annotations } : {}),
    ...(spec.typeParams?.length ? { typeParams: typeParams(spec.typeParams) } : {}),
    ...(spec.receiver ? { receiver: params([spec.receiver])[0] } : {}),
    signature,
    ...(spec.params?.length ? { params: params(spec.params) } : {}),
    ...(spec.returns ? { returns: { type: spec.returns.type, ...(spec.returns.nullness ? { nullness: spec.returns.nullness } : {}), ...(spec.returns.doc ? { doc: blocks(spec.returns.doc) } : {}) } } : {}),
    ...(spec.type ? { type: spec.type } : {}),
    ...(spec.nullness ? { nullness: spec.nullness } : {}),
    ...(spec.throws?.length ? { throws: spec.throws.map(t => ({ type: t.type, ...(t.declared ? { declared: true } : {}), ...(t.doc ? { doc: blocks(t.doc) } : {}) })) } : {}),
    ...(spec.constant ? { constant: spec.constant } : {}),
    ...(spec.defaultValue ? { defaultValue: spec.defaultValue } : {}),
    ...(spec.overrides ? { overrides: spec.overrides } : {}),
    ...(spec.implicit ? { implicit: true } : {}),
    ...(spec.doc ? { doc: doc(spec.doc) } : {}),
    ...(spec.deprecated ? { deprecated: spec.deprecated } : {}),
    ...(spec.since ? { since: spec.since } : {}),
    ...(spec.line ? { source: { path: spec.file ?? owner.replace(/\$.*/, "").replace(/\./g, "/") + ".java", line: spec.line } } : {}),
  };
}

/** A Java member, as the doclet writes it. */
export function javaMember(owner: string, ownerName: string, spec: MemberSpec): Member {
  const kind = spec.kind ?? "method";
  const sig: (Token | Token[] | string)[] = [];
  for (const mod of spec.mods ?? []) sig.push(kw(mod), " ");
  if (kind === "enumConstant") sig.push(nm(spec.name));
  else if (kind === "field") sig.push(spec.type!, " ", nm(spec.name));
  else {
    const tps = typeParamTokens(spec.typeParams, "extends");
    if (tps.length) sig.push(tps, " ");
    if (kind !== "constructor") sig.push(spec.returns?.type ?? [kw("void")], " ");
    const indent = "\n" + " ".repeat(8);
    sig.push(nm(kind === "constructor" ? ownerName.split(".").pop()! : spec.name), "(", spec.wrap ? indent : "");
    (spec.params ?? []).forEach((p, i) => {
      if (i) sig.push(spec.wrap ? `,${indent}` : ", ");
      for (const a of p.annotations ?? []) sig.push(a, " ");
      sig.push(p.type, " ", prm(p.name));
    });
    sig.push(")");
    if (spec.defaultValue) sig.push(" ", kw("default"), " ", lit(spec.defaultValue));
    const declared = (spec.throws ?? []).filter(t => t.declared);
    if (declared.length) sig.push(spec.wrap ? indent : " ", kw("throws"), " ", ...declared.flatMap((t, i) => [...(i ? [", "] : []), t.type]));
  }
  const anchor = javaAnchor({ ...spec, kind });
  return base(owner, { ...spec, file: spec.file }, anchor, `${owner}#${anchor}`, tk(...sig), kind);
}

/** A Kotlin member, as the Dokka plugin writes it: ids are DRIs, anchors are readable names. */
export function kotlinMember(owner: string, spec: MemberSpec): Member {
  const kind = spec.kind ?? "function";
  const sig: (Token | Token[] | string)[] = [];
  for (const mod of spec.mods ?? []) sig.push(kw(mod), " ");
  sig.push(kw(kind === "property" ? (spec.mods?.includes("var") ? "" : "val") : kind === "constructor" ? "constructor" : "fun"));
  if (kind !== "constructor") sig.push(" ");
  const tps = typeParamTokens(spec.typeParams, ":");
  if (tps.length) sig.push(tps, " ");
  if (spec.receiver) sig.push(spec.receiver.type, ".");
  if (kind !== "constructor") sig.push(nm(spec.name));
  if (kind === "property") sig.push(": ", spec.type!);
  else {
    sig.push("(", spec.wrap ? "\n    " : "");
    (spec.params ?? []).forEach((p, i) => {
      if (i) sig.push(spec.wrap ? ",\n    " : ", ");
      if (p.varargs) sig.push(kw("vararg"), " ");
      sig.push(prm(p.name), ": ", p.type);
      if (p.defaultValue) sig.push(" = ", lit(p.defaultValue));
    });
    sig.push(spec.wrap ? ",\n)" : ")");
    if (spec.returns) sig.push(": ", spec.returns.type);
  }
  const anchor = kind === "property" ? spec.name : `${spec.name}(${(spec.params ?? []).map(p => p.type.map(t => t.text).join("")).join(",")})`;
  const id = `${owner}/${spec.name}/${spec.receiver ? spec.receiver.type.map(t => t.text).join("") : ""}#${(spec.params ?? []).map(p => p.type.map(t => t.text).join("")).join("#")}/PointingToDeclaration/`;
  return base(owner, { ...spec, file: spec.file ?? `${owner.split("/")[0]!.replace(/\./g, "/")}/${(owner.split("/")[1] || "Top")}.kt` }, anchor, id, tk(...sig.filter(s => s !== "")), kind);
}

/** A type: fills the defaults every type needs. */
export function type(t: Partial<Type> & Pick<Type, "id" | "name" | "kind" | "signature">, language = "java"): Type {
  return { language, ...t } as Type;
}
