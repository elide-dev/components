import * as React from "react";
import { cn } from "../lib/utils";

export interface DeferredContentProps extends React.ComponentProps<"div"> {
  /**
   * Estimated block size before the body has been rendered; numbers are pixels.
   * Choose an estimate near the real size to limit scroll-position changes.
   * The browser remembers the measured size after the first render.
   * @default "32rem"
   */
  intrinsicBlockSize?: number | string;
}

/**
 * Opt-in rendering containment for expensive bodies on long documentation pages.
 * Children stay mounted, searchable, and available to assistive technology; this
 * defers browser layout/paint, not React work or network requests.
 *
 * Keep section headings and anchor targets outside this wrapper so the table of
 * contents can measure headings without forcing skipped bodies to render. Avoid
 * wrapping sticky/fixed content or non-portaled overlays: paint containment clips
 * overflow. Browsers without content-visibility support render normally.
 */
export function DeferredContent({
  intrinsicBlockSize = "32rem",
  className,
  style,
  ...props
}: DeferredContentProps) {
  return (
    <div
      {...props}
      data-slot="deferred-content"
      className={cn("eld-deferred-content", className)}
      style={{
        "--eld-deferred-content-size": typeof intrinsicBlockSize === "number"
          ? `${intrinsicBlockSize}px`
          : intrinsicBlockSize,
        ...style,
      } as React.CSSProperties}
    />
  );
}
