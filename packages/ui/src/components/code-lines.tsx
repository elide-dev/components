import * as React from "react";
import type { CodeLine, CodeToken, InlineDecoration, LineDecoration, LineDecorationKind } from "../lib/code-model";
import { decorationCovers } from "../lib/code-model";
import { segmentLine, withColumns } from "../lib/segments";
import { tokenStyleToCss } from "../lib/token-style";

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

/** Wrap a segment covered by one inline decoration. */
function InlineWrapper({ decoration, id, children }: { decoration: InlineDecoration; id?: string; children: React.ReactNode }) {
  switch (decoration.kind) {
    case "mark":
      return <mark className="eld-mark">{children}</mark>;
    case "hover":
      // A tooltip trigger: the text is drawn by CSS from data-hover and the
      // accessible description lives outside the code, so neither is copied.
      return (
        <button type="button" className="eld-hover" data-tone={decoration.tone} data-hover={String(decoration.payload ?? "")} aria-describedby={id}>
          {children}
        </button>
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
  if (!inline.length) {
    return (
      <>
        {withColumns(tokens).map(({ token, column }) => (
          <Token key={column} token={token} links={links} />
        ))}
      </>
    );
  }
  return (
    <>
      {segmentLine(tokens, inline).map(({ column, pieces, decoration }) => {
        const children = pieces.map((piece) => <Token key={piece.column} token={piece.token} links={links && !decoration} />);
        if (!decoration) return <React.Fragment key={column}>{children}</React.Fragment>;
        return (
          <InlineWrapper key={column} decoration={decoration} id={decoration.kind === "hover" ? hoverId?.(decoration) : undefined}>
            {children}
          </InlineWrapper>
        );
      })}
    </>
  );
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

/** Accessible names for a row's decorations (and exit status). */
function rowLabels(line: CodeLine, applied: readonly LineDecoration[] | undefined, props: CodeLinesProps): string | undefined {
  const labels = (applied ?? []).map((decoration) => decoration.label ?? props.decorationLabels?.[decoration.kind]).filter(Boolean);
  if (line.exitCode !== undefined && props.exitLabel) labels.push(props.exitLabel(line.exitCode));
  return labels.length ? labels.join(", ") : undefined;
}

interface RowProps {
  line: CodeLine;
  index: number;
  number: number;
  props: CodeLinesProps;
}

/** One grid row: `[marks] [number] [prompt] [content]`, plus optional badges and action. */
function CodeRow({ line, index, number, props }: RowProps) {
  const { lineLinks, lineNumbers, links = true } = props;
  const applied = props.decorations?.filter((decoration) => decorationCovers(decoration, number));
  const kinds = applied?.length ? [...new Set(applied.map((decoration) => decoration.kind))].join(" ") : undefined;
  const badges = props.annotations?.filter((annotation) => annotation.line === number) ?? [];
  const exit = line.exitCode === undefined ? undefined : line.exitCode === 0 ? "ok" : "fail";
  return (
    <span
      className="eld-line"
      data-n={lineNumbers && !lineLinks ? number : undefined}
      data-kind={line.kind}
      data-exit={exit}
      data-decor={kinds}
      data-tone={applied?.find((decoration) => decoration.tone)?.tone}
      data-sr={rowLabels(line, applied, props)}
    >
      {lineNumbers && lineLinks ? (
        // Empty link: CSS draws the number, so it is never copied.
        <a className="eld-line-number" id={`${lineLinks}L${number}`} href={`#${lineLinks}L${number}`} aria-label={props.lineLabel?.(number) ?? String(number)} data-n={number} />
      ) : null}
      {line.prompt !== undefined ? (
        // Empty and hidden from AT: its pseudo-elements draw the cwd and glyph.
        <span className="eld-prompt" aria-hidden data-prompt={line.prompt} data-cwd={line.cwd} />
      ) : null}
      <span className="eld-content" key={props.remountChangedRows ? rowKey(line) : undefined}>
        <LineTokens tokens={line.tokens} inline={props.inline?.filter((decoration) => decoration.line === number) ?? []} links={links} hoverId={props.hoverId} />
        {"\n"}
      </span>
      {badges.length ? (
        <span className="eld-annotation-badges">
          {badges.map((badge) => (
            <a key={badge.index} className="eld-annotation-badge" href={badge.href} aria-label={badge.label} data-n={badge.index} />
          ))}
        </span>
      ) : null}
      {props.rowAction?.(line, index)}
    </span>
  );
}

/**
 * One CSS-grid row per line: `[marks] [number] [prompt] [content]`. Gutter
 * glyphs, numbers and prompts are pseudo-elements, so they are never selected
 * or copied and wrapped content keeps a hanging indent. Each row ends with a
 * newline so `textContent` reads as the original text.
 */
export const CodeLines = React.memo(function CodeLines(props: CodeLinesProps) {
  const { lines, lang, variant = "editor", lineNumbers = false, startLine = 1, decorations, wrap = false, folds } = props;
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
        // Rows are keyed by line number: positional identity (a source line, a screen row).
        const number = line.number ?? startLine + index;
        const fold = folds?.find((candidate) => number >= candidate.start && number <= candidate.end);
        if (!fold) return <CodeRow key={number} line={line} index={index} number={number} props={props} />;
        if (number !== fold.start) return null;
        return (
          <span key={number} className="eld-line eld-fold-row">
            <button type="button" className="eld-fold" aria-expanded={false} aria-label={fold.label} data-label={fold.label} onClick={fold.onExpand} />
            {"\n"}
          </span>
        );
      })}
    </code>
  );
});
