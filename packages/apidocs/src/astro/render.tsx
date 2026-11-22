/**
 * One page as the pieces ApidocsPage.astro assembles: the head's metadata, and the body split at the places
 * where Astro adds its own content. The page is rendered by the static renderer's components (Shell in its
 * "astro" variant), then its URLs are mapped to the Astro form (urls.ts).
 */
import { renderToString } from "preact-render-to-string";
import { HOLES, type Hole, ModuleVersion, ShellVariantContext } from "../components/chrome";
import { Ctx, type PageContext } from "../context";
import type { Model } from "../model";
import { type Theme, themeCss } from "../theme";
import { siteOf } from "./pages";
import { prepareTheme } from "./text";
import { assertBase, rewriteHtml } from "./urls";

export interface RenderOptions {
  /** The site's base path, ending with a slash: "/api/komodo/main/". */
  base: string;
  /** The site's absolute URL, ending with a slash; canonical links and the JSON-LD use it. theme.baseUrl wins. */
  baseUrl?: string;
  /** Where a theme font file is served, from its asset path ("fonts/inter.woff2"). Defaults to the site's assets/. */
  fontUrl?: (asset: string) => string;
}

export interface PageParts {
  /** The head's elements: metadata, favicon, the boot script, JSON-LD. */
  head: string;
  /** The body, split at the holes: before the top-bar slot, before search, before the notice, the rest. */
  body: [string, string, string, string];
  /** What the top-bar slot shows when the app fills it with nothing: the module's name and version. */
  moduleVersion: string;
  /** The theme's tokens (on :root:root, so they win over the stylesheet's defaults in any order) and font faces. */
  themeCss: string;
  /** Font files to preload: the upright faces. */
  preload: string[];
  /** Whether the site has an API reference (packages), which decides the search field's wording. */
  api: boolean;
  /** The page's title. */
  title: string;
}

function between(html: string, open: string, close: string): string {
  const start = html.indexOf(open);
  const end = html.lastIndexOf(close);
  if (start < 0 || end < start) throw new Error(`apidocs: rendered page has no ${open}`);
  return html.slice(start + open.length, end);
}

/** Renders one page of a model (a page path from resolvePage) into the pieces of an Astro document. */
export function renderPage(model: Model, page: string, themeInput: Theme | string | undefined, options: RenderOptions): PageParts {
  const { site, pages } = siteOf(model);
  const entry = pages.get(page);
  if (!entry) throw new Error(`apidocs: no page ${JSON.stringify(page)} in ${model.module.name}`);
  const base = options.base.endsWith("/") ? options.base : `${options.base}/`;
  assertBase(base);
  const input = typeof themeInput === "string" ? (JSON.parse(themeInput) as Theme) : (themeInput ?? {});
  const theme = prepareTheme({ ...input, baseUrl: input.baseUrl ?? options.baseUrl });
  const ctx: PageContext = { site, theme, page, language: entry.language };
  const render = (node: preact.VNode) =>
    rewriteHtml(
      renderToString(
        <ShellVariantContext.Provider value={{ kind: "astro", persist: base }}>
          <Ctx.Provider value={ctx}>{node}</Ctx.Provider>
        </ShellVariantContext.Provider>,
      ),
      { page, base, baseUrl: theme.baseUrl },
    );
  const html = render(entry.html());
  const head = between(html, "<head>", "</head>");
  const parts = between(html, "<body>", "</body>").split(/<apidocs-hole name="([a-z]+)"><\/apidocs-hole>/);
  // split() with a capture group interleaves the hole names: [chunk, name, chunk, name, ...].
  const names = parts.filter((_, i) => i % 2 === 1) as Hole[];
  if (names.join() !== HOLES.join()) throw new Error(`apidocs: expected the holes ${HOLES.join(", ")}, got ${names.join(", ")}`);
  const chunks = parts.filter((_, i) => i % 2 === 0);
  const fontUrl = options.fontUrl ?? ((asset: string) => `${base}assets/${asset}`);
  const fonts = (theme.fonts ?? []).map(face => ({ ...face, asset: fontUrl(face.asset) }));
  return {
    head,
    body: chunks as PageParts["body"],
    moduleVersion: render(<ModuleVersion />),
    themeCss: themeCss({ ...theme, fonts }, ":root:root"),
    preload: fonts.filter(face => face.preload ?? (face.style ?? "normal") === "normal").map(face => face.asset),
    api: site.packages.length > 0,
    title: /<title>([\s\S]*?)<\/title>/.exec(head)?.[1] ?? "",
  };
}
