/**
 * Guides: narrative pages beside the API reference. A guide's body is the same block tree as a documentation
 * comment, so it renders with the same components; this file adds what prose needs on top: headings with
 * stable anchors that the "On this page" rail lists, sections, admonitions in every tone, the previous and next
 * guides, and the list of guides for the module overview.
 *
 * Class names and data attributes the stylesheet and the client script read:
 *   article.guide[data-guide-id][data-reading-progress]   the page's article
 *   .guide-head, .guide-kicker, .guide-summary              the header: group or "Guide", title, summary
 *   .guide-body, .guide-intro, section.guide-section        the text; one section per level-2 heading
 *   .guide-heading, a.heading-anchor                        headings with a link to themselves
 *   nav.guide-pager, a.guide-pager-link.guide-prev/.guide-next, .guide-pager-dir, .guide-pager-title
 *   section#guides.guide-index, .guide-group, .guide-group-title, ul.guide-cards, li.guide-card,
 *   a.guide-card-link, .guide-card-title, .guide-card-summary   the overview's list of guides
 * Admonitions render through Callout as .callout.callout-<tone>.
 */
import type { ComponentChildren } from "preact";
import { usePage } from "./context";
import type { Block, Heading } from "./model";
import { type GuideEntry, type GuideGroup, guideCrumbs, guideNav, INDEX } from "./site";
import { ADMONITION_LABEL, guideHeadingLevel, summaryText } from "./structure";
import { Callout } from "./components/callout";
import type { PageMeta, TocItem } from "./components/chrome";
import { Shell } from "./components/chrome";
import { SourceLink } from "./components/declaration";
import { Blocks, Inlines } from "./components/doc";
import { SYMBOLS } from "./symbols";
import { guideIcon } from "./theme";

export { ADMONITION_LABEL, guideCrumbs, guideNav };
export type { GuideGroup, GuideLink, GuideNav } from "./site";

function moduleTitle(): string {
  const m = usePage().site.model.module;
  return m.version ? `${m.name} ${m.version}` : m.name;
}

/** The "On this page" entries of a guide: its sections, with subsections under them. */
export function guideToc(entry: GuideEntry): TocItem[] {
  return entry.sections.map(s => ({ id: s.anchor, label: s.text, depth: s.level === 2 ? 1 : 2 }));
}

/**
 * A guide's page. The overview guide (the module's overview page) has no breadcrumbs or kicker, and `children`
 * follow its text: the package and type lists when the model also has an API reference.
 */
export function GuidePage({ entry, children, extraToc = [] }: { entry: GuideEntry; children?: ComponentChildren; extraToc?: TocItem[] }) {
  const { site, theme, page } = usePage();
  const g = entry.guide;
  const m = site.model.module;
  const overview = entry.page === INDEX;
  const description = summaryText({ summary: g.summary }) || `${g.title}: a guide to ${m.name}.`;
  const crumbs = guideCrumbs(site, entry);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    name: g.title,
    headline: g.title,
    description,
    isPartOf: { "@type": "SoftwareSourceCode", name: m.name, ...(m.version ? { version: m.version } : {}) },
  };
  const nav = guideNav(site, page);
  const meta: PageMeta = { kind: overview ? "module" : "guide", id: g.id, keywords: [g.title, ...(entry.group ? [entry.group] : []), ...entry.sections.map(s => s.text)] };
  const title = overview && g.title === m.name ? moduleTitle() : `${g.title} (${moduleTitle()})`;
  return (
    <Shell title={title} description={description} crumbs={crumbs} heading={g.title} toc={[...guideToc(entry), ...extraToc]} jsonLd={jsonLd} meta={meta}>
      <article class="guide" data-guide-id={g.id} data-reading-progress>
        <header class="page-head guide-head">
          {/* The section's name, unless this is the section's own page, whose title already says it. */}
          {!overview && entry.group !== g.title && <p class="guide-kicker">{entry.group ?? "Guide"}</p>}
          <h1>{g.title}</h1>
          {g.summary?.length ? <p class="lede guide-summary"><Inlines nodes={g.summary} /></p> : null}
          {g.source && <p class="page-meta"><SourceLink path={g.source.path} line={g.source.line} /></p>}
        </header>
        <div id="guide-body" class="prose guide-body">
          <GuideSections entry={entry} />
        </div>
        {children}
        {(nav.prev || nav.next) && (
          <nav class="guide-pager" aria-label="Previous and next guides">
            {nav.prev && (
              <a class="guide-pager-link guide-prev" rel="prev" href={nav.prev.href}>
                <span class="guide-pager-dir">Previous</span>
                <span class="guide-pager-title">{nav.prev.title}</span>
              </a>
            )}
            {nav.next && (
              <a class="guide-pager-link guide-next" rel="next" href={nav.next.href}>
                <span class="guide-pager-dir">Next</span>
                <span class="guide-pager-title">{nav.next.title}</span>
              </a>
            )}
          </nav>
        )}
      </article>
    </Shell>
  );
}

/** The body split at its level-2 headings: an introduction, then one section element per heading. */
function GuideSections({ entry }: { entry: GuideEntry }) {
  const intro: Block[] = [];
  const sections: { heading: Heading; blocks: Block[] }[] = [];
  for (const node of entry.guide.body ?? []) {
    if (node.kind === "heading" && guideHeadingLevel(node) === 2) sections.push({ heading: node, blocks: [] });
    else if (sections.length) sections[sections.length - 1]!.blocks.push(node);
    else intro.push(node);
  }
  return (
    <>
      {intro.length > 0 && <div class="guide-intro"><GuideBlocks entry={entry} nodes={intro} /></div>}
      {sections.map((section, i) => (
        <section key={i} class="guide-section" aria-labelledby={entry.anchors.get(section.heading)}>
          <GuideBlocks entry={entry} nodes={[section.heading, ...section.blocks]} />
        </section>
      ))}
    </>
  );
}

/**
 * Guide blocks: headings carry their anchors, and admonitions, lists and quotes recurse so headings inside them
 * do too. Every other block renders as in a documentation comment.
 */
function GuideBlocks({ entry, nodes }: { entry: GuideEntry; nodes: Block[] | undefined }) {
  return <>{(nodes ?? []).map((node, i) => <GuideBlock key={i} entry={entry} node={node} />)}</>;
}

function GuideBlock({ entry, node }: { entry: GuideEntry; node: Block }) {
  const { page } = usePage();
  switch (node.kind) {
    case "heading": {
      const anchor = entry.anchors.get(node)!;
      const Tag = `h${guideHeadingLevel(node)}` as "h2";
      const name = page.split("/").pop()!;
      return (
        <Tag id={anchor} class="doc-heading guide-heading">
          <Inlines nodes={node.children} />
          <a class="heading-anchor" href={`${name}.html#${anchor}`} aria-label="Link to this section"><span aria-hidden="true">#</span></a>
        </Tag>
      );
    }
    case "admonition":
      return (
        <Callout kind={node.tone} label={node.title?.length ? <Inlines nodes={node.title} /> : ADMONITION_LABEL[node.tone]}>
          <GuideBlocks entry={entry} nodes={node.children} />
        </Callout>
      );
    case "quote": return <blockquote><GuideBlocks entry={entry} nodes={node.children} /></blockquote>;
    case "list": {
      const items = (node.items ?? []).map((item, i) => <li key={i}><GuideBlocks entry={entry} nodes={item} /></li>);
      return node.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
    }
    default: return <Blocks nodes={[node]} offset={0} />;
  }
}

/**
 * The module overview's list of guides, as cards in reading order, grouped. Renders nothing for a model without
 * guides. For the overview page (src/pages.tsx) to place, with a rail entry { id: "guides", label: "Guides" }.
 */
export function GuideIndex({ level = 2 }: { level?: number }) {
  const { site, page, theme } = usePage();
  const { groups } = guideNav(site, page);
  if (!groups.length) return null;
  const Heading = `h${level}` as "h2";
  const GroupHeading = `h${Math.min(6, level + 1)}` as "h3";
  return (
    <section id="guides" class="section guide-index">
      <Heading>Guides</Heading>
      {groups.map(group => (
        <div key={group.title ?? ""} class="guide-group">
          {group.title && <GroupHeading class="guide-group-title">{group.title}</GroupHeading>}
          <ul class="guide-cards">
            {group.guides.map(guide => (
              <li key={guide.id} class="guide-card">
                <a class="guide-card-link" href={guide.href}>
                  {theme.guideIcons && <span class="glyph" data-tone="guide" aria-hidden="true">{guideIcon(theme, guide.slug, SYMBOLS.guide.utf)}</span>}
                  <span class="guide-card-title">{guide.title}</span></a>
                {guide.summary && <p class="guide-card-summary">{guide.summary}</p>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
