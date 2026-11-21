/**
 * Declaration parts. Parameters, return value and exceptions share one layout
 * (FactTable) on every declaration, so readers find them in the same place.
 * Notes are visually distinct by kind; an API note is the most prominent.
 */
import type { ComponentChildren } from "preact";
import { usePage } from "../context";
import type { Block, Deprecation, Doc, Member, Note, Nullness, Param, Ref, Thrown, Token, TypeParam } from "../model";
import { refLabel, resolve, resolveRef } from "../site";
import { sourceUrl } from "../theme";
import { safeUrl } from "../url";
import { Badge, Blocks, Cell, Inlines, Signature, TokenList } from "./doc";

export const NOTE_LABEL: Record<Note["kind"], string> = {
  apiNote: "API note",
  implSpec: "Implementation requirements",
  implNote: "Implementation note",
};

/** Notes in a fixed order: API notes first, as the ones callers need. */
export function sortedNotes(notes: Note[] | undefined): Note[] {
  const order = { apiNote: 0, implSpec: 1, implNote: 2 };
  return [...(notes ?? [])].sort((a, b) => order[a.kind] - order[b.kind]);
}

/** Icons for callouts: 16px line drawings in the callout's tone. */
const CALLOUT_ICON: Record<string, preact.ComponentChildren> = {
  // A caller's heads-up.
  apiNote: <><circle cx="8" cy="8" r="6.25" /><path d="M8 4.6v3.9" /><path d="M8 11.1v.01" /></>,
  // A requirement an override must meet.
  implSpec: <><rect x="2.75" y="2.75" width="10.5" height="10.5" rx="2.5" /><path d="M5.4 8.2l1.8 1.8 3.4-3.9" /></>,
  // A fact about the code.
  implNote: <path d="M6 4.5 2.75 8 6 11.5M10 4.5 13.25 8 10 11.5" />,
  deprecated: <><circle cx="8" cy="8" r="6.25" /><path d="M3.7 12.3l8.6-8.6" /></>,
};

/**
 * A callout: an icon tile, a label and the text, in a soft panel. Tone and weight come from the kind: an API note
 * and a deprecation are filled, an implementation note is an outline only.
 */
function Callout({ kind, label, children }: { kind: string; label: preact.ComponentChildren; children: preact.ComponentChildren }) {
  return (
    <div class={`callout callout-${kind}`} role="note">
      <span class="callout-icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="16" height="16">{CALLOUT_ICON[kind]}</svg>
      </span>
      <div class="callout-body">
        <p class="callout-label">{label}</p>
        {children}
      </div>
    </div>
  );
}

export function Notes({ notes }: { notes: Note[] | undefined }) {
  if (!notes?.length) return null;
  return (
    <>
      {sortedNotes(notes).map((note, i) => (
        <Callout key={i} kind={note.kind} label={NOTE_LABEL[note.kind]}>
          <Blocks nodes={note.body} offset={3} />
        </Callout>
      ))}
    </>
  );
}

export function DeprecationBanner({ deprecation }: { deprecation: Deprecation | undefined }) {
  if (!deprecation) return null;
  const title = deprecation.forRemoval ? "Deprecated for removal" : "Deprecated";
  return (
    <Callout kind="deprecated" label={<>{title}{deprecation.since && <span class="callout-aside"> since {deprecation.since}</span>}</>}>
      <Blocks nodes={deprecation.doc} offset={3} />
    </Callout>
  );
}

export function NullnessBadge({ nullness }: { nullness: Nullness | undefined }) {
  if (!nullness) return null;
  return nullness === "nullable"
    ? <Badge tone="nullable" title="May be null">nullable</Badge>
    : <Badge tone="non-null" title="Never null">non-null</Badge>;
}

interface Fact {
  id?: string;
  name?: ComponentChildren;
  type?: Token[];
  badges?: ComponentChildren;
  doc?: Block[];
}

/** The shared layout of parameters, type parameters, return values and exceptions. */
export function FactTable({ title, facts, names = true, level = 4 }: { title: string; facts: Fact[]; names?: boolean; level?: number }) {
  if (!facts.length) return null;
  const Heading = `h${level}` as "h4";
  return (
    <div class="facts">
      <Heading class="facts-title">{title}</Heading>
      <dl class={names ? "facts-list" : "facts-list facts-unnamed"}>
        {facts.map((fact, i) => (
          <div key={i} class="fact" id={fact.id}>
            <dt>
              {names && <code class="fact-name">{fact.name}</code>}
              {fact.type && fact.type.length > 0 && <code class="fact-type"><TokenList tokens={fact.type} /></code>}
              {fact.badges}
            </dt>
            <dd>{fact.doc && fact.doc.length > 0 ? <Cell blocks={fact.doc} /> : <span class="undocumented">No description.</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function TypeParams({ params, level }: { params: TypeParam[] | undefined; level?: number }) {
  const documented = (params ?? []).filter(p => p.doc?.length);
  return <FactTable title="Type parameters" level={level} facts={documented.map(p => ({ name: `<${p.name}>`, doc: p.doc }))} />;
}

export function Params({ params, title = "Parameters", ids, level }: { params: Param[] | undefined; title?: string; ids?: boolean; level?: number }) {
  return (
    <FactTable
      title={title}
      level={level}
      facts={(params ?? []).map(p => ({
        id: ids ? `param-${p.name}` : undefined,
        name: p.name,
        type: p.type,
        badges: <>{p.defaultValue && <code class="default-arg" title="Default argument">= {p.defaultValue}</code>}<NullnessBadge nullness={p.nullness} /></>,
        doc: p.doc,
      }))}
    />
  );
}

export function Throws({ exceptions }: { exceptions: Thrown[] | undefined }) {
  return (
    <FactTable
      title="Throws"
      names={false}
      facts={(exceptions ?? []).map(t => ({
        type: t.type,
        badges: t.declared ? undefined : <Badge title="Unchecked; not in the throws clause">unchecked</Badge>,
        doc: t.doc,
      }))}
    />
  );
}

export function SeeAlso({ doc, level = 4 }: { doc: Doc | undefined; level?: number }) {
  if (!doc?.see?.length) return null;
  const Heading = `h${level}` as "h4";
  return (
    <div class="see">
      <Heading class="facts-title">See also</Heading>
      <ul class="see-list">{doc.see.map((entry, i) => <li key={i}><Inlines nodes={entry} /></li>)}</ul>
    </div>
  );
}

export function RefLink({ refValue, children }: { refValue: Ref; children?: ComponentChildren }) {
  const ctx = usePage();
  const href = resolveRef(ctx.site, ctx.page, ".html", refValue);
  const label = children ?? <code>{refLabel(ctx.site, refValue)}</code>;
  return href ? <a href={href}>{label}</a> : <>{label}</>;
}

export function SourceLink({ path, line }: { path: string; line: number }) {
  const { theme } = usePage();
  const url = safeUrl(sourceUrl(theme, path, line));
  return url ? <a class="source-link" href={url}>Source</a> : null;
}

const KIND_WORD: Record<Member["kind"], string> = {
  constructor: "Constructor", method: "Method", field: "Field", enumConstant: "Enum constant",
  annotationElement: "Element", function: "Function", property: "Property",
};

/** Modifiers worth a badge: they change how a member is called or overridden. */
const SHOWN_MODIFIERS = new Set(["static", "abstract", "default", "suspend", "inline", "operator", "infix", "override", "const", "lateinit", "open", "external", "tailrec"]);

/** One member, in full: what a reader opens the page for. */
export function MemberDetail({ member }: { member: Member }) {
  const ctx = usePage();
  const doc = member.doc;
  const statics = (member.modifiers ?? []).filter(m => SHOWN_MODIFIERS.has(m));
  return (
    <section class="member" id={member.anchor} data-kind={member.kind}>
      <header class="member-head">
        <h3 class="member-name">
          <a class="anchor" href={resolve(ctx.site, ctx.page, ".html", member.id)} aria-label={`${KIND_WORD[member.kind]} ${member.name}`}>
            {member.name}
          </a>
        </h3>
        <span class="member-badges">
          {statics.map(m => <Badge key={m}>{m}</Badge>)}
          {member.implicit && <Badge title="Declared by the compiler">implicit</Badge>}
          {member.deprecated && <Badge tone="deprecated">{member.deprecated.forRemoval ? "deprecated for removal" : "deprecated"}</Badge>}
          {member.since && <Badge tone="since" title={`Since ${member.since}`}>since {member.since}</Badge>}
          {member.source && <SourceLink path={member.source.path} line={member.source.line} />}
        </span>
      </header>
      <Signature tokens={member.signature} annotations={member.annotations} />
      <DeprecationBanner deprecation={member.deprecated} />
      {doc?.body && doc.body.length > 0
        ? <div class="prose"><Blocks nodes={doc.body} offset={2} /></div>
        : !member.implicit && <p class="undocumented">No description.</p>}
      {doc?.inheritedFrom && (
        <p class="inherited-from">Description copied from <RefLink refValue={doc.inheritedFrom} />.</p>
      )}
      <TypeParams params={member.typeParams} />
      {member.receiver && (
        <FactTable title="Receiver" names={false} facts={[{ type: member.receiver.type, badges: <NullnessBadge nullness={member.receiver.nullness} />, doc: member.receiver.doc }]} />
      )}
      <Params params={member.params} />
      {member.returns && (
        <FactTable
          title="Returns"
          names={false}
          facts={[{ type: member.returns.type, badges: <NullnessBadge nullness={member.returns.nullness} />, doc: member.returns.doc }]}
        />
      )}
      {(member.kind === "field" || member.kind === "property") && member.type && (member.nullness || member.constant) && (
        <FactTable
          title="Value"
          names={false}
          facts={[{
            type: member.type,
            badges: <NullnessBadge nullness={member.nullness} />,
            doc: member.constant ? [{ kind: "paragraph", children: [{ kind: "text", text: "Constant: " }, { kind: "code", text: member.constant }] }] : undefined,
          }]}
        />
      )}
      {member.defaultValue && <p class="default-value">Default: <code>{member.defaultValue}</code></p>}
      <Throws exceptions={member.throws} />
      <Notes notes={doc?.notes} />
      {member.overrides && <p class="overrides">Overrides <RefLink refValue={member.overrides} />.</p>}
      <SeeAlso doc={doc} />
    </section>
  );
}
