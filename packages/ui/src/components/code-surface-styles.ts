import type * as React from "react";

/** Styles and constants shared by code surfaces (kept out of component files for Fast Refresh). */

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

/** Icon button styling shared by code-surface controls (copy, wrap, playback). */
export const codeControlClassName =
  "inline-flex shrink-0 touch-manipulation select-none items-center justify-center rounded-md p-1.5 text-sm text-[var(--code-control-foreground)] transition-[color,background-color,scale] duration-[var(--eld-motion-hover)] ease-[var(--eld-motion-ease-out)] hover:bg-[var(--code-control-hover)] hover:text-[var(--code-syntax-default)] active:scale-[0.96] focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-[var(--code-prompt)] disabled:pointer-events-none disabled:opacity-40 aria-pressed:text-[var(--code-prompt)] motion-reduce:transition-none [&_svg]:size-[1em] [&_svg]:shrink-0";
