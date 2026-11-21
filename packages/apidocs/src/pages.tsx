/** The three page kinds: the module overview, a package, and a type. */
import { usePage } from "./context";
import type { Member, Package, Token, Type } from "./model";
import { INDEX, overviewGuide, packagePage, refLabel, relative, resolve, typePage } from "./site";
import { compactTokens, memberGroups, memberTitle, summaryText, typeGroups, typeKindWord } from "./structure";
import { Badge, Blocks, Inlines, Signature, TokenList } from "./components/doc";
import type { Crumb, TocItem } from "./components/chrome";
import { LanguageMark, Shell, kindGlyph, packageLanguages } from "./components/chrome";
import { GuideIndex, GuidePage } from "./narrative";
import { DeprecationBanner, MemberDetail, Notes, Params, RefLink, SeeAlso, SourceLink, TypeParams } from "./components/declaration";

function moduleTitle(): string {
  const { site } = usePage();
  const m = site.model.module;
  return m.version ? `${m.name} ${m.version}` : m.name;
}

function jsonLd(name: string, description: string, kind: string) {
  const { site, theme, page } = usePage();
  const m = site.model.module;
  return {
    "@context": "https://schema.org",
    "@type": "APIReference",
    name,
    description,
    programmingLanguage: (m.languages ?? []).map(l => l[0]!.toUpperCase() + l.slice(1)),
    about: kind,
    ...(theme.baseUrl ? { url: `${theme.baseUrl}${page}.html` } : {}),
    isPartOf: { "@type": "SoftwareSourceCode", name: m.name, ...(m.version ? { version: m.version } : {}) },
  };
}

// ---- The module overview.

export function IndexPage() {
  const { site } = usePage();
  const m = site.model.module;
  // A model that names an overview guide shows it here: a guides-only site's introduction, or an API reference's
  // own overview text, followed by the package and type lists when there are packages.
  const overview = overviewGuide(site);
  if (overview) {
    const extra: TocItem[] = site.packages.length > 0 ? [{ id: "packages", label: "Packages", depth: 1 }, { id: "all-types", label: "All types", depth: 1 }] : [];
    return <GuidePage entry={overview} extraToc={extra}>{site.packages.length > 0 && <PackageSections />}</GuidePage>;
  }
  // Without an overview guide, a guides-only site's overview is the list of guides, with no empty package lists.
  const guidesOnly = site.packages.length === 0 && site.guides.length > 0;
  const description = summaryText(m.doc) || `${guidesOnly ? "Documentation" : "API reference"} for ${m.name}.`;
  const toc: TocItem[] = [
    ...(site.guides.length > 0 ? [{ id: "guides", label: "Guides", depth: 1 }] : []),
    ...(guidesOnly ? [] : [{ id: "packages", label: "Packages", depth: 1 }, { id: "all-types", label: "All types", depth: 1 }]),
  ];
  return (
    <Shell title={`${moduleTitle()} API`} description={description} crumbs={[]} toc={toc} jsonLd={jsonLd(m.name, description, "module")}
      meta={{ kind: "module", keywords: site.packages.map(pkg => pkg.name) }}>
      <header class="page-head">
        <h1>{m.name}</h1>
        <p class="page-meta">
          {m.version && <Badge tone="since">version {m.version}</Badge>}
          {(m.languages ?? []).map(l => <LanguageMark key={l} language={l} label />)}
        </p>
      </header>
      {m.doc?.body ? <div class="prose"><Blocks nodes={m.doc.body} offset={0} /></div> : <p class="lede">{description}</p>}
      <GuideIndex />
      {!guidesOnly && <PackageSections />}
    </Shell>
  );
}

/** The overview's package table and its types by package. */
function PackageSections() {
  const { site } = usePage();
  return (
    <>
      <section id="packages" class="section">
        <h2>Packages</h2>
        <SummaryTable
          rows={site.packages.map(pkg => ({
            key: pkg.id,
            name: <a href={relative(INDEX, packagePage(pkg), ".html")}><code>{pkg.name || "(default package)"}</code></a>,
            summary: pkg.doc?.summary,
            deprecated: !!pkg.deprecated,
          }))}
        />
      </section>
      <section id="all-types" class="section">
        <h2>All types</h2>
        {site.packages.filter(pkg => pkg.types?.length).map(pkg => (
          <div key={pkg.id} class="type-index">
            <h3><code>{pkg.name || "(default package)"}</code></h3>
            <TypeTable types={pkg.types ?? []} pkg={pkg} withKind />
          </div>
        ))}
      </section>
    </>
  );
}

// ---- A package.

export function PackagePage({ pkg }: { pkg: Package }) {
  const description = summaryText(pkg.doc) || `The ${pkg.name} package.`;
  const tops = (pkg.types ?? []).filter(t => !t.enclosing);
  const groups = typeGroups(tops);
  const sections = [
    { id: "type-aliases", title: "Type aliases", members: [] as Member[] },
    { id: "function-details", title: "Functions", members: pkg.functions ?? [] },
    { id: "property-details", title: "Properties", members: pkg.properties ?? [] },
  ].filter(section => section.members.length);
  const toc: TocItem[] = [
    ...(pkg.doc?.body ? [{ id: "doc-description", label: "Description", depth: 1 }] : []),
    ...groups.map(g => ({ id: g.id, label: g.title, depth: 1 })),
    ...(pkg.typeAliases?.length ? [{ id: "type-aliases", label: "Type aliases", depth: 1 }] : []),
    ...sections.flatMap(section => [
      { id: section.id, label: section.title, depth: 1 },
      ...section.members.map(m => ({ id: m.anchor, label: memberTitle(m), depth: 2, code: true })),
    ]),
  ];
  const empty = !pkg.types?.length && !pkg.functions?.length && !pkg.properties?.length && !pkg.typeAliases?.length;
  return (
    <Shell
      title={`${pkg.name} (${moduleTitle()})`}
      description={description}
      crumbs={[{ label: usePage().site.model.module.name, page: INDEX }, { label: pkg.name }]}
      toc={toc}
      jsonLd={jsonLd(pkg.name, description, "package")}
      meta={{ kind: "package", id: pkg.id, package: pkg.name, keywords: [pkg.name, ...tops.map(t => t.name)].slice(0, 24) }}
    >
      <header class="page-head">
        <h1><code>{pkg.name || "(default package)"}</code></h1>
        <p class="page-meta">
          {packageLanguages(pkg, usePage().site.model.module.languages).map(l => <LanguageMark key={l} language={l} label />)}
          <span class="kind-word">package</span>
          {pkg.since && <Badge tone="since">since {pkg.since}</Badge>}
          {pkg.nullMarked && <Badge tone="non-null" title="JSpecify @NullMarked: types are non-null unless annotated">null-marked</Badge>}
          {pkg.deprecated && <Badge tone="deprecated">deprecated</Badge>}
        </p>
      </header>
      <DeprecationBanner deprecation={pkg.deprecated} />
      {pkg.doc?.body && <section id="doc-description" class="prose"><Blocks nodes={pkg.doc.body} offset={0} /></section>}
      <Notes notes={pkg.doc?.notes} />
      <SeeAlso doc={pkg.doc} level={2} />
      {groups.map(group => (
        <section key={group.id} id={group.id} class="section">
          <h2>{group.title}</h2>
          <TypeTable types={group.types} pkg={pkg} />
        </section>
      ))}
      {pkg.typeAliases?.length ? (
        <section id="type-aliases" class="section members">
          <h2>Type aliases</h2>
          {pkg.typeAliases.map(alias => (
            <section key={alias.id} class="member" id={alias.name} data-kind="typeAlias">
              <header class="member-head">
                <h3 class="member-name">{alias.name}</h3>
                <span class="member-badges">
                  {alias.deprecated && <Badge tone="deprecated">deprecated</Badge>}
                  {alias.since && <Badge tone="since">since {alias.since}</Badge>}
                  {alias.source && <SourceLink path={alias.source.path} line={alias.source.line} />}
                </span>
              </header>
              <Signature tokens={alias.signature} />
              <DeprecationBanner deprecation={alias.deprecated} />
              {alias.doc?.body?.length ? <div class="prose"><Blocks nodes={alias.doc.body} offset={2} /></div> : <p class="undocumented">No description.</p>}
              <TypeParams params={alias.typeParams} />
              <Notes notes={alias.doc?.notes} />
              <SeeAlso doc={alias.doc} />
            </section>
          ))}
        </section>
      ) : null}
      {sections.map(section => (
        <section key={section.id} id={section.id} class="section members">
          <MembersHeading title={section.title} count={section.members.length} />
          {section.members.map(member => <MemberDetail key={member.id} member={member} summary={<MemberSummarySignature member={member} />} />)}
        </section>
      ))}
      {empty && <p class="empty">This package declares nothing public.</p>}
    </Shell>
  );
}

// ---- A type.

export function TypePage({ type }: { type: Type }) {
  const { site } = usePage();
  const entry = site.types.get(type.id)!;
  const pkg = entry.pkg;
  const description = summaryText(type.doc) || `The ${type.name} ${typeKindWord(type)}.`;
  const groups = memberGroups(type);
  const crumbs: Crumb[] = [
    { label: site.model.module.name, page: INDEX },
    { label: pkg.name, page: packagePage(pkg) },
  ];
  const chain: Type[] = [];
  for (let t: Type | undefined = type; t; t = t.enclosing ? site.types.get(t.enclosing)?.type : undefined) chain.unshift(t);
  for (const t of chain) crumbs.push({ label: t.name.split(".").pop()!, page: typePage(pkg, t) });

  const toc: TocItem[] = [{ id: "doc-description", label: "Description", depth: 1 }];
  if (type.components?.length) toc.push({ id: "record-components", label: "Record components", depth: 1 });
  if (entry.nested.length) toc.push({ id: "nested-types", label: "Nested types", depth: 1 });
  for (const group of groups) {
    toc.push({ id: group.id, label: group.title, depth: 1 });
    for (const member of group.members) toc.push({ id: member.anchor, label: memberTitle(member), depth: 2, code: true });
  }
  if (type.inherited?.length) toc.push({ id: "inherited-members", label: "Inherited members", depth: 1 });

  return (
    <Shell title={`${type.name} (${moduleTitle()})`} description={description} crumbs={crumbs} toc={toc} jsonLd={jsonLd(type.name, description, typeKindWord(type))}
      meta={{
        kind: "type", id: type.id, package: pkg.name, language: type.language,
        keywords: [type.name, `${pkg.name}.${type.name}`, typeKindWord(type), ...new Set((type.members ?? []).map(member => member.name))].slice(0, 32),
      }}>
      <header class="page-head">
        <h1 data-kind={type.kind}><span class="glyph glyph-large" data-tone={kindGlyph(type).tone} aria-hidden="true">{kindGlyph(type).letter}</span>{type.name}</h1>
        <p class="page-meta">
          <LanguageMark language={type.language} label />
          <span class="kind-word">{typeKindWord(type)}</span>
          <span class="in-package">in <a href={relative(entry.page, packagePage(pkg), ".html")}><code>{pkg.name}</code></a></span>
          {type.since && <Badge tone="since">since {type.since}</Badge>}
          {type.deprecated && <Badge tone="deprecated">{type.deprecated.forRemoval ? "deprecated for removal" : "deprecated"}</Badge>}
          {type.nullMarked && <Badge tone="non-null" title="JSpecify @NullMarked: types are non-null unless annotated">null-marked</Badge>}
          {type.source && <SourceLink path={type.source.path} line={type.source.line} />}
        </p>
      </header>
      <Signature tokens={type.signature} annotations={type.annotations} large />
      <Lineage type={type} />
      <DeprecationBanner deprecation={type.deprecated} />
      <section id="doc-description" class="prose">
        {type.doc?.body?.length ? <Blocks nodes={type.doc.body} offset={0} /> : <p class="undocumented">No description.</p>}
      </section>
      <Notes notes={type.doc?.notes} />
      {type.components?.length ? (
        <section id="record-components" class="section-tight"><Params params={type.components} title="Record components" ids level={2} /></section>
      ) : null}
      <TypeParams params={type.typeParams} level={2} />
      <SeeAlso doc={type.doc} level={2} />

      {entry.nested.length > 0 && (
        <section id="nested-types" class="section">
          <h2>Nested types</h2>
          <TypeTable types={entry.nested} pkg={pkg} withKind within={type.name} />
        </section>
      )}

      {groups.map(group => (
        <section key={group.id} id={group.id} class="section members">
          <MembersHeading title={group.title} count={group.members.length} />
          {group.members.map(member => <MemberDetail key={member.id} member={member} summary={<MemberSummarySignature member={member} />} />)}
        </section>
      ))}

      {type.inherited?.length ? (
        <section id="inherited-members" class="section">
          <h2>Inherited members</h2>
          {type.inherited.map(group => (
            <div key={group.from.id} class="inherited">
              <h3>From {group.kind} <RefLink refValue={group.from} /></h3>
              <p class="inherited-list">
                {(group.members ?? []).map((ref, i) => (
                  <span key={ref.id}>{i > 0 && ", "}<RefLink refValue={ref}><code>{refLabel(site, ref)}</code></RefLink></span>
                ))}
              </p>
            </div>
          ))}
        </section>
      ) : null}
    </Shell>
  );
}

/** A member group's heading: its title, how many it holds, and a control that opens or folds them all. */
function MembersHeading({ title, count }: { title: string; count: number }) {
  return (
    <h2 class="members-heading">
      <span>{title}</span>
      <span class="members-count">{count}</span>
      <button type="button" class="members-toggle" data-expand-all data-js-only aria-expanded="false">Expand all</button>
    </h2>
  );
}

/** Superclass chain, interfaces, permitted and known subtypes, enclosing type. */
function Lineage({ type }: { type: Type }) {
  const { site } = usePage();
  const entry = site.types.get(type.id)!;
  const rows: { label: string; value: preact.ComponentChildren }[] = [];
  if (type.ancestors?.length) {
    const chain = [...type.ancestors].reverse();
    rows.push({
      label: "Inheritance",
      value: (
        <ol class="chain">
          {chain.map(ref => <li key={ref.id}><RefLink refValue={ref} /></li>)}
          <li aria-current="true"><code>{type.name.split(".").pop()}</code></li>
        </ol>
      ),
    });
  }
  if (type.interfaces?.length) {
    rows.push({ label: type.kind === "interface" ? "Extends" : "Implements", value: <TokenLists lists={type.interfaces} /> });
  }
  if (type.permits?.length) {
    rows.push({ label: "Permitted subtypes", value: <RefList refs={type.permits} /> });
  }
  const permitted = new Set((type.permits ?? []).map(p => p.id));
  const known = entry.subtypes.filter(t => !permitted.has(t.id));
  if (known.length) {
    rows.push({ label: "Known subtypes", value: <RefList refs={known.map(t => ({ id: t.id }))} /> });
  }
  if (type.enclosing) rows.push({ label: "Enclosing type", value: <RefLink refValue={{ id: type.enclosing }} /> });
  if (!rows.length) return null;
  return (
    <dl class="lineage">
      {rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
    </dl>
  );
}

function RefList({ refs }: { refs: { id: string; url?: string; text?: string }[] }) {
  return <ul class="inline-list">{refs.map(ref => <li key={ref.id}><RefLink refValue={ref} /></li>)}</ul>;
}

function TokenLists({ lists }: { lists: Token[][] }) {
  return <ul class="inline-list">{lists.map((tokens, i) => <li key={i}><code><TokenList tokens={tokens} /></code></li>)}</ul>;
}

/**
 * A compact signature for a member's row: return type, name, parameter types. The row is the summary of a
 * disclosure, which may hold no links, so everything here is text; the links are in the full signature inside.
 */
function MemberSummarySignature({ member }: { member: Member }) {
  const name = <span class="member-key">{member.name}</span>;
  const statik = (member.modifiers ?? []).includes("static");
  const receiver = member.receiver ? <><TokenList plain tokens={compactTokens(member.receiver.type)} />.</> : null;
  if (member.kind === "property") {
    return <code class="summary-sig">{receiver}{name}: <TokenList plain tokens={compactTokens(member.type)} /></code>;
  }
  if (member.kind === "field") {
    return <code class="summary-sig">{statik && <span class="tk-k">static </span>}<TokenList plain tokens={compactTokens(member.type)} /> {name}</code>;
  }
  if (member.kind === "function") {
    return (
      <code class="summary-sig">
        {(member.modifiers ?? []).includes("suspend") && <span class="tk-k">suspend </span>}
        {receiver}{name}({(member.params ?? []).map((p, i) => <span key={i}>{i > 0 && ", "}<TokenList plain tokens={compactTokens(p.type)} /></span>)})
        {member.returns && <>: <TokenList plain tokens={compactTokens(member.returns.type)} /></>}
      </code>
    );
  }
  if (member.kind === "enumConstant") return <code class="summary-sig">{name}</code>;
  return (
    <code class="summary-sig">
      {statik && <span class="tk-k">static </span>}
      {member.returns && <><TokenList plain tokens={compactTokens(member.returns.type)} />{" "}</>}
      {member.kind === "method" && !member.returns && <span class="tk-k">void </span>}
      {name}(
      {(member.params ?? []).map((p, i) => <span key={i}>{i > 0 && ", "}<TokenList plain tokens={compactTokens(p.type)} /></span>)}
      )
    </code>
  );
}

interface Row {
  key: string;
  name: preact.ComponentChildren;
  kind?: string;
  summary?: import("./model").Inline[];
  deprecated?: boolean;
}

function SummaryTable({ rows, withKind }: { rows: Row[]; withKind?: boolean }) {
  return (
    <div class="table-scroll">
      <table class="summary">
        <thead>
          <tr>
            <th scope="col">Name</th>
            {withKind && <th scope="col">Kind</th>}
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key} class={row.deprecated ? "is-deprecated" : undefined}>
              <th scope="row">{row.name}</th>
              {withKind && <td class="kind-cell">{row.kind}</td>}
              <td>
                {row.deprecated && <Badge tone="deprecated">deprecated</Badge>}
                {row.summary?.length ? <Inlines nodes={row.summary} /> : <span class="undocumented">No description.</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** `within` is the enclosing type's name on a nested-types table: rows drop that prefix. */
function TypeTable({ types, pkg, withKind, within }: { types: Type[]; pkg: Package; withKind?: boolean; within?: string }) {
  const { page, site } = usePage();
  const mixed = (site.model.module.languages ?? []).length > 1;
  return (
    <SummaryTable
      withKind={withKind}
      rows={types.map(type => ({
        key: type.id,
        name: (
          <a class="type-link" href={relative(page, typePage(pkg, type), ".html")}>
            <span class="glyph" data-tone={kindGlyph(type).tone} aria-hidden="true">{kindGlyph(type).letter}</span>
            <code>{within && type.name.startsWith(`${within}.`) ? type.name.slice(within.length + 1) : type.name}</code>
            {mixed && <LanguageMark language={type.language} />}
          </a>
        ),
        kind: typeKindWord(type),
        summary: type.doc?.summary,
        deprecated: !!type.deprecated,
      }))}
    />
  );
}
