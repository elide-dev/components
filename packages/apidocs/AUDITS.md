# Audits

`bun run audit` (or `bun run apidocs:audit` from the repository root) builds the samples with `dist/runner.mjs`,
exactly as the doclet does, serves each site on its own free localhost port, and runs three audits. It prints one table
row per audit target, writes full reports to a fresh temporary directory (its path is printed; `--out` picks one), and
exits 1 when a score is below its threshold.

```sh
export PLAYWRIGHT_BROWSERS_PATH=/path/to/ms-playwright   # a Playwright 1.65 browser directory (chromium-1254)
bun run audit                                  # both samples, both presets; Lighthouse on java-elide
bun run audit --only agentic,css               # no browser; about a second
bun run audit --only lighthouse --form-factor mobile
bun run audit --model path/to/api.json --preset elide    # a real model; Ir.html as the largest page if present
bun run audit --host agent                     # serve with Markdown negotiation and Link headers
bun run audit --threshold-lighthouse 95 --threshold-agentic 90 --threshold-css 0
```

To audit a site that is already served, such as the Astro sample app (`bun run apidocs:astro:preview`, or its
test server on port 5191), pass its base URL:

```sh
bun run audit --url http://127.0.0.1:5190/java/2.0/      # Lighthouse and agent readiness; nothing is built
```

The audit reads the site's `llms.txt` for its pages, fetches each at its Astro URL, and saves it in the static layout
(`X.html`, its links mapped back to the static form) for the checks that read files; the checks that make requests,
and Lighthouse, go to the server. The CSS audit needs the stylesheet files, so it runs on static builds only.

Other flags: `--sample java,kotlin`, `--preset neutral,elide`, `--page <path.html>` (the largest type page to use),
`--theme theme.json` (merged over the preset), `--lighthouse-sites first|all`, `--no-base-url`, `--no-build`, `--json`.
`test/audit.test.ts` covers the rule logic and runs the agent-readiness audit over the Java sample; it does not run
Lighthouse.

To compare two runs, keep each run's `--out` directory and diff `summary.md` (or `summary.json`).

## Thresholds

Every threshold defaults to 100. A Lighthouse row passes when the lowest of performance, accessibility, best practices
and SEO meets it. The agentic-browsing category (`AG` in the table) is reported, not gated. The agent-readiness row uses
the score below; the CSS row is the share of the nine mechanical good-css rules with no violation.

## Lighthouse

Lighthouse 13.6.0 (pinned) runs programmatically in the Chromium that Playwright installs, through chrome-launcher, once
per page and form factor (mobile is Lighthouse's default config; desktop uses `desktop-config.js`). It audits the module
overview, the package page with the most types, the smallest type page with real content, and the largest type page
(`ShapeCatalog.html` in the Java sample; `dev/elide/kotlin/api/Ir.html` in the Komodo model). Each run's JSON and HTML
report, and a summary of the failing weighted audits with their values, are in `lighthouse/`.

The pages are served the way a static host would serve them: brotli or gzip, `Cache-Control: public, max-age=31536000`
on `assets/` and revalidation on pages, strong ETags, a real 404. These results depend on the server, not the pages:
`uses-text-compression`, `cache-insight` (cache lifetimes), `modern-http-insight` (HTTP/2: the audit server speaks
HTTP/1.1, and Lighthouse does not flag HTTP/1.1 on localhost), `document-latency-insight`, `server-response-time`,
`redirects`, `is-on-https` (localhost counts as secure) and the security-header diagnostics (`csp-xss`, `has-hsts`,
`origin-isolation`, `clickjacking-mitigation`). The year-long asset cache is only safe on a real host if asset names
change with their content, which today they do not. Throttling is Lighthouse's simulated default, so performance on
a loaded machine still varies by a few points.

## Agent readiness ("is-agentic")

[Is Agentic](https://is-agentic.com) (Vercel Labs) scores a public website from 0 to 100 for AI agents. Its checks are
run by [Ora](https://ora.ai); its [methodology](https://is-agentic.com/methodology) describes the score. Its CLI,
[`is-agentic` on npm](https://www.npmjs.com/package/is-agentic), only fetches or starts a hosted scan of a public URL,
so it cannot audit localhost or a directory, and the audit never submits anything to it.

The check catalog and the scoring formula are public in every report (for example
[a report page](https://is-agentic.com/scan/vercel.com)) and at
[Ora's rules, version 2](https://ora.ai/api/ranker/releases/2/rules). `scripts/audit/agentic.ts` implements, locally,
the checks that apply to a documentation site (Ora's `content` site type):

- the 15 required checks: content without JavaScript, metadata completeness, JSON-LD, llms.txt exists, sitemap,
  noindex, robots.txt AI-crawler and agent-user policy, crawler reachability, bot detection, content behind auth,
  redirect hygiene, page token budget (100,000 characters of text), agent-friendly 404s, trust anchors;
- the gated checks that follow: llms.txt formatting and links, schema type breadth;
- the bonus checks a reference can earn: sitemap lastmod, agent instruction in llms.txt, Link headers, Markdown
  negotiation, and the five accessibility-tree checks (`ax-*`);
- the emerging, unscored checks: Markdown alternate link, `.md` URL fallback, Markdown frontmatter, code fences,
  Markdown agent docs, modular llms.txt.

The score follows Ora's formula: layer weights accessibility 30, discovery 20, usability 40 (payments has no checks
here); emerging checks unscored; bonus checks count only what they earn. It is an approximation of the hosted score:
Ora's partial-credit thresholds are not all published, and the values used are in the code next to each check. Is
Agentic's own display groups checks as Essential (80 points), Recommended (20) and Bonus (5); that grouping per site
type is not published, so the audit reports Ora's score.

Each finding names an owner: `page` (markup, CSS, client script), `output` (files the renderer writes: llms.txt,
sitemap.xml, robots.txt, 404 pages, JSON-LD content) or `host` (status codes, headers, negotiation). `--host agent`
serves each page's `.md` twin for `Accept: text/markdown` with `Vary: Accept` and adds Link headers, to show the score
with a host that does that.

Not testable locally: trust-anchor pages (about, contact, privacy belong to the host site; reported as not applicable),
a real host's WAF and bot rules (the local server treats every user agent alike), search ranking and brand
discoverability, Wikipedia presence, registry listings, and everything about APIs, OAuth, MCP servers and payments,
which do not apply to a generated reference.

## good-css.com

[good-css.com](https://good-css.com) is a guideline, not a tool: 47 modern CSS techniques in eight categories, each with
its rules and sources, written for agents ([llms.txt](https://good-css.com/llms.txt)). It has no score. Its
[agent skill](https://good-css.com/skills/good-css/SKILL.md) lists nine rules for all CSS, which `scripts/audit/css.ts`
checks mechanically over the shipped `assets/apidocs.css` and `assets/theme.css`, each violation with its line and
selector: logical properties (including multi-value margin and padding shorthands), `oklch()` colors with `none` as a
gray's hue, fluid sizes in `clamp()` rather than width breakpoints, `:hover` only inside
`@media (hover: hover) and (pointer: fine)`, `:focus-visible` and never `outline: none`, an `:active` state for
everything pressable (approximated: every `:hover` selector has a matching `:active`), motion inside
`prefers-reduced-motion: no-preference`, named transition properties without `all` or `ease-in` and at most 300 ms,
`overflow: clip` over `hidden`, and the declarations the skill leaves out on purpose. The 47 entries need judgment
about where they apply, so each gets a `review` row in the report with what the stylesheet shows; a person settles it.
