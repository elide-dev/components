import * as React from "react";
import { Check, Copy } from "lucide-react";
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
      aria-label={label || "Copy"}
      onClick={() => {
        void navigator.clipboard?.writeText(value);
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
 * CodeBlock — the signature Elide code surface. Dark in both themes (matches the
 * Figma Code Block). Two variants:
 *   - "editor"  : traffic lights, centered filename, optional line-number gutter,
 *                 and an optional vim-style status bar with the magenta NORMAL badge.
 *   - "terminal": a "TERMINAL" title row and prompt output.
 *
 * `children` should be already-highlighted markup (Shiki at build time, or hand
 * spans in stories). `code` is the raw text — used for copy and line counting.
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
  const lines = code.replace(/\n$/, "").split("\n");
  const body = children ?? code;

  if (variant === "terminal") {
    return (
      <div className={cn("overflow-hidden rounded-xl border", className)} style={surface}>
        <div
          className="flex h-8 items-center gap-2 border-b px-3.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--eld-syntax-line-number)]"
          style={elev}
        >
          <span className="i">{lang ?? "Terminal"}</span>
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
