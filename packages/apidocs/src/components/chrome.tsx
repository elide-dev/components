/**
 * The page shell: head, header, navigation, breadcrumbs, table of contents and footer.
 *
 * Two renderers compose these parts. The static renderer (src/render.tsx) renders Shell into a whole document
 * that works from file:// and inside a jar. The Astro integration (src/astro/) renders the same Shell in its
 * "astro" variant: the same markup, minus what only a static site needs (its stylesheet links, the deferred
 * client bundle, speculation rules), plus the attributes the client router persists elements by and named holes
 * where Astro puts its own content (a slot in the top bar, the search island, a notice above the page).
 */
import { createContext, type ComponentChildren } from "preact";
import { useContext } from "preact/hooks";
import { type PageContext, usePage } from "../context";
import type { Package, Type } from "../model";
import { INDEX, PACKAGES_PAGE, TYPES_PAGE, guideNav, indexPages, isAbsolute, isThrowable, packagePage, relative, rootOf, type Site, typePage } from "../site";
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
 * Which document Shell renders. "static" (the default) is the static renderer's page. "astro" is the Astro
 * integration's: `persist` names the elements the client router keeps across navigations within one site.
 */
export type ShellVariant = { kind: "static" } | { kind: "astro"; persist: string };

export const ShellVariantContext = createContext<ShellVariant>({ kind: "static" });

function useVariant(): ShellVariant {
  return useContext(ShellVariantContext);
}

/** A named place in the astro variant's markup where the Astro component puts its own content. */
export const HOLES = ["topbar", "search", "notice"] as const;
export type Hole = (typeof HOLES)[number];

function HoleMark({ name }: { name: Hole }) {
  const Tag = "apidocs-hole" as "span";
  return <Tag {...({ name } as object)} />;
}

/** The attribute Astro's client router keeps an element by (what `transition:persist="id"` compiles to). */
function persistAttr(variant: ShellVariant, id: string): Record<string, string> {
  return variant.kind === "astro" ? { "data-astro-transition-persist": `${id}:${variant.persist}` } : {};
}

/**
 * Runs before first paint: applies a stored theme choice, and marks the page as scripted so the controls that
 * need the script take their space at once instead of appearing (and moving the page) when the bundle loads.
 */
export const THEME_BOOT =
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

/**
 * Where the navigator scrolls to show the current row: about a third of the way down, at a position where no row
 * lies partly under the sticky filter field, which covers the navigator's top once it is scrolled (a row half under
 * the field is a link with part of it covered). It picks the scroll position nearest the third whose field sits over
 * a gap between rows (a heading, the space between sections), with the current row still in view; at the top
 * nothing is under the field. Defined once, as a global the page's scripts call (apidocsNavTop), and used at once to
 * restore the navigator's position before it is painted.
 */
const NAV_BOOT =
  'window.apidocsNavTop=function(n,c){var m=n.scrollHeight-n.clientHeight,w=Math.max(0,Math.min(c.offsetTop-n.clientHeight/3,m)),i=n.querySelector(".nav-filter input"),' +
  'a=i?i.offsetTop:0,z=i?a+i.offsetHeight:0,best=0,end=0;' +
  'Array.prototype.forEach.call(n.querySelectorAll(".nav-row"),function(r){if(!r.offsetHeight)return;var t=r.offsetTop,s=t-z;' +
  'if(t-end>=z-a&&s>=0&&s<=m&&end<=s+a&&c.offsetTop>=s+z&&c.offsetTop+c.offsetHeight<=s+n.clientHeight&&Math.abs(s-w)<Math.abs(best-w))best=s;end=Math.max(end,t+r.offsetHeight)});' +
  'return best};' +
  '(function(){var n=document.getElementById("apidocs-nav");if(!n)return;try{var k="apidocs-nav:"+new URL(document.documentElement.getAttribute("data-root")||"./",location.href).pathname;var s=sessionStorage.getItem(k);if(s)n.scrollTop=+s}catch(e){}var c=n.querySelector(\'[aria-current="page"]\');if(c&&(c.offsetTop<n.scrollTop||c.offsetTop>n.scrollTop+n.clientHeight-40))n.scrollTop=apidocsNavTop(n,c)})()';

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

/** Pages of this site only: relative links to .html files. Other sites are never preloaded. */
const SPECULATION = JSON.stringify({
  prerender: [{ where: { selector_matches: "a[href$='.html']:not([href*='://']), a[href*='.html#']:not([href*='://'])" }, eagerness: "moderate" }],
});

/**
 * Sizes the suite switcher before first paint, and again whenever the script calls it (on resize). The layout
 * alone already shows the row or the menu (see SuiteSwitcher); this gives the switcher exactly the width of what it
 * shows, so a menu leaves no empty space for the search field, and takes the switcher out of a drawer layout's bar
 * when its row does not fit. The room it measures is what the tools would leave it with the search field at its
 * narrowest, so the decision never depends on the switcher's own width.
 */
export const SUITES_BOOT =
  'window.apidocsFitSuites=function(){var b=document.querySelector(".suites");if(!b)return;var t=b.parentElement,g=parseFloat(getComputedStyle(t).columnGap)||0,' +
  'a=t.clientWidth-(parseFloat(getComputedStyle(b).marginInlineStart)||0),r=0,l=b.querySelectorAll(".suites-ghost"),f=b.querySelector(".suites-floor"),' +
  // The search field's floor beside a switcher (a length in rem or px), not its floor once the switcher has left.
  'm=getComputedStyle(t).getPropertyValue("--apidocs-search-floor").trim(),q=parseFloat(m)*(/rem$/.test(m)?parseFloat(getComputedStyle(document.documentElement).fontSize):1)||0;' +
  'Array.prototype.forEach.call(t.querySelectorAll(".search,.theme-switch,.search-fallback"),function(e){var c=getComputedStyle(e);if(c.display==="none")return;a-=g+(e.classList.contains("search")?q:e.getBoundingClientRect().width)});' +
  'Array.prototype.forEach.call(l,function(e){r+=e.getBoundingClientRect().width});r+=(parseFloat(getComputedStyle(l[0].parentElement).columnGap)||0)*(l.length-1)+1;' +
  'var s=r<=a?"row":matchMedia("(min-width:861px)").matches?"menu":"none";b.setAttribute("data-fit",s);b.style.setProperty("--apidocs-suites-width",(s==="row"?r:f.getBoundingClientRect().width)+"px")};apidocsFitSuites()';

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
  kind: "module" | "package" | "type" | "guide" | "index" | "notfound";
  /** The declaration's stable id. */
  id?: string;
  package?: string;
  language?: string;
  /** Terms a search should find this page by, most specific first. */
  keywords?: string[];
}

/** Where a page's machine-readable versions are: absolute when the site's address is known, else relative to the page. */
export interface Formats {
  markdown: string;
  llms: string;
  full: string;
  model: string;
}

/**
 * A page's head metadata as data: what HeadMeta renders, and what a program can compare or reuse. URLs are in
 * the static renderer's form (relative, or under theme.baseUrl, naming .html files); the Astro integration maps
 * them to its own form after rendering.
 */
export interface HeadData {
  title: string;
  description: string;
  keywords: string[];
  /** The product the pages belong to: the theme's productName, else the module's name. */
  product: string;
  canonical?: string;
  /** name or property, and content, in document order. */
  meta: { name?: string; property?: string; content: string }[];
  /** The alternate and index links, in document order. */
  links: { rel: string; type?: string; href: string; title: string }[];
  formats: Formats;
  /** The JSON-LD graph. */
  jsonLd: object;
}

/** The head metadata of the page being rendered, from Shell's props. */
export function headData(ctx: PageContext, props: Pick<ShellProps, "title" | "description" | "crumbs" | "jsonLd" | "meta">): HeadData {
  const { site, theme, page } = ctx;
  const { title, description, crumbs, jsonLd, meta } = props;
  const root = rootOf(page);
  const name = page.split("/").pop()!;
  const product = theme.productName ?? site.model.module.name;
  // The not-found page is served at every missing URL: it names no canonical one.
  const canonical = theme.baseUrl && meta?.kind !== "notfound" ? `${theme.baseUrl}${page}.html` : undefined;
  const m = site.model.module;
  const at = (path: string, fromRoot: boolean) => (theme.baseUrl ? `${theme.baseUrl}${fromRoot ? path : `${page.slice(0, page.lastIndexOf("/") + 1)}${path}`}` : `${fromRoot ? root : ""}${path}`);
  const formats: Formats = {
    markdown: at(`${name}.md`, false),
    llms: at("llms.txt", true),
    full: at("llms-full.txt", true),
    model: at("api.json", true),
  };
  const keywords = [...new Set([...(meta?.keywords ?? []), m.name, ...(m.languages ?? []).map(languageName), ...(site.packages.length ? ["API reference"] : [])])].filter(Boolean);
  // Another page's URL in the graph: absolute under the base URL, else relative to this page, as the breadcrumbs are.
  const pageUrl = (target: string) => (theme.baseUrl ? `${theme.baseUrl}${target}.html` : relative(page, target, ".html"));
  const image = socialImageUrl(theme, root);
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        ...jsonLd,
        "@context": undefined,
        url: pageUrl(page),
        headline: title,
        inLanguage: "en",
        keywords: keywords.join(", "),
        encoding: [{ "@type": "MediaObject", encodingFormat: "text/markdown", contentUrl: formats.markdown, name: "This page as Markdown" }],
        ...(m.version ? { version: m.version } : {}),
        ...(image ? { image: { "@type": "ImageObject", url: image, width: theme.socialImage!.width, height: theme.socialImage!.height, caption: theme.socialImage!.alt } } : {}),
        // The overview lists what the site holds: the guides, then the packages.
        ...(page === INDEX && (site.guides.length > 0 || site.packages.length > 0)
          ? {
              hasPart: [
                ...site.guides.filter(g => g.page !== INDEX).map(g => ({ "@type": "TechArticle", name: g.guide.title, url: pageUrl(g.page) })),
                ...site.packages.map(pkg => ({ "@type": "APIReference", name: pkg.name || "(default package)", url: pageUrl(packagePage(pkg)) })),
              ],
            }
          : {}),
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
  const tags: HeadData["meta"] = [
    { name: "description", content: description },
    { name: "keywords", content: keywords.join(", ") },
    { name: "generator", content: "apidocs" },
    { name: "color-scheme", content: "light dark" },
    // What this page documents, for programs that read pages.
    { name: "apidocs:kind", content: meta?.kind ?? "module" },
    { name: "apidocs:module", content: m.name },
    ...(m.version ? [{ name: "apidocs:version", content: m.version }] : []),
    ...(meta?.id ? [{ name: "apidocs:id", content: meta.id }] : []),
    ...(meta?.package ? [{ name: "apidocs:package", content: meta.package }] : []),
    ...(meta?.language ? [{ name: "apidocs:language", content: meta.language }] : []),
    { property: "og:type", content: meta?.kind === "module" || !meta ? "website" : "article" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:site_name", content: product },
    ...(canonical ? [{ property: "og:url", content: canonical }] : []),
    ...(image
      ? [
          { property: "og:image", content: image },
          { property: "og:image:width", content: String(theme.socialImage!.width) },
          { property: "og:image:height", content: String(theme.socialImage!.height) },
          { property: "og:image:alt", content: theme.socialImage!.alt },
        ]
      : []),
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    ...(meta?.kind === "notfound" ? [{ name: "robots", content: "noindex" }] : []),
  ];
  // The same content for programs and AI agents: this page as Markdown, the index, the whole reference, the model.
  const links: HeadData["links"] = [
    { rel: "alternate", type: "text/markdown", href: `${name}.md`, title: "This page as Markdown" },
    { rel: "alternate", type: "text/markdown", href: `${root}llms.txt`, title: "llms.txt: index of every page, as Markdown links" },
    { rel: "alternate", type: "text/markdown", href: `${root}llms-full.txt`, title: "llms-full.txt: the whole reference in one Markdown file" },
    { rel: "alternate", type: "application/json", href: `${root}api.json`, title: "api.json: the apidocs/1 model of this module" },
    { rel: "index", href: `${root}index.html`, title: `${product} API reference` },
  ];
  return { title, description, keywords, product, canonical, meta: tags, links, formats, jsonLd: graph };
}

/**
 * Where the theme's social image is: its URL as given, else its asset under the base URL. Open Graph needs an
 * absolute URL and link previews ignore a relative one, so without a base URL (a jar, a page opened from disk) a
 * page names no image. Undefined without an image.
 */
export function socialImageUrl(theme: Theme, _root: string): string | undefined {
  const image = theme.socialImage;
  if (!image) return undefined;
  if (image.url) return image.url;
  if (!image.asset || !theme.baseUrl) return undefined;
  return `${theme.baseUrl}assets/${image.asset}`;
}

/** The head's metadata elements: charset and viewport, title, meta tags, canonical, alternates and index. */
export function HeadMeta({ head }: { head: HeadData }) {
  return (
    <>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{head.title}</title>
      {head.meta.map(tag => <meta key={tag.name ?? tag.property} name={tag.name} property={tag.property} content={tag.content} />)}
      {head.canonical && <link rel="canonical" href={head.canonical} />}
      {head.links.map(link => <link key={link.href} rel={link.rel} type={link.type} href={link.href} title={link.title} />)}
    </>
  );
}

/** The JSON-LD graph as a script element; the head's last element. */
export function JsonLd({ head }: { head: HeadData }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(head.jsonLd).replace(/</g, "\\u003c") }} />;
}

export function Shell({ title, description, crumbs, toc, jsonLd, meta, children }: ShellProps) {
  const ctx = usePage();
  const variant = useVariant();
  const { theme, page } = ctx;
  const root = rootOf(page);
  const name = page.split("/").pop()!;
  const head = headData(ctx, { title, description, crumbs, jsonLd, meta });
  const astro = variant.kind === "astro";
  return (
    <html lang="en" data-root={root || "./"}>
      <head>
        {/* A host serves the not-found page at any depth: with the site's address known, its links resolve from the root. */}
        {meta?.kind === "notfound" && theme.baseUrl && !astro && <base href={theme.baseUrl} />}
        <HeadMeta head={head} />
        {/* Astro bundles the stylesheet and inlines the theme's tokens itself. */}
        {!astro && <link rel="stylesheet" href={`${root}assets/apidocs.css`} />}
        {!astro && <link rel="stylesheet" href={`${root}assets/theme.css`} />}
        {theme.favicon && <link rel="icon" type="image/svg+xml" href={`${root}assets/favicon.svg`} />}
        {/* Astro preloads the fonts with link elements: its pages are always served. */}
        <script dangerouslySetInnerHTML={{ __html: astro ? THEME_BOOT : THEME_BOOT + fontPreload(theme.fonts, root) }} />
        {!astro && <script defer src={`${root}assets/apidocs.js`} />}
        {/* Hold first paint until the content element is parsed, so a page transition starts from real content. */}
        <link rel="expect" href={meta?.kind === "notfound" ? "#content" : `${name}.html#content`} {...({ blocking: "render" } as object)} />
        {/* On a server, start loading and rendering a page of this site when a link to it is hovered or pressed.
            Astro pages navigate with its client router and prefetch instead. */}
        {!astro && <script type="speculationrules" dangerouslySetInnerHTML={{ __html: SPECULATION }} />}
        <JsonLd head={head} />
      </head>
      <body>
        <div class="loadbar" aria-hidden="true" />
        {meta?.kind === "guide" && <div class="readbar" aria-hidden="true" />}
        {/* The not-found page is served at whatever URL was missing, so its skip link names no file. */}
        <a class="skip" href={meta?.kind === "notfound" ? "#content" : `${name}.html#content`}>Skip to content</a>
        <TopBar />
        <div class="layout">
          <Navigation />
          <script dangerouslySetInnerHTML={{ __html: NAV_BOOT }} />
          <main id="content" class="content">
            <AgentNote formats={head.formats} />
            <PageTools crumbs={crumbs} canonical={head.canonical} title={title} />
            {astro && <HoleMark name="notice" />}
            {children}
          </main>
        </div>
        <Footer />
      </body>
    </html>
  );
}

/** For programs that read the page as text: where the other forms are. Not shown, not read aloud. */
export function AgentNote({ formats }: { formats: Formats }) {
  return (
    <p class="visually-hidden" aria-hidden="true" data-agent-note>
      {`Machine-readable versions of this page. Markdown: ${formats.markdown} . Index of every page (llms.txt): ${formats.llms} . The whole reference in one Markdown file: ${formats.full} . The API model as JSON (apidocs/1): ${formats.model} .`}
    </p>
  );
}

/** The module's name (when the product has another) and version, beside the brand in the top bar. */
export function ModuleVersion() {
  const { site, theme } = usePage();
  const product = theme.productName ?? site.model.module.name;
  return (
    <span class="module-version">
      {site.model.module.name !== product && <span>{site.model.module.name} </span>}
      {site.model.module.version && <span class="version">{site.model.module.version}</span>}
    </span>
  );
}

/** The search field's markup. The static client script and the Astro search island both drive this markup. */
export function SearchField({ apiLabel = true }: { apiLabel?: boolean }) {
  return (
    <search class="search" data-search data-js-only>
      <label class="visually-hidden" for="apidocs-search">{apiLabel ? "Search the API" : "Search the guides"}</label>
      <input id="apidocs-search" type="search" placeholder={apiLabel ? "Search types and members" : "Search the guides"} autocomplete="off" spellcheck={false}
        role="combobox" list={undefined} aria-expanded="false" aria-controls="apidocs-results" aria-autocomplete="list" />
      <kbd class="search-key" aria-hidden="true">/</kbd>
      <ul id="apidocs-results" class="search-results" role="listbox" aria-label="Search results" hidden />
    </search>
  );
}

/**
 * The top bar holds what belongs to the whole site: the navigator toggle, the brand, the module's version (or an
 * Astro app's version menu), the switcher between sibling documentation sites, search and the theme switch. The
 * module's indexes (overview, packages, types, A to Z, deprecated) are in the navigator. One checkbox toggles the
 * navigator with no script: it hides it on a wide screen and shows it on a narrow one.
 *
 * Nothing in the bar wraps, overflows or is cut off at any width from 320px; the stylesheet's top-bar section says
 * in what order its parts give way.
 */
export function TopBar() {
  const { site, theme, page } = usePage();
  const variant = useVariant();
  const astro = variant.kind === "astro";
  const root = rootOf(page);
  const product = theme.productName ?? site.model.module.name;
  return (
    <header class="topbar" {...persistAttr(variant, "apidocs-topbar")}>
      <input type="checkbox" id="apidocs-nav-toggle" class="nav-toggle visually-hidden" aria-label="Toggle navigation" autocomplete="off" />
      <script dangerouslySetInnerHTML={{ __html: NAV_STATE_BOOT }} />
      <label class="nav-button" for="apidocs-nav-toggle" title="Toggle navigation" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="16" height="16"><rect x="2" y="2.75" width="12" height="10.5" rx="2.25" /><path d="M6.25 2.75v10.5" /></svg>
      </label>
      <a class="brand" href={theme.homeUrl ? hrefFor(page, theme.homeUrl) : relative(page, INDEX, ".html")}>
        {theme.logo?.light && (
          <>
            <img class="logo logo-light" src={`${root}assets/logo-light.svg`} alt={theme.logo.alt ?? ""} height={22} width={logoWidth(theme.logo.light, 22)} />
            <img class="logo logo-dark" src={`${root}assets/logo-${theme.logo.dark ? "dark" : "light"}.svg`} alt={theme.logo.alt ?? ""} height={22} width={logoWidth(theme.logo.dark ?? theme.logo.light, 22)} />
          </>
        )}
        <span class="product" title={product}>{product}</span>
      </a>
      {astro ? <HoleMark name="topbar" /> : <ModuleVersion />}
      <div class="topbar-tools">
        <SuiteSwitcher />
        {site.packages.length > 0 && <a class="search-fallback" href={`${relative(page, INDEX, ".html")}#all-types`}>All types</a>}
        {astro ? <HoleMark name="search" /> : <SearchField apiLabel={site.packages.length > 0} />}
        <button type="button" class="theme-switch" data-theme-switch data-js-only aria-label="Color theme: system">
          {/* The drawn icon everywhere; a sun or a moon where the platform's emoji are good (data-emoji). */}
          <span aria-hidden="true" class="theme-icon" />
          <span aria-hidden="true" class="theme-emoji" />
        </button>
      </div>
      {suites(theme, page).length > 0 && <script dangerouslySetInnerHTML={{ __html: SUITES_BOOT }} />}
    </header>
  );
}

/**
 * One sibling documentation site, as the switcher and the navigator list it. The current site is marked with
 * aria-current="true", not "page": its link goes to the site's overview, which is rarely the page being read.
 */
export interface Suite {
  label: string;
  /** The link from the page being rendered. */
  href: string;
  /** Whether this is the site being rendered. */
  current: boolean;
  /**
   * The theme's link to the site, from the page: the same for every page of every sibling site that names it, so
   * the script can remember the last page read in each site under it (suiteMemory in client/behaviors.tsx).
   */
  key: string;
}

/**
 * The sibling documentation sites from the theme's header links, linked from a page, with the current one
 * marked: the entry with `current: true`, else the one whose URL is this site's own root (see ThemeLink). The
 * current entry links to this site's overview. Empty when there is nothing to switch to: no links, or only this site.
 */
export function suites(theme: Theme, page: string): Suite[] {
  const links = theme.links?.header ?? [];
  const marked = links.some(link => link.current);
  const isOwnRoot = (url: string) => {
    if (["", "./", ".", "index.html", "./index.html"].includes(url.trim())) return true;
    if (!theme.baseUrl) return false;
    try {
      const at = new URL(url, theme.baseUrl).href;
      return at === theme.baseUrl || at === `${theme.baseUrl}index.html`;
    } catch {
      return false;
    }
  };
  let found = false;
  const list = links.map(link => {
    const current = !found && (marked ? !!link.current : isOwnRoot(link.url));
    found ||= current;
    return { label: link.label, href: current ? relative(page, INDEX, ".html") : hrefFor(page, link.url), current, key: hrefFor(page, link.url) };
  });
  return list.some(entry => !entry.current) ? list : [];
}

/** The label of the suite menu's button: the current site, or a word for the set when no entry is current. */
function currentSuiteLabel(list: Suite[]): string {
  return list.find(entry => entry.current)?.label ?? "Documentation";
}

const CHEVRON = <svg class="icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 6.25 8 10.25l4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>;

/**
 * The switcher between sibling documentation sites: a row of the sites with the current one marked when the bar
 * has room for it, else one menu button that names the current site and opens the list. The browser's layout
 * decides, with no script and no width written down anywhere: the hidden copies of the labels (.suites-fit) are a
 * wrapping row whose height says whether the labels fit on one line, and that height places the visible row or
 * the menu (see "Suite switcher" in apidocs.css). The script only hides the one out of view from assistive
 * technology and the keyboard. Where the navigator is a drawer, the drawer lists the sites first, and the bar shows
 * the row only when it fits.
 */
export function SuiteSwitcher() {
  const { theme, page } = usePage();
  const list = suites(theme, page);
  if (!list.length) return null;
  const label = currentSuiteLabel(list);
  return (
    <div class="suites">
      <div class="suites-fit">
        {/* Empty and zero-wide, so that even a first label wider than the switcher moves to a second line. */}
        <span class="suites-probe" aria-hidden="true" />
        {list.map((entry, i) => <span key={i} class="suites-ghost" data-current={entry.current ? "" : undefined} aria-hidden="true">{entry.label}</span>)}
        <nav class="suites-row" aria-label="Documentation">
          {list.map((entry, i) => <a key={i} href={entry.href} data-suite={entry.key} aria-current={entry.current ? "true" : undefined}>{entry.label}</a>)}
        </nav>
        <details class="suite-menu">
          <summary class="suite-current" aria-label={`${label}: other documentation`} title="Other documentation">
            <span class="suite-label">{label}</span>
            {CHEVRON}
          </summary>
          <ul class="suite-list">
            {list.map((entry, i) => <li key={i}><a href={entry.href} data-suite={entry.key} aria-current={entry.current ? "true" : undefined}>{entry.label}</a></li>)}
          </ul>
        </details>
      </div>
      {/* The menu button's width, so the bar keeps room for it. */}
      <span class="suites-floor" aria-hidden="true"><span>{label}</span>{CHEVRON}</span>
    </div>
  );
}

/** The row above the page's title: where the page is, and its other forms. */
export function PageTools({ crumbs, canonical, title }: { crumbs: Crumb[]; canonical: string | undefined; title: string }) {
  const { page } = usePage();
  return (
    <div class="page-tools">
      <Breadcrumbs crumbs={crumbs} />
      <PageActions name={page.split("/").pop()!} root={rootOf(page)} canonical={canonical} title={title} />
    </div>
  );
}

/** The foot of every page: the theme's footer text, the machine-readable forms, the theme's footer links. */
export function Footer() {
  const { theme, page } = usePage();
  const root = rootOf(page);
  const name = page.split("/").pop()!;
  return (
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
        <p class="footer-links">{theme.links!.footer!.map(link => <a key={link.url} href={hrefFor(page, link.url)}>{link.label}</a>)}</p>
      )}
    </footer>
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
export function PageActions({ name, root, canonical, title }: { name: string; root: string; canonical: string | undefined; title: string }) {
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

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
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
 * The navigator: one tree. Guides by group, then the module, whose heading leads to its overview, then every
 * package with its types, and every type with its nested types, each shown as `.Name` under its enclosing type.
 * Every branch folds. On the server, the branches on the current page's path are open and the rest are folded; the
 * script keeps a reader's own folding across pages (refreshNavigator in astro/client.ts) and the fold-all button
 * folds or opens them all. Without the script nothing is folded, so every row stays reachable. A row is one line
 * and truncates; its title carries the full name.
 */
export function Navigation() {
  const { site, theme, page } = usePage();
  const current = currentType(site.types, page);
  const currentPkg = current ? site.types.get(current.id)!.pkg : site.packages.find(pkg => packagePage(pkg) === page);
  const prefix = sharedPrefix(site.packages.map(pkg => pkg.name));
  const chain = new Set<string>();
  for (let t: Type | undefined = current; t; t = t.enclosing ? site.types.get(t.enclosing)?.type : undefined) chain.add(t.id);
  const guides = guideNav(site, page);
  const sites = suites(theme, page);
  const indexes = navIndexes(site, page);
  const overview = relative(page, INDEX, ".html");
  // One package needs no fold of its own: its types are the tree.
  const single = site.packages.length === 1;
  return (
    <nav class="sidebar" id="apidocs-nav" aria-label={site.packages.length ? "Packages and types" : "Guides"} {...persistAttr(useVariant(), "apidocs-nav")}>
      {/* Shown only where the navigator is a drawer: there the top bar may have no room for the switcher. */}
      {sites.length > 0 && (
        <section class="nav-section nav-suites">
          <h2 class="nav-heading"><span>Documentation</span></h2>
          <ul class="nav-list">
            {sites.map((entry, i) => (
              <li key={i}><a class="nav-row" href={entry.href} data-suite={entry.key} aria-current={entry.current ? "true" : undefined}><span class="nav-label">{entry.label}</span></a></li>
            ))}
          </ul>
        </section>
      )}
      {(site.packages.length > 0 || site.guides.length > 0) && (
        <div class="nav-filter" data-nav-filter data-js-only>
          <label class="visually-hidden" for="apidocs-nav-filter">{site.packages.length ? "Filter packages, types and guides" : "Filter guides"}</label>
          <input id="apidocs-nav-filter" type="search" placeholder="Filter" autocomplete="off" spellcheck={false} />
          <button type="button" class="nav-fold-all" data-nav-fold-all aria-label="Expand all" title="Expand all" data-state="folded">
            {/* Chevrons apart: open everything; chevrons together: fold everything. */}
            <svg class="icon fold-all-expand" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4.5 6 8 2.5 11.5 6M4.5 10 8 13.5 11.5 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
            <svg class="icon fold-all-collapse" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4.5 2.5 8 6l3.5-3.5M4.5 13.5 8 10l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        </div>
      )}
      {guides.groups.length > 0 && (
        <section class="nav-section nav-guides" data-nav-filterable>
          <h2 class="nav-heading">{site.packages.length > 0 ? <span>Guides</span> : <a href={overview} aria-current={page === INDEX ? "page" : undefined}>Guides</a>}</h2>
          <ul class="nav-list nav-tree">
            {guides.groups.map((group, i) => {
              const rows = group.guides.map(guide => (
                <li key={guide.id} class="nav-item">
                  <a class="nav-row" href={guide.href} title={guide.summary || guide.title} aria-current={guide.current ? "page" : undefined}>
                    <span class="glyph" data-tone="guide" aria-hidden="true">{SYMBOLS.guide.utf}</span>
                    <span class="nav-label">{guide.label}</span>
                  </a>
                </li>
              ));
              if (!group.title) return rows;
              const open = group.guides.some(guide => guide.current);
              return (
                <NavBranch key={i} id={`g:${group.title}`} open={open} label={group.title}
                  row={<span class="nav-row nav-group-row"><span class="nav-label">{group.title}</span></span>}>
                  {rows}
                </NavBranch>
              );
            })}
          </ul>
        </section>
      )}
      {site.packages.length > 0 && (
        <section class="nav-section nav-packages" data-nav-filterable>
          <h2 class="nav-heading nav-module">
            <a href={overview} aria-current={page === INDEX ? "page" : undefined} title={`${site.model.module.name}: overview`}>{site.model.module.name}</a>
            {indexes.length > 0 && (
              <span class="nav-index">
                {indexes.map(entry => <a key={entry.page} href={entry.href} aria-current={entry.current ? "page" : undefined}>{entry.label}</a>)}
              </span>
            )}
          </h2>
          <ul class="nav-list nav-tree">
            {site.packages.map(pkg => {
              const tops = sortedTypes((pkg.types ?? []).filter(t => !t.enclosing));
              const types = <NavTypes types={tops} pkg={pkg} chain={chain} />;
              if (single) return <li key={pkg.id} class="nav-item nav-children-wrap">{types}</li>;
              const here = packagePage(pkg) === page;
              const label = pkg.name ? (prefix ? pkg.name.slice(prefix.length + 1) : pkg.name) : "(default package)";
              return (
                <NavBranch key={pkg.id} id={`p:${pkg.id}`} open={pkg === currentPkg} label={pkg.name || label} empty={tops.length === 0}
                  row={
                    <a class="nav-row nav-package" href={relative(page, packagePage(pkg), ".html")} title={pkg.name}
                      aria-current={here ? "page" : undefined} data-open={pkg === currentPkg ? "" : undefined}>
                      <span class="nav-label">{prefix && <span class="nav-dot" aria-hidden="true">.</span>}{label}</span>
                      {tops.length > 0 && <span class="nav-count">{tops.length}</span>}
                    </a>
                  }>
                  {tops.length > 0 && <li class="nav-item nav-children-wrap">{types}</li>}
                </NavBranch>
              );
            })}
          </ul>
        </section>
      )}
    </nav>
  );
}

/**
 * A branch of the navigator's tree: a twisty button that folds it, its row, and its children. `open` is the
 * server's choice: open along the current page's path. `id` names the branch across pages, so the script can keep a
 * reader's folding. The children's list is the twisty's controlled region.
 */
function NavBranch({ id, open, label, row, empty, children }: { id: string; open: boolean; label: string; row: ComponentChildren; empty?: boolean; children: ComponentChildren }) {
  const region = `nav-${id.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
  return (
    <li class="nav-item nav-branch" data-nav-key={id} data-folded={open ? undefined : ""} data-path={open ? "" : undefined}>
      <div class="nav-branch-row">
        {empty
          ? <span class="nav-twisty" aria-hidden="true" />
          : (
            <button type="button" class="nav-twisty" data-js-only aria-expanded={open ? "true" : "false"} aria-controls={region} aria-label={`${label}: ${open ? "fold" : "unfold"}`}>
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6 3.75 10.25 8 6 12.25" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
          )}
        {row}
      </div>
      {!empty && <ul class="nav-list nav-children" id={region}>{children}</ul>}
    </li>
  );
}

/** Types by name, as a reader scans them: the kind glyph beside each name says what it is. */
function sortedTypes(types: Type[]): Type[] {
  return [...types].sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/** One of the module's index pages, as the navigator lists it. */
export interface NavIndex {
  page: string;
  label: string;
  href: string;
  current: boolean;
}

/**
 * The module's index pages that hold what the overview does not: the A to Z index of every declaration and the
 * deprecated list. The overview itself is the module's heading, and it lists the packages and their types, so the
 * separate package and type lists are not in the navigator. A guides-only site has none.
 */
export function navIndexes(site: Site, page: string): NavIndex[] {
  const entries = indexPages(site).filter(entry => entry.page !== PACKAGES_PAGE && entry.page !== TYPES_PAGE);
  return entries.map(entry => ({ ...entry, href: relative(page, entry.page, ".html"), current: entry.page === page }));
}

function NavTypes({ types, pkg, chain, depth = 0 }: { types: Type[]; pkg: Package; chain: Set<string>; depth?: number }) {
  const { site, page } = usePage();
  const mixed = (site.model.module.languages ?? []).length > 1;
  return (
    <ul class="nav-list" data-depth={depth || undefined}>
      {types.map(type => {
        const target = typePage(pkg, type);
        const nested = sortedTypes(site.types.get(type.id)!.nested);
        const glyph = kindGlyph(type);
        const simple = type.name.split(".").pop()!;
        const row = (
          <a class="nav-row" href={relative(page, target, ".html")} title={`${type.name} (${type.kind})`}
            aria-current={target === page ? "page" : undefined} data-open={chain.has(type.id) ? "" : undefined}>
            <span class="glyph" data-tone={glyph.tone} aria-hidden="true">{glyph.letter}</span>
            {/* A nested type reads as a member of its enclosing type's name: ".Inner" under "Outer". */}
            <span class="nav-label">{depth > 0 && <span class="nav-dot" aria-hidden="true">.</span>}{simple}</span>
            {mixed && <LanguageMark language={type.language} />}
          </a>
        );
        if (nested.length === 0) return <li key={type.id} class="nav-item">{row}</li>;
        return (
          <NavBranch key={type.id} id={`t:${type.id}`} open={chain.has(type.id)} label={type.name} row={row}>
            <li class="nav-item nav-children-wrap"><NavTypes types={nested} pkg={pkg} chain={chain} depth={depth + 1} /></li>
          </NavBranch>
        );
      })}
    </ul>
  );
}

function currentType(types: Map<string, { type: Type; page: string }>, page: string): Type | undefined {
  for (const entry of types.values()) if (entry.page === page) return entry.type;
  return undefined;
}

/**
 * A theme link from a page: an absolute URL or a path from the server's root ("/docs/") as given, and a relative
 * URL resolved from the site's root, so it works from a page at any depth.
 */
export function hrefFor(page: string, url: string): string {
  return isAbsolute(url) || url.startsWith("/") ? url : relative(page, url, "");
}
