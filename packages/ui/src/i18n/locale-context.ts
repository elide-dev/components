import * as React from "react";
import type { Direction } from "./locales";

export interface LocaleContextValue {
  /** BCP 47 formatting language; independent of the supplied message catalog. */
  locale: string;
  direction: Direction;
}
export const LocaleContext = React.createContext<LocaleContextValue>({ locale: "en", direction: "ltr" });
export function useLocale(): LocaleContextValue { return React.useContext(LocaleContext); }
