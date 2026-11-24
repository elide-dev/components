/**
 * Javadoc's index pages: every package, every type, every declaration from A to Z, and everything deprecated. Each
 * is written only when it has content (site.ts indexPages). The module overview (index.html) stays the module
 * reference.
 */
import type { ComponentChildren } from "preact";
import { Badge, Blocks, Inlines } from "./components/doc";
import type { Crumb, TocItem } from "./components/chrome";
import { kindGlyph, Shell } from "./components/chrome";
import { usePage } from "./context";
import { compareNames, deprecatedGroups, guideEntries, type IndexEntry, letterGroups, packageRows, typeRows } from "./index-data";
import { DEPRECATED_PAGE, INDEX, INDEX_ALL_PAGE, PACKAGES_PAGE, packagePage, relative, resolve, TYPES_PAGE } from "./site";

function IndexShell({ page, title, description, toc, children }: { page: string; title: string; description: string; toc: TocItem[]; children: ComponentChildren }) {
  const { site } = usePage();
  const m = site.model.module;
  const crumbs: Crumb[] = [{ label: m.name, page: INDEX, symbol: true }, { label: title }];
  const keywords = [m.name, title, "API reference", "index"];
  return (
    <Shell
      title={`${title} (${m.version ? `${m.name} ${m.version}` : m.name})`}
      description={description}
      crumbs={crumbs}
      heading={title}
      toc={toc}
      meta={{ kind: "index", keywords }}
      jsonLd={{ "@context": "https://schema.org", "@type": "CollectionPage", name: `${title} of ${m.name}`, description }}
    >
      <header class="page-head">
        <h1>{title}</h1>
      </header>
      {children}
    </Shell>
  );
}

/** A link to an index entry: its declaration's anchor, or a guide's page. */
function EntryLink({ entry, children }: { entry: IndexEntry; children: ComponentChildren }) {
  const { site, page } = usePage();
  const href = entry.page ? relative(page, entry.page, ".html") : resolve(site, page, ".html", entry.id);
  return href ? <a class="index-name" href={href}>{children}</a> : <span class="index-name">{children}</span>;
}

function Glyph({ entry }: { entry: IndexEntry }) {
  if (!entry.type) return null;
  const glyph = kindGlyph(entry.type);
  return <span class="glyph" data-tone={glyph.tone} aria-hidden="true">{glyph.letter}</span>;
}

function EntryList({ entries }: { entries: IndexEntry[] }) {
  return (
    <ul class="index-list">
      {entries.map(entry => (
        <li key={`${entry.id}|${entry.name}`} class="index-entry">
          <EntryLink entry={entry}><Glyph entry={entry} /><code>{entry.name}</code></EntryLink>{" "}
          <span class="index-where">{entry.where}</span>
          {entry.deprecation && <> <Badge tone="deprecated">{entry.deprecation.forRemoval ? "deprecated for removal" : "deprecated"}</Badge></>}
          {entry.summary?.length ? <span class="index-summary"> <Inlines nodes={entry.summary} /></span> : null}
        </li>
      ))}
    </ul>
  );
}

export function PackagesIndexPage() {
  const { site, page } = usePage();
  const rows = packageRows(site);
  return (
    <IndexShell page={PACKAGES_PAGE} title="Packages" description={`Every package of ${site.model.module.name}.`} toc={[{ id: "packages", label: "Packages", depth: 1 }]}>
      <section id="packages" class="section">
        <div class="table-scroll">
          <table class="summary">
            <thead><tr><th scope="col">Package</th><th scope="col">Types</th><th scope="col">Description</th></tr></thead>
            <tbody>
              {rows.map(({ pkg, counts }) => (
                <tr key={pkg.id} class={pkg.deprecated ? "is-deprecated" : undefined}>
                  <th scope="row"><a href={relative(page, packagePage(pkg), ".html")}><code>{pkg.name || "(default package)"}</code></a></th>
                  <td class="kind-cell">{counts.map(c => `${c.count} ${c.word}`).join(", ") || "none"}</td>
                  <td>{pkg.doc?.summary?.length ? <Inlines nodes={pkg.doc.summary} /> : <span class="undocumented">No description.</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </IndexShell>
  );
}

export function TypesIndexPage() {
  const { site } = usePage();
  return (
    <IndexShell page={TYPES_PAGE} title="All types" description={`Every type of ${site.model.module.name}, nested ones too, by name.`} toc={[{ id: "all-types-list", label: "All types", depth: 1 }]}>
      <section id="all-types-list" class="section">
        <EntryList entries={typeRows(site)} />
      </section>
    </IndexShell>
  );
}

export function IndexAllPage() {
  const { site, page } = usePage();
  const guides = guideEntries(site);
  const groups = letterGroups(site);
  const toc: TocItem[] = [...(guides.length ? [{ id: "index-guides", label: "Guides", depth: 1 }] : []), ...groups.map(g => ({ id: `index-${g.letter === "#" ? "other" : g.letter}`, label: g.letter, depth: 1 }))];
  return (
    <IndexShell page={INDEX_ALL_PAGE} title="Index" description={`Every declaration of ${site.model.module.name}, from A to Z.`} toc={toc}>
      <nav class="letter-bar" aria-label="Letters">
        {groups.map(g => <a key={g.letter} href={`${page.split("/").pop()}.html#index-${g.letter === "#" ? "other" : g.letter}`}>{g.letter}</a>)}
      </nav>
      {guides.length > 0 && (
        <section id="index-guides" class="section index-letter">
          <h2>Guides</h2>
          <EntryList entries={guides} />
        </section>
      )}
      {groups.map(g => (
        <section key={g.letter} id={`index-${g.letter === "#" ? "other" : g.letter}`} class="section index-letter">
          <h2>{g.letter}</h2>
          <EntryList entries={g.entries} />
        </section>
      ))}
    </IndexShell>
  );
}

export function DeprecatedPage() {
  const { site } = usePage();
  const groups = deprecatedGroups(site);
  return (
    <IndexShell page={DEPRECATED_PAGE} title="Deprecated" description={`Everything deprecated in ${site.model.module.name}, what to use instead, and what will be removed.`} toc={groups.map(g => ({ id: g.id, label: g.title, depth: 1 }))}>
      {groups.map(g => (
        <section key={g.id} id={g.id} class="section">
          <h2>{g.title}</h2>
          <ul class="index-list">
            {g.entries.map(entry => (
              <li key={entry.id} class="index-entry">
                <EntryLink entry={entry}><Glyph entry={entry} /><code>{entry.name}</code></EntryLink>{" "}
                <span class="index-where">{entry.where}</span>{" "}
                <Badge tone="deprecated">{entry.deprecation?.forRemoval ? "deprecated for removal" : "deprecated"}</Badge>
                {entry.deprecation?.since && <span class="index-where"> since {entry.deprecation.since}</span>}
                {entry.deprecation?.doc?.length ? <div class="index-summary"><Blocks nodes={entry.deprecation.doc} offset={3} /></div> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </IndexShell>
  );
}

export { compareNames };
