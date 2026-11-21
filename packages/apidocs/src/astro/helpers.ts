/**
 * @elide/apidocs/astro/helpers: everything in @elide/apidocs/astro except the Astro components and the
 * integration, for code that runs outside Astro's Vite pipeline (tests, scripts, a Worker's own router).
 */
export { renderPage, type PageParts, type RenderOptions } from "./render";
export { type Resolved, resolvePage, sitePaths, textFiles } from "./resolve";
export { prepareTheme, renderText, searchEntries, type TextFile } from "./text";
export { assertBase, fileUrl, isBaseRelative, mapUrl, pageUrl, rewriteHtml } from "./urls";
export { latestRelease, pathUnder, type Version, versionLabel } from "./versions";
