/**
 * @elide/apidocs/astro: apidocs pages in an Astro app, rendered on request or at build time with the same
 * components as the static renderer. See the README's "Astro" section.
 */
export { default as ApidocsPage } from "./ApidocsPage.astro";
export { default as VersionNotice } from "./VersionNotice.astro";
export { default as VersionSelect } from "./VersionSelect.astro";
export { type ApidocsOptions, type ApidocsSite, apidocs } from "./integration";
export { renderPage, type PageParts, type RenderOptions } from "./render";
export { type Resolved, resolvePage, sitePaths, textFiles } from "./resolve";
export { prepareTheme, renderText, searchEntries, type TextFile } from "./text";
export { assertBase, fileUrl, isBaseRelative, mapUrl, pageUrl, rewriteHtml } from "./urls";
export { latestRelease, pathUnder, type Version, versionLabel } from "./versions";
