/** Groupings and text the HTML and Markdown pages share, so both have the same sections in the same order. */
import type { Block, Doc, Inline, Member, Token, Type } from "./model";
import { isThrowable, tokenText } from "./site";

export interface TypeGroup {
  id: string;
  title: string;
  types: Type[];
}

export interface MemberGroup {
  id: string;
  title: string;
  members: Member[];
}

/** Types by category, in a fixed order. Exceptions are classes whose chain reaches Throwable. */
export function typeGroups(types: Type[]): TypeGroup[] {
  const groups: TypeGroup[] = [
    { id: "interfaces", title: "Interfaces", types: [] },
    { id: "classes", title: "Classes", types: [] },
    { id: "objects", title: "Objects", types: [] },
    { id: "records", title: "Records", types: [] },
    { id: "enums", title: "Enums", types: [] },
    { id: "exceptions", title: "Exceptions", types: [] },
    { id: "annotations", title: "Annotations", types: [] },
  ];
  const by = Object.fromEntries(groups.map(g => [g.id, g]));
  for (const type of types) {
    const id = type.kind === "class" && isThrowable(type) ? "exceptions"
      : type.kind === "class" ? "classes"
      : type.kind === "interface" ? "interfaces"
      : type.kind === "object" ? "objects"
      : type.kind === "record" ? "records"
      : type.kind === "enum" ? "enums"
      : "annotations";
    by[id]!.types.push(type);
  }
  return groups.filter(g => g.types.length > 0);
}

/** A type's members by kind, in a fixed order; declaration order inside each group. */
export function memberGroups(type: Type): MemberGroup[] {
  const groups: MemberGroup[] = [
    { id: "enum-constants", title: "Enum constants", members: [] },
    { id: "field-details", title: "Fields", members: [] },
    { id: "property-details", title: "Properties", members: [] },
    { id: "constructor-details", title: "Constructors", members: [] },
    { id: "element-details", title: "Elements", members: [] },
    { id: "method-details", title: "Methods", members: [] },
    { id: "function-details", title: "Functions", members: [] },
  ];
  const by: Record<Member["kind"], MemberGroup> = {
    enumConstant: groups[0]!, field: groups[1]!, property: groups[2]!, constructor: groups[3]!,
    annotationElement: groups[4]!, method: groups[5]!, function: groups[6]!,
  };
  for (const member of type.members ?? []) by[member.kind].members.push(member);
  return groups.filter(g => g.members.length > 0);
}

export function inlineText(nodes: Inline[] | undefined): string {
  return (nodes ?? []).map(node => {
    switch (node.kind) {
      case "text":
      case "code": return node.text;
      case "raw": return node.text;
      case "break": return " ";
      default: return inlineText(node.children);
    }
  }).join("");
}

export function blockText(nodes: Block[] | undefined): string {
  return (nodes ?? []).map(node => {
    switch (node.kind) {
      case "paragraph":
      case "heading": return inlineText(node.children);
      case "code":
      case "raw": return node.text;
      case "quote": return blockText(node.children);
      case "list": return (node.items ?? []).map(blockText).join(" ");
      case "table": return (node.rows ?? []).map(r => r.map(blockText).join(" ")).join(" ");
    }
  }).join(" ");
}

/** A declaration's summary sentence as plain text, or empty. */
export function summaryText(doc: Doc | undefined): string {
  return inlineText(doc?.summary).replace(/\s+/g, " ").trim();
}

/** The visible kind of a type: "class", "sealed interface", "exception", ... */
export function typeKindWord(type: Type): string {
  const sealed = (type.modifiers ?? []).includes("sealed") ? "sealed " : "";
  const abstract = type.kind === "class" && (type.modifiers ?? []).includes("abstract") ? "abstract " : "";
  if (type.kind === "class" && isThrowable(type)) return `${abstract}exception`;
  if (type.kind === "annotation") return "annotation interface";
  return `${sealed}${abstract}${type.kind === "enum" ? "enum class" : type.kind}`;
}

/** Tokens without annotations or type arguments: List<? extends T> becomes List. For summaries and titles. */
export function compactTokens(tokens: Token[] | undefined): Token[] {
  const out: Token[] = [];
  let depth = 0;
  let skipSpace = false;
  for (const token of tokens ?? []) {
    if (token.kind === "annotation" && depth === 0) {
      skipSpace = true;
      continue;
    }
    if (token.kind === "punct") {
      let text = "";
      for (const ch of token.text) {
        if (ch === "<") depth++;
        else if (ch === ">") depth--;
        else if (depth === 0) text += ch;
      }
      if (skipSpace) text = text.replace(/^\s+/, "");
      skipSpace = false;
      if (text) out.push({ kind: "punct", text });
    } else if (depth === 0) {
      skipSpace = false;
      out.push(token);
    }
  }
  return out;
}

/** A member's title: its name, with compact parameter types for callables so overloads differ ("read(InputStream)"). */
export function memberTitle(member: Member): string {
  const receiver = member.receiver ? `${tokenText(compactTokens(member.receiver.type))}.` : "";
  if (member.kind === "field" || member.kind === "enumConstant" || member.kind === "property") return receiver + member.name;
  const params = (member.params ?? []).map(p => tokenText(compactTokens(p.type)).trim());
  const shown = params.length > 3 ? [...params.slice(0, 2), "\u2026"] : params;
  return `${receiver}${member.name}(${shown.join(", ")})`;
}
