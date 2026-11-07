import * as React from "react";
import { WrapText } from "lucide-react";
import type { CodeLine, InlineDecoration, LineDecoration, LineRange } from "../lib/code-model";
import { parseLineRanges, parseNotations } from "../lib/notations";
import { cn } from "../lib/utils";
import { formatMessage } from "../i18n/format";
import { useMessages } from "../i18n/context";
import { CodeLines, type CodeAnnotationBadge, type CodeFold } from "./code-lines";
import {
  CodeSurface,
  CodeSurfaceBadge,
  CodeSurfaceTitleBar,
  codeControlClassName,
  codeSurfaceElevStyle,
  type CodeChrome,
} from "./code-surface";
import { isShellLang, syncLines } from "./highlight";
import { getSyncHighlighter } from "./highlight-registry";

export { CopyButton } from "./copy-button";
import { CopyButton } from "./copy-button";

export interface CodeAnnotation {
  /** 1-based line (relative to `startLine`). */
  line: number;
  /** The note, shown in a numbered list under the code. */
  content: React.ReactNode;
}

/** One file of a multi-file block. */
export interface CodeFile {
  name: string;
  lang?: string;
  code: string;
  /** Pre-highlighted lines (e.g. from `highlightCode` at build time). */
  lines?: CodeLine[];
  decorations?: LineDecoration[];
  inline?: InlineDecoration[];
  highlight?: string | number[];
}

/**
 * CodeBlock — the signature Elide code surface. Dark in both themes: window
 * chrome, a filename (or file tabs), a line-number gutter that hosts
 * decorations, and an optional vim-style status bar.
 *
 * Highlighting: pass `lines` from `highlightCode()` (build time, zero client
 * cost), or just `code` + `lang`: the block renders plain text on the server
 * and upgrades with a lazily loaded Shiki chunk (before paint when the grammar
 * is cached; see `preloadHighlighter`). Shell languages use the built-in shell
 * tokenizer. `[!code ++]`-style notation comments become decorations.
 * For shell sessions use `Terminal`; pair the two with `CodeSample`.
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
  code?: string;
  /** Several files, shown as tabs in the title bar (replaces `code`/`filename`/`lang`). */
  files?: CodeFile[];
  /** Pre-highlighted lines, e.g. `(await highlightCode(code, lang)).lines`. */
  lines?: CodeLine[];
  /** Column-range decorations: word marks, Twoslash type hovers, links. */
  inline?: InlineDecoration[];
  /** Pre-rendered markup override (no line numbers or decorations). */
  children?: React.ReactNode;
  lineNumbers?: boolean;
  /** Number of the first line (default 1), e.g. for an excerpt. */
  startLine?: number;
  /** Per-line decorations, by 1-based line number (relative to `startLine`). `fold` ranges start collapsed. */
  decorations?: LineDecoration[];
  /** Lines to highlight, as `"1,3-5"` or numbers. */
  highlight?: string | number[];
  /** Parse `[!code ++]`-style notation comments (default true). */
  notations?: boolean;
  /** Soft-wrap long lines (default false), or show a toggle. */
  wrap?: boolean | "toggle";
  /** Make line numbers permalinks (`#<prefix>L12`); a string sets the prefix. */
  lineLinks?: boolean | string;
  /** Collapse to this many lines with a "Show more" control. */
  maxLines?: number;
  /** Numbered notes for lines (a code tour), listed under the code. */
  annotations?: CodeAnnotation[];
  /** Caption under the block; the block becomes a `<figure>`. */
  caption?: React.ReactNode;
  /** Extra title-bar controls (e.g. "Open in playground"). */
  actions?: React.ReactNode;
  statusBar?: boolean;
  /** Window controls; `auto` follows the viewer's OS (see `codeChromeScript`). */
  chrome?: CodeChrome;
  className?: string;
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * Lines for `code`: provided lines, else synchronous (shell or plain) lines,
 * upgraded by Shiki after mount. Server and first client render agree, so
 * hydration never mismatches; a cached grammar upgrades before paint.
 */
function useHighlightedLines(code: string, lang: string | undefined, provided: CodeLine[] | undefined): CodeLine[] {
  const initial = React.useMemo(() => provided ?? syncLines(code, lang), [provided, code, lang]);
  const [upgraded, setUpgraded] = React.useState<{ code: string; lang: string; lines: CodeLine[] }>();
  useIsomorphicLayoutEffect(() => {
    if (provided || !lang || isShellLang(lang)) return;
    const ready = getSyncHighlighter()?.highlight(code, lang);
    if (ready) {
      setUpgraded({ code, lang, lines: ready });
      return;
    }
    let live = true;
    // First use compiles a grammar (a long task), so wait for an idle moment
    // rather than competing with page load and input.
    const run = () =>
      import("./shiki")
        .then((shiki) => (shiki.resolveLanguage(lang) ? shiki.highlightToLines(code, lang) : undefined))
        .then((lines) => {
          if (live && lines) setUpgraded({ code, lang, lines });
        })
        .catch(() => {
          // Highlighting is an enhancement; plain text stays.
        });
    const idle = typeof requestIdleCallback === "function" ? requestIdleCallback(run, { timeout: 2000 }) : setTimeout(run, 1);
    return () => {
      live = false;
      if (typeof cancelIdleCallback === "function" && typeof requestIdleCallback === "function") cancelIdleCallback(idle as number);
      else clearTimeout(idle as ReturnType<typeof setTimeout>);
    };
  }, [code, lang, provided]);
  return upgraded && upgraded.code === code && upgraded.lang === lang ? upgraded.lines : initial;
}

function slug(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

interface PreparedFile {
  name?: string;
  lang?: string;
  /** Source without notation comments (what copy yields). */
  code: string;
  lines?: CodeLine[];
  decorations: LineDecoration[];
  inline: InlineDecoration[];
}

function prepare(file: CodeFile | (Omit<CodeFile, "name"> & { name?: string }), notations: boolean, extra?: LineDecoration[]): PreparedFile {
  const source = file.code.replace(/\n$/, "");
  const parsed = notations && !file.lines ? parseNotations(source) : { code: source, decorations: [], inline: [] };
  const highlighted = parseLineRanges(file.highlight).map((line): LineDecoration => ({ line, kind: "highlight" }));
  return {
    name: file.name,
    lang: file.lang,
    code: parsed.code,
    lines: file.lines,
    decorations: [...parsed.decorations, ...highlighted, ...(file.decorations ?? []), ...(extra ?? [])],
    inline: [...parsed.inline, ...(file.inline ?? [])],
  };
}

interface BodyProps {
  file: PreparedFile;
  id: string;
  lineNumbers: boolean;
  startLine: number;
  wrapped: boolean;
  lineLinks?: string;
  maxLines?: number;
  annotations?: CodeAnnotation[];
  label: string;
  children?: React.ReactNode;
}

function CodeBody({ file, id, lineNumbers, startLine, wrapped, lineLinks, maxLines, annotations, label, children }: BodyProps) {
  const m = useMessages().codeBlock;
  const lines = useHighlightedLines(file.code, file.lang, file.lines);
  const [expandedFolds, setExpandedFolds] = React.useState<ReadonlySet<string>>(() => new Set());
  const [expanded, setExpanded] = React.useState(false);

  const foldRanges = file.decorations.filter((d) => d.kind === "fold");
  const decorations = foldRanges.length ? file.decorations.filter((d) => d.kind !== "fold") : file.decorations;
  const folds: CodeFold[] = foldRanges.flatMap((d) => {
    const range: LineRange = typeof d.line === "number" ? { start: d.line, end: d.line } : d.line;
    const key = `${range.start}-${range.end}`;
    if (expandedFolds.has(key)) return [];
    const count = range.end - range.start + 1;
    return [{ ...range, label: d.label ?? formatMessage(m.folded, { count }), onExpand: () => setExpandedFolds((open) => new Set(open).add(key)) }];
  });
  const decorationLabels = React.useMemo(
    () => ({
      add: m.added,
      remove: m.removed,
      breakpoint: m.breakpoint,
      "breakpoint-hit": m.breakpoint,
      cursor: m.currentLine,
      warning: m.warning,
      error: m.error,
    }),
    [m],
  );
  const hovers = file.inline.filter((d) => d.kind === "hover");
  const hoverId = React.useCallback((d: InlineDecoration) => `${id}-hover-${d.line}-${d.start}`, [id]);
  const badges: CodeAnnotationBadge[] | undefined = annotations?.map((annotation, i) => ({
    line: annotation.line,
    index: i + 1,
    href: `#${id}-note-${i + 1}`,
    label: formatMessage(m.note, { n: i + 1 }),
  }));
  // Rows actually rendered: each collapsed fold shows as a single row.
  const rows = lines.length - folds.reduce((sum, fold) => sum + (fold.end - fold.start), 0);
  const collapsible = maxLines !== undefined && rows > maxLines + 1;
  const collapsed = collapsible && !expanded;
  // Unwrapped (or collapsed) code can overflow: a named, focusable group lets keyboard users scroll it.
  const scrollable = !wrapped;
  const preId = `${id}-code`;

  return (
    <>
      <pre
        id={preId}
        dir="ltr"
        className={cn("eld-code-body", children ? "px-4" : undefined, collapsed && "eld-collapsed")}
        style={collapsed ? ({ "--eld-visible-lines": maxLines } as React.CSSProperties) : undefined}
        tabIndex={scrollable ? 0 : undefined}
        role={scrollable ? "group" : undefined}
        aria-label={scrollable ? label : undefined}
      >
        {children ?? (
          <CodeLines
            lines={lines}
            lang={file.lang}
            lineNumbers={lineNumbers}
            startLine={startLine}
            decorations={decorations}
            decorationLabels={decorationLabels}
            inline={file.inline}
            hoverId={hoverId}
            lineLinks={lineLinks}
            lineLabel={(n) => formatMessage(m.line, { n })}
            folds={folds}
            annotations={badges}
            wrap={wrapped}
          />
        )}
      </pre>
      {collapsible ? (
        <button
          type="button"
          className="eld-code-expand"
          aria-expanded={expanded}
          aria-controls={preId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? m.showLess : formatMessage(m.showMore, { count: rows - maxLines })}
        </button>
      ) : null}
      {hovers.length ? (
        // Descriptions for type hovers: outside the code so they are never copied.
        <div hidden>
          {hovers.map((d) => (
            <span key={hoverId(d)} id={hoverId(d)}>
              {String(d.payload ?? "")}
            </span>
          ))}
        </div>
      ) : null}
      {annotations?.length ? (
        <ol className="eld-annotations">
          {annotations.map((annotation, i) => (
            <li key={i} id={`${id}-note-${i + 1}`} data-n={i + 1}>
              {annotation.content}
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}

export function CodeBlock({
  variant = "editor",
  filename,
  lang,
  code = "",
  files,
  lines: linesProp,
  inline,
  children,
  lineNumbers: lineNumbersProp,
  startLine = 1,
  decorations,
  highlight,
  notations = true,
  wrap = false,
  lineLinks,
  maxLines,
  annotations,
  caption,
  actions,
  statusBar: statusBarProp,
  chrome = "auto",
  className,
}: CodeBlockProps) {
  const m = useMessages();
  const reactId = React.useId();
  const legacyTerminal = variant === "terminal";
  const lineNumbers = lineNumbersProp ?? !legacyTerminal;
  const statusBar = statusBarProp ?? !legacyTerminal;
  const [wrapped, setWrapped] = React.useState(wrap === true);
  // The legacy terminal variant highlights the whole sample as shell.
  const grammar = legacyTerminal ? (lang ?? "bash") : lang;

  const prepared = React.useMemo(
    () =>
      files?.length
        ? files.map((file) => prepare(file, notations))
        : [prepare({ name: filename, lang: grammar, code, lines: linesProp, inline, highlight }, notations, decorations)],
    [files, notations, filename, grammar, code, linesProp, inline, highlight, decorations],
  );
  const [active, setActive] = React.useState(0);
  const current = prepared[Math.min(active, prepared.length - 1)];
  const id = slug(typeof lineLinks === "string" ? lineLinks : filename ?? reactId) || "code";
  const linkPrefix = lineLinks ? `${id}-` : undefined;
  const tabsRef = React.useRef<HTMLDivElement>(null);

  function onTabKey(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = prepared.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setActive(next);
    tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  const title = files?.length ? (
    <div ref={tabsRef} role="tablist" aria-label={m.codeBlock.files} className="eld-file-tabs">
      {prepared.map((file, index) => (
        <button
          key={file.name ?? index}
          type="button"
          role="tab"
          id={`${id}-tab-${index}`}
          aria-selected={index === active}
          aria-controls={`${id}-panel-${index}`}
          tabIndex={index === active ? 0 : -1}
          onClick={() => setActive(index)}
          onKeyDown={(event) => onTabKey(event, index)}
          className="eld-file-tab"
        >
          <bdi dir="ltr">{file.name}</bdi>
        </button>
      ))}
    </div>
  ) : (
    filename ?? (legacyTerminal ? m.codeBlock.terminal : undefined)
  );

  const bodyProps = {
    lineNumbers,
    startLine,
    wrapped,
    maxLines,
    annotations,
  };

  const surface = (
    <CodeSurface raised chrome={chrome} data-slot="code-block" className={caption ? undefined : className}>
      <CodeSurfaceTitleBar
        chrome={chrome}
        title={title}
        actions={
          <>
            {current.lang ? <CodeSurfaceBadge>{current.lang}</CodeSurfaceBadge> : null}
            {actions}
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
            <CopyButton value={current.code} label="" className="px-1.5 py-1.5" />
          </>
        }
      />

      {files?.length ? (
        prepared.map((file, index) => (
          // Every file stays in the DOM (readable without script); inactive panels are hidden.
          <div
            key={file.name ?? index}
            role="tabpanel"
            id={`${id}-panel-${index}`}
            aria-labelledby={`${id}-tab-${index}`}
            hidden={index !== active}
          >
            <CodeBody
              {...bodyProps}
              file={file}
              id={`${id}-${slug(file.name ?? String(index))}`}
              lineLinks={linkPrefix ? `${linkPrefix}${slug(file.name ?? String(index))}-` : undefined}
              annotations={index === active ? annotations : undefined}
              label={file.name ?? m.codeSample.code}
            />
          </div>
        ))
      ) : (
        <CodeBody {...bodyProps} file={current} id={id} lineLinks={linkPrefix} label={filename ?? m.codeSample.code}>
          {children}
        </CodeBody>
      )}

      {/* vim status bar */}
      {statusBar ? (
        <div data-slot="code-block-status" className="flex min-h-[1.875rem] flex-wrap items-center border-t font-mono text-[0.6875rem] font-semibold" style={codeSurfaceElevStyle}>
          <span
            className="inline-flex min-h-[1.875rem] items-center whitespace-nowrap px-3 tracking-normal"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {m.codeBlock.normal}
          </span>
          {current.name ? (
            <span className="whitespace-nowrap px-3 py-1 tracking-wide text-[var(--eld-syntax-line-number)]"><bdi dir="ltr">{current.name}</bdi></span>
          ) : null}
          <span className="flex-1" />
          <span className="whitespace-nowrap px-3.5 py-1 tracking-wide text-[var(--eld-syntax-line-number)]">
            utf-8 · {current.lang ?? m.codeBlock.text} · {formatMessage(m.codeBlock.lines, { count: current.code.split("\n").length })}
          </span>
        </div>
      ) : null}
    </CodeSurface>
  );

  if (!caption) return surface;
  return (
    <figure className={cn("eld-code-figure", className)}>
      {surface}
      <figcaption className="eld-code-caption">{caption}</figcaption>
    </figure>
  );
}
