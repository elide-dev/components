/**
 * The Markdown importer, for programmatic use: `import { importMarkdown } from "@elide/apidocs/import"`. Build time
 * only and Node-or-Bun only (readSuite and suiteSite read files); the package's root export stays free of it, and
 * render.js and the client bundle never include it.
 */
export { formatDiagnostic, guidesModel, importMarkdown, mapLink, SUITE_FILES } from "./markdown";
export type { CopiedFile, Diagnostic, ImportOptions, ImportResult, LinkMapping, SuiteAsset, SuiteFile } from "./markdown";
export { readSuite } from "./files";
export type { Suite } from "./files";
export { imageSize } from "./images";
export { suiteSite } from "./suite";
export type { SuiteSite, SuiteSiteOptions } from "./suite";
