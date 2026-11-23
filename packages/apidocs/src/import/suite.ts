/**
 * A Markdown suite as a site: read the directory, import it, and render the guides-only model with the theme. The
 * CLI (`apidocs guides`) and the dev server share this; it writes nothing.
 */
import type { Model } from "../model";
import { type Output, render } from "../render";
import type { Theme } from "../theme";
import { type DiagramRenderer, drawDiagrams } from "./diagrams";
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
  /**
   * How to draw the suite's Mermaid diagrams: a factory for a renderer, or false to leave them undrawn (their pages
   * show the source). The default starts Chromium (mermaidRenderer) only when the suite has a diagram.
   */
  diagrams?: (() => Promise<DiagramRenderer>) | false;
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

export async function suiteSite(dir: string, options: SuiteSiteOptions): Promise<SuiteSite> {
  const { files, assets } = readSuite(dir);
  const result = importMarkdown(files, {
    suite: options.id,
    assets,
    ...(options.links ? { links: options.links } : {}),
    ...(options.includeDrafts ? { includeDrafts: true } : {}),
    ...(options.extraKeys ? { extraKeys: options.extraKeys } : {}),
    ...(options.sourceRoot ? { sourceRoot: options.sourceRoot } : {}),
  });
  if (result.diagrams.length && options.diagrams !== false) {
    const factory = options.diagrams ?? (async () => (await import("./mermaid")).mermaidRenderer());
    let renderer: DiagramRenderer | undefined;
    try {
      renderer = await factory();
    } catch (failure) {
      const cause = failure instanceof Error ? failure.message.split("\n")[0] : String(failure);
      const first = result.diagrams[0]!;
      result.diagnostics.push({ file: first.path, line: first.line, severity: "error", message: `Mermaid diagrams need Chromium: run bunx playwright install chromium (${cause})` });
    }
    if (renderer) await drawDiagrams(result, renderer);
  }
  const model = guidesModel(result, { name: options.title, ...(options.version ? { version: options.version } : {}) });
  const theme: Theme = {
    ...options.theme,
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    ...(options.sourceLink ? { sourceLink: options.sourceLink } : {}),
  };
  return { model, output: render(model, theme), copies: result.files, result, diagnostics: result.diagnostics };
}
