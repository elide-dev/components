/**
 * Default (English) UI strings for @elide/ui, broken out for i18n. Every
 * user-facing string a component renders itself (labels, placeholders, ARIA
 * names, status text) lives here rather than being hardcoded, so a consuming
 * app can translate the catalog by supplying a locale dictionary to
 * `MessagesProvider`. Content passed in as props (nav items, method params,
 * etc.) is the consumer's responsibility to localize.
 *
 * Shape is two levels: `messages.<component>.<key>`. Add new strings here (not
 * inline in components) and read them via `useMessages()`.
 */
export const en = {
  appNav: {
    navLabel: "Main navigation",
    docsBadge: "DOCS",
    searchPlaceholder: "Search or ask",
    searchLabel: "Search",
    toggleTheme: "Toggle theme",
    language: "Language",
    changelog: "Changelog",
    install: "Install",
  },
  mobileNav: {
    openNavigation: "Open navigation",
    navLabel: "Mobile navigation",
    dialogLabel: "Navigation menu",
    searchPlaceholder: "Search or ask",
    searchLabel: "Search",
    changelog: "Changelog",
  },
  sectionTabs: {
    navLabel: "Sections",
  },
  sidebar: {
    navLabel: "Sidebar",
    comingSoon: "Soon",
  },
  tableOfContents: {
    title: "On this page",
    navLabel: "Table of contents",
  },
  codeBlock: {
    copy: "Copy",
    copied: "Copied",
    terminal: "Terminal",
  },
  copyCommand: {
    copy: "Copy",
    copied: "Copied",
  },
  aiActions: {
    title: "Use with AI",
    copyAsMarkdown: "Copy as Markdown",
    copied: "Copied",
  },
  supportMatrix: {
    caption: "Support matrix",
    supported: "Supported",
    partial: "Partial",
    notSupported: "Not supported",
  },
  statusBadge: {
    implemented: "Implemented",
    supported: "Supported",
    partial: "Partial",
    missing: "Missing",
    planned: "Planned",
  },
} as const;

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
    out[key] = { ...base[key], ...(override[key] ?? {}) };
  }
  return out as Messages;
}
