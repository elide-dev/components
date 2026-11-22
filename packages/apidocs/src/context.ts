import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { Site } from "./site";
import type { Theme } from "./theme";

/** What every component on a page needs: the site, the theme and the page being rendered. */
export interface PageContext {
  site: Site;
  theme: Theme;
  /** The page's path without an extension. */
  page: string;
  /** The code language of the declaration being shown. */
  language: string;
}

export const Ctx = createContext<PageContext>(null as unknown as PageContext);

export function usePage(): PageContext {
  return useContext(Ctx);
}
