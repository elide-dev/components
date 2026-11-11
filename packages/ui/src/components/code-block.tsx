import * as React from "react";
import type { CodeInsights, CodeLine, InlineDecoration, LineDecoration, LineRange } from "../lib/code-model";
import { parseLineRanges, parseNotations } from "../lib/notations";
import { cn, keyed } from "../lib/utils";
import { formatMessage } from "../i18n/format";
import { useMessages } from "../i18n/context";
import { CodeLines, type CodeAnnotationBadge, type CodeFold } from "./code-lines";
import { CodeSurface, CodeSurfaceTitleBar } from "./code-surface";
import { CodeSurfaceActions } from "./code-surface-actions";
import { codeSurfaceElevStyle, type CodeChrome } from "./code-surface-styles";
import { isShellLang, syncLines } from "./highlight";
import { getSyncHighlighter } from "./highlight-registry";
import { scheduleIdle } from "../lib/schedule";

export { CopyButton } from "./copy-button";

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
  /** Coverage and profile overlays. */
  insights?: CodeInsights;
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
  /** Coverage (edge strip) and profile (heat + sample share) overlays, by line. */
  insights?: CodeInsights;
  /** With `files`: the shown file, controlled (e.g. by a scene following execution). */
  activeFile?: string;
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
  /**
   * Base for the block's element ids (file tabs and panels, line anchors).
   * Defaults to the `lineLinks` prefix, the filename, or a generated id; set
   * it when separately rendered roots on one page would otherwise collide.
   */
  id?: string;
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
 * Hidden file panels keep their source but defer grammar work until selected.
 */
function useHighlightedLines(code: string, lang: string | undefined, provided: CodeLine[] | undefined, active: boolean): CodeLine[] {
  const initial = React.useMemo(() => provided ?? syncLines(code, lang), [provided, code, lang]);
  const [upgraded, setUpgraded] = React.useState<{ code: string; lang: string; lines: CodeLine[] }>();
  useIsomorphicLayoutEffect(() => {
    if (!active || provided || !lang || isShellLang(lang)) return;
    // Reopening a tab reuses its highlighted lines; no global source cache.
    if (upgraded?.code === code && upgraded.lang === lang) return;
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
        .then((shiki) => (live && shiki.resolveLanguage(lang) ? shiki.highlightToLines(code, lang) : undefined))
        .then((lines) => {
          if (live && lines) setUpgraded({ code, lang, lines });
        })
        .catch(() => {
          // Highlighting is an enhancement; plain text stays.
        });
    const cancel = scheduleIdle(run);
    return () => {
      live = false;
      cancel();
    };
  }, [code, lang, provided, active, upgraded]);
  return provided ?? (upgraded && upgraded.code === code && upgraded.lang === lang ? upgraded.lines : initial);
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
  insights?: CodeInsights;
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
    insights: file.insights,
  };
}

interface BodyProps {
  active?: boolean;
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

function CodeBody({ file, id, lineNumbers, startLine, wrapped, lineLinks, maxLines, annotations, label, children, active = true }: BodyProps) {
  const m = useMessages().codeBlock;
  const lines = useHighlightedLines(file.code, file.lang, file.lines, active && children == null);
  const [expandedFolds, setExpandedFolds] = React.useState<ReadonlySet<string>>(() => new Set());
  const [expanded, setExpanded] = React.useState(false);
  /** Line of the note under the pointer or focus. */
  const [activeLine, setActiveLine] = React.useState<number>();

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
  const insightLabels = React.useMemo(
    () => ({
      covered: m.covered,
      notCovered: m.notCovered,
      partiallyCovered: m.partiallyCovered,
      samples: (percent: string) => formatMessage(m.samples, { percent }),
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
            insights={file.insights}
            insightLabels={insightLabels}
            hoverId={hoverId}
            lineLinks={lineLinks}
            lineLabel={(n) => formatMessage(m.line, { n })}
            folds={folds}
            annotations={badges}
            activeLine={activeLine}
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
          {keyed(annotations, (annotation) => `line-${annotation.line}`).map(({ item, key }, i) => (
            // Pointing at a note (or focusing something inside it) highlights its line.
            <li
              key={key}
              id={`${id}-note-${i + 1}`}
              data-n={i + 1}
              data-active={activeLine === item.line || undefined}
              onPointerEnter={() => setActiveLine(item.line)}
              onPointerLeave={() => setActiveLine(undefined)}
              onFocusCapture={() => setActiveLine(item.line)}
              onBlurCapture={() => setActiveLine(undefined)}
            >
              {item.content}
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}

interface FilesInput {
  insights?: CodeInsights;
  files?: CodeFile[];
  notations: boolean;
  filename?: string;
  lang?: string;
  code: string;
  lines?: CodeLine[];
  inline?: InlineDecoration[];
  highlight?: string | number[];
  decorations?: LineDecoration[];
}

/** The block's files (or its single source) with notations parsed and decorations merged. */
function usePreparedFiles({ files, notations, filename, lang, code, lines, inline, highlight, decorations, insights }: FilesInput): PreparedFile[] {
  return React.useMemo(
    () =>
      files?.length
        ? files.map((file) => prepare(file, notations))
        : [prepare({ name: filename, lang, code, lines, inline, highlight, insights }, notations, decorations)],
    [files, notations, filename, lang, code, lines, inline, highlight, decorations, insights],
  );
}

type BodyDisplay = Pick<BodyProps, "lineNumbers" | "startLine" | "wrapped" | "maxLines" | "annotations">;

/** One body, or a tab panel per file (all in the DOM, readable without script; inactive ones hidden). */
function CodeBodies({
  files,
  multiFile,
  active,
  id,
  linkPrefix,
  bodyProps,
  label,
  children,
}: {
  files: PreparedFile[];
  multiFile: boolean;
  active: number;
  id: string;
  linkPrefix?: string;
  bodyProps: BodyDisplay;
  label: string;
  children?: React.ReactNode;
}) {
  if (!multiFile) {
    return (
      <CodeBody {...bodyProps} file={files[0]} id={id} lineLinks={linkPrefix} label={label}>
        {children}
      </CodeBody>
    );
  }
  return (
    <>
      {keyed(files, (file) => file.name ?? "file").map(({ item: file, key }, index) => (
        <div key={key} role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} hidden={index !== active}>
          <CodeBody
            {...bodyProps}
            active={index === active}
            file={file}
            id={`${id}-${slug(key)}`}
            lineLinks={linkPrefix && `${linkPrefix}${slug(key)}-`}
            annotations={index === active ? bodyProps.annotations : undefined}
            label={file.name ?? label}
          />
        </div>
      ))}
    </>
  );
}

/** Defaults that depend on the (deprecated) terminal variant. */
function variantDefaults(variant: CodeBlockProps["variant"], lineNumbers: boolean | undefined, statusBar: boolean | undefined, lang: string | undefined) {
  const legacyTerminal = variant === "terminal";
  return {
    legacyTerminal,
    lineNumbers: lineNumbers ?? !legacyTerminal,
    statusBar: statusBar ?? !legacyTerminal,
    // The legacy terminal variant highlights the whole sample as shell.
    grammar: legacyTerminal ? (lang ?? "bash") : lang,
  };
}

/** Id prefix for permalinks, notes and tab panels: explicit, else the filename, else a React id. */
function blockId(lineLinks: CodeBlockProps["lineLinks"], filename: string | undefined, fallback: string, explicitId?: string): string {
  if (explicitId) return slug(explicitId) || "code";
  return slug(typeof lineLinks === "string" ? lineLinks : (filename ?? fallback)) || "code";
}

/** Wrap in a `<figure>` with a caption when one is given. */
function CodeFigure({ caption, className, children }: { caption?: React.ReactNode; className?: string; children: React.ReactElement }) {
  if (!caption) return children;
  return (
    <figure className={cn("eld-code-figure", className)}>
      {children}
      <figcaption className="eld-code-caption">{caption}</figcaption>
    </figure>
  );
}

/** File names as tabs in the title bar (roving focus; arrow keys, Home, End). */
function FileTabs({ files, active, id, label, onSelect }: { files: PreparedFile[]; active: number; id: string; label: string; onSelect: (index: number) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = files.length - 1;
    const moves: Record<string, number> = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onSelect(next);
    ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
  return (
    <div ref={ref} role="tablist" aria-label={label} className="eld-file-tabs">
      {keyed(files, (file) => file.name ?? "file").map(({ item: file, key }, index) => (
        <button
          key={key}
          type="button"
          role="tab"
          id={`${id}-tab-${index}`}
          aria-selected={index === active}
          aria-controls={`${id}-panel-${index}`}
          tabIndex={index === active ? 0 : -1}
          onClick={() => onSelect(index)}
          onKeyDown={(event) => onKeyDown(event, index)}
          className="eld-file-tab"
        >
          <bdi dir="ltr">{file.name}</bdi>
        </button>
      ))}
    </div>
  );
}

/** Status bar: file, encoding, language and line count. */
function StatusBar({ file }: { file: PreparedFile }) {
  const m = useMessages().codeBlock;
  return (
    <div data-slot="code-block-status" className="flex min-h-[1.875rem] flex-wrap items-center border-t font-mono text-[0.6875rem] font-semibold" style={codeSurfaceElevStyle}>
      {file.name ? (
        <span className="whitespace-nowrap px-3 py-1 tracking-wide text-[var(--code-syntax-line-number)]">
          <bdi dir="ltr">{file.name}</bdi>
        </span>
      ) : null}
      <span className="flex-1" />
      <span className="whitespace-nowrap px-3.5 py-1 tracking-wide text-[var(--code-syntax-line-number)]">
        {`utf-8 · ${file.lang ?? m.text} · ${formatMessage(m.lines, { count: file.code.split("\n").length })}`}
      </span>
    </div>
  );
}

export function CodeBlock({
  id: idProp,
  variant = "editor",
  filename,
  lang,
  code = "",
  files,
  lines: linesProp,
  inline,
  insights,
  activeFile,
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
  const { legacyTerminal, lineNumbers, statusBar, grammar } = variantDefaults(variant, lineNumbersProp, statusBarProp, lang);
  const [wrapChoice, setWrapped] = React.useState(wrap === true);
  const wrapped = wrap === "toggle" ? wrapChoice : wrap === true;

  const prepared = usePreparedFiles({ files, notations, filename, lang: grammar, code, lines: linesProp, inline, highlight, decorations, insights });
  const [chosen, setActive] = React.useState(0);
  const controlled = activeFile === undefined ? -1 : prepared.findIndex((file) => file.name === activeFile);
  const active = controlled >= 0 ? controlled : Math.min(chosen, prepared.length - 1);
  const current = prepared[active];
  const id = blockId(lineLinks, filename, reactId, idProp);
  const linkPrefix = lineLinks ? `${id}-` : undefined;

  // A single file is just a titled block; tabs start at two.
  const multiFile = (files?.length ?? 0) > 1;
  const title = multiFile ? (
    <FileTabs files={prepared} active={active} id={id} label={m.codeBlock.files} onSelect={setActive} />
  ) : (
    (files?.[0]?.name ?? filename) ?? (legacyTerminal ? m.codeBlock.terminal : undefined)
  );

  const surface = (
    <CodeSurface raised chrome={chrome} tone={legacyTerminal ? "dark" : "adaptive"} data-slot="code-block" className={caption ? undefined : className}>
      <CodeSurfaceTitleBar
        chrome={chrome}
        title={title}
        actions={
          <CodeSurfaceActions
            lang={current.lang}
            wrapped={wrap === "toggle" ? wrapped : undefined}
            onWrapChange={setWrapped}
            copyValue={current.code}
          >
            {actions}
          </CodeSurfaceActions>
        }
      />

      <CodeBodies
        files={prepared}
        multiFile={multiFile}
        active={active}
        id={id}
        linkPrefix={linkPrefix}
        bodyProps={{ lineNumbers, startLine, wrapped, maxLines, annotations }}
        label={filename ?? m.codeSample.code}
      >
        {children}
      </CodeBodies>

      {statusBar ? <StatusBar file={current} /> : null}
    </CodeSurface>
  );

  return <CodeFigure caption={caption} className={className}>{surface}</CodeFigure>;
}
