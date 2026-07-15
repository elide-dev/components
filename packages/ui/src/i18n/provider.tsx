import * as React from "react";
import { en, mergeMessages, type PartialMessages } from "./messages";
import { MessagesContext } from "./context";

/**
 * i18n for @elide/ui. Components read their own chrome strings from
 * `useMessages()`; wrap the app in `<MessagesProvider messages={locale}>` to
 * translate them. Without a provider, English defaults (`en`) are used.
 *
 *   import { MessagesProvider } from "@elide/ui";
 *   import fr from "./locales/fr.json"; // a PartialMessages dictionary
 *   <MessagesProvider messages={fr}>{app}</MessagesProvider>
 */
export interface MessagesProviderProps {
  /** Locale dictionary; deep-merged (two levels) over the English defaults. */
  messages?: PartialMessages;
  children: React.ReactNode;
}

export function MessagesProvider({ messages, children }: MessagesProviderProps) {
  const value = React.useMemo(() => mergeMessages(en, messages), [messages]);
  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}
