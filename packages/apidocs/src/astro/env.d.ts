/// <reference types="astro/client" />

/** The sites, models, themes and versions apidocs() was given (integration.ts writes this module). */
declare module "virtual:@elide/apidocs/sites" {
  import type { Model } from "../model";
  import type { Theme } from "../theme";
  import type { Version } from "./versions";
  export const sites: { base: string; model: Model; theme: Theme; version: string | null }[];
  export const versions: Version[];
  export function loadVersions(request: Request): Promise<Version[]>;
}

/** For tsc outside Astro's tooling, which types .astro files itself. */
declare module "*.astro" {
  const Component: (props: Record<string, unknown>) => unknown;
  export default Component;
}
