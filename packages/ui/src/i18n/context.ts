import * as React from "react";
import { en, type Messages } from "./messages";

/**
 * Messages context + `useMessages`. Kept out of provider.tsx so that file
 * exports only components and Fast Refresh can preserve state on edit.
 * Without a provider, English defaults (`en`) are used.
 */
export const MessagesContext = React.createContext<Messages>(en);

/** Access the merged message dictionary (defaults ⊕ provider override). */
export function useMessages(): Messages {
  return React.useContext(MessagesContext);
}
