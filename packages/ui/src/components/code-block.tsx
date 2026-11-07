import * as React from "react";
import { WrapText } from "lucide-react";
import type { LineDecoration } from "../lib/code-model";
import { cn } from "../lib/utils";
import { formatMessage } from "../i18n/format";
import { useMessages } from "../i18n/context";
import { CodeLines } from "./code-lines";
import {
  CodeSurface,
  CodeSurfaceBadge,
  CodeSurfaceTitleBar,
  codeControlClassName,
  codeSurfaceElevStyle,
  type CodeChrome,
} from "./code-surface";
import { highlightLines } from "./highlight";

export { CopyButton } from "./copy-button";
import { CopyButton } from "./copy-button";

/**
 * CodeBlock — the signature Elide code surface. Dark in both themes (matches the
 * Figma Code Block): window chrome, centered filename, a line-number gutter
 * that hosts decorations (highlight, diff, breakpoints, current line, …), and
 * an optional vim-style status bar with the NORMAL badge. For shell sessions
 * use `Terminal`; pair the two with `CodeSample`.
 *
 * `code` is highlighted from `lang` (shell languages use the positional shell
 * tokenizer). Pass `children` to supply pre-highlighted markup instead; line
 * numbers and decorations need the built-in highlighting.
 */
export interface CodeBlockProps {
  /**
   * @deprecated `"terminal"` keeps the legacy rendering (the whole sample
   * shell-highlighted, no gutter). Use `Terminal`, which separates prompts,
   * commands and ANSI output and supports recordings.
   */
  variant?: "editor" | "terminal";
  filename?: string;
  lang?: string;
  code: string;
  children?: React.ReactNode;
  lineNumbers?: boolean;
  /** Number of the first line (default 1), e.g. for an excerpt. */
  startLine?: number;
  /** Per-line decorations, by 1-based line number (relative to `startLine`). */
  decorations?: LineDecoration[];
  /** Soft-wrap long lines (default false), or show a toggle. */
  wrap?: boolean | "toggle";
  statusBar?: boolean;
  /** Window controls; `auto` follows the viewer's OS (see `codeChromeScript`). */
  chrome?: CodeChrome;
  className?: string;
}

export function CodeBlock({
  variant = "editor",
  filename,
  lang,
  code,
  children,
  lineNumbers: lineNumbersProp,
  startLine = 1,
  decorations,
  wrap = false,
  statusBar: statusBarProp,
  chrome = "auto",
  className,
}: CodeBlockProps) {
  const m = useMessages();
  const legacyTerminal = variant === "terminal";
  const lineNumbers = lineNumbersProp ?? !legacyTerminal;
  const statusBar = statusBarProp ?? !legacyTerminal;
  const [wrapped, setWrapped] = React.useState(wrap === true);
  const trimmed = code.replace(/\n$/, "");
  // The legacy terminal variant highlights the whole sample as shell.
  const grammar = legacyTerminal ? (lang ?? "bash") : lang;
  const lines = React.useMemo(() => highlightLines(trimmed, grammar), [trimmed, grammar]);
  const decorationLabels = React.useMemo(
    () => ({
      add: m.codeBlock.added,
      remove: m.codeBlock.removed,
      breakpoint: m.codeBlock.breakpoint,
      "breakpoint-hit": m.codeBlock.breakpoint,
      cursor: m.codeBlock.currentLine,
      warning: m.codeBlock.warning,
      error: m.codeBlock.error,
    }),
    [m.codeBlock],
  );

  // Unwrapped code can overflow sideways: make it a named, focusable group so
  // keyboard users can scroll it. Wrapped code never overflows.
  const scrollable = !wrapped;
  return (
    <CodeSurface raised chrome={chrome} data-slot="code-block" className={className}>
      <CodeSurfaceTitleBar
        chrome={chrome}
        title={filename ?? (legacyTerminal ? m.codeBlock.terminal : undefined)}
        actions={
          <>
            {lang ? <CodeSurfaceBadge>{lang}</CodeSurfaceBadge> : null}
            {wrap === "toggle" ? (
              <button
                type="button"
                className={codeControlClassName}
                aria-label={m.codeBlock.wrap}
                aria-pressed={wrapped}
                onClick={() => setWrapped((value) => !value)}
              >
                <WrapText aria-hidden />
              </button>
            ) : null}
            <CopyButton value={code} label="" className="px-1.5 py-1.5" />
          </>
        }
      />

      <pre
        dir="ltr"
        className={cn("eld-code-body", children ? "px-4" : undefined)}
        tabIndex={scrollable ? 0 : undefined}
        role={scrollable ? "group" : undefined}
        aria-label={scrollable ? (filename ?? m.codeSample.code) : undefined}
      >
        {children ?? (
          <CodeLines
            lines={lines}
            lang={grammar}
            lineNumbers={lineNumbers}
            startLine={startLine}
            decorations={decorations}
            decorationLabels={decorationLabels}
            wrap={wrapped}
          />
        )}
      </pre>

      {/* vim status bar */}
      {statusBar ? (
        <div data-slot="code-block-status" className="flex min-h-[1.875rem] flex-wrap items-center border-t font-mono text-[0.6875rem] font-semibold" style={codeSurfaceElevStyle}>
          <span
            className="inline-flex min-h-[1.875rem] items-center whitespace-nowrap px-3 tracking-normal"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {m.codeBlock.normal}
          </span>
          {filename ? (
            <span className="whitespace-nowrap px-3 py-1 tracking-wide text-[var(--eld-syntax-line-number)]"><bdi dir="ltr">{filename}</bdi></span>
          ) : null}
          <span className="flex-1" />
          <span className="whitespace-nowrap px-3.5 py-1 tracking-wide text-[var(--eld-syntax-line-number)]">
            utf-8 · {lang ?? m.codeBlock.text} · {formatMessage(m.codeBlock.lines, { count: lines.length })}
          </span>
        </div>
      ) : null}
    </CodeSurface>
  );
}
