/**
 * apidocs(options): the Astro integration for apps that have their models when they build (a local api.json, a
 * sample, an imported Markdown suite). It serves each site under its base with an injected route, adds the
 * Preact renderer the search island needs, and makes the models, themes and versions a virtual module, so
 * `astro dev` reloads when a model, a component or the stylesheet changes.
 *
 * Apps whose models arrive at request time (from R2, say) do not need it: they use resolvePage, renderText
 * and <ApidocsPage> in their own route. They still need the Preact renderer (`preact()` from
 * @astrojs/preact) for the search island; `apidocs()` with no sites adds just that.
 */
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import preact from "@astrojs/preact";
import type { AstroIntegration } from "astro";
import type { Theme } from "../theme";
import { assertBase } from "./urls";

export interface ApidocsSite {
  /** The site's base path, ending with a slash: "/java/2.0/". */
  base: string;
  /** The model: a path (from the project root) to an api.json, or to a module whose default export is the model. */
  model: string;
  theme?: Theme;
  /** The id of the version this site is, in `versions`; enables the version menu and notice. */
  version?: string;
}

export interface ApidocsOptions {
  sites?: ApidocsSite[];
  /**
   * The versions of the sites: a path to a JSON file (an array of Version), or to a module that exports
   * `versions` (what pages are rendered with) and optionally `loadVersions(request)`, which the version server
   * islands call on each request, so they can read the newest list while pages stay cached.
   */
  versions?: string;
}

const VIRTUAL = "virtual:@elide/apidocs/sites";

export function apidocs(options: ApidocsOptions = {}): AstroIntegration {
  const sites = options.sites ?? [];
  for (const site of sites) assertBase(site.base);
  return {
    name: "@elide/apidocs",
    hooks: {
      "astro:config:setup": ({ config, updateConfig, injectRoute, logger }) => {
        const root = fileURLToPath(config.root);
        const at = (path: string) => (isAbsolute(path) ? path : resolve(root, path));
        if (!config.integrations.some(i => i.name === "@astrojs/preact")) {
          updateConfig({ integrations: [preact()] });
        }
        if (config.trailingSlash !== "ignore") {
          logger.warn(`trailingSlash is "${config.trailingSlash}"; apidocs URLs need "ignore": packages end with a slash and types do not.`);
        }
        updateConfig({
          vite: {
            // One Preact: the pages render with this package's copy, and the search island with the renderer's.
            resolve: { dedupe: ["preact", "preact-render-to-string"] },
            plugins: [{
              name: "apidocs-sites",
              resolveId: id => (id === VIRTUAL ? `\0${VIRTUAL}` : undefined),
              load: id => {
                if (id !== `\0${VIRTUAL}`) return undefined;
                const lines = sites.map((site, i) => `import * as model${i} from ${JSON.stringify(at(site.model))};`);
                if (options.versions) lines.push(`import * as versionsModule from ${JSON.stringify(at(options.versions))};`);
                lines.push(
                  `const pick = m => m.default ?? m.model;`,
                  `export const sites = [${sites.map((site, i) => `{ base: ${JSON.stringify(site.base)}, model: pick(model${i}), theme: ${JSON.stringify(site.theme ?? {})}, version: ${JSON.stringify(site.version ?? null)} }`).join(", ")}];`,
                  options.versions
                    ? `const module = m => m;\nexport const versions = module(versionsModule).versions ?? module(versionsModule).default ?? [];\nexport const loadVersions = module(versionsModule).loadVersions ?? (async () => versions);`
                    : `export const versions = [];\nexport const loadVersions = async () => [];`,
                );
                return lines.join("\n");
              },
            }],
          },
        });
        for (const site of sites) {
          injectRoute({ pattern: `${site.base}[...path]`, entrypoint: new URL("./Route.astro", import.meta.url), prerender: false });
        }
      },
    },
  };
}

export default apidocs;
