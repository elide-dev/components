import * as React from "react";
import type { CodeLine, CodeToken, InlineDecoration, LineDecoration, LineDecorationKind, TokenStyle } from "../lib/code-model";
import { decorationCovers } from "../lib/code-model";

/** Inline CSS for a model token style (ANSI attributes; classes cover highlighter tokens). */
export function tokenStyleToCss(style: TokenStyle | undefined): React.CSSProperties | undefined {
  if (!style) return undefined;
  const css: React.CSSProperties = {};
  if (style.color) css.color = style.color;
  if (style.background) css.backgroundColor = style.background;
  if (style.bold) css.fontWeight = 700;
  if (style.italic) css.fontStyle = "italic";
  if (style.dim) css.opacity = 0.6;
  const decorations = [style.underline && "underline", style.strike && "line-through"].filter(Boolean);
  if (decorations.length) css.textDecorationLine = decorations.join(" ");
  if (style.hidden) css.color = "transparent";
  return Object.keys(css).length ? css : undefined;
}

function Token({ token, links }: { token: CodeToken; links: boolean }) {
  const style = tokenStyleToCss(token.style);
  const className = token.cursor ? "eld-terminal-cursor" : token.style?.className;
  if (token.href && links) {
    return (
      <a href={token.href} className={className ? `eld-code-link ${className}` : "eld-code-link"} style={style} rel="noreferrer">
        {token.text}
      </a>
    );
  }
  if (!style && !className) return <>{token.text}</>;
  return (
    <span className={className} style={style}>
      {token.text}
    </span>
  );
}

/** Wrap a run of tokens covered by one inline decoration. */
function InlineWrapper({ decoration, id, children }: { decoration: InlineDecoration; id?: string; children: React.ReactNode }) {
  switch (decoration.kind) {
    case "mark":
      return <mark className="eld-mark">{children}</mark>;
    case "hover":
      // The tooltip text lives in a data attribute (drawn by CSS) and a hidden
      // description outside the code, so it is never selected or copied.
      return (
        <span className="eld-hover" data-tone={decoration.tone} data-hover={String(decoration.payload ?? "")} tabIndex={0} aria-describedby={id}>
          {children}
        </span>
      );
    case "link":
      return (
        <a className="eld-code-link" href={String(decoration.payload ?? "")} rel="noreferrer">
          {children}
        </a>
      );
    default:
      return <span className={`eld-inline-${decoration.kind}`}>{children}</span>;
  }
}

/** Tokens of one line, split at inline decoration boundaries and grouped into wrappers. */
function LineTokens({
  tokens,
  inline,
  links,
  hoverId,
}: {
  tokens: readonly CodeToken[];
  inline: readonly InlineDecoration[];
  links: boolean;
  hoverId?: (decoration: InlineDecoration) => string;
}) {
  if (!inline.length) return <>{tokens.map((token, i) => <Token key={i} token={token} links={links} />)}</>;
  // Non-overlapping, in column order.
  const ranges = [...inline].sort((a, b) => a.start - b.start).filter((d, i, all) => i === 0 || d.start >= all[i - 1].end);
  const cuts = new Set(ranges.flatMap((d) => [d.start, d.end]));
  const pieces: { token: CodeToken; range?: number }[] = [];
  let column = 0;
  for (const token of tokens) {
    let start = 0;
    for (let i = 1; i <= token.text.length; i++) {
      if (i === token.text.length || cuts.has(column + i)) {
        const at = column + start;
        const range = ranges.findIndex((d) => at >= d.start && at < d.end);
        pieces.push({ token: { ...token, text: token.text.slice(start, i) }, range: range === -1 ? undefined : range });
        start = i;
      }
    }
    column += token.text.length;
  }
  const out: React.ReactNode[] = [];
  for (let i = 0; i < pieces.length; ) {
    const range = pieces[i].range;
    let j = i;
    while (j < pieces.length && pieces[j].range === range) j++;
    const children = pieces.slice(i, j).map((piece, k) => <Token key={k} token={piece.token} links={links && range === undefined} />);
    if (range === undefined) out.push(...children.map((child, k) => <React.Fragment key={`${i}:${k}`}>{child}</React.Fragment>));
    else {
      const decoration = ranges[range];
      out.push(
        <InlineWrapper key={i} decoration={decoration} id={decoration.kind === "hover" ? hoverId?.(decoration) : undefined}>
          {children}
        </InlineWrapper>,
      );
    }
    i = j;
  }
  return <>{out}</>;
}

/** Decorations that draw a glyph in the marks column. */
const MARKED = new Set<LineDecorationKind>(["add", "remove", "breakpoint", "breakpoint-hit", "cursor", "warning", "error"]);

export interface CodeFold {
  start: number;
  end: number;
  /** Accessible name and visible text, e.g. "5 lines hidden". */
  label: string;
  onExpand: () => void;
}

export interface CodeAnnotationBadge {
  line: number;
  /** 1-based note number. */
  index: number;
  href: string;
  label: string;
}

export interface CodeLinesProps {
  lines: readonly CodeLine[];
  /** Grammar name, exposed as `language-*` for tools and agents reading the DOM. */
  lang?: string;
  /** Terminal rows draw prompts; editor rows draw line numbers. */
  variant?: "editor" | "terminal";
  lineNumbers?: boolean;
  /** Number of the first line (default 1). */
  startLine?: number;
  decorations?: readonly LineDecoration[];
  /** Column-range decorations (word marks, type hovers, links). */
  inline?: readonly InlineDecoration[];
  /** Element id for a hover decoration's hidden description (see `aria-describedby`). */
  hoverId?: (decoration: InlineDecoration) => string;
  /** Make line numbers permalinks with ids `${lineLinks}L${n}`. */
  lineLinks?: string;
  /** Accessible name for a line-number link. */
  lineLabel?: (line: number) => string;
  /** Collapsed regions: their rows render as one expand button. */
  folds?: readonly CodeFold[];
  /** Numbered badges linking each annotated line to its note. */
  annotations?: readonly CodeAnnotationBadge[];
  /** Localized accessible names per decoration kind (a decoration's own `label` wins). */
  decorationLabels?: Partial<Record<LineDecorationKind, string>>;
  /** Accessible name for an exit status dot. */
  exitLabel?: (code: number) => string;
  /** Soft-wrap long lines (wrapped text hangs under the content, never the gutter). */
  wrap?: boolean;
  /** Render token links (disable inside `aria-hidden` screens). Default true. */
  links?: boolean;
  /** Extra element per row (e.g. a copy button on command rows). */
  rowAction?: (line: CodeLine, index: number) => React.ReactNode;
  /**
   * Replace (rather than mutate) a row's content when it changes. For animated
   * screens: moved text nodes count as layout shifts; new nodes do not.
   */
  remountChangedRows?: boolean;
}

/** Content identity of a row: its text, styles, cursor and links. */
function rowKey(line: CodeLine): string {
  let key = "";
  for (const token of line.tokens) {
    key += `${token.text}\u0000${token.style ? JSON.stringify(token.style) : ""}${token.cursor ? "\u0001" : ""}${token.href ?? ""}\u0002`;
  }
  return key;
}

/**
 * One CSS-grid row per line: `[marks] [number] [prompt] [content]`. Gutter
 * glyphs, numbers and prompts are pseudo-elements, so they are never selected
 * or copied and wrapped content keeps a hanging indent. Each row ends with a
 * newline so `textContent` reads as the original text.
 */
export const CodeLines = React.memo(function CodeLines({
  lines,
  lang,
  variant = "editor",
  lineNumbers = false,
  startLine = 1,
  decorations,
  decorationLabels,
  exitLabel,
  wrap = false,
  links = true,
  rowAction,
  remountChangedRows = false,
  inline,
  hoverId,
  lineLinks,
  lineLabel,
  folds,
  annotations,
}: CodeLinesProps) {
  const last = startLine + lines.length - 1;
  const marks = lines.some((line) => line.exitCode !== undefined) || !!decorations?.some((d) => MARKED.has(d.kind));
  return (
    <code
      className={lang ? `eld-lines language-${lang}` : "eld-lines"}
      data-variant={variant}
      data-wrap={wrap || undefined}
      data-marks={marks || undefined}
      data-numbers={lineNumbers || undefined}
      style={lineNumbers ? ({ "--eld-code-digits": String(last).length } as React.CSSProperties) : undefined}
    >
      {lines.map((line, index) => {
        const number = line.number ?? startLine + index;
        const fold = folds?.find((candidate) => number >= candidate.start && number <= candidate.end);
        if (fold) {
          if (number !== fold.start) return null;
          return (
            <span key={index} className="eld-line eld-fold-row">
              <button type="button" className="eld-fold" aria-expanded={false} aria-label={fold.label} data-label={fold.label} onClick={fold.onExpand} />
              {"\n"}
            </span>
          );
        }
        const lineInline = inline?.filter((decoration) => decoration.line === number) ?? [];
        const badges = annotations?.filter((annotation) => annotation.line === number) ?? [];
        const applied = decorations?.filter((decoration) => decorationCovers(decoration, number));
        const kinds = applied?.length ? [...new Set(applied.map((decoration) => decoration.kind))] : undefined;
        const labels = applied?.map((decoration) => decoration.label ?? decorationLabels?.[decoration.kind]).filter(Boolean) ?? [];
        if (line.exitCode !== undefined && exitLabel) labels.push(exitLabel(line.exitCode));
        const tone = applied?.find((decoration) => decoration.tone)?.tone;
        return (
          // Rows are positional (source line, screen row): the index is their identity.
          <span
            key={index}
            className="eld-line"
            data-n={lineNumbers && !lineLinks ? number : undefined}
            data-kind={line.kind}
            data-exit={line.exitCode === undefined ? undefined : line.exitCode === 0 ? "ok" : "fail"}
            data-decor={kinds?.join(" ")}
            data-tone={tone}
            data-sr={labels.length ? labels.join(", ") : undefined}
          >
            {lineNumbers && lineLinks ? (
              // Empty link: CSS draws the number, so it is never copied.
              <a
                className="eld-line-number"
                id={`${lineLinks}L${number}`}
                href={`#${lineLinks}L${number}`}
                aria-label={lineLabel?.(number) ?? String(number)}
                data-n={number}
              />
            ) : null}
            {line.prompt !== undefined ? (
              // Empty and hidden from AT: its pseudo-elements draw the cwd and glyph.
              <span className="eld-prompt" aria-hidden data-prompt={line.prompt} data-cwd={line.cwd} />
            ) : null}
            <span className="eld-content" key={remountChangedRows ? rowKey(line) : undefined}>
              <LineTokens tokens={line.tokens} inline={lineInline} links={links} hoverId={hoverId} />
              {"\n"}
            </span>
            {badges.length ? (
              <span className="eld-annotation-badges">
                {badges.map((badge) => (
                  <a key={badge.index} className="eld-annotation-badge" href={badge.href} aria-label={badge.label} data-n={badge.index} />
                ))}
              </span>
            ) : null}
            {rowAction?.(line, index)}
          </span>
        );
      })}
    </code>
  );
});
