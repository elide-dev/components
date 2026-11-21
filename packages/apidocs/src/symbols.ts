/**
 * The symbol vocabulary: one entry per thing the pages express, each with a
 * plain Unicode symbol, an emoji and a spoken label, so the same thing can be
 * written with either set or with neither. HTML pages draw SVG icons where
 * they can and use these in text; Markdown pages and llms.txt, which cannot
 * carry SVG, use these alone. A theme picks the set with `symbols`.
 *
 * Symbols that also have an emoji form end in U+FE0E (text presentation), and
 * emoji that also have a text form end in U+FE0F, so each renders as intended
 * whatever fonts the reader has.
 */

/** Which set a page writes: Unicode symbols, emoji, or no symbols at all. */
export type SymbolMode = "utf" | "emoji" | "none";

export interface SymbolPair {
  /** A single-cell Unicode symbol, in text presentation. */
  utf: string;
  /** An emoji with the same meaning. */
  emoji: string;
  /** What the symbol stands for, for titles and assistive technology. */
  label: string;
}

const TEXT = "︎";
const EMOJI = "️";

export const SYMBOLS = {
  // Containers and declaration kinds.
  module: { utf: "⬢", emoji: "\u{1F5C2}" + EMOJI, label: "module" }, // ⬢ 🗂️
  package: { utf: "▣", emoji: "\u{1F4E6}", label: "package" }, // ▣ 📦
  class: { utf: "◆", emoji: "\u{1F537}", label: "class" }, // ◆ 🔷
  interface: { utf: "◇", emoji: "\u{1F536}", label: "interface" }, // ◇ 🔶
  record: { utf: "▤", emoji: "\u{1F9FE}", label: "record" }, // ▤ 🧾
  enum: { utf: "≡", emoji: "\u{1F522}", label: "enum" }, // ≡ 🔢
  annotation: { utf: "@", emoji: "\u{1F3F7}" + EMOJI, label: "annotation" }, // @ 🏷️
  object: { utf: "●", emoji: "\u{1F9E9}", label: "object" }, // ● 🧩
  exception: { utf: "⚡" + TEXT, emoji: "⚡" + EMOJI, label: "exception" }, // ⚡︎ ⚡️
  typeAlias: { utf: "≔", emoji: "\u{1F517}", label: "type alias" }, // ≔ 🔗
  constructor: { utf: "✚", emoji: "\u{1F3D7}" + EMOJI, label: "constructor" }, // ✚ 🏗️
  function: { utf: "ƒ", emoji: "⚙" + EMOJI, label: "function" }, // ƒ ⚙️
  property: { utf: "▪" + TEXT, emoji: "\u{1F539}", label: "property" }, // ▪︎ 🔹
  // What a declaration says about itself.
  param: { utf: "▸", emoji: "\u{1F538}", label: "parameter" }, // ▸ 🔸
  returns: { utf: "→", emoji: "↩" + EMOJI, label: "returns" }, // → ↩️
  throws: { utf: "↯", emoji: "\u{1F4A5}", label: "throws" }, // ↯ 💥
  nullable: { utf: "?", emoji: "❔", label: "nullable" }, // ? ❔
  since: { utf: "◷", emoji: "\u{1F552}", label: "since" }, // ◷ 🕒
  inherited: { utf: "⤴" + TEXT, emoji: "\u{1F9EC}", label: "inherited" }, // ⤴︎ 🧬
  see: { utf: "↗" + TEXT, emoji: "\u{1F517}", label: "see also" }, // ↗︎ 🔗
  // Notes, in the order pages show them.
  deprecated: { utf: "⊘", emoji: "\u{1F6AB}", label: "deprecated" }, // ⊘ 🚫
  apiNote: { utf: "⚠" + TEXT, emoji: "⚠" + EMOJI, label: "API note" }, // ⚠︎ ⚠️
  implSpec: { utf: "☑" + TEXT, emoji: "\u{1F4D0}", label: "implementation requirements" }, // ☑︎ 📐
  implNote: { utf: "✎", emoji: "\u{1F6E0}" + EMOJI, label: "implementation note" }, // ✎ 🛠️
  // Languages.
  java: { utf: "☕" + TEXT, emoji: "☕" + EMOJI, label: "Java" }, // ☕︎ ☕️
  kotlin: { utf: "Ⓚ", emoji: "\u{1F7E3}", label: "Kotlin" }, // Ⓚ 🟣
  // Page furniture.
  guide: { utf: "¶", emoji: "\u{1F4D6}", label: "guide" }, // ¶ 📖
  markdown: { utf: "Ⓜ" + TEXT, emoji: "\u{1F4DD}", label: "Markdown" }, // Ⓜ︎ 📝
  source: { utf: "‹›", emoji: "\u{1F4C4}", label: "source" }, // ‹› 📄
  external: { utf: "↗" + TEXT, emoji: "\u{1F310}", label: "external link" }, // ↗︎ 🌐
  copy: { utf: "⧉", emoji: "\u{1F4CB}", label: "copy" }, // ⧉ 📋
  search: { utf: "⌕", emoji: "\u{1F50D}", label: "search" }, // ⌕ 🔍
} as const satisfies Record<string, SymbolPair>;

export type SymbolKey = keyof typeof SYMBOLS;

/** The symbol for a key in a mode, or the empty string when the mode is "none". */
export function sym(mode: SymbolMode | undefined, key: SymbolKey): string {
  const m = mode ?? "utf";
  return m === "none" ? "" : SYMBOLS[key][m];
}

/** Text with its symbol in front, separated by a space; the text alone when the mode is "none". */
export function withSym(mode: SymbolMode | undefined, key: SymbolKey, text: string): string {
  const s = sym(mode, key);
  return s ? `${s} ${text}` : text;
}

/** The vocabulary key for a type: its kind, or "exception" for a class whose chain reaches Throwable. */
export function typeSymbolKey(kind: string, throwable: boolean): SymbolKey {
  if (kind === "class" && throwable) return "exception";
  return (kind in SYMBOLS ? kind : "class") as SymbolKey;
}

/** The vocabulary key for a member kind. */
export function memberSymbolKey(kind: string): SymbolKey {
  switch (kind) {
    case "constructor": return "constructor";
    case "field":
    case "property":
    case "enumConstant":
    case "annotationElement": return "property";
    default: return "function";
  }
}
