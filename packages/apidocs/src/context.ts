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
  /**
   * How the navigator is rendered. "full" (the default) puts the whole tree in the page. "split" puts only the
   * branches on the page's path in it, and loads the whole tree from assets/nav.js, which every page shares.
   */
  nav?: "full" | "split";
  /** Which of the site's optional files exist, so pages link only to those. Each defaults to true. */
  outputs?: Outputs;
}

/** The optional files a site has besides its HTML pages. */
export interface Outputs {
  /** A Markdown twin of every page (page.md). */
  markdown?: boolean;
  /** llms.txt and llms-full.txt. */
  llms?: boolean;
  /** api.json, the model. */
  model?: boolean;
}

/** Which optional files the page's site has, with the defaults filled in. */
export function outputsOf(ctx: Pick<PageContext, "outputs">): Required<Outputs> {
  return { markdown: ctx.outputs?.markdown !== false, llms: ctx.outputs?.llms !== false, model: ctx.outputs?.model !== false };
}

export const Ctx = createContext<PageContext>(null as unknown as PageContext);

export function usePage(): PageContext {
  return useContext(Ctx);
}
