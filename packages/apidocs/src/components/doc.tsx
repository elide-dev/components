/** Documentation trees, signatures and code blocks as static markup. */
import type { ComponentChildren, JSX } from "preact";
import { usePage } from "../context";
import { ADMONITION_LABEL } from "../structure";
import { Callout } from "./callout";
import { highlight } from "../highlight";
import type { Block, Inline, Token } from "../model";
import { sanitize } from "../sanitize";
import { sanitizeSvg } from "../import/svg";
import { namespaceSvg } from "../diagram";
import { safeUrl } from "../url";
import { resolve, resolveRef, resolveToken } from "../site";
import { layoutSignature } from "../signature";

export function Inlines({ nodes }: { nodes: Inline[] | undefined }) {
  return <>{(nodes ?? []).map((node, i) => <InlineNode key={i} node={node} />)}</>;
}

function InlineNode({ node }: { node: Inline }): JSX.Element {
  const ctx = usePage();
  switch (node.kind) {
    case "text": return <>{node.text}</>;
    case "code": return <code>{node.text}</code>;
    case "emphasis": return <em><Inlines nodes={node.children} /></em>;
    case "strong": return <strong><Inlines nodes={node.children} /></strong>;
    case "break": return <br />;
    case "raw": return <span class="raw" dangerouslySetInnerHTML={{ __html: sanitize(node.html) }} />;
    case "strikethrough": return <del><Inlines nodes={node.children} /></del>;
    case "check": return <input type="checkbox" class="task-check" disabled checked={!!node.checked} aria-label={node.checked ? "Done" : "Not done"} />;
    case "image": {
      // A relative source is a path from the site's root; an unsafe one renders as its alternative text.
      const src = resolve(ctx.site, ctx.page, ".html", undefined, node.src);
      if (!src) return <>{node.alt}</>;
      return <img src={src} alt={node.alt} title={node.title} width={node.width} height={node.height} loading="lazy" decoding="async" />;
    }
    case "link": {
      const short = node.target ? shortLabel(node.children, node.target.id) : undefined;
      const text = short ? [{ kind: "text" as const, text: short }] : node.children;
      const label = node.code ? <code><Inlines nodes={text} /></code> : <Inlines nodes={text} />;
      const href = node.target ? resolveRef(ctx.site, ctx.page, ".html", node.target) : safeUrl(node.url);
      const title = short ? linkText(node.children) : undefined;
      return href ? <a href={href} title={title}>{label}</a> : label;
    }
  }
}

function linkText(nodes: Inline[] | undefined): string {
  return (nodes ?? []).map(n => (n.kind === "text" || n.kind === "code" ? n.text : "")).join("");
}

/**
 * The short form of a link whose text is its target's qualified name, as a Javadoc `{@link com.example.Frontend}`
 * gives when a file cannot import the type: "Frontend", or "Frontend.compile(Request)" for a member, with the
 * parameter types' packages dropped too. Text a writer chose (a label, a simple name) is kept: undefined then.
 */
export function shortLabel(children: Inline[] | undefined, targetId: string): string | undefined {
  const text = linkText(children).trim();
  if (!text || /\s/.test(text.replace(/,\s/g, ","))) return undefined;
  const head = text.split("(")[0]!;
  // Only text that names the target itself: its id, with a member's "#" and a nested type's "$" written as dots.
  if (!head.includes(".") || head !== targetId.split("(")[0]!.replace(/[#$]/g, ".")) return undefined;
  const parts = head.split(".");
  // The package is the run of lowercase segments before the first capitalized one.
  const first = parts.findIndex(part => /^[A-Z]/.test(part));
  if (first <= 0) return undefined;
  const params = text.includes("(") ? text.slice(text.indexOf("(")).replace(/[a-z][\w]*\.(?=[\w.]*[A-Z])/g, "") : "";
  return parts.slice(first).join(".") + params;
}

/** Blocks, with documentation headings shifted below the page's own (offset 1: an h2 in a comment becomes h3). */
export function Blocks({ nodes, offset = 1 }: { nodes: Block[] | undefined; offset?: number }) {
  return <>{(nodes ?? []).map((node, i) => <BlockNode key={i} node={node} offset={offset} />)}</>;
}

function BlockNode({ node, offset }: { node: Block; offset: number }): JSX.Element {
  const ctx = usePage();
  switch (node.kind) {
    case "paragraph": return <p><Inlines nodes={node.children} /></p>;
    case "list": {
      const items = (node.items ?? []).map((item, i) => <li key={i}><Blocks nodes={item} offset={offset} /></li>);
      return node.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
    }
    case "code": return <CodeBlock code={node.text} language={node.language ?? ctx.language} />;
    case "diagram": {
      // A model can come from any producer, so the SVG is checked again here; one that fails shows its source.
      const svg = node.svg === undefined ? undefined : sanitizeSvg(node.svg);
      if (!svg?.ok) return <CodeBlock code={node.source} language={node.language} />;
      return (
        <figure class="diagram">
          <div class="diagram-scroll" dangerouslySetInnerHTML={{ __html: namespaceSvg(svg.svg) }} />
          {node.title && <figcaption class="diagram-caption">{node.title}</figcaption>}
        </figure>
      );
    }
    case "admonition":
      return (
        <Callout kind={node.tone} label={node.title?.length ? <Inlines nodes={node.title} /> : ADMONITION_LABEL[node.tone]}>
          <Blocks nodes={node.children} offset={offset + 1} />
        </Callout>
      );
    case "heading": {
      const Tag = `h${Math.min(6, Math.max(2, node.level) + offset)}` as "h3";
      return <Tag class="doc-heading"><Inlines nodes={node.children} /></Tag>;
    }
    case "quote": return <blockquote><Blocks nodes={node.children} offset={offset} /></blockquote>;
    case "raw": return <div class="raw" dangerouslySetInnerHTML={{ __html: sanitize(node.html) }} />;
    case "table": return (
      <div class="table-scroll">
        <table class="doc-table">
          {node.caption && node.caption.length > 0 && <caption><Inlines nodes={node.caption} /></caption>}
          {node.head && node.head.length > 0 && (
            <thead>{node.head.map((row, r) => <tr key={r}>{row.map((cell, c) => <th key={c} scope="col"><Cell blocks={cell} /></th>)}</tr>)}</thead>
          )}
          <tbody>{(node.rows ?? []).map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}><Cell blocks={cell} /></td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
}

/** A table cell or description: one paragraph renders as its inlines, anything else as blocks. */
export function Cell({ blocks }: { blocks: Block[] | undefined }) {
  if (blocks?.length === 1 && blocks[0]!.kind === "paragraph") return <Inlines nodes={blocks[0]!.children} />;
  return <Blocks nodes={blocks} offset={3} />;
}

export function CodeBlock({ code, language }: { code: string; language: string | undefined }) {
  return (
    <div class="code-block">
      <pre data-lang={language}><code>{highlight(code, language).map((run, i) => run.cls ? <span key={i} class={`hl-${run.cls}`}>{run.text}</span> : run.text)}</code></pre>
      <CopyButton label="Copy code" />
    </div>
  );
}

/** A copy button: hidden until the client script shows it, so pages without JavaScript carry no dead control. */
/** A copy button: it copies `text`, or without it the code block or signature it sits in. */
export function CopyButton({ label, text }: { label: string; text?: string }) {
  return <button type="button" class="copy" data-copy data-copy-text={text} hidden aria-label={label} title={label}>Copy</button>;
}

/** Tokens as code: types link to their pages, or to external documentation. */
/** `plain` writes type references as text, for places that must hold no links, such as a disclosure's summary. */
export function TokenList({ tokens, plain }: { tokens: Token[] | undefined; plain?: boolean }) {
  const ctx = usePage();
  return (
    <>
      {(tokens ?? []).map((token, i) => {
        switch (token.kind) {
          case "punct": return token.text;
          case "type":
          case "annotation": {
            const resolved = resolveToken(ctx.site, ctx.page, ".html", token);
            const cls = token.kind === "type" ? "tk-t" : "tk-a";
            // Plain text holds no links, but a type in it still shows its hover card (client/cards.ts).
            if (plain) return <span key={i} class={cls} data-card-href={resolved}>{token.text}</span>;
            return resolved ? <a key={i} class={cls} href={resolved}>{token.text}</a> : <span key={i} class={cls}>{token.text}</span>;
          }
          default: {
            // Visibility reads as context, not as part of what a declaration is: it is styled apart (.tk-vis).
            const cls = token.kind === "keyword" && VISIBILITY.has(token.text) ? "tk-k tk-vis" : TOKEN_CLASS[token.kind];
            return <span key={i} class={cls}>{token.text}</span>;
          }
        }
      })}
    </>
  );
}

const TOKEN_CLASS: Record<string, string> = {
  keyword: "tk-k", name: "tk-n", typeParam: "tk-tp", literal: "tk-l", param: "tk-p",
};

const VISIBILITY = new Set(["public", "protected", "private", "internal"]);

/**
 * A declaration's tokens without its "public" modifier, when the theme says every declaration documented is public
 * (`visibility: "public"`): there it says nothing. Listings and member signatures use this; a page's own header keeps
 * the full declaration.
 */
export function withoutImpliedVisibility(tokens: Token[], theme: { visibility?: string }): Token[] {
  if (theme.visibility !== "public") return tokens;
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.kind === "keyword" && token.text === "public") {
      if (tokens[i + 1]?.kind === "punct" && /^\s+$/.test(tokens[i + 1]!.text)) i++;
      continue;
    }
    out.push(token);
  }
  return out;
}

/** A declaration signature, laid out over several lines when long, with a copy button. */
export function Signature({ tokens, annotations, large }: { tokens: Token[]; annotations?: Token[][]; large?: boolean }) {
  const { theme } = usePage();
  const shown = large ? tokens : withoutImpliedVisibility(tokens, theme);
  return (
    <div class={large ? "sig sig-large" : "sig"}>
      <pre><code>
        {(annotations ?? []).map((a, i) => <span key={i} class="sig-annotation"><TokenList tokens={a} />{"\n"}</span>)}
        <TokenList tokens={layoutSignature(shown)} />
      </code></pre>
      <CopyButton label="Copy signature" />
    </div>
  );
}

export function Badge({ tone, children, title }: { tone?: string; children: ComponentChildren; title?: string }) {
  return <span class={tone ? `badge badge-${tone}` : "badge"} title={title}>{children}</span>;
}
