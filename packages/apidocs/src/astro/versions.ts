/** Versions of one documentation set, for the version selector and the version notice. */

export interface Version {
  /** A stable id: "main", "2.0". */
  id: string;
  /** What the selector shows; defaults to the id. */
  label?: string;
  /** The version's site base path, ending with a slash: "/api/komodo/2.0/". */
  base: string;
  /** "release" (the default), "prerelease", or "development" for a branch such as main. */
  channel?: "release" | "prerelease" | "development";
  /** Whether this is the release readers should use. Defaults to the first release in the list. */
  latest?: boolean;
}

export function versionLabel(version: Version): string {
  return version.label ?? version.id;
}

/** The release readers should use: the one marked latest, else the first release. */
export function latestRelease(versions: Version[]): Version | undefined {
  return versions.find(v => v.latest) ?? versions.find(v => (v.channel ?? "release") === "release");
}

/** A page's path under its site's base ("com/example/geo/Circle"), from a URL path and the base. */
export function pathUnder(pathname: string, base: string): string {
  return pathname.startsWith(base) ? pathname.slice(base.length) : "";
}
