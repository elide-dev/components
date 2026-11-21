/**
 * Agent readiness, measured locally with the checks Is Agentic
 * (https://is-agentic.com) scores. Is Agentic's scans are run by Ora, whose
 * scoring rules are public (https://ora.ai/api/ranker/releases/2/rules,
 * version 2, revision 17). Is Agentic only scans public URLs, so this file
 * re-implements, against the built files and the local audit server, every
 * check that applies to a documentation site (Ora's "content" site type):
 * the 15 checks it requires, the gated checks that follow from them, and the
 * bonus and emerging checks a static reference can earn. Checks about the
 * owner's business (pricing, OAuth, MCP servers, payments, search ranking,
 * Wikipedia) are out of scope for the generator and listed in AUDITS.md.
 *
 * The score follows Ora's published formula (weighted-active-layer-ratios:
 * accessibility 30, discovery 20, usability 40, payments 10 and empty here;
 * emerging checks unscored; bonus checks count only what they earn). It is a
 * local approximation of the hosted score, not the hosted score: Ora's
 * partial-credit thresholds are not all published, and the values used here
 * are written next to each check.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readPage, type PageFacts } from "./html";
import type { Finding, Owner, Site, Status } from "./types";

type State = "req" | "gated" | "bonus" | "emerging" | "na";
type Layer = "accessibility" | "discovery" | "usability";

interface Rule {
  id: string;
  name: string;
  layer?: Layer;
  max: number;
  state: State;
  owner: Owner;
  file?: string;
}

/** Layer weights from Ora's rules, version 2. Payments has no checks here, and its weight is redistributed. */
const LAYER_WEIGHTS: Record<Layer, number> = { accessibility: 30, discovery: 20, usability: 40 };
const SOURCE = "https://is-agentic.com/methodology; rules: https://ora.ai/api/ranker/releases/2/rules";

const RULES: Rule[] = [
  { id: "content-no-js", name: "Content without JavaScript", layer: "accessibility", max: 3, state: "req", owner: "page", file: "src/components/chrome.tsx" },
  { id: "metadata-completeness", name: "Metadata completeness", layer: "accessibility", max: 2, state: "req", owner: "page", file: "src/components/chrome.tsx" },
  { id: "json-ld", name: "JSON-LD structured data", layer: "accessibility", max: 4, state: "req", owner: "output", file: "src/pages.tsx" },
  { id: "schema-type-breadth", name: "Schema type breadth", layer: "accessibility", max: 2, state: "gated", owner: "output", file: "src/pages.tsx" },
  { id: "llms-txt-exists", name: "llms.txt exists", layer: "accessibility", max: 1, state: "req", owner: "output", file: "src/render.tsx" },
  { id: "llms-txt-formatting", name: "llms.txt formatting", layer: "accessibility", max: 2, state: "gated", owner: "output", file: "src/render.tsx" },
  { id: "llms-txt-links-resolve", name: "llms.txt links resolve", layer: "accessibility", max: 2, state: "gated", owner: "output", file: "src/render.tsx" },
  { id: "sitemap", name: "Sitemap exists", layer: "accessibility", max: 2, state: "req", owner: "output", file: "src/render.tsx" },
  { id: "noindex-directives", name: "Homepage not hidden from search", layer: "discovery", max: 1, state: "req", owner: "page", file: "src/components/chrome.tsx" },
  { id: "robots-ai-policy-quality", name: "robots.txt AI crawler policy", layer: "discovery", max: 2, state: "req", owner: "output", file: "src/render.tsx" },
  { id: "robots-agent-user-policy", name: "robots.txt agent-user policy", layer: "accessibility", max: 2, state: "req", owner: "output", file: "src/render.tsx" },
  { id: "agent-crawler-reachability", name: "Agent crawler reachability", layer: "accessibility", max: 2, state: "req", owner: "host" },
  { id: "bot-detection", name: "Not blocked by bot detection", layer: "accessibility", max: 2, state: "req", owner: "host" },
  { id: "docs-auth-gate", name: "Content behind auth", layer: "accessibility", max: 2, state: "req", owner: "host" },
  { id: "redirect-hygiene", name: "Redirect hygiene", layer: "accessibility", max: 1, state: "req", owner: "page", file: "src/components/chrome.tsx" },
  { id: "page-token-budget", name: "Page token budget", layer: "accessibility", max: 1, state: "req", owner: "page", file: "src/pages.tsx" },
  { id: "agent-friendly-404", name: "Agent-friendly 404s", layer: "usability", max: 2, state: "req", owner: "host", file: "src/render.tsx" },
  { id: "trust-anchors", name: "Trust anchor pages", layer: "accessibility", max: 2, state: "na", owner: "host" },
  { id: "sitemap-lastmod", name: "Sitemap freshness (lastmod)", layer: "accessibility", max: 1, state: "bonus", owner: "output", file: "src/render.tsx" },
  { id: "agent-instruction", name: "Agent instruction / when-to-use", layer: "accessibility", max: 3, state: "bonus", owner: "output", file: "src/render.tsx" },
  { id: "link-headers-discovery", name: "HTTP Link headers (RFC 8288)", layer: "accessibility", max: 1, state: "bonus", owner: "host" },
  { id: "markdown-negotiation-vary", name: "Markdown content negotiation", layer: "accessibility", max: 1, state: "bonus", owner: "host" },
  { id: "ax-document-structure", name: "Accessible document structure", layer: "usability", max: 3, state: "bonus", owner: "page", file: "src/components/chrome.tsx" },
  { id: "ax-native-controls", name: "Native interactive controls", layer: "usability", max: 3, state: "bonus", owner: "page", file: "src/components/chrome.tsx" },
  { id: "ax-accessible-names", name: "Accessible names on controls", layer: "usability", max: 2, state: "bonus", owner: "page", file: "src/components/chrome.tsx" },
  { id: "ax-form-labeling", name: "Form control labeling", layer: "usability", max: 2, state: "bonus", owner: "page", file: "src/components/chrome.tsx" },
  { id: "ax-tree-injection-safe", name: "Accessibility-tree injection safety", layer: "usability", max: 2, state: "bonus", owner: "page", file: "src/components/chrome.tsx" },
  { id: "markdown-link-alternate", name: "Markdown alternate link", max: 1, state: "emerging", owner: "page", file: "src/components/chrome.tsx" },
  { id: "markdown-url-fallback", name: "Markdown URL fallback", max: 2, state: "emerging", owner: "output", file: "src/render.tsx" },
  { id: "markdown-frontmatter", name: "Markdown frontmatter metadata", max: 1, state: "emerging", owner: "output", file: "src/markdown.ts" },
  { id: "code-fence-validity", name: "Code fence validity", max: 1, state: "emerging", owner: "output", file: "src/markdown.ts" },
  { id: "markdown-negotiation", name: "Markdown agent docs", max: 1, state: "emerging", owner: "host" },
  { id: "modular-llms-txt", name: "Modular llms.txt per section", max: 1, state: "emerging", owner: "output", file: "src/render.tsx" },
];

export interface AgenticOptions {
  /** Read every page when the site has at most this many; otherwise the representative pages and an even sample. */
  pageLimit?: number;
}

export interface AgenticReport {
  score: number;
  findings: Finding[];
  pages: string[];
  layers: Record<string, { earned: number; available: number }>;
}

const AGENTS_SEARCH = ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"];
const AGENTS_USER = ["ChatGPT-User", "Claude-User", "Perplexity-User"];
const TOKEN_BUDGET_CHARS = 100_000;

/** Where a page of the site is served. */
function pageAt(site: Site, page: string): string {
  return site.urlOf ? site.urlOf(page) : site.url + page;
}

export async function agenticAudit(site: Site, options: AgenticOptions = {}): Promise<AgenticReport> {
  const limit = options.pageLimit ?? 150;
  const pages = samplePages(site, limit);
  const facts = new Map<string, PageFacts>();
  for (const page of pages) facts.set(page, readPage(readFileSync(join(site.dir, page), "utf8")));
  const overview = facts.get(site.pages.overview)!;
  const file = (path: string) => (existsSync(join(site.dir, path)) ? readFileSync(join(site.dir, path), "utf8") : undefined);
  const results = new Map<string, Omit<Finding, "rule" | "name" | "owner"> & { owner?: Owner }>();
  const set = (id: string, r: Omit<Finding, "rule" | "name" | "owner"> & { owner?: Owner }) => results.set(id, r);
  const worst = <T>(list: T[], key: (t: T) => number, n = 5) => [...list].sort((a, b) => key(b) - key(a)).slice(0, n);

  // content-no-js. Ora: homepage 500+ characters with an H1, sequential headings, and a text-to-HTML ratio of 5%;
  // inner pages need their main text in the raw HTML.
  {
    const rows = pages.map(p => ({ page: p, f: facts.get(p)! })).map(({ page, f }) => ({ page, chars: f.mainText.length, ratio: f.bodyText.length / f.bytes, h1: f.h1, skip: f.maxHeadingSkip }));
    const home = rows.find(r => r.page === site.pages.overview)!;
    const homeChecks = [home.chars >= 500, home.h1 === 1, home.ratio >= 0.05, home.skip <= 1];
    const inner = rows.filter(r => r.page !== site.pages.overview);
    const innerOk = inner.filter(r => r.chars >= 200 && r.h1 === 1);
    const lowRatio = rows.filter(r => r.ratio < 0.05);
    const skips = rows.filter(r => r.skip > 1);
    const score = 2 * (homeChecks.filter(Boolean).length / 4) + (inner.length ? innerOk.length / inner.length : 1);
    set("content-no-js", {
      score, max: 3, status: statusOf(score, 3),
      evidence: `Overview: ${home.chars} chars of main text, ${home.h1} h1, text/HTML ratio ${(home.ratio * 100).toFixed(1)}% (target 5%), largest heading skip ${home.skip}. `
        + `${innerOk.length}/${inner.length} inner pages have main text and one h1 without JavaScript. Ratio below 5% on ${lowRatio.length}/${rows.length} pages (lowest ${pct(Math.min(...rows.map(r => r.ratio)))}). Heading skips >1 on ${skips.length} pages.`,
      where: [...worst(lowRatio, r => -r.ratio).map(r => `${r.page} ratio ${pct(r.ratio)}`), ...skips.slice(0, 3).map(r => `${r.page} heading skip ${r.skip}`)],
      fix: lowRatio.length ? "Cut repeated markup per page: the navigator and member rows repeat wrapper elements, classes and inline SVG on every page. Ora measures text over HTML bytes." : undefined,
    });
  }

  // metadata-completeness: canonical (own site), html lang, og:image, og:type, on the homepage; also counted over all pages.
  {
    const signals = (f: PageFacts) => ({
      canonical: f.links.some(l => l.rel.split(/\s+/).includes("canonical") && /^https?:\/\//.test(l.href)),
      lang: !!f.lang,
      "og:image": !!f.meta.get("og:image"),
      "og:type": !!f.meta.get("og:type"),
    });
    const home = signals(overview);
    const missing = Object.entries(home).filter(([, v]) => !v).map(([k]) => k);
    const pagesMissing = Object.keys(home).map(k => [k, pages.filter(p => !signals(facts.get(p)!)[k as keyof typeof home]).length] as const);
    const score = 2 * (4 - missing.length) / 4;
    set("metadata-completeness", {
      score, max: 2, status: statusOf(score, 2),
      evidence: missing.length ? `Overview lacks ${missing.join(", ")}. Pages missing each: ${pagesMissing.map(([k, n]) => `${k} ${n}/${pages.length}`).join(", ")}.` : "Canonical URL, lang, og:image and og:type on the overview.",
      fix: missing.length ? `Add ${missing.map(m => m === "canonical" ? '<link rel="canonical"> (needs the theme baseUrl)' : m === "lang" ? "<html lang>" : `<meta property="${m}">`).join(", ")} in the page head. og:image needs an image in the output (a theme or preset asset), og:type can be "website" or "article".` : undefined,
    });
  }

  // json-ld: identity JSON-LD on the homepage, with name, description, url and a type. Every page's JSON-LD must parse.
  {
    const blocks = overview.jsonLd.map(b => b.value).filter(Boolean) as Record<string, unknown>[];
    const items = blocks.flatMap(b => (Array.isArray(b["@graph"]) ? (b["@graph"] as Record<string, unknown>[]) : [b]));
    const primary = items[0];
    const checks = {
      parses: overview.jsonLd.length > 0 && overview.jsonLd.every(b => !b.error),
      type: !!primary?.["@type"],
      name: !!primary?.name,
      description: !!primary?.description,
      url: !!primary?.url,
    };
    const broken = pages.filter(p => facts.get(p)!.jsonLd.some(b => b.error));
    const noLd = pages.filter(p => facts.get(p)!.jsonLd.length === 0);
    const typeOk = /^(SoftwareSourceCode|SoftwareApplication|WebSite|APIReference|TechArticle|Organization|Product|CreativeWork|Article)$/.test(String(primary?.["@type"] ?? ""));
    const passed = Object.values(checks).filter(Boolean).length;
    const score = broken.length ? Math.min(2, 4 * passed / 5) : 4 * passed / 5;
    set("json-ld", {
      score, max: 4, status: statusOf(score, 4),
      evidence: `Overview: ${overview.jsonLd.length} block(s), @type ${JSON.stringify(primary?.["@type"])}${typeOk ? "" : " (not an identity type Ora recognizes)"}; ` +
        Object.entries(checks).map(([k, v]) => `${k} ${v ? "yes" : "no"}`).join(", ") + `. Pages without JSON-LD: ${noLd.length}/${pages.length}; unparseable: ${broken.length}.`,
      where: [...broken, ...noLd].slice(0, 5),
      fix: !checks.url ? 'Add "url" (the page\'s absolute URL from the theme baseUrl, or its relative path) to each JSON-LD block; on the overview, describe the library as SoftwareSourceCode (name, description, url, programmingLanguage, version, codeRepository).' : undefined,
    });
    const list = items.find(i => i["@type"] === "ItemList" || Array.isArray(i.hasPart) || (i.mainEntity as Record<string, unknown> | undefined)?.["@type"] === "ItemList");
    const s2 = list ? 2 : 0;
    set("schema-type-breadth", {
      score: s2, max: 2, status: statusOf(s2, 2),
      evidence: list ? "The overview marks up its list of packages." : "The overview lists packages and types, but its JSON-LD has no ItemList (or hasPart) pointing at them.",
      fix: list ? undefined : "On the overview (and package pages), add an ItemList (or hasPart) whose items are the package (type) pages, each with name and url.",
    });
  }

  // llms.txt
  const llms = await get(`${site.url}llms.txt`);
  {
    const ok = llms.status === 200 && llms.text.trim().length >= 100 && !/^\s*<(!doctype|html)/i.test(llms.text);
    set("llms-txt-exists", { score: ok ? 1 : 0, max: 1, status: ok ? "pass" : "fail", evidence: `GET /llms.txt: ${llms.status}, ${llms.type ?? "no type"}, ${llms.text.length} chars.` });
    const links = [...llms.text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)].map(m => m[1]!);
    const heading = /^# \S/.test(llms.text.trimStart());
    const len = llms.text.length;
    const fmtScore = !ok ? 0 : (heading ? 0.5 : 0) + (links.length ? 0.5 : 0) + (len <= 30_000 ? 1 : len <= 100_000 ? 0.5 : 0);
    set("llms-txt-formatting", {
      score: fmtScore, max: 2, status: ok ? statusOf(fmtScore, 2) : "na",
      evidence: `Starts with a heading: ${heading ? "yes" : "no"}; ${links.length} Markdown links; ${len.toLocaleString("en")} chars (Ora's target: under 30,000; agents truncate past 100,000).`,
      fix: len > 30_000 ? "Keep llms.txt an index under 30,000 characters: link the package pages (and llms-full.txt) instead of listing every type, or list types per package in per-package llms.txt files." : undefined,
    });
    const targets = [...new Set(links.map(l => new URL(l, `${site.url}llms.txt`).href))];
    const bad: string[] = [];
    await pool(targets, 16, async href => {
      const r = await get(href);
      if (r.status !== 200 || (href.endsWith(".md") && /^\s*<!doctype/i.test(r.text))) bad.push(`${href.slice(site.url.length)} (${r.status})`);
    });
    const lr = !ok ? 0 : targets.length === 0 ? 0 : 2 * (targets.length - bad.length) / targets.length;
    set("llms-txt-links-resolve", {
      score: lr, max: 2, status: ok ? statusOf(lr, 2) : "na",
      evidence: `${targets.length - bad.length}/${targets.length} links in llms.txt resolve to their content.`, where: bad.slice(0, 5),
    });
    const when = /^#{1,3} .*(when to use|use (this|it) (for|when)|for (ai )?agents)/im.test(llms.text);
    set("agent-instruction", {
      score: when ? 3 : 0, max: 3, status: when ? "pass" : "fail",
      evidence: when ? "llms.txt has a when-to-use section." : "llms.txt has no section that tells an agent when to use this reference and how to read it.",
      fix: when ? undefined : 'Add a "## When to use this" section to llms.txt: what the library is for, that each page has a .md twin, that api.json holds the whole model, and how to find a type (element-list, search-index).',
    });
    const modular = targets.some(t => /\/llms\.txt$/.test(t) && t !== `${site.url}llms.txt`);
    set("modular-llms-txt", { score: modular ? 1 : 0, max: 1, status: modular ? "pass" : "fail", evidence: modular ? "Per-section llms.txt files are linked." : "Only a root llms.txt; no per-package llms.txt.", fix: modular ? undefined : "For a large module, write <package>/llms.txt per package and link each from the root llms.txt." });
  }

  // sitemap
  {
    const sm = await get(`${site.url}sitemap.xml`);
    const locs = [...sm.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]!);
    const lastmod = (sm.text.match(/<lastmod>/g) ?? []).length;
    const htmlPages = site.pages.all.length;
    const valid = sm.status === 200 && /<urlset[\s>]/.test(sm.text) && locs.length > 0;
    const sample = locs.filter((_, i) => i % Math.max(1, Math.floor(locs.length / 20)) === 0);
    const dead: string[] = [];
    await pool(sample, 8, async loc => {
      const r = await get(loc);
      if (r.status !== 200) dead.push(`${loc} (${r.status})`);
    });
    const s = !valid ? 0 : dead.length ? 1 : 2;
    set("sitemap", {
      score: s, max: 2, status: statusOf(s, 2),
      evidence: valid ? `sitemap.xml lists ${locs.length} URLs for ${htmlPages} HTML pages; ${sample.length - dead.length}/${sample.length} sampled URLs resolve.` : `GET /sitemap.xml: ${sm.status}. The renderer writes it only when the theme sets baseUrl.`,
      where: dead.slice(0, 5),
      fix: valid ? undefined : "Write sitemap.xml whenever the site's URL is known (theme baseUrl), and have the JVM tools pass the published URL. Without a base URL, say so in the run output.",
    });
    const lm = valid && locs.length ? lastmod / locs.length : 0;
    set("sitemap-lastmod", { score: lm >= 0.5 ? 1 : 0, max: 1, status: lm >= 0.5 ? "pass" : "fail", evidence: valid ? `${lastmod}/${locs.length} sitemap entries carry <lastmod>.` : "No sitemap.", fix: lm >= 0.5 ? undefined : "Add <lastmod> to sitemap entries from the model's build date (or the module version's release date)." });
  }

  // noindex-directives
  {
    const r = await get(pageAt(site, site.pages.overview));
    const robotsMeta = ["robots", "googlebot", "bingbot"].map(k => overview.meta.get(k) ?? "").join(" ");
    const header = r.headers.get("x-robots-tag") ?? "";
    const hidden = /noindex/i.test(robotsMeta) || /noindex/i.test(header);
    set("noindex-directives", { score: hidden ? 0 : 1, max: 1, status: hidden ? "fail" : "pass", evidence: hidden ? `noindex in ${robotsMeta ? "meta robots" : "X-Robots-Tag"}` : "No noindex meta tag or X-Robots-Tag header on the overview." });
  }

  // robots.txt
  {
    const robots = await get(`${site.url}robots.txt`);
    const paths = pages.slice(0, 6).map(p => "/" + p);
    const evaluate = (agents: string[]) => {
      if (robots.status === 404) return { blocked: [] as string[], note: "no robots.txt (404): nothing is restricted" };
      if (robots.status !== 200 || /html/.test(robots.type ?? "")) return { blocked: ["*"], note: `robots.txt answered ${robots.status} ${robots.type}; crawlers treat errors and HTML as no usable rules` };
      const blocked = agents.flatMap(a => paths.filter(p => !robotsAllows(robots.text, a, p)).map(p => `${a} ${p}`));
      return { blocked, note: `robots.txt present (${robots.text.length} chars)` };
    };
    const search = evaluate(AGENTS_SEARCH);
    const user = evaluate(AGENTS_USER);
    set("robots-ai-policy-quality", {
      score: search.blocked.length ? 0 : 2, max: 2, status: search.blocked.length ? "fail" : "pass",
      evidence: `${search.note}. AI search crawlers (${AGENTS_SEARCH.join(", ")}) on ${paths.length} pages: ${search.blocked.length ? `blocked ${search.blocked.length}` : "allowed"}.`, where: search.blocked.slice(0, 5),
      fix: robots.status === 404 ? "Optional: write a robots.txt (Allow: / for all, and Sitemap: <baseUrl>sitemap.xml) when the reference is served at a host root. It passes without one." : undefined,
    });
    set("robots-agent-user-policy", {
      score: user.blocked.length ? 0 : 2, max: 2, status: user.blocked.length ? "fail" : "pass",
      evidence: `${user.note}. User-triggered agents (${AGENTS_USER.join(", ")}): ${user.blocked.length ? `blocked ${user.blocked.length}` : "allowed"}.`, where: user.blocked.slice(0, 5),
    });
  }

  // agent-crawler-reachability and bot-detection: the audit server serves every user agent alike; this proves the pages need no cookies or JS challenge.
  {
    const base = await get(pageAt(site, site.pages.overview));
    const uas = ["ChatGPT-User/1.0", "OAI-SearchBot/1.0", "Claude-User/1.0", "PerplexityBot/1.0"];
    const results = await Promise.all(uas.map(async ua => ({ ua, r: await get(pageAt(site, site.pages.overview), { "user-agent": `Mozilla/5.0 (compatible; ${ua})` }) })));
    // The same content: a page with server islands differs in every response (each render encrypts the islands'
    // props anew), so compare the text a reader gets, not the bytes.
    const text = (html: string) => readPage(html).mainText;
    const ok = results.filter(x => x.r.status === 200 && text(x.r.text) === text(base.text));
    const s = 2 * ok.length / uas.length;
    const evidence = `${ok.length}/${uas.length} agent user agents got the same 200 page from the audit server. A real host's WAF or bot rules are not tested here.`;
    set("agent-crawler-reachability", { score: s, max: 2, status: statusOf(s, 2), evidence });
    set("bot-detection", { score: s, max: 2, status: statusOf(s, 2), evidence });
  }

  // docs-auth-gate
  {
    const gated = pages.filter(p => /<input[^>]+type="password"/i.test(readFileSync(join(site.dir, p), "utf8")));
    const s = gated.length ? 0 : 2;
    set("docs-auth-gate", { score: s, max: 2, status: statusOf(s, 2), evidence: `${pages.length - gated.length}/${pages.length} pages are readable with no sign-in form.`, where: gated.slice(0, 5) });
  }

  // redirect-hygiene
  {
    const stubs = pages.filter(p => {
      const f = facts.get(p)!;
      return f.metaRefresh || f.inlineScripts.some(s => /\b(window\.)?location(\.href)?\s*=(?!=)|location\.(replace|assign)\s*\(/.test(s));
    });
    set("redirect-hygiene", { score: stubs.length ? 0 : 1, max: 1, status: stubs.length ? "fail" : "pass", evidence: `${stubs.length} of ${pages.length} pages carry a meta refresh or a script redirect.`, where: stubs.slice(0, 5) });
  }

  // page-token-budget: extracted text under ~100K characters (~25K tokens).
  {
    const rows = pages.map(p => ({ page: p, chars: facts.get(p)!.bodyText.length, md: (file(p.replace(/\.html$/, ".md")) ?? "").length }));
    const over = rows.filter(r => r.chars > TOKEN_BUDGET_CHARS);
    const largest = worst(rows, r => r.chars, 1)[0]!;
    set("page-token-budget", {
      score: over.length ? 0 : 1, max: 1, status: over.length ? "fail" : "pass",
      evidence: `${pages.length - over.length}/${pages.length} pages fit ${TOKEN_BUDGET_CHARS.toLocaleString("en")} chars of text (~25K tokens). Largest: ${largest.page}, ${largest.chars.toLocaleString("en")} chars of text (~${Math.round(largest.chars / 4000)}K tokens); its .md twin is ${largest.md.toLocaleString("en")} chars.`,
      where: worst(over, r => r.chars).map(r => `${r.page}: ${r.chars.toLocaleString("en")} chars`),
      fix: over.length ? "Split very large type pages: keep the summary tables and the most-used members on the type page and move member details for big groups (or inherited members) to per-group pages, or drop text repeated per member (each member's full signature appears in the summary and again in its detail). The .md twin needs the same split." : undefined,
    });
  }

  // agent-friendly-404: real 404/410 status (partial), plus a Markdown body for Accept: text/markdown (full).
  {
    const missing = `${site.url}no-such-page-${Date.now()}.html`;
    const html = await get(missing);
    const md = await get(missing, { accept: "text/markdown" });
    const realStatus = html.status === 404 || html.status === 410;
    const mdBody = (md.status === 404 || md.status === 410) && /markdown/.test(md.type ?? "") && md.text.trim().length >= 20;
    const s = (realStatus ? 1 : 0) + (mdBody ? 1 : 0);
    set("agent-friendly-404", {
      score: s, max: 2, status: statusOf(s, 2),
      evidence: `GET a missing page: ${html.status} ${html.type ?? ""}; with Accept: text/markdown: ${md.status} ${md.type ?? ""}, ${md.text.length} chars. Output has 404.html: ${existsSync(join(site.dir, "404.html")) ? "yes" : "no"}, 404.md: ${existsSync(join(site.dir, "404.md")) ? "yes" : "no"}.`,
      fix: mdBody ? undefined : "Have the renderer write 404.html and 404.md (a short page that points at index, llms.txt and the search), so hosts that serve a 404 page (GitHub Pages, Netlify, Cloudflare Pages) return them; the host must serve 404.md for Accept: text/markdown.",
    });
  }

  set("trust-anchors", { status: "na", evidence: "About, contact and privacy pages belong to the site that hosts the reference, not to the generated reference. Not scored here; the hosted scan checks the host's root." });

  // Host-dependent bonus checks.
  {
    const r = await get(pageAt(site, site.pages.overview));
    const link = r.headers.get("link") ?? "";
    set("link-headers-discovery", { score: link ? 1 : 0, max: 1, status: link ? "pass" : "fail", evidence: link ? `Link: ${link}` : "No Link response header on the overview (the host adds it; the agent host profile does)." });
    const md = await get(site.url, { accept: "text/markdown" });
    const vary = (md.headers.get("vary") ?? "").toLowerCase().includes("accept");
    const okMd = /markdown/.test(md.type ?? "") && md.text.trim().length > 0 && vary;
    set("markdown-negotiation-vary", { score: okMd ? 1 : 0, max: 1, status: okMd ? "pass" : "fail", evidence: `GET / with Accept: text/markdown: ${md.status} ${md.type ?? ""}, Vary: ${md.headers.get("vary") ?? "none"}.`, fix: okMd ? undefined : "Host: serve each page's .md twin for Accept: text/markdown with Vary: Accept (run with --host agent to see the score with it)." });
    const staticMd = await Promise.all(["llms.md", "agents.md", "auth.md"].map(f => get(site.url + f)));
    const neg = okMd || staticMd.some(x => x.status === 200 && /markdown/.test(x.type ?? ""));
    set("markdown-negotiation", { score: neg ? 1 : 0, max: 1, status: neg ? "pass" : "fail", evidence: neg ? "Markdown served for the homepage, by negotiation or a root .md file." : "No Accept: text/markdown negotiation on / and no /llms.md or /agents.md.", fix: neg ? undefined : "Either the host negotiates (see markdown-negotiation-vary), or the renderer also writes llms.txt as /llms.md." });
  }

  // Accessibility-tree checks, from raw HTML.
  {
    const rows = pages.map(p => ({ page: p, f: facts.get(p)! }));
    const structureOk = rows.filter(({ f }) => f.landmarks.main === 1 && f.h1 === 1 && f.maxHeadingSkip <= 1);
    const landmarkAvg = rows.reduce((a, { f }) => a + ["header", "nav", "main", "footer"].filter(k => f.landmarks[k as keyof typeof f.landmarks] > 0).length, 0) / rows.length;
    const s1 = 3 * structureOk.length / rows.length;
    set("ax-document-structure", {
      score: s1, max: 3, status: statusOf(s1, 3),
      evidence: `${structureOk.length}/${rows.length} pages have one main, one h1 and no heading skip over 1. Landmarks (header, nav, main, footer) present on average: ${landmarkAvg.toFixed(1)}/4.`,
      where: rows.filter(r => !structureOk.includes(r)).slice(0, 5).map(({ page, f }) => `${page}: main ${f.landmarks.main}, h1 ${f.h1}, skip ${f.maxHeadingSkip}`),
    });
    const controls = rows.flatMap(({ page, f }) => f.controls.map(c => ({ page, c })));
    const nonNative = controls.filter(x => !x.c.native);
    const nativeShare = controls.length ? (controls.length - nonNative.length) / controls.length : 1;
    const s2 = nativeShare >= 0.95 ? 3 : 3 * nativeShare;
    set("ax-native-controls", { score: s2, max: 3, status: statusOf(s2, 3), evidence: `${controls.length - nonNative.length}/${controls.length} interactive elements are native (${pct(nativeShare)}).`, where: unique(nonNative.map(x => `${x.c.label} (${x.page})`)).slice(0, 5) });
    const unnamed = controls.filter(x => !x.c.name);
    const named = controls.length ? (controls.length - unnamed.length) / controls.length : 1;
    const s3 = named === 1 ? 2 : 2 * named;
    set("ax-accessible-names", { score: s3, max: 2, status: statusOf(s3, 2), evidence: `${controls.length - unnamed.length}/${controls.length} interactive elements have a name in the raw HTML (${pct(named)}).`, where: unique(unnamed.map(x => `${x.c.label} (${x.page})`)).slice(0, 5) });
    const fields = rows.flatMap(({ page, f }) => f.fields.map(x => ({ page, ...x })));
    const unlabelled = fields.filter(x => !x.labelled);
    const s4 = fields.length ? 2 * (fields.length - unlabelled.length) / fields.length : 2;
    set("ax-form-labeling", { score: s4, max: 2, status: statusOf(s4, 2), evidence: `${fields.length - unlabelled.length}/${fields.length} form fields have a label.`, where: unique(unlabelled.map(x => `${x.label} (${x.page})`)).slice(0, 5) });
    const inj = rows.flatMap(({ page, f }) => f.injection.map(i => `${page}: ${i}`));
    set("ax-tree-injection-safe", { score: inj.length ? 0 : 2, max: 2, status: inj.length ? "fail" : "pass", evidence: inj.length ? `${inj.length} hidden strings read like instructions to an agent.` : "No hidden text that reads like an instruction to an agent.", where: inj.slice(0, 5) });
  }

  // Emerging Markdown checks.
  {
    const rows = pages.map(p => ({ page: p, f: facts.get(p)! }));
    const bad: string[] = [];
    let advertised = 0;
    for (const { page, f } of rows) {
      const alt = f.links.find(l => l.rel.split(/\s+/).includes("alternate") && l.type === "text/markdown");
      if (!alt) {
        bad.push(`${page}: no alternate`);
        continue;
      }
      advertised++;
      const target = join(site.dir, page, "..", alt.href.split("#")[0]!);
      const body = existsSync(target) ? readFileSync(target, "utf8") : undefined;
      if (!body || /^\s*</.test(body)) bad.push(`${page}: ${alt.href} ${body ? "is HTML" : "missing"}`);
    }
    const s = rows.length ? (rows.length - bad.length) / rows.length : 0;
    set("markdown-link-alternate", { score: s, max: 1, status: statusOf(s, 1), evidence: `${advertised}/${rows.length} pages advertise a Markdown twin; ${rows.length - bad.length} of them resolve to Markdown.`, where: bad.slice(0, 5) });
    const index = await get(`${site.url}index.md`);
    const twins = pages.filter(p => existsSync(join(site.dir, p.replace(/\.html$/, ".md"))));
    const okIndex = index.status === 200 && /markdown/.test(index.type ?? "") && /^#/.test(index.text.trimStart());
    const sf = okIndex ? (twins.length === pages.length ? 2 : 1) : 0;
    set("markdown-url-fallback", { score: sf, max: 2, status: statusOf(sf, 2), evidence: `/index.md: ${index.status} ${index.type ?? ""}; ${twins.length}/${pages.length} pages have a .md twin at the same path.` });
    const mdFiles = pages.map(p => p.replace(/\.html$/, ".md")).filter(p => existsSync(join(site.dir, p)));
    const withFront = mdFiles.filter(p => /^---\n[\s\S]*?\btitle:[\s\S]*?\n---\n/.test(readFileSync(join(site.dir, p), "utf8")));
    const sfm = mdFiles.length ? withFront.length / mdFiles.length : 0;
    set("markdown-frontmatter", { score: sfm, max: 1, status: statusOf(sfm, 1), evidence: `${withFront.length}/${mdFiles.length} Markdown pages open with a --- frontmatter block carrying a title.`, fix: sfm < 1 ? "Open each .md twin with frontmatter: title, description (the summary), canonical (the HTML page's absolute URL when baseUrl is set), and the module version. Keep llms-full.txt readable (strip or keep per page)." : undefined });
    const unbalanced = mdFiles.filter(p => !fencesBalanced(readFileSync(join(site.dir, p), "utf8")));
    set("code-fence-validity", { score: unbalanced.length ? 0 : 1, max: 1, status: unbalanced.length ? "fail" : "pass", evidence: `${mdFiles.length - unbalanced.length}/${mdFiles.length} Markdown pages close every code fence.`, where: unbalanced.slice(0, 5) });
  }

  // Assemble, in rule order, and score with Ora's formula.
  const findings: Finding[] = RULES.map(rule => {
    const r = results.get(rule.id);
    if (!r) return { rule: rule.id, name: rule.name, owner: rule.owner, status: "info" as Status, evidence: "not measured", source: SOURCE };
    return { rule: rule.id, name: rule.name, owner: r.owner ?? rule.owner, file: rule.file, source: SOURCE, ...r, ...(rule.state === "emerging" ? { evidence: `[emerging, unscored] ${r.evidence}` } : rule.state === "bonus" ? { evidence: `[bonus] ${r.evidence}` } : {}) };
  });
  const layers: Record<string, { earned: number; available: number }> = {};
  for (const rule of RULES) {
    if (!rule.layer || rule.state === "emerging" || rule.state === "na") continue;
    const r = results.get(rule.id);
    if (!r || r.status === "na" || r.score === undefined) continue;
    const layer = (layers[rule.layer] ??= { earned: 0, available: 0 });
    layer.earned += r.score;
    layer.available += rule.state === "bonus" ? r.score : rule.max;
  }
  let weighted = 0;
  let weights = 0;
  for (const [id, l] of Object.entries(layers)) {
    if (l.available === 0) continue;
    weighted += LAYER_WEIGHTS[id as Layer] * (l.earned / l.available);
    weights += LAYER_WEIGHTS[id as Layer];
  }
  return { score: weights ? Math.round((100 * weighted) / weights) : 0, findings, pages, layers };
}

/** The representative pages, and when the site is large, an even sample of the rest. */
function samplePages(site: Site, limit: number): string[] {
  const { overview, package: pkg, smallType, largestType, all } = site.pages;
  if (all.length <= limit) return all;
  const picked = new Set([overview, pkg, smallType, largestType]);
  const step = all.length / (limit - picked.size);
  for (let i = 0; i < all.length && picked.size < limit; i += step) picked.add(all[Math.floor(i)]!);
  return [...picked];
}

/** Whether a robots.txt lets a user agent fetch a path: the most specific matching group, then the longest matching rule. */
export function robotsAllows(robots: string, agent: string, path: string): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let current: (typeof groups)[number] | undefined;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!lastWasAgent || !current) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && (key === "allow" || key === "disallow") && value) current.rules.push({ allow: key === "allow", path: value });
    }
  }
  const name = agent.toLowerCase();
  const group = groups.find(g => g.agents.some(a => a !== "*" && name.startsWith(a))) ?? groups.find(g => g.agents.includes("*"));
  if (!group) return true;
  const matches = group.rules.filter(r => pathMatches(r.path, path)).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return matches[0]?.allow ?? true;
}

function pathMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern).split("*").map(s => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

/** Whether every ``` or ~~~ fence in a Markdown document is closed (CommonMark: a closing fence uses the same character, at least as long). */
export function fencesBalanced(md: string): boolean {
  let open: { char: string; len: number } | undefined;
  for (const line of md.split("\n")) {
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!m) continue;
    const fence = m[1]!;
    if (!open) {
      if (fence[0] === "`" && m[2]!.includes("`")) continue;
      open = { char: fence[0]!, len: fence.length };
    } else if (fence[0] === open.char && fence.length >= open.len && m[2]!.trim() === "") open = undefined;
  }
  return !open;
}

interface Got {
  status: number;
  type?: string;
  text: string;
  headers: Headers;
}

async function get(url: string, headers: Record<string, string> = {}): Promise<Got> {
  try {
    const r = await fetch(url, { headers, redirect: "manual" });
    return { status: r.status, type: r.headers.get("content-type") ?? undefined, text: await r.text(), headers: r.headers };
  } catch (e) {
    return { status: 0, text: String(e), headers: new Headers() };
  }
}

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await work(items[next++]!);
  }));
}

function statusOf(score: number, max: number): Status {
  return score >= max - 1e-9 ? "pass" : score <= 0 ? "fail" : "partial";
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const unique = (list: string[]) => [...new Set(list)];
