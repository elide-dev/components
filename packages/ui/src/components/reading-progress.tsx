import * as React from "react";
import { cn } from "../lib/utils";

export type ReadingProgressProps = Omit<
  React.ComponentProps<"div">,
  "children" | "role" | "aria-hidden" | "tabIndex"
>;

/**
 * A visual reading-position cue for the root document scroller. CSS drives the
 * transform directly from scroll position without JavaScript listeners. Hidden
 * when scroll timelines are unsupported, reduced motion is requested, or printed.
 *
 * This is decorative, not an ARIA progressbar: CSS does not expose a live numeric
 * value. Pair it with headings and TableOfContents for accessible navigation.
 * Place outside contained content; use className/style to offset a fixed header.
 */
export function ReadingProgress({ className, ...props }: ReadingProgressProps) {
  return (
    <div
      {...props}
      aria-hidden="true"
      data-slot="reading-progress"
      className={cn("eld-reading-progress", className)}
    />
  );
}
