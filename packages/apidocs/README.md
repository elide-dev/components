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
`href` survives only as a `#fragment` and `url()` only as a whole value `url(#fragment)`. A presentation value with a
backslash (a CSS escape) or a control character is dropped, and so is any `style`. An SVG with a DOCTYPE, CDATA or markup
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

### The top bar and the navigator

The top bar holds what belongs to the whole site: the navigator toggle, the brand, the version (or an Astro app's
version menu), a switcher between sibling documentation sites, search and the theme switch. The module's indexes
(Overview, Packages, All types, Index, Deprecated, as many as the site has) are at the top of the navigator, under the
filter: one line of links when there are at most two, else rows under "Reference", the current one marked.

`links.header` lists the sibling sites, such as a user guide, a developer guide and the API reference, in the order
the switcher shows them. Mark the entry that is this site with `"current": true`; without one, the entry whose URL is
the site's own root (`""`, `"./"`, `"index.html"`, or the theme's `baseUrl`) is current. The current entry links to
this site's overview. With no entries, or only this site, there is no switcher. Put other links, such as a
repository, in `links.footer`. Relative URLs in both lists are resolved from the site's root; a path that starts with
`/` and an absolute URL are written as given.

```json
{ "links": { "header": [
  { "label": "User guide", "url": "https://example.com/user/" },
  { "label": "API reference", "url": "https://example.com/api/", "current": true }
] } }
```

The switcher shows the sites as a row when the bar has room for it, else as one menu button that names the current
site and opens the list (a `<details>` menu that works without JavaScript; Escape and a click elsewhere close it).
Where the navigator is a drawer (860px and narrower), the drawer lists the sites first, and the bar shows the row
only when it fits. Nothing in the bar wraps, overflows or is cut off at any width from 320px: the search field
narrows first, then the switcher gives way, then the product name ends in an ellipsis. The browser's layout makes
the choice with no width written down; `src/styles/apidocs.css` (the top bar section) has the details.

## Astro

`@elide/apidocs/astro` serves the same pages from an Astro app (Astro 7), rendered on request or from models the app
has when it builds, with the same components and stylesheet.

Use the static renderer for output that must work anywhere: a `-javadoc.jar`, `file://`, any static host. Use the
Astro integration for a docs site you run: pages render on demand from models in storage, navigation goes through
Astro's client router (the top bar and the navigator stay put while the content cross-fades), and parts that change
more often than the pages, such as a version menu, come from server islands so the pages stay cacheable.

### URLs

A site lives under a base path that starts and ends with `/` (`/api/komodo/main/`; `/` itself is allowed). Under it:

| Page | Static file | Astro URL |
| --- | --- | --- |
| Overview | `index.html` | the base itself |
| Package | `com/example/geo/index.html` | `com/example/geo/` |
| Type, guide, index page | `com/example/geo/Circle.html` | `com/example/geo/Circle` |
| Anything else | `Circle.md`, `llms.txt`, `api.json`, ... | the same path |

The static paths redirect (301) to the Astro URLs, and so do `com/example/geo` (a package without its slash) and
`com/example/geo/Circle/`. Keep Astro's `trailingSlash` at `"ignore"`. Every link in a page is root-absolute in this
form.

### The contract

From `@elide/apidocs/astro` (`.astro` files and TypeScript; plain code outside Astro's Vite pipeline imports the
same functions from `@elide/apidocs/astro/helpers`):

- `resolvePage(model, path, theme?)`: what `path` (relative to the base, no leading slash) is.
  `{ kind: "page", page }`, `{ kind: "markdown", page }`, `{ kind: "file", name }`, `{ kind: "redirect", to }` or
  `{ kind: "missing" }`. `to` is relative to the base and never leaves it: no scheme, leading `/`, backslash or `..`.
- `<ApidocsPage model page theme base site? />`: the whole document for a page. Slots: `topbar` (replaces the module's
  version, beside the brand), `notice` (one line above the page) and `head`. Canonical URLs use `site`, else
  `Astro.site`, else the request's origin; a theme's `baseUrl` wins.
- `renderText(model, path, theme?)`: `{ body, contentType }` for a Markdown twin (`${page}.md`), `llms.txt`,
  `llms-full.txt`, `api.json`, `element-list`, `sitemap.xml` (when the theme has a `baseUrl`), the search index
  (`assets/search-index.js`, and `assets/search-index.json` in the Astro form), `assets/theme.css` and the theme's
  artwork. `llms.txt`, `llms-full.txt` and `element-list` render the whole site once per model object and keep only
  those three; everything else renders alone.
- `prefersMarkdown(accept)`, `linkHeader(base, page)` and `notFound(base, title, accept)`: serve a page's Markdown
  twin at its URL to a client that asks for Markdown, point at the other forms in a `Link` header, and answer a
  missing page with directions.
- `<VersionSelect versions current path />` and `<VersionNotice versions current path />`: a version menu for the top
  bar and a "not the latest release" line, each a fixed box (see "Server islands"). A `Version` is
  `{ id, label?, base, channel?: "release" | "prerelease" | "development", latest? }`.
- `apidocs(options)`, from `@elide/apidocs/astro/integration` in `astro.config`: routes for sites whose models the app
  has at build time.
- `assertBase(base)`: throws for a base that is not an absolute path with a single leading `/` and a trailing `/`.

The search island is Preact: the app needs `@astrojs/preact`. `apidocs()` adds it (and keeps one copy of Preact), so an
app that renders on request adds `apidocs()` with no sites. An app that also uses React gives each renderer `include`
patterns. Astro bundles the stylesheet, the client script and the Elide preset's fonts as hashed files under
`/_astro/`; a theme's tokens are inlined. Nothing under `assets/` needs copying unless a theme names its own fonts,
which resolve to `assets/fonts/...` under the base.

Keep the parsed model object between requests (per version, say): the site structure and each page's data are
cached in `WeakMap`s keyed by it.

### On request

The models live in storage; the app's own catch-all route does what `apidocs()` would:

```astro
---
// src/pages/api/[version]/[...path].astro
import { ApidocsPage, assertBase, linkHeader, notFound, prefersMarkdown, renderText, resolvePage } from "@elide/apidocs/astro";
import { loadModel } from "../../../models"; // the app's: api.json from R2, parsed once per version and kept

const { version } = Astro.params;
const base = `/api/${version}/`;
assertBase(base);
const model = await loadModel(version);
if (!model) return notFound("/api/", "API reference", Astro.request.headers.get("accept"));
const theme = { extends: "elide" as const, productName: "Komodo" };
const path = Astro.url.pathname.slice(base.length);
const resolved = resolvePage(model, path, theme);
if (resolved.kind === "redirect") return Astro.redirect(base + resolved.to + Astro.url.search, 301);
if (resolved.kind === "missing") return notFound(base, model.module.name, Astro.request.headers.get("accept"));
if (resolved.kind !== "page" || prefersMarkdown(Astro.request.headers.get("accept"))) {
  const text = renderText(model, resolved.kind === "file" ? resolved.name : `${resolved.page}.md`, theme);
  if (!text) return notFound(base, model.module.name, null);
  return new Response(text.body, { headers: { "content-type": text.contentType, vary: "Accept" } });
}
Astro.response.headers.set("vary", "Accept");
Astro.response.headers.set("link", linkHeader(base, resolved.page));
---
<ApidocsPage model={model} page={resolved.page} theme={theme} base={base} />
```

### At build time

```js
// astro.config.mjs
import cloudflare from "@astrojs/cloudflare";
import { apidocs } from "@elide/apidocs/astro/integration";
import { defineConfig } from "astro/config";

export default defineConfig({
  adapter: cloudflare(),
  integrations: [
    apidocs({
      sites: [
        { base: "/java/2.0/", model: "./models/java-2.0.json", theme: { extends: "elide" }, version: "2.0" },
        { base: "/java/main/", model: "./models/java-main.json", theme: { extends: "elide" }, version: "main" },
      ],
      versions: "./src/versions.ts", // exports `versions`, and optionally `loadVersions(request)`
    }),
  ],
});
```

`model` is a path from the project root to an `api.json`, or to a module whose default export is the model. Each site
gets a route at `${base}[...path]` that resolves, redirects, serves text (with Markdown negotiation and `Link`
headers) and renders pages, on request. With `versions`, the route puts the version menu and, on versions that are
not the latest release, the notice in server islands. `astro dev` reloads when a model, a component or a sample
changes, and updates the stylesheet in place.

### Server islands

A server island renders after the page, from its own request, so the page can be cached while the island shows
something newer. The pattern, as the integration uses it:

```astro
---
// VersionIsland.astro, the app's own: reads the newest versions.json on each request.
import { VersionSelect } from "@elide/apidocs/astro";
const { current, path } = Astro.props;
const versions = await loadVersionsFromR2(); // the app's
Astro.response.headers.set("cache-control", "public, max-age=60, stale-while-revalidate=600");
---
<VersionSelect versions={versions} current={current} path={path} />
```

```astro
<ApidocsPage model={model} page={page} theme={theme} base={base}>
  <VersionIsland server:defer slot="topbar" current={id} path={path}>
    <VersionSelect slot="fallback" versions={versionsWhenRendered} current={id} path={path} />
  </VersionIsland>
</ApidocsPage>
```

The fallback is the same component rendered from the versions known when the page rendered: a working menu with
JavaScript off, and the same closed box (the current version's label) as the island's, so the swap moves nothing.
`<VersionNotice>` goes in the `notice` slot the same way; render it only on versions that are not the latest release.
Island props travel encrypted in the island's URL, so set `ASTRO_KEY` (`astro create-key`) when pages outlive a
deploy, or cached pages will ask for islands with a key the new deploy cannot read.

### Caching

A page's HTML depends only on the model, the theme, the base and the site's origin: cache it per URL for as long as
the version's model does not change (a released version's never does), and vary it on `Accept` when Markdown
negotiation is on. What changes more often goes in server islands, which have their own `Cache-Control` (the
integration's: one minute, then stale while revalidating). The `/_astro/` files are named by their content and can be
cached for a year.

### Behaviors

| Behavior | How it runs on an Astro page |
| --- | --- |
| Search | A Preact island, `client:idle`, in the top bar. Loads `assets/search-index.json` on first focus or keystroke; opens results through the router. The top bar persists, so it hydrates once per site. |
| Theme switch, navigator toggle and `[`, copy buttons, copy as Markdown, member expand and collapse, open-on-hash, list filters, "On this page" tracking, menus | The static page's functions (`src/client/behaviors.tsx`), started on `astro:page-load` and stopped on `astro:before-swap` through one `AbortController` per page: no listener outlives its page. |
| Top bar and navigator | `transition:persist`, keyed by the site's base: across pages of one site they are the same elements, so the navigator keeps its scroll position and filter text without a script restoring them. Before each swap the client moves the new page's suite switcher and navigator blocks (the sites, the indexes with the current one marked, guides, packages and types) into them, around the kept filter field, and applies the kept filter text to the new rows. A top bar from another site is sized before it paints. |
| Theme and `data-js` | The head script sets them on first load; the client carries them to each new page's `<html>`, whose attributes the router replaces. |
| Load bar | Starts on `astro:before-preparation`, finishes on arrival, clears if the navigation is aborted. |
| Page transition | The router's view transition, with the static stylesheet's `::view-transition` rules: the content fades and rises 6px, the top bar and navigator do not move. The browser's cross-document transitions are off on Astro pages, so the two never both run. With reduced motion nothing animates. |
| Prefetch | The router's, on hover, for same-site links. The static pages' speculation rules are not on Astro pages. |
| Version menu and notice | Server islands; the client keeps their links on the page being read. |

The router announces each new page (its title) to assistive technology and restores scroll on back and forward;
focus starts from the top of the new page, except that a keyboard user who followed a navigator row stays on it.

The sample app, `apps/apidocs-astro`, serves the Java sample at `/java/2.0/` and `/java/main/`, the Kotlin sample at
`/kotlin/` and the Markdown sample suite at `/guides/`, on the Cloudflare adapter:

```sh
bun run apidocs:astro:dev            # astro dev on http://127.0.0.1:5190/
bun run apidocs:astro:build
bun run apidocs:astro:preview        # wrangler dev on http://127.0.0.1:5190/
bun run --cwd apps/apidocs-astro test   # builds, serves on 5191 (APIDOCS_ASTRO_PORT), and drives it in Chromium
```

Astro 7 runs `astro dev` in the background when it detects an AI agent; set `ASTRO_DEV_BACKGROUND=1` to keep it in the
foreground.

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
`--model` file), the theme preset, the number of sibling sites in the switcher (none, 1, 3 or 5), light or dark, the
viewport width, and JavaScript off for the current page.

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
- in Chromium, a site built with `dist/runner.mjs` opened from `file://` with JavaScript on and off, and axe on every
  page kind in light and dark; the same for the Markdown sample suite built with `apidocs guides`
  (`test/guides-browser.test.ts`); and the top bar (`test/topbar.test.ts`) at every width from 320 to 1600px in steps
  of 20, in the static and the Astro markup, with zero to five sibling sites, with and without a version menu, and
  with a long product name: nothing wraps, overflows or is cut off, and the switcher's menu and layout stability. Locally, point `PLAYWRIGHT_BROWSERS_PATH` at a Playwright 1.65 browser directory, or
  install one with `bunx playwright install chromium`.
- the Astro helpers (`test/astro.test.ts`): every page and text file of every sample resolves in both URL forms and
  renders as the static renderer does, head metadata equals the static page's apart from the URL form, and hostile
  links and paths never leave the site's base. The sample app's own suite drives the Astro pages in Chromium.
