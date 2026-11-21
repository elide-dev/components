/**
 * The Elide preset's font files, bundled by Vite: each URL names the file's content hash, so a host can cache it
 * for a year. A theme font that is not here is served from the site's assets/ (see assetFile).
 */
import jetbrainsItalic from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-italic.woff2?url";
import jetbrainsNormal from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url";

export const bundledFonts: Record<string, string> = {
  "fonts/jetbrains-mono-latin-wght-normal.woff2": jetbrainsNormal,
  "fonts/jetbrains-mono-latin-wght-italic.woff2": jetbrainsItalic,
};
