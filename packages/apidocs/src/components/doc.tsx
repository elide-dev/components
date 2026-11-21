/** Documentation trees, signatures and code blocks as static markup. */
import type { ComponentChildren, JSX } from "preact";
import { usePage } from "../context";
import { highlight } from "../highlight";
import type { Block, Inline, Token } from "../model";
import { sanitize } from "../sanitize";
import { resolveRef, resolveToken } from "../site";
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
    case "link": {
      const label = node.code ? <code><Inlines nodes={node.children} /></code> : <Inlines nodes={node.children} />;
      const href = node.target ? resolveRef(ctx.site, ctx.page, ".html", node.target) : node.url;
      return href ? <a href={href}>{label}</a> : label;
    }
  }
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
export function CopyButton({ label }: { label: string }) {
  return <button type="button" class="copy" data-copy hidden aria-label={label} title={label}>Copy</button>;
}

/** Tokens as code: types link to their pages, or to external documentation. */
export function TokenList({ tokens }: { tokens: Token[] | undefined }) {
  const ctx = usePage();
  return (
    <>
      {(tokens ?? []).map((token, i) => {
        switch (token.kind) {
          case "punct": return token.text;
          case "type":
          case "annotation": {
            const href = resolveToken(ctx.site, ctx.page, ".html", token);
            const cls = token.kind === "type" ? "tk-t" : "tk-a";
            return href ? <a key={i} class={cls} href={href}>{token.text}</a> : <span key={i} class={cls}>{token.text}</span>;
          }
          default: return <span key={i} class={TOKEN_CLASS[token.kind]}>{token.text}</span>;
        }
      })}
    </>
  );
}

const TOKEN_CLASS: Record<string, string> = {
  keyword: "tk-k", name: "tk-n", typeParam: "tk-tp", literal: "tk-l", param: "tk-p",
};

/** A declaration signature, laid out over several lines when long, with a copy button. */
export function Signature({ tokens, annotations, large }: { tokens: Token[]; annotations?: Token[][]; large?: boolean }) {
  return (
    <div class={large ? "sig sig-large" : "sig"}>
      <pre><code>
        {(annotations ?? []).map((a, i) => <span key={i} class="sig-annotation"><TokenList tokens={a} />{"\n"}</span>)}
        <TokenList tokens={layoutSignature(tokens)} />
      </code></pre>
      <CopyButton label="Copy signature" />
    </div>
  );
}

export function Badge({ tone, children, title }: { tone?: string; children: ComponentChildren; title?: string }) {
  return <span class={tone ? `badge badge-${tone}` : "badge"} title={title}>{children}</span>;
}
