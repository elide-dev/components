/**
 * A Markdown suite as a site: read the directory, import it, and render the guides-only model with the theme. The
 * CLI (`apidocs guides`) and the dev server share this; it writes nothing.
 */
import type { Model } from "../model";
import { type Output, render } from "../render";
import type { Theme } from "../theme";
import { readSuite } from "./files";
import { type CopiedFile, type Diagnostic, guidesModel, importMarkdown, type ImportResult, type LinkMapping } from "./markdown";

export interface SuiteSiteOptions {
  /** The suite's id: it namespaces the guide ids. */
  id: string;
  /** The site's title: the module name pages show. */
  title: string;
  version?: string;
  theme?: Theme;
  /** The site's absolute URL with a trailing slash: canonical links and sitemap.xml. */
  baseUrl?: string;
  /** A source-link template with {path} and {line} (and {ref}, the theme's sourceRef). */
  sourceLink?: string;
  /** The suite's path in its repository, which {path} starts with. */
  sourceRoot?: string;
  links?: LinkMapping[];
  includeDrafts?: boolean;
  extraKeys?: string[];
}

export interface SuiteSite {
  model: Model;
  /** The rendered site, as render() returns it: paths to contents or renderer assets. */
  output: Output;
  /** The suite's own files to copy into the site, such as images. */
  copies: CopiedFile[];
  result: ImportResult;
  diagnostics: Diagnostic[];
}

export function suiteSite(dir: string, options: SuiteSiteOptions): SuiteSite {
  const { files, assets } = readSuite(dir);
  const result = importMarkdown(files, {
    suite: options.id,
    assets,
    ...(options.links ? { links: options.links } : {}),
    ...(options.includeDrafts ? { includeDrafts: true } : {}),
    ...(options.extraKeys ? { extraKeys: options.extraKeys } : {}),
    ...(options.sourceRoot ? { sourceRoot: options.sourceRoot } : {}),
  });
  const model = guidesModel(result, { name: options.title, ...(options.version ? { version: options.version } : {}) });
  const theme: Theme = {
    ...options.theme,
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    ...(options.sourceLink ? { sourceLink: options.sourceLink } : {}),
  };
  return { model, output: render(model, theme), copies: result.files, result, diagnostics: result.diagnostics };
}
