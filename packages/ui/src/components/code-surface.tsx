import * as React from "react";
import { cn } from "../lib/utils";

/**
 * Shared chrome for every code surface (editor blocks, terminals, recordings):
 * the always-dark panel, the title bar with window controls, and controls.
 */

export const codeSurfaceStyle: React.CSSProperties = {
  background: "var(--code-background)",
  borderColor: "var(--code-border)",
};

export const codeSurfaceElevStyle: React.CSSProperties = {
  background: "var(--code-background-elev)",
  borderColor: "var(--code-border)",
};

/**
 * Window-control style. `auto` follows the viewer's OS when the page runs
 * `codeChromeScript` before hydration (otherwise it shows macOS controls);
 * CSS picks the variant, so server and client render identical markup.
 */
export type CodeChrome = "auto" | "mac" | "windows" | "linux" | "none";

/**
 * Inline this in `<head>` (before hydration) to let `chrome="auto"` surfaces
 * match the viewer's OS. It only sets `data-os` on `<html>`.
 */
export const codeChromeScript =
  '(function(){try{var n=navigator,p=(n.userAgentData&&n.userAgentData.platform)||n.platform||n.userAgent||"";document.documentElement.dataset.os=/win/i.test(p)?"windows":/linux|cros|x11/i.test(p)&&!/android/i.test(p)?"linux":"mac"}catch(e){}})()';

export interface CodeSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Drop shadow used by the editor block; terminals sit flatter by default. */
  raised?: boolean;
  chrome?: CodeChrome;
}

export function CodeSurface({ raised = false, chrome = "auto", className, style, ...props }: CodeSurfaceProps) {
  return (
    <div
      {...props}
      data-chrome={chrome}
      className={cn(
        "overflow-clip rounded-xl border",
        raised && "shadow-[0_20px_44px_-26px_rgba(0,0,0,0.65)]",
        className,
      )}
      style={{ ...codeSurfaceStyle, ...style }}
    />
  );
}

const glyph = "block size-[0.6875rem] shrink-0";

/** macOS traffic lights. Decorative. */
function MacControls() {
  return (
    <span aria-hidden className="eld-chrome-mac items-center gap-[0.4375rem]">
      <span className={cn(glyph, "rounded-full bg-[var(--code-chrome-close)]")} />
      <span className={cn(glyph, "rounded-full bg-[var(--code-chrome-minimize)]")} />
      <span className={cn(glyph, "rounded-full bg-[var(--code-chrome-zoom)]")} />
    </span>
  );
}

/** Windows minimize / maximize / close. Decorative. */
function WindowsControls() {
  return (
    <span aria-hidden className="eld-chrome-windows items-center gap-4 text-[var(--code-control-foreground)]">
      <svg viewBox="0 0 10 10" className="size-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M0 5.5h10" />
      </svg>
      <svg viewBox="0 0 10 10" className="size-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1">
        <rect x="0.5" y="0.5" width="9" height="9" />
      </svg>
      <svg viewBox="0 0 10 10" className="size-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
      </svg>
    </span>
  );
}

/** GNOME (Adwaita) close button. Decorative. */
function LinuxControls() {
  return (
    <span aria-hidden className="eld-chrome-linux items-center">
      <span className="flex size-[1.125rem] items-center justify-center rounded-full bg-[var(--code-control-hover)] text-[var(--code-control-foreground)]">
        <svg viewBox="0 0 10 10" className="size-2" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
        </svg>
      </span>
    </span>
  );
}

export interface CodeSurfaceTitleBarProps {
  /** Centered label (filename, `user@host: cwd`, …). */
  title?: React.ReactNode;
  /** Controls next to the title (language badge, copy, …). */
  actions?: React.ReactNode;
  chrome?: CodeChrome;
  className?: string;
}

/**
 * Title bar on a symmetric three-column grid, so the title stays centered
 * whatever the controls' widths. Pinned LTR: window chrome does not mirror in
 * RTL locales (macOS keeps traffic lights on the left).
 */
export function CodeSurfaceTitleBar({ title, actions, chrome = "auto", className }: CodeSurfaceTitleBarProps) {
  const mac = chrome === "auto" || chrome === "mac";
  return (
    <div
      dir="ltr"
      data-slot="code-surface-title"
      className={cn(
        "grid min-h-[2.625rem] grid-cols-[minmax(4.5rem,1fr)_minmax(0,auto)_minmax(4.5rem,1fr)] items-center gap-3 border-b px-3.5",
        className,
      )}
      style={codeSurfaceElevStyle}
    >
      <div className="flex min-w-0 items-center">{mac ? <MacControls /> : null}</div>
      <div className="min-w-0 truncate text-center font-mono text-[0.78125rem] tracking-wide text-[var(--code-title-foreground)]">
        {typeof title === "string" ? <bdi>{title}</bdi> : title}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-2">
        {actions}
        {chrome === "auto" || chrome === "windows" ? <WindowsControls /> : null}
        {chrome === "auto" || chrome === "linux" ? <LinuxControls /> : null}
      </div>
    </div>
  );
}

/** Small monospace label for the language/shell in a title bar. */
export function CodeSurfaceBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[0.65625rem] font-semibold tracking-normal text-[var(--eld-syntax-line-number)]">
      {children}
    </span>
  );
}

/** Icon button styling shared by code-surface controls (copy, wrap, playback). */
export const codeControlClassName =
  "inline-flex shrink-0 touch-manipulation select-none items-center justify-center rounded-md p-1.5 text-sm text-[var(--code-control-foreground)] transition-[color,background-color,scale] duration-[var(--eld-motion-hover)] ease-[var(--eld-motion-ease-out)] hover:bg-[var(--code-control-hover)] hover:text-[var(--eld-syntax-default)] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--code-prompt)] disabled:pointer-events-none disabled:opacity-40 aria-pressed:text-[var(--code-prompt)] motion-reduce:transition-none [&_svg]:size-[1em] [&_svg]:shrink-0";
