import * as React from "react";
import type { CodeLine, CodeToken, LineDecoration, LineDecorationKind, TokenStyle } from "../lib/code-model";
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

/** Decorations that draw a glyph in the marks column. */
const MARKED = new Set<LineDecorationKind>(["add", "remove", "breakpoint", "breakpoint-hit", "cursor", "warning", "error"]);

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
            data-n={lineNumbers ? number : undefined}
            data-kind={line.kind}
            data-exit={line.exitCode === undefined ? undefined : line.exitCode === 0 ? "ok" : "fail"}
            data-decor={kinds?.join(" ")}
            data-tone={tone}
            data-sr={labels.length ? labels.join(", ") : undefined}
          >
            {line.prompt !== undefined ? (
              // Empty and hidden from AT: its pseudo-elements draw the cwd and glyph.
              <span className="eld-prompt" aria-hidden data-prompt={line.prompt} data-cwd={line.cwd} />
            ) : null}
            <span className="eld-content" key={remountChangedRows ? rowKey(line) : undefined}>
              {line.tokens.map((token, i) => (
                <Token key={i} token={token} links={links} />
              ))}
              {"\n"}
            </span>
            {rowAction?.(line, index)}
          </span>
        );
      })}
    </code>
  );
});
