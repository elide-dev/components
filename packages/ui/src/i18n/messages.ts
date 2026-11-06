/**
 * Default (English) UI strings for @elide/ui, broken out for i18n. Every
 * user-facing string a component renders itself (labels, placeholders, ARIA
 * names, status text) lives here rather than being hardcoded, so a consuming
 * app can translate the catalog by supplying a locale dictionary to
 * `MessagesProvider`. Content passed in as props (nav items, method params,
 * etc.) is the consumer's responsibility to localize.
 *
 * Shape is two levels: `messages.<component>.<key>`. Add new strings to locales/en.json (not
 * inline in components) and read them via `useMessages()`.
 */
import en from "./locales/en";
export { en };

/** The full messages dictionary shape (mutable — `en` is `as const`). */
export type Messages = {
  -readonly [K in keyof typeof en]: { -readonly [P in keyof (typeof en)[K]]: string };
};

/** A partial override: any subset of components, any subset of their keys. */
export type PartialMessages = {
  [K in keyof Messages]?: Partial<Messages[K]>;
};

/** Two-level merge of an override dictionary over the English defaults. */
export function mergeMessages(base: Messages, override?: PartialMessages): Messages {
  if (!override) return base;
  const out = {} as Record<keyof Messages, Record<string, string>>;
  for (const key of Object.keys(base) as (keyof Messages)[]) {
    out[key] = { ...base[key] };
    for (const [field, value] of Object.entries(override[key] ?? {})) {
      if (value !== undefined) out[key][field] = value;
    }
  }
  return out as Messages;
}
