/** The page shell: head, header, navigation, breadcrumbs, table of contents and footer. */
import type { ComponentChildren } from "preact";
import { usePage } from "../context";
import type { Package, Type } from "../model";
import { INDEX, isAbsolute, isThrowable, packagePage, relative, rootOf, typePage } from "../site";
import { typeGroups } from "../structure";
import type { Theme } from "../theme";
import { SYMBOLS, sym } from "../symbols";

export interface Crumb {
  label: string;
  page?: string;
}

export interface TocItem {
  id: string;
  label: string;
  depth: number;
  code?: boolean;
}

/**
 * Runs before first paint: applies a stored theme choice, and marks the page as scripted so the controls that
 * need the script take their space at once instead of appearing (and moving the page) when the bundle loads.
 */
const THEME_BOOT =
  'var d=document.documentElement;d.setAttribute("data-js","");' +
  // A page opened from disk cannot read its neighbors, so the controls that need to are left out there.
  'if(location.protocol==="file:")d.setAttribute("data-file","");' +
  // Color emoji are used only where the platform draws them well; elsewhere the drawn icons stay.
  'try{if(!/Win/.test((navigator.userAgentData&&navigator.userAgentData.platform)||navigator.platform||""))d.setAttribute("data-emoji","")}catch(e){}' +
  // Coming from another page of this site: finish the load bar that page started.
  'try{if(sessionStorage.getItem("apidocs-load")){sessionStorage.removeItem("apidocs-load");d.setAttribute("data-arriving","")}}catch(e){}' +
  'try{var t=localStorage.getItem("apidocs-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}';

/** The width that keeps an SVG's aspect ratio at a height, from its viewBox, so the image reserves its box before it loads. */
function logoWidth(svg: string, height: number): number | undefined {
  const box = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(svg);
  if (!box) return undefined;
  const w = Number(box[1]);
  const h = Number(box[2]);
  return w > 0 && h > 0 ? Math.round((height * w) / h) : undefined;
}

/** Restores the navigator's scroll position as soon as it is parsed, so it never jumps after paint. */
const NAV_BOOT =
  '(function(){var n=document.getElementById("apidocs-nav");if(!n)return;try{var k="apidocs-nav:"+new URL(document.documentElement.getAttribute("data-root")||"./",location.href).pathname;var s=sessionStorage.getItem(k);if(s)n.scrollTop=+s}catch(e){}var c=n.querySelector(\'[aria-current="page"]\');if(c&&(c.offsetTop<n.scrollTop||c.offsetTop>n.scrollTop+n.clientHeight-40))n.scrollTop=Math.max(0,c.offsetTop-n.clientHeight/3)})()';

/**
 * Preloads the upright font files, so they are ready at first paint. Done from the head script, not with link
 * elements in the markup, because a font preload is a cross-origin request and a page opened from file:// has
 * no origin to make one with: there the links would fail and log errors, and the faces load from CSS as usual.
 */
function fontPreload(fonts: Theme["fonts"], root: string): string {
  const urls = (fonts ?? [])
    .filter(face => face.preload ?? (face.style ?? "normal") === "normal")
    .map(face => `${root}assets/${face.asset}`);
  if (urls.length === 0) return "";
  const list = JSON.stringify(urls).replace(/</g, "\\u003c");
  return `;if(location.protocol!=="file:")${list}.forEach(function(h){var l=document.createElement("link");l.rel="preload";l.as="font";l.type="font/woff2";l.crossOrigin="anonymous";l.href=h;document.head.appendChild(l)})`;
}

/** Applies a stored "navigator hidden" choice on a wide screen, before the navigator is painted. */
const NAV_STATE_BOOT =
  'try{if(matchMedia("(min-width:861px)").matches&&localStorage.getItem("apidocs-nav")==="closed")document.getElementById("apidocs-nav-toggle").checked=true}catch(e){}';

export interface ShellProps {
  title: string;
  description: string;
  crumbs: Crumb[];
  toc: TocItem[];
  jsonLd: object;
  /** What the page documents, for machine-readable metadata. */
  meta?: PageMeta;
  children: ComponentChildren;
}

export interface PageMeta {
  kind: "module" | "package" | "type" | "guide";
  /** The declaration's stable id. */
  id?: string;
  package?: string;
  language?: string;
  /** Terms a search should find this page by, most specific first. */
  keywords?: string[];
}

export function Shell({ title, description, crumbs, toc, jsonLd, meta, children }: ShellProps) {
  const ctx = usePage();
  const { site, theme, page } = ctx;
  const root = rootOf(page);
  const name = page.split("/").pop()!;
  const product = theme.productName ?? site.model.module.name;
  const canonical = theme.baseUrl ? `${theme.baseUrl}${page}.html` : undefined;
  const m = site.model.module;
  // Where the machine-readable versions are: absolute when the site's address is known, else relative to this page.
  const at = (path: string, fromRoot: boolean) => (theme.baseUrl ? `${theme.baseUrl}${fromRoot ? path : `${page.slice(0, page.lastIndexOf("/") + 1)}${path}`}` : `${fromRoot ? root : ""}${path}`);
  const formats = {
    markdown: at(`${name}.md`, false),
    llms: at("llms.txt", true),
    full: at("llms-full.txt", true),
    model: at("api.json", true),
  };
  const keywords = [...new Set([...(meta?.keywords ?? []), m.name, ...(m.languages ?? []).map(languageName), "API reference"])].filter(Boolean);
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        ...jsonLd,
        "@context": undefined,
        headline: title,
        inLanguage: "en",
        keywords: keywords.join(", "),
        encoding: [{ "@type": "MediaObject", encodingFormat: "text/markdown", contentUrl: formats.markdown, name: "This page as Markdown" }],
        ...(m.version ? { version: m.version } : {}),
      },
      ...(crumbs.length > 1
        ? [{
            "@type": "BreadcrumbList",
            itemListElement: crumbs.map((crumb, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: crumb.label,
              item: theme.baseUrl ? `${theme.baseUrl}${crumb.page ?? page}.html` : relative(page, crumb.page ?? page, ".html"),
            })),
          }]
        : []),
      {
        "@type": "DataCatalog",
        name: `${product} machine-readable reference`,
        description: "The same reference as Markdown and JSON, for programs and AI agents.",
        dataset: [
          { "@type": "Dataset", name: "llms.txt", description: "Index of every page as Markdown links.", encodingFormat: "text/markdown", url: formats.llms },
          { "@type": "Dataset", name: "llms-full.txt", description: "The whole reference in one Markdown file.", encodingFormat: "text/markdown", url: formats.full },
          { "@type": "Dataset", name: "api.json", description: "The apidocs/1 model of the module.", encodingFormat: "application/json", url: formats.model },
        ],
      },
    ],
  };
  return (
    <html lang="en" data-root={root || "./"}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords.join(", ")} />
        <meta name="generator" content="apidocs" />
        <meta name="color-scheme" content="light dark" />
        {/* What this page documents, for programs that read pages. */}
        <meta name="apidocs:kind" content={meta?.kind ?? "module"} />
        <meta name="apidocs:module" content={m.name} />
        {m.version && <meta name="apidocs:version" content={m.version} />}
        {meta?.id && <meta name="apidocs:id" content={meta.id} />}
        {meta?.package && <meta name="apidocs:package" content={meta.package} />}
        {meta?.language && <meta name="apidocs:language" content={meta.language} />}
        <meta property="og:type" content={meta?.kind === "module" || !meta ? "website" : "article"} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:site_name" content={product} />
        {canonical && <meta property="og:url" content={canonical} />}
        <meta name="twitter:card" content="summary" />
        {canonical && <link rel="canonical" href={canonical} />}
        {/* The same content for programs and AI agents: this page as Markdown, the index, the whole reference, the model. */}
        <link rel="alternate" type="text/markdown" href={`${name}.md`} title="This page as Markdown" />
        <link rel="alternate" type="text/markdown" href={`${root}llms.txt`} title="llms.txt: index of every page, as Markdown links" />
        <link rel="alternate" type="text/markdown" href={`${root}llms-full.txt`} title="llms-full.txt: the whole reference in one Markdown file" />
        <link rel="alternate" type="application/json" href={`${root}api.json`} title="api.json: the apidocs/1 model of this module" />
        <link rel="index" href={`${root}index.html`} title={`${product} API reference`} />
        <link rel="stylesheet" href={`${root}assets/apidocs.css`} />
        <link rel="stylesheet" href={`${root}assets/theme.css`} />
        {theme.favicon && <link rel="icon" type="image/svg+xml" href={`${root}assets/favicon.svg`} />}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT + fontPreload(theme.fonts, root) }} />
        <script defer src={`${root}assets/apidocs.js`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }} />
      </head>
      <body>
        <div class="loadbar" aria-hidden="true" />
        <a class="skip" href={`${name}.html#content`}>Skip to content</a>
        {/* One checkbox toggles the navigator with no script: it hides it on a wide screen and shows it on a narrow one. */}
        <header class="topbar">
          <input type="checkbox" id="apidocs-nav-toggle" class="nav-toggle visually-hidden" aria-label="Toggle navigation" autocomplete="off" />
          <script dangerouslySetInnerHTML={{ __html: NAV_STATE_BOOT }} />
          <label class="nav-button" for="apidocs-nav-toggle" title="Toggle navigation" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="16" height="16"><rect x="2" y="2.75" width="12" height="10.5" rx="2.25" /><path d="M6.25 2.75v10.5" /></svg>
          </label>
          <a class="brand" href={relative(page, INDEX, ".html")}>
            {theme.logo?.light && (
              <>
                <img class="logo logo-light" src={`${root}assets/logo-light.svg`} alt={theme.logo.alt ?? ""} height={22} width={logoWidth(theme.logo.light, 22)} />
                <img class="logo logo-dark" src={`${root}assets/logo-${theme.logo.dark ? "dark" : "light"}.svg`} alt={theme.logo.alt ?? ""} height={22} width={logoWidth(theme.logo.dark ?? theme.logo.light, 22)} />
              </>
            )}
            <span class="product">{product}</span>
          </a>
          <span class="module-version">
            {site.model.module.name !== product && <span>{site.model.module.name} </span>}
            {site.model.module.version && <span class="version">{site.model.module.version}</span>}
          </span>
          <div class="topbar-tools">
            <a class="search-fallback" href={`${relative(page, INDEX, ".html")}#all-types`}>All types</a>
            <div class="search" data-search data-js-only>
              <label class="visually-hidden" for="apidocs-search">Search the API</label>
              <input id="apidocs-search" type="search" placeholder="Search types and members" autocomplete="off" spellcheck={false}
                role="combobox" list={undefined} aria-expanded="false" aria-controls="apidocs-results" aria-autocomplete="list" />
              <kbd class="search-key" aria-hidden="true">/</kbd>
              <ul id="apidocs-results" class="search-results" role="listbox" aria-label="Search results" hidden />
            </div>
            {(theme.links?.header ?? []).map(link => <a key={link.url} class="topbar-link" href={link.url}>{link.label}</a>)}
            <button type="button" class="theme-switch" data-theme-switch data-js-only aria-label="Color theme: system">
              {/* The drawn icon everywhere; a sun or a moon where the platform's emoji are good (data-emoji). */}
              <span aria-hidden="true" class="theme-icon" />
              <span aria-hidden="true" class="theme-emoji" />
            </button>
          </div>
        </header>
        <div class="layout">
          <Navigation />
          <script dangerouslySetInnerHTML={{ __html: NAV_BOOT }} />
          <main id="content" class="content">
            {/* For programs that read the page as text: where the other forms are. Not shown, not read aloud. */}
            <p class="visually-hidden" aria-hidden="true" data-agent-note>
              {`Machine-readable versions of this page. Markdown: ${formats.markdown} . Index of every page (llms.txt): ${formats.llms} . The whole reference in one Markdown file: ${formats.full} . The API model as JSON (apidocs/1): ${formats.model} .`}
            </p>
            <div class="page-tools">
              <Breadcrumbs crumbs={crumbs} />
              <PageActions name={name} root={root} canonical={canonical} title={title} />
            </div>
            {children}
          </main>
          <Toc items={toc} />
        </div>
        <footer class="footer">
          <p>
            {theme.footer && <span>{theme.footer} </span>}
            <a href={`${name}.md`}>This page as Markdown</a>
            {", "}
            <a href={`${root}llms.txt`}>llms.txt</a>
            {", "}
            <a href={`${root}api.json`}>api.json</a>
          </p>
          {(theme.links?.footer ?? []).length > 0 && (
            <p class="footer-links">{theme.links!.footer!.map(link => <a key={link.url} href={link.url}>{link.label}</a>)}</p>
          )}
        </footer>
      </body>
    </html>
  );
}

/** The Markdown mark (Dustin Curtis's, public domain), in the text color. */
export function MarkdownIcon() {
  return (
    <svg class="icon icon-markdown" viewBox="0 0 208 128" width="19" height="12" aria-hidden="true">
      <rect x="5" y="5" width="198" height="118" rx="14" fill="none" stroke="currentColor" stroke-width="10" />
      <path fill="currentColor" d="M30 98V30h20l20 25 20-25h20v68H90V59L70 84 50 59v39zm125 0l-30-33h20V30h20v35h20z" />
    </svg>
  );
}

const LANGUAGE_NAME: Record<string, string> = { java: "Java", kotlin: "Kotlin" };

export function languageName(language: string): string {
  return LANGUAGE_NAME[language] ?? language;
}

/**
 * A language's mark, drawn for these pages in the same weight as the other icons: a cup for Java, the folded
 * square for Kotlin. With `label`, the name follows; without, the title carries it.
 */
export function LanguageMark({ language, label }: { language: string; label?: boolean }) {
  const name = languageName(language);
  const art = language === "kotlin"
    ? <path d="M3 3h10L8 8l5 5H3z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
    : language === "java"
      ? (
        <g fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7.5h7.5v2.25a3.75 3.75 0 0 1-7.5 0z" />
          <path d="M10.5 8.25h.9a1.6 1.6 0 0 1 0 3.2h-1.2" />
          <path d="M5.4 2.4c-.9 1 .9 1.7 0 2.8M8.1 2.4c-.9 1 .9 1.7 0 2.8" />
        </g>
      )
      : null;
  return (
    <span class="lang" data-lang={language} title={label ? undefined : name}>
      {art && <svg class="icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">{art}</svg>}
      {label ? <span>{name}</span> : <span class="visually-hidden">{name}</span>}
    </span>
  );
}

/** The languages a package's declarations are written in. */
export function packageLanguages(pkg: Package, fallback: string[] | undefined): string[] {
  const found = new Set<string>((pkg.types ?? []).map(t => t.language));
  if (pkg.functions?.length || pkg.properties?.length || pkg.typeAliases?.length) found.add("kotlin");
  return found.size ? [...found].sort() : (fallback ?? []);
}

/**
 * The page's other forms, as one small split button at the top of every page. The mark copies the page as
 * Markdown; the arrow opens the rest: the Markdown file, the index, the whole reference, the model. Copying needs
 * the script and a server (a page opened from disk cannot read the file beside it); without either, the mark is
 * a plain link to the Markdown file and looks the same.
 */
function PageActions({ name, root, canonical, title }: { name: string; root: string; canonical: string | undefined; title: string }) {
  const markdown = canonical ? canonical.replace(/\.html$/, ".md") : undefined;
  const ask = markdown ? encodeURIComponent(`Read ${markdown} so that I can ask questions about ${title}.`) : undefined;
  const out = sym("utf", "external");
  return (
    <div class="formats">
      <button type="button" class="formats-main" data-copy-markdown={`${name}.md`} data-js-only data-served-only
        aria-label="Copy this page as Markdown" title="Copy this page as Markdown">
        <MarkdownIcon />
        <svg class="icon formats-done" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <a class="formats-main" href={`${name}.md`} data-static-only aria-label="This page as Markdown" title="This page as Markdown">
        <MarkdownIcon />
      </a>
      <details class="formats-menu">
        <summary aria-label="Other formats of this page" title="Other formats">
          <svg class="icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 6.25 8 10.25l4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </summary>
        <ul class="formats-list">
          <li><a href={`${name}.md`}><code>{name.split("/").pop()}.md</code><small>this page as Markdown</small></a></li>
          <li><a href={`${root}llms.txt`}><code>llms.txt</code><small>index of every page</small></a></li>
          <li><a href={`${root}llms-full.txt`}><code>llms-full.txt</code><small>the whole reference</small></a></li>
          <li><a href={`${root}api.json`}><code>api.json</code><small>the model</small></a></li>
          {ask && <li class="formats-sep"><a href={`https://claude.ai/new?q=${ask}`} rel="noopener"><span>Open in Claude</span><small>{out}</small></a></li>}
          {ask && <li><a href={`https://chatgpt.com/?q=${ask}`} rel="noopener"><span>Open in ChatGPT</span><small>{out}</small></a></li>}
        </ul>
      </details>
    </div>
  );
}

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const { page } = usePage();
  if (crumbs.length < 2) return null;
  return (
    <nav class="crumbs" aria-label="Breadcrumbs">
      <ol>
        {crumbs.map((crumb, i) => (
          <li key={i}>
            {crumb.page && i < crumbs.length - 1
              ? <a href={relative(page, crumb.page, ".html")}>{crumb.label}</a>
              : <span aria-current={i === crumbs.length - 1 ? "page" : undefined}>{crumb.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The longest dotted prefix every package name shares, so rows show only what differs. */
export function sharedPrefix(names: string[]): string {
  const named = names.filter(Boolean);
  if (named.length === 0) return "";
  let parts = named[0]!.split(".");
  if (named.length === 1) parts = parts.slice(0, -1);
  for (const name of named.slice(1)) {
    const other = name.split(".");
    let i = 0;
    while (i < parts.length && i < other.length && parts[i] === other[i]) i++;
    parts = parts.slice(0, i);
  }
  // A package equal to the prefix would have an empty label: keep its last segment.
  if (named.some(name => name === parts.join("."))) parts = parts.slice(0, -1);
  return parts.join(".");
}

/** One letter per kind, as IDEs show them. Read with the row's title; hidden from assistive technology. */
export function kindGlyph(type: Type): { letter: string; tone: string } {
  if (type.kind === "class" && isThrowable(type)) return { letter: SYMBOLS.exception.utf, tone: "exception" };
  switch (type.kind) {
    case "interface": return { letter: "I", tone: "interface" };
    case "record": return { letter: "R", tone: "record" };
    case "enum": return { letter: "E", tone: "enum" };
    case "annotation": return { letter: "@", tone: "annotation" };
    case "object": return { letter: "O", tone: "object" };
    default: return { letter: "C", tone: "class" };
  }
}

/**
 * The navigator. Two flat lists, never a tree of disclosures: every package by
 * the part of its name that differs, then the current package's types by kind.
 * A row is one line and truncates; its title carries the full name. Nested
 * types appear only along the current page's nesting chain, so a type with
 * hundreds of nested types does not repeat them on every page.
 */
function Navigation() {
  const { site, page } = usePage();
  const current = currentType(site.types, page);
  const currentPkg = current ? site.types.get(current.id)!.pkg : site.packages.find(pkg => packagePage(pkg) === page);
  const prefix = sharedPrefix(site.packages.map(pkg => pkg.name));
  const chain = new Set<string>();
  for (let t: Type | undefined = current; t; t = t.enclosing ? site.types.get(t.enclosing)?.type : undefined) chain.add(t.id);
  const tops = (currentPkg?.types ?? []).filter(t => !t.enclosing);
  return (
    <nav class="sidebar" id="apidocs-nav" aria-label="Packages and types">
      <div class="nav-filter" data-nav-filter data-js-only>
        <label class="visually-hidden" for="apidocs-nav-filter">Filter this list</label>
        <input id="apidocs-nav-filter" type="search" placeholder="Filter" autocomplete="off" spellcheck={false} />
      </div>
      <section class="nav-section">
        <h2 class="nav-heading"><span>Packages</span></h2>
        {prefix && (
          <a class="nav-row nav-prefix" href={relative(page, INDEX, ".html")} title={`${prefix}: the prefix every package shares`}>
            <span class="nav-label">{prefix}</span>
          </a>
        )}
        <ul class={prefix ? "nav-list nav-suffixes" : "nav-list"}>
          {site.packages.map(pkg => {
            const here = packagePage(pkg) === page;
            const label = pkg.name ? (prefix ? pkg.name.slice(prefix.length + 1) : pkg.name) : "(default package)";
            const count = (pkg.types ?? []).filter(t => !t.enclosing).length;
            return (
              <li key={pkg.id}>
                <a class="nav-row nav-package" href={relative(page, packagePage(pkg), ".html")} title={pkg.name}
                  aria-current={here ? "page" : undefined} data-open={pkg === currentPkg ? "" : undefined}>
                  <span class="nav-label">{prefix && <span class="nav-dot" aria-hidden="true">.</span>}{label}</span>
                  {count > 0 && <span class="nav-count">{count}</span>}
                </a>
              </li>
            );
          })}
        </ul>
      </section>
      {currentPkg && typeGroups(tops).map(group => (
        <section key={group.id} class="nav-section">
          <h2 class="nav-heading"><span>{group.title}</span></h2>
          <NavTypes types={group.types} pkg={currentPkg} chain={chain} />
        </section>
      ))}
    </nav>
  );
}

function NavTypes({ types, pkg, chain }: { types: Type[]; pkg: Package; chain: Set<string> }) {
  const { site, page } = usePage();
  const mixed = (site.model.module.languages ?? []).length > 1;
  return (
    <ul class="nav-list">
      {types.map(type => {
        const target = typePage(pkg, type);
        const all = site.types.get(type.id)!.nested;
        const nested = chain.has(type.id) ? all : [];
        const glyph = kindGlyph(type);
        return (
          <li key={type.id}>
            <a class="nav-row" href={relative(page, target, ".html")} title={`${type.name} (${type.kind})`}
              aria-current={target === page ? "page" : undefined} data-open={chain.has(type.id) ? "" : undefined}>
              <span class="glyph" data-tone={glyph.tone} aria-hidden="true">{glyph.letter}</span>
              <span class="nav-label">{type.name.split(".").pop()}</span>
              {mixed && <LanguageMark language={type.language} />}
              {all.length > 0 && <span class="nav-count" title={`${all.length} nested types`}>{all.length}</span>}
            </a>
            {nested.length > 0 && <div class="nav-nested"><NavTypes types={nested} pkg={pkg} chain={chain} /></div>}
          </li>
        );
      })}
    </ul>
  );
}

function currentType(types: Map<string, { type: Type; page: string }>, page: string): Type | undefined {
  for (const entry of types.values()) if (entry.page === page) return entry.type;
  return undefined;
}

/** Sections with more entries than this start collapsed in the rail; the script opens the one in view. */
const TOC_OPEN_LIMIT = 12;

/**
 * "On this page": the page's sections, each with a count of its entries. A long
 * section's entries sit behind a disclosure, so a type with hundreds of members
 * gives a rail of a few lines, not hundreds.
 */
function Toc({ items }: { items: TocItem[] }) {
  const name = usePage().page.split("/").pop()!;
  if (items.length === 0) return <div class="toc-spacer" />;
  const sections: { head: TocItem; entries: TocItem[] }[] = [];
  for (const item of items) {
    if (item.depth === 1 || sections.length === 0) sections.push({ head: item, entries: [] });
    else sections[sections.length - 1]!.entries.push(item);
  }
  const link = (item: TocItem) => (
    <a href={`${name}.html#${item.id}`} data-toc-target={item.id} title={item.label}>{item.code ? <code>{item.label}</code> : item.label}</a>
  );
  const hasEntries = sections.some(section => section.entries.length > 0);
  return (
    <nav class="toc" aria-label="On this page">
      <p class="toc-title">On this page</p>
      {hasEntries && (
        <div class="toc-filter" data-toc-filter data-js-only>
          <label class="visually-hidden" for="apidocs-toc-filter">Filter members</label>
          <input id="apidocs-toc-filter" type="search" placeholder="Filter members" autocomplete="off" spellcheck={false} />
        </div>
      )}
      <ol class="toc-list">
        {sections.map(({ head, entries }) => (
          <li key={head.id} class="toc-section">
            <div class="toc-head">
              {link(head)}
              {entries.length > 0 && <span class="toc-count">{entries.length}</span>}
            </div>
            {entries.length > 0 && entries.length <= TOC_OPEN_LIMIT && (
              <ol class="toc-entries">{entries.map(entry => <li key={entry.id}>{link(entry)}</li>)}</ol>
            )}
            {entries.length > TOC_OPEN_LIMIT && (
              <details class="toc-more">
                <summary>Show all {entries.length}</summary>
                <ol class="toc-entries">{entries.map(entry => <li key={entry.id}>{link(entry)}</li>)}</ol>
              </details>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** A link to an absolute URL or a page, for theme links. */
export function hrefFor(page: string, url: string): string {
  return isAbsolute(url) ? url : relative(page, url, "");
}
