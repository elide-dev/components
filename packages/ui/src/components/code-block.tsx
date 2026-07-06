import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Highlight, type PrismTheme } from "prism-react-renderer";
import { cn } from "../lib/utils";

/**
 * CopyButton — copies `value` to the clipboard, flips to a check for 1.5s.
 * Used by CodeBlock and CopyCommand.
 */
export function CopyButton({
  value,
  className,
  label = "Copy",
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label || "Copy"}
      onClick={() => {
        // Swallow clipboard rejections (e.g. no permission in a headless/denied
        // context) — the copy is optimistic and a failure shouldn't surface as an
        // unhandled promise rejection.
        void navigator.clipboard?.writeText(value)?.catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
        "border-[var(--code-border)] text-[#a8a8ac] hover:text-white hover:bg-white/5",
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {label ? <span>{copied ? "Copied" : label}</span> : null}
    </button>
  );
}

/**
 * Prism theme mapped entirely onto the Elide `--eld-syntax-*` tokens, so the
 * highlighter tracks the design system (and both light/dark, since the tokens
 * are `var()` references). Colors are applied as inline styles by the renderer.
 */
const eldPrismTheme: PrismTheme = {
  plain: { color: "var(--eld-syntax-default)", backgroundColor: "transparent" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "var(--eld-syntax-comment)", fontStyle: "italic" } },
    { types: ["keyword", "control-flow", "at-rule", "rule", "important", "tag", "selector"], style: { color: "var(--eld-syntax-keyword)" } },
    { types: ["string", "char", "attr-value", "template-string", "url", "regex"], style: { color: "var(--eld-syntax-string)" } },
    { types: ["number", "boolean", "constant", "symbol", "inserted", "unit"], style: { color: "var(--eld-syntax-number)" } },
    { types: ["function", "function-variable", "method", "deleted"], style: { color: "var(--eld-syntax-function)" } },
    { types: ["class-name", "maybe-class-name", "builtin", "namespace", "type-annotation"], style: { color: "var(--eld-syntax-type)" } },
    { types: ["parameter", "property", "property-access", "variable", "attr-name", "entity"], style: { color: "var(--eld-syntax-param)" } },
    { types: ["operator", "punctuation"], style: { color: "var(--eld-syntax-default)" } },
  ],
};

/** Map the friendly `lang` prop to a Prism grammar id (falls back to plain text). */
const LANG_ALIASES: Record<string, string> = {
  ts: "typescript",
  typescript: "typescript",
  tsx: "tsx",
  js: "javascript",
  javascript: "javascript",
  jsx: "jsx",
  json: "json",
  bash: "bash",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  terminal: "bash",
  css: "css",
  html: "markup",
  xml: "markup",
  md: "markdown",
  markdown: "markdown",
  py: "python",
  python: "python",
  yaml: "yaml",
  yml: "yaml",
  sql: "sql",
  go: "go",
};

function prismLang(lang?: string): string {
  if (!lang) return "text";
  return LANG_ALIASES[lang.toLowerCase()] ?? lang.toLowerCase();
}

/** Prism-highlighted code lines, themed from `--eld-syntax-*`. */
function Highlighted({ code, lang }: { code: string; lang?: string }) {
  return (
    <Highlight theme={eldPrismTheme} code={code} language={prismLang(lang)}>
      {({ tokens, getLineProps, getTokenProps }) => (
        <>
          {tokens.map((line, i) => (
            <span key={i} {...getLineProps({ line })} className="block">
              {line.map((token, j) => (
                <span key={j} {...getTokenProps({ token })} />
              ))}
            </span>
          ))}
        </>
      )}
    </Highlight>
  );
}

/**
 * CodeBlock — the signature Elide code surface. Dark in both themes (matches the
 * Figma Code Block). Two variants:
 *   - "editor"  : traffic lights, centered filename, optional line-number gutter,
 *                 and an optional vim-style status bar with the magenta NORMAL badge.
 *   - "terminal": a "TERMINAL" title row and prompt output.
 *
 * By default `code` is syntax-highlighted with Prism using the `lang` grammar,
 * themed from the `--eld-syntax-*` tokens. Pass `children` to override with your
 * own pre-highlighted markup (e.g. Shiki output).
 */
export interface CodeBlockProps {
  variant?: "editor" | "terminal";
  filename?: string;
  lang?: string;
  code: string;
  children?: React.ReactNode;
  lineNumbers?: boolean;
  statusBar?: boolean;
  className?: string;
}

const surface: React.CSSProperties = {
  background: "var(--code-background)",
  borderColor: "var(--code-border)",
};
const elev: React.CSSProperties = {
  background: "var(--code-background-elev)",
  borderColor: "var(--code-border)",
};

export function CodeBlock({
  variant = "editor",
  filename,
  lang,
  code,
  children,
  lineNumbers = variant === "editor",
  statusBar = variant === "editor",
  className,
}: CodeBlockProps) {
  const trimmed = code.replace(/\n$/, "");
  const lines = trimmed.split("\n");
  // `children` (pre-highlighted) wins; otherwise highlight the raw code.
  const body = children ?? <Highlighted code={trimmed} lang={variant === "terminal" ? lang ?? "bash" : lang} />;

  if (variant === "terminal") {
    return (
      <div className={cn("overflow-hidden rounded-xl border", className)} style={surface}>
        <div
          className="flex h-8 items-center gap-2 border-b px-3.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--eld-syntax-line-number)]"
          style={elev}
        >
          <span>{lang ?? "Terminal"}</span>
        </div>
        <pre className="m-0 overflow-x-auto p-4 font-mono text-[13px] leading-[1.7] text-[var(--eld-syntax-default)]">
          {body}
        </pre>
      </div>
    );
  }

  return (
    <div
      className={cn("overflow-hidden rounded-xl border shadow-[0_20px_44px_-26px_rgba(0,0,0,0.65)]", className)}
      style={surface}
    >
      {/* title bar */}
      <div className="flex h-[42px] items-center border-b px-3.5" style={elev}>
        <div className="flex w-[70px] shrink-0 gap-[7px]">
          <span className="h-[11px] w-[11px] rounded-full bg-[#ff5f56]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#febc2e]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#27c93f]" />
        </div>
        <div className="flex-1 text-center font-mono text-[12.5px] tracking-wide text-[#b7b7bb]">
          {filename}
        </div>
        <div className="flex w-[70px] shrink-0 items-center justify-end gap-2">
          {lang ? (
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-[var(--eld-syntax-line-number)]">
              {lang}
            </span>
          ) : null}
          <CopyButton value={code} label="" className="px-1.5 py-1.5" />
        </div>
      </div>

      {/* body */}
      <div className="flex">
        {lineNumbers ? (
          <div
            aria-hidden
            className="shrink-0 select-none whitespace-pre border-r px-3.5 py-4 text-right font-mono text-[13px] leading-[1.65] text-[var(--eld-syntax-line-number)]"
            style={{ borderColor: "var(--code-border)" }}
          >
            {lines.map((_, i) => `${i + 1}`).join("\n")}
          </div>
        ) : null}
        <pre className="m-0 flex-1 overflow-x-auto py-4 pl-4 pr-5 font-mono text-[13px] leading-[1.65] text-[var(--eld-syntax-default)]">
          {body}
        </pre>
      </div>

      {/* vim status bar */}
      {statusBar ? (
        <div className="flex h-[30px] items-center border-t font-mono text-[11px] font-semibold" style={elev}>
          <span
            className="inline-flex h-full items-center px-3 tracking-[0.16em]"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            NORMAL
          </span>
          {filename ? (
            <span className="px-3 tracking-wide text-muted-foreground">{filename}</span>
          ) : null}
          <span className="flex-1" />
          <span className="px-3.5 tracking-wide text-[var(--eld-syntax-line-number)]">
            utf-8 · {lang ?? "text"} · {lines.length}L
          </span>
        </div>
      ) : null}
    </div>
  );
}
