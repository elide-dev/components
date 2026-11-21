/**
 * The Java sample's versions. Pages render with `versions` (the fallback the version islands show first); the
 * islands call loadVersions on each request, which reads public/versions.json through the Worker's assets
 * binding, so editing that file changes the menu on pages that are already cached. A real app reads its
 * versions.json from R2 the same way.
 */
import type { Version } from "@elide/apidocs/astro/helpers";
import initial from "../public/versions.json";

export const versions: Version[] = initial as Version[];

export async function loadVersions(request: Request): Promise<Version[]> {
  try {
    const { env } = await import("cloudflare:workers");
    const assets = (env as { ASSETS?: { fetch: (input: string | URL) => Promise<Response> } }).ASSETS;
    const response = await assets?.fetch(new URL("/versions.json", request.url));
    if (response?.ok) return (await response.json()) as Version[];
  } catch {
    /* not on the Workers runtime */
  }
  return versions;
}
