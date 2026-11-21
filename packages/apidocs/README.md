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

## Guides

A module can carry narrative guides in `module.guides`: `{ id, slug, title, summary?, group?, order?, body?,
source? }`. The body is the same block tree as a documentation comment, plus `admonition` blocks (`tone`: note, tip,
important, warning, caution, apiNote, implSpec, implNote; optional `title`). Each guide is `guides/<slug>.html` and
`.md`. Its headings get readable anchors (the heading's `anchor`, or its text slugified), deduplicated with `-2`,
`-3`; level-2 and level-3 headings fill "On this page". A link targets a guide with `target: { id }` and a section
with `target: { id, section }`, from guides and from doc comments; an unresolved one renders as plain text, and the
output checker reports a link to a section that does not exist. Pages list ungrouped guides first, then each group
in the order of its first guide; inside each, guides with an `order` come first, lowest first. Guides appear on the
overview, in the navigator, in search (guides and sections), in `llms.txt` before the reference pages, in
`llms-full.txt` after the overview, and in `sitemap.xml`.

A model may name one guide as `module.overview`: that guide is the overview page (`index.html`) instead of a page
under `guides/`, and the package lists follow it when there are packages. A model with guides and no packages is a
guides-only site: no package block in the navigator, no package, type or A-Z index pages and no `element-list`; the
overview, search, `llms.txt`, `llms-full.txt`, Markdown twins and `sitemap.xml` cover the guides. A guide's
`navTitle` is its label in the navigator. A group's crumb links to the group's first guide when that guide has the
group's title, as a suite's `index.md` does.

## Markdown suites

`apidocs guides` builds a documentation site from a directory of Markdown files, with the same components, design and
outputs as an API reference. The importer (`src/import/markdown.ts`) reads the layout and frontmatter of Astro
Starlight's docs collection, so a suite written for Starlight imports unchanged.

```sh
bun src/cli.ts guides --src docs/user --id user --title "Komodo user guide" --out site/user \
  --theme theme.json --version 1.2.0 --base-url https://example.com/user/ \
  --source-link 'https://github.com/o/r/blob/main/{path}#L{line}' --source-root docs/user \
  --link ../developer/=../developer/ --link ../api/=https://example.com/api/
```

From the repository root, `bun run apidocs:guides -- <arguments>` runs the same command.

| Option | What it does |
| --- | --- |
| `--src`, `--id`, `--title`, `--out` | Required. The suite's directory; its id, which namespaces guide ids (`guide:<id>/<path>`); the site's title; the output directory. |
| `--theme <file>` | A theme JSON file, as for API sites. |
| `--version` | The version the top bar and `llms.txt` show. |
| `--base-url <url/>` | The site's address: canonical links and `sitemap.xml`. |
| `--source-link <template>`, `--source-root <path>` | Source links on every page: `{path}` is `<source-root>/<file>`, `{line}` is 1. |
| `--link <prefix>=<target>` | Repeatable. A link that leaves the suite, resolved from the suite's root, that starts with `prefix` goes to `target` plus the rest of its path. `target` is an absolute URL or a path from the site's root. A rest that names a Markdown file becomes that page in a site this command built: `index.md` is `index.html`, `a/b.md` is `guides/a/b.html`. |
| `--include-drafts` | Include pages with `draft: true`. |
| `--warn-only` | Report errors as warnings and write the site anyway. |
| `--assets <dir>` | Take the stylesheet, client script and fonts from a directory instead of the sources and `dist/assets/apidocs.js` (built when missing or stale). |

It writes the same files as an API site, plus the suite's images under `guides/`, and adds to `--out` without
deleting anything. Diagnostics go to stderr as `<src>/<file>:<line>: message` (`warning: ` before a warning's
message). The exit status is 1 when there is an error (nothing is written), 2 for bad arguments, and 0 otherwise,
with one JSON line of counts on stdout.

For programmatic use, `@elide/apidocs/import` exports `importMarkdown(files, options)`, `readSuite(dir)`,
`suiteSite(dir, options)`, `guidesModel(result, module)` and `formatDiagnostic`. The root export, `render.js` and the
client bundle do not include the importer.

`bun run dev --guides <dir>` serves a suite through the dev server; editing, adding or removing a file reloads the
page. The dev bar also offers the Markdown sample suite, `samples/guides`.

### What the importer reads

- **Files.** Every `.md` file is a page; paths become URLs, so names should be lower-case kebab-case (others are
  slugified, with a warning). The root `index.md` is the overview page. Each directory is a group, titled by its
  `index.md`; a nested directory is a group named `Parent › Child`. Pages read in this order: the overview, the root's
  other pages, then each group (its `index.md` first, then its pages, then its subgroups). Pages and groups sort by
  `sidebar.order` (a group by its index's), then by name.
- **Frontmatter.** `title` (required), `description` (the summary listings, search and `llms.txt` show; a warning when
  missing), `sidebar.label` (the navigator label; an `index.md` without one is "Overview"), `sidebar.order`, and
  `draft: true` (left out unless `--include-drafts`). Any other key is an error naming the file, line and key, unless
  `importMarkdown`'s `extraKeys` lists it (`template`, `sidebar.badge`).
- **Markdown.** CommonMark with GitHub's tables, task lists, strikethrough and autolinks; fenced code with its
  language (`text` without one); GitHub alerts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`) as
  admonitions. The title is the page's heading, so the body starts at `##`: `##` is a section and `###` a subsection
  in "On this page". `## Heading {#id}` sets a heading's anchor. HTML comments, the sync block among them, are
  dropped. Other raw HTML becomes a raw node, which the renderer passes through its allowlist sanitizer.
- **Links.** A relative link to a `.md` file becomes a reference to that guide, and a `#fragment` a reference to its
  section; both are checked at import. A fragment matches the renderer's anchor, the heading's `{#id}` or GitHub's
  slug of the heading. A missing file or heading, a link outside the suite with no `--link` mapping, and an unsafe URL
  are errors with file and line. A link to a draft that is left out is a warning and shows as text. Absolute URLs
  pass through `safeUrl()`.
- **Images.** `![alt](path "title")` with the image in the suite is copied to `guides/<path>` and gets its width and
  height from the file (PNG, GIF, JPEG, WebP, SVG). The alternative text is required. A link to an image in the suite
  copies it too.

### Copied files and hosting

Only images are copied: `png`, `jpg`, `jpeg`, `gif`, `webp`, `avif` and `svg`, by the final extension. A name with a
second document-like extension (`shot.html.png`) or ending in a dot or a space is refused, and so is every other
type, with an error at the link. An SVG is rebuilt from an allowlist of drawing elements and presentation attributes
(`src/import/svg.ts`): scripts, styles, `foreignObject`, embedded images, links, animation and event handlers go, an
`href` survives only as a `#fragment` and `url()` only as `url(#fragment)`. An SVG with a DOCTYPE, CDATA or markup
that does not parse is refused. Symbolic links in the suite are not followed, and files are written from the bytes
read at import.

A host should serve the copied files under `guides/` with `X-Content-Type-Options: nosniff`, and anything that is not
an image the pages embed with `Content-Security-Policy: sandbox`.

### Not supported

- MDX (`.mdx` pages are an error) and Starlight components and asides (`:::note`); use GitHub alerts.
- Footnotes (an error at the reference and the definition).
- Downloads other than images, raw `<img>` and other embedded media in HTML (the sanitizer drops them), and image
  sizes set in Markdown.
- Starlight frontmatter beyond `title`, `description`, `sidebar.label`, `sidebar.order` and `draft`: `template`,
  `hero`, `banner`, `sidebar.badge`, `sidebar.hidden` and the rest are errors unless accepted as extra keys, and then
  ignored.
- Redirects, `lastUpdated`, edit links other than the source link, and ordered lists that start at a number other
  than 1.

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
- the Markdown importer (`test/import.test.ts`): each construct, the diagnostics fixture
  (`test/fixtures/guides-errors`), hostile Markdown and SVG, copied-file rules, the sample suite as a guides-only site
  through the output checker, the CLI, and Komodo's two suites when this package sits inside Komodo;
- in Chromium, a site built with `dist/runner.mjs` opened from `file://` with JavaScript on and off, and axe on the
  page shell in light and dark; the same for the Markdown sample suite built with `apidocs guides`
  (`test/guides-browser.test.ts`). Locally, point `PLAYWRIGHT_BROWSERS_PATH` at a Playwright 1.65 browser directory, or
  install one with `bunx playwright install chromium`.
