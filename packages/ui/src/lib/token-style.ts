import type { CSSProperties } from "react";
import type { TokenStyle } from "./code-model";

/** Inline CSS for a model token style (ANSI attributes; classes cover highlighter tokens). */
export function tokenStyleToCss(style: TokenStyle | undefined): CSSProperties | undefined {
  if (!style) return undefined;
  const css: CSSProperties = {};
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
