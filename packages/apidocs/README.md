# @elide/apidocs

Static API reference pages, as HTML and Markdown, from the `apidocs/1` model that Elide's Javadoc doclet and Dokka
plugin write. Pages are prerendered with Preact. They work from `file://`, from any path prefix and inside a
`-javadoc.jar`. Branding is a theme input; the package's own components carry none.

## What it builds

`bun run build` writes `dist/`:

| File | What it is |
| --- | --- |
| `render.js` | One classic script (IIFE) that defines the global `ApiDocs = { schema, render }`. Preact and the highlighter are inlined. `render(model, theme)` is a pure function: no file, network, Node, Bun or DOM API. |
| `runner.mjs` | Runs `render.js` in Bun or Node and writes the site. The JVM tools ship it with `render.js` and `assets/`. |
| `assets/` | `apidocs.css`, `apidocs.js` (the client islands, Preact inlined, loaded with `defer`) and the fonts the Elide preset uses. |
| `apidocs-1.schema.json` | The model's JSON Schema. `src/model.ts` is generated from it. |

```sh
node dist/runner.mjs --bundle dist/render.js --assets dist/assets --model api.json --theme theme.json --out site/
```

The runner prints `{"files":N,"bytes":N,"renderMs":N}` and exits 0, or prints the error and exits 1. It never reaches
the network.

## Output

Every page has an `.html` and an `.md` twin: `index`, `<package/path>/index` and `<package/path>/<Type>`, with nested
types as `Outer.Inner`. The root also holds `llms.txt`, `llms-full.txt`, `api.json`, `element-list` and `assets/`.
With a theme `baseUrl` it also has `sitemap.xml`, and pages carry canonical links. Every link is relative and names
its file. Scripts are classic. Search reads `assets/search-index.js`, which assigns a global, so nothing uses `fetch`.
With JavaScript off, pages keep all their content; only search, the theme switch, copy buttons and table-of-contents
tracking go away.

## Themes

A theme is JSON:

```json
{
  "extends": "elide",
  "productName": "Komodo",
  "links": { "header": [{ "label": "GitHub", "url": "https://github.com/elide-dev/komodo" }] },
  "sourceLink": "https://github.com/elide-dev/komodo/blob/{ref}/{path}#L{line}",
  "sourceRef": "main",
  "baseUrl": "https://example.com/api/",
  "tokens": { "light": { "accent": "#6d28d9" }, "dark": { "accent": "#c4b5fd" } },
  "css": ".member { scroll-margin-top: 80px; }"
}
```

The stylesheet reads only `--apidocs-*` custom properties; `tokens` sets them without the prefix (see the top of
`src/styles/apidocs.css` for the names). `extends` picks a preset. `neutral` is the default and is unbranded.
`elide` maps the tokens to `@elide/tokens` and takes its logo from `@elide/brand`. A theme can also set `logo`
(SVG markup for light and dark), `favicon`, `fonts` and `footer`.

## Development

From this directory (or from the repository root with `bun run apidocs:dev` and `bun run apidocs:sample`):

```sh
bun run dev                          # http://127.0.0.1:5180/, opens the browser
bun run dev --port 5190 --no-open
bun run dev --model ../../../../../bazel-bin/tools/release/komodo-api-api.json   # a real model
```

The dev server renders pages with the production `render()` and the same components, under
`/site/<model>/<preset>/`. Editing a component, the stylesheet, a theme preset, a sample or the `--model` file
reloads the page. In dev, the islands run as a module; the built pages load the `defer` bundle instead. The bar at the
top is for development only and is not part of any output. It switches the model (Java sample, Kotlin sample, the
`--model` file), the theme preset, light or dark, the viewport width, and JavaScript off for the current page.

To check the portable output in the same loop, build it exactly as the doclet will:

```sh
bun run sample                       # the Java sample, neutral theme, into dist/sample/java-neutral/
bun run sample --sample kotlin --preset elide --open      # opens it from file://
bun run sample --model path/to/api.json --serve           # serves it on http://127.0.0.1:5181/
bun run sample --runtime node        # run the runner with Node instead of Bun
```

It runs `bun run build` first (`--no-build` skips that), then `dist/runner.mjs`, and prints the `file://` URL.

### The samples

`samples/java.ts` and `samples/kotlin.ts` are hand-written models in the doclet's and the Dokka plugin's flavors.
One generated type has hundreds of members. [`samples/FEATURES.md`](samples/FEATURES.md) lists each feature and the
page that shows it, and says how to add one.

## Tests

`bun test` (turbo runs `build` first):

- the samples and the Komodo doclet's fixture model (`test/fixtures/fixture-java.api.json`) validate against the
  schema; `src/model.ts` and the Elide artwork module are current;
- HTML and Markdown snapshots of the fixture's pages;
- the output checker (`test/check.ts`) over every model and preset: no absolute URLs other than the model's externals
  and theme links, no module scripts, no `fetch`, and no link to a missing file or anchor;
- in Chromium, a site built with `dist/runner.mjs` opened from `file://` with JavaScript on and off, and axe on the
  page shell in light and dark. Locally, point `PLAYWRIGHT_BROWSERS_PATH` at a Playwright 1.65 browser directory, or
  install one with `bunx playwright install chromium`.
