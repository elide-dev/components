/** The three page kinds: the module overview, a package, and a type. */
import { usePage } from "./context";
import type { Inherited, Member, Package, Ref, Token, Type } from "./model";
import { INDEX, indexPages, overviewGuide, packagePage, refLabel, relative, resolve, rootOf, type Site, typePage } from "./site";
import { compactTokens, memberGroups, rowTokens, memberTitle, summaryText, typeGroups, typeKindWord } from "./structure";
import { Badge, CopyButton, Blocks, Inlines, Signature, TokenList, withoutImpliedVisibility } from "./components/doc";
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
    isPartOf: { "@type": "SoftwareSourceCode", name: m.name, ...(m.version ? { version: m.version } : {}) },
  };
}

// ---- The page a host serves for a missing URL (404.html).

export function NotFoundPage() {
  const { site, page } = usePage();
  const m = site.model.module;
  const description = `There is no such page in ${m.name}.`;
  const links = [{ page: INDEX, label: "Overview" }, ...indexPages(site)];
  return (
    <Shell title={`Not found (${moduleTitle()})`} description={description} crumbs={[]} toc={[]} jsonLd={{ "@context": "https://schema.org", "@type": "WebPage", name: "Not found", description }}
      meta={{ kind: "notfound" }}>
      <header class="page-head">
        <h1>Not found</h1>
      </header>
      <div class="prose">
        <p>There is no such page in {m.name}. It may have moved, or the link may be wrong. Search above, or start from one of these:</p>
        <ul>
          {links.map(link => <li key={link.page}><a href={relative(page, link.page, ".html")}>{link.label}</a></li>)}
          <li><a href={`${rootOf(page)}llms.txt`}>llms.txt</a>, every page as Markdown</li>
        </ul>
      </div>
    </Shell>
  );
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

/**
 * The overview's packages, each with its types as declarations: the one place that lists the module's contents.
 * The package and type index pages still exist at their URLs, but the navigator and the overview no longer send
 * readers to them.
 */
function PackageSections() {
  const { site } = usePage();
  return (
    <section id="packages" class="section">
      <h2>Packages</h2>
      {site.packages.map(pkg => {
        const tops = (pkg.types ?? []).filter(t => !t.enclosing);
        return (
          <section key={pkg.id} id={pkg.name ? `package-${pkg.name}` : "package-default"} class="package-block">
            <h3 class="package-name">
              <a href={relative(INDEX, packagePage(pkg), ".html")}><code>{pkg.name || "(default package)"}</code></a>
              {pkg.deprecated && <Badge tone="deprecated">deprecated</Badge>}
              <span class="package-count">{tops.length === 1 ? "1 type" : `${tops.length} types`}</span>
            </h3>
            {pkg.doc?.summary?.length ? <p class="package-summary"><Inlines nodes={pkg.doc.summary} /></p> : null}
            {tops.length > 0 && <DeclList types={tops} pkg={pkg} />}
          </section>
        );
      })}
      {/* The old "All types" anchor, which links from elsewhere still name, lands on the package list. */}
      <span id="all-types" />
    </section>
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
      crumbs={[{ label: usePage().site.model.module.name, page: INDEX, symbol: true }, { label: pkg.name, symbol: true }]}
      toc={toc}
      jsonLd={jsonLd(pkg.name, description, "package")}
      meta={{ kind: "package", id: pkg.id, package: pkg.name, keywords: [pkg.name, ...tops.map(t => t.name)].slice(0, 24) }}
    >
      <header class="page-head">
        <div class="page-name">
          <h1><code>{pkg.name || "(default package)"}</code></h1>
          {pkg.name && <CopyButton label="Copy the package name" text={pkg.name} />}
        </div>
        <p class="page-meta">
          {packageLanguages(pkg, usePage().site.model.module.languages).map(l => <LanguageMark key={l} language={l} label />)}
          <span class="kind-word">package</span>
          {pkg.since && <Badge tone="since">since {pkg.since}</Badge>}
          {pkg.nullMarked && <Badge tone="non-null" title="JSpecify @NullMarked: types are non-null unless annotated">null-marked</Badge>}
          {pkg.deprecated && <Badge tone="deprecated">deprecated</Badge>}
        </p>
      </header>
      <DeprecationBanner deprecation={pkg.deprecated} />
      {pkg.doc?.body && <section id="doc-description"><Fold><div class="prose"><Blocks nodes={pkg.doc.body} offset={0} /></div></Fold></section>}
      <Notes notes={pkg.doc?.notes} />
      <SeeAlso doc={pkg.doc} level={2} />
      {groups.map(group => (
        <section key={group.id} id={group.id} class="section">
          <h2>{group.title}</h2>
          <DeclList types={group.types} pkg={pkg} />
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
  const inherited = inheritedMembers(site, type);
  // Inherited members by group, in the groups' order; a group may hold only inherited members.
  const inheritedGroups = new Map(memberGroups({ ...type, members: inherited.resolved.map(r => r.member) }).map(g => [g.id, g.members]));
  const fromOf = new Map(inherited.resolved.map(r => [r.member, r.from]));
  const allGroups = memberGroups({ ...type, members: [...(type.members ?? []), ...inherited.resolved.map(r => r.member)] })
    .map(g => ({ id: g.id, title: g.title, declared: groups.find(d => d.id === g.id)?.members ?? [], inherited: inheritedGroups.get(g.id) ?? [] }));
  const extensions = extensionsOf(site, type);
  const crumbs: Crumb[] = [
    { label: site.model.module.name, page: INDEX, symbol: true },
    { label: pkg.name, page: packagePage(pkg), symbol: true },
  ];
  const chain: Type[] = [];
  for (let t: Type | undefined = type; t; t = t.enclosing ? site.types.get(t.enclosing)?.type : undefined) chain.unshift(t);
  for (const t of chain) crumbs.push({ label: t.name.split(".").pop()!, page: typePage(pkg, t), symbol: true });

  const toc: TocItem[] = [{ id: "doc-description", label: "Description", depth: 1 }];
  if (type.components?.length) toc.push({ id: "record-components", label: "Record components", depth: 1 });
  if (entry.nested.length) toc.push({ id: "nested-types", label: "Nested types", depth: 1 });
  for (const group of groups) {
    toc.push({ id: group.id, label: group.title, depth: 1 });
    for (const member of group.members) toc.push({ id: member.anchor, label: memberTitle(member), depth: 2, code: true });
  }
  if (extensions.length) toc.push({ id: "extension-details", label: "Extensions", depth: 1 });
  if (inherited.external.length) toc.push({ id: "inherited-members", label: "Inherited members", depth: 1 });

  return (
    <Shell title={`${type.name} (${moduleTitle()})`} description={description} crumbs={crumbs} toc={toc} jsonLd={jsonLd(type.name, description, typeKindWord(type))}
      meta={{
        kind: "type", id: type.id, package: pkg.name, language: type.language,
        keywords: [type.name, `${pkg.name}.${type.name}`, typeKindWord(type), ...new Set((type.members ?? []).map(member => member.name))].slice(0, 32),
      }}>
      <header class="page-head">
        <div class="page-name">
          <h1 data-kind={type.kind}><span class="glyph glyph-large" data-tone={kindGlyph(type).tone} aria-hidden="true">{kindGlyph(type).letter}</span>{type.name}</h1>
          <CopyButton label="Copy the qualified name" text={pkg.name ? `${pkg.name}.${type.name}` : type.name} />
        </div>
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
      <section id="doc-description">
        {type.doc?.body?.length ? <Fold><div class="prose"><Blocks nodes={type.doc.body} offset={0} /></div></Fold> : <p class="undocumented">No description.</p>}
      </section>
      <Notes notes={type.doc?.notes} />
      {type.components?.length ? (
        <section id="record-components" class="section-tight"><Params params={type.components} title="Record components" ids level={2} /></section>
      ) : null}
      <TypeParams params={type.typeParams} level={2} />
      <SeeAlso doc={type.doc} level={2} />

      {inherited.resolved.length > 0 && <MembersFilter count={inherited.resolved.length} />}
      {allGroups.map(group => (
        <section key={group.id} id={group.id} class="section members" data-inherited-only={group.declared.length ? undefined : ""}>
          <MembersHeading title={group.title} count={group.declared.length} inherited={group.inherited.length} />
          {group.declared.map((member, i) => (
            <MemberDetail key={member.id} member={member} overload={i > 0 && group.declared[i - 1]!.name === member.name} summary={<MemberSummarySignature member={member} />} />
          ))}
          {group.inherited.map(member => <LinkedRow key={member.id} member={member} mark={`from ${refLabel(site, fromOf.get(member)!)}`} inherited />)}
        </section>
      ))}
      {extensions.length > 0 && (
        <section id="extension-details" class="section members">
          <MembersHeading title="Extensions" count={extensions.length} toggle={false} />
          {extensions.map(({ member, pkg: at }) => <LinkedRow key={member.id} member={member} mark={`in ${at.name}`} />)}
        </section>
      )}
      {/* Said, not left to an absent heading: a type that only holds nested types must not read as one whose nested
          types are its members. */}
      {groups.length === 0 && (
        <p class="empty" id="no-members">{type.inherited?.length ? `${type.name.split(".").pop()} declares no members of its own.` : `${type.name.split(".").pop()} has no members.`}</p>
      )}

      {entry.nested.length > 0 && (
        <section id="nested-types" class="section">
          <h2>Nested types</h2>
          <DeclList types={entry.nested} pkg={pkg} within={type.name} />
        </section>
      )}

      {inherited.external.length ? (
        <section id="inherited-members" class="section">
          <h2>Inherited members</h2>
          {inherited.external.map(group => (
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
function MembersHeading({ title, count, inherited = 0, toggle = true }: { title: string; count: number; inherited?: number; toggle?: boolean }) {
  return (
    <h2 class="members-heading">
      <span>{title}</span>
      <span class="members-count">{count}{inherited > 0 && <span class="members-inherited-count"> + {inherited} inherited</span>}</span>
      {toggle && <button type="button" class="members-toggle" data-expand-all data-js-only aria-expanded="false">Expand all</button>}
    </h2>
  );
}

/**
 * A type's inherited members: those this site documents, as members (with the type they come from), and the groups
 * whose members it does not, such as a JDK class's, which the page lists by name.
 */
export function inheritedMembers(site: Site, type: Type): { resolved: { member: Member; from: Ref }[]; external: Inherited[] } {
  const resolved: { member: Member; from: Ref }[] = [];
  const external: Inherited[] = [];
  for (const group of type.inherited ?? []) {
    const owner = site.types.get(group.from.id)?.type;
    const left: Ref[] = [];
    for (const ref of group.members ?? []) {
      const member = owner && site.types.get(ref.id.split("#")[0]!)?.type.members?.find(m => m.id === ref.id);
      if (member) resolved.push({ member, from: { id: ref.id.split("#")[0]! } });
      else left.push(ref);
    }
    if (left.length) external.push({ ...group, members: left });
  }
  return { resolved, external };
}

/**
 * The Kotlin extensions this site documents whose receiver is the type itself (not a type built from it, such as a
 * list of it), in package order: a Kotlin reader looks for them with the type's members.
 */
export function extensionsOf(site: Site, type: Type): { member: Member; pkg: Package }[] {
  const out: { member: Member; pkg: Package }[] = [];
  for (const pkg of site.packages) {
    for (const member of [...(pkg.functions ?? []), ...(pkg.properties ?? [])]) {
      if (member.receiver?.type.find(token => token.kind === "type")?.ref === type.id) out.push({ member, pkg });
    }
  }
  return out;
}

/**
 * Which members the type page shows: those the type declares, or those with the ones it inherits from this site's
 * types. Two radio buttons and :has(), so it works without the script, which keeps the choice and puts it in the URL.
 */
function MembersFilter({ count }: { count: number }) {
  return (
    <>
      <fieldset class="members-filter">
        <legend class="visually-hidden">Members shown</legend>
        <label><input type="radio" name="apidocs-members" value="declared" data-members-filter checked /> Declared</label>
        <label><input type="radio" name="apidocs-members" value="all" data-members-filter /> With {count} inherited</label>
      </fieldset>
      {/* Before the rows are parsed, so a reader who chose all members never sees them arrive. */}
      <script dangerouslySetInnerHTML={{ __html: MEMBERS_BOOT }} />
    </>
  );
}

/** The switch's state from the URL (?members=) or the reader's last choice; membersFilter in behaviors.tsx keeps it. */
const MEMBERS_BOOT =
  '(function(){var v=new URLSearchParams(location.search).get("members");if(v!=="all"&&v!=="declared")try{v=localStorage.getItem("apidocs-members")}catch(e){}' +
  'if(v==="all"){var r=document.querySelector(\'input[data-members-filter][value="all"]\');if(r)r.checked=true}})()';

/**
 * A member documented elsewhere, as a row that links to its entry: an inherited member, with the type it comes from,
 * or an extension, with the package that declares it.
 */
function LinkedRow({ member, mark, inherited }: { member: Member; mark: string; inherited?: boolean }) {
  const { site, page } = usePage();
  const brief = summaryText(member.doc);
  return (
    <div class={inherited ? "member member-linked member-inherited" : "member member-linked"} data-kind={member.kind}>
      <a class="member-row" href={resolve(site, page, ".html", member.id)}>
        <span class="member-chevron" aria-hidden="true" />
        <span class="member-sig"><MemberSummarySignature member={member} /></span>
        <span class="member-brief" data-brief={brief || undefined} />
        <span class="member-marks"><span class="member-from">{mark}</span></span>
      </a>
    </div>
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
  const receiver = member.receiver ? <><TokenList plain tokens={rowTokens(member.receiver.type)} />.</> : null;
  if (member.kind === "property") {
    return <code class="summary-sig">{receiver}{name}: <TokenList plain tokens={rowTokens(member.type)} /></code>;
  }
  if (member.kind === "field") {
    return <code class="summary-sig">{statik && <span class="tk-k">static </span>}<TokenList plain tokens={rowTokens(member.type)} /> {name}</code>;
  }
  if (member.kind === "function") {
    return (
      <code class="summary-sig">
        {(member.modifiers ?? []).includes("suspend") && <span class="tk-k">suspend </span>}
        {receiver}{name}({(member.params ?? []).map((p, i) => <span key={i}>{i > 0 && ", "}<TokenList plain tokens={rowTokens(p.type)} /></span>)})
        {member.returns && <>: <TokenList plain tokens={rowTokens(member.returns.type)} /></>}
      </code>
    );
  }
  if (member.kind === "enumConstant") return <code class="summary-sig">{name}</code>;
  return (
    <code class="summary-sig">
      {statik && <span class="tk-k">static </span>}
      {member.returns && <><TokenList plain tokens={rowTokens(member.returns.type)} />{" "}</>}
      {member.kind === "method" && !member.returns && <span class="tk-k">void </span>}
      {name}(
      {(member.params ?? []).map((p, i) => <span key={i}>{i > 0 && ", "}<TokenList plain tokens={rowTokens(p.type)} /></span>)}
      )
    </code>
  );
}

/**
 * The head of a type's declaration, on one line, as a list row shows it: the modifiers, the kind and the name, with
 * a record's components and the supertype clauses left for the type's page. Inside its enclosing type's list
 * (`within`), a nested type's name drops that prefix and begins with the dot: ".Inner".
 */
export function declHead(type: Type, within?: string): Token[] {
  const tokens = compactTokens(type.signature);
  const out: Token[] = [];
  for (const token of tokens) {
    if (token.kind === "keyword" && /^(extends|implements|permits)$/.test(token.text)) break;
    if (token.kind === "punct" && /^\s*:\s*$/.test(token.text) && out.some(t => t.kind === "name")) break;
    if (token.kind === "punct" && token.text.includes("(")) {
      out.push({ kind: "punct", text: `${token.text.slice(0, token.text.indexOf("("))}(…)` });
      break;
    }
    if (token.kind === "name" && within && token.text.startsWith(`${within}.`)) {
      out.push({ ...token, text: token.text.slice(within.length) });
      continue;
    }
    out.push(token);
  }
  while (out.length && out[out.length - 1]!.kind === "punct" && !out[out.length - 1]!.text.trim()) out.pop();
  return out;
}

/** Plain text of tokens, for a title. */
function tokensText(tokens: Token[]): string {
  return tokens.map(t => t.text).join("");
}

/**
 * Types as declaration code, one per row: the declaration's head, then its summary sentence folded to two lines.
 * A type's nested types hang under it, indented, each beginning with the dot that joins it to its enclosing type.
 */
function DeclList({ types, pkg, within }: { types: Type[]; pkg: Package; within?: string }) {
  const { page, site, theme } = usePage();
  const mixed = (site.model.module.languages ?? []).length > 1;
  return (
    <ul class={within ? "decls decls-nested" : "decls"}>
      {types.map(type => {
        const head = declHead(type, within);
        const nested = within ? [] : site.types.get(type.id)!.nested;
        const glyph = kindGlyph(type);
        return (
          <li key={type.id} class={type.deprecated ? "decl-item is-deprecated" : "decl-item"}>
            <a class="decl" href={relative(page, typePage(pkg, type), ".html")} title={tokensText(compactTokens(type.signature))}>
              <span class="glyph" data-tone={glyph.tone} aria-hidden="true">{glyph.letter}</span>
              <code class="decl-sig"><TokenList plain tokens={withoutImpliedVisibility(head, theme)} /></code>
              {mixed && <LanguageMark language={type.language} />}
            </a>
            <p class="decl-summary">
              {type.deprecated && <Badge tone="deprecated">deprecated</Badge>}
              {type.doc?.summary?.length ? <Inlines nodes={type.doc.summary} /> : <span class="undocumented">No description.</span>}
            </p>
            {nested.length > 0 && <DeclList types={nested} pkg={pkg} within={type.name} />}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A description that shows its first lines and folds the rest behind "Show more". Without the script, or when
 * the description is short, it shows whole (folds() in client/behaviors.tsx).
 */
export function Fold({ children }: { children: preact.ComponentChildren }) {
  return (
    <div class="fold" data-fold>
      <div class="fold-body">{children}</div>
      <button type="button" class="fold-toggle" data-js-only aria-expanded="false" hidden>Show more</button>
    </div>
  );
}
