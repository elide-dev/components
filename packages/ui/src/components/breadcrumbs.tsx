import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * Breadcrumbs — the trail above a docs page title (e.g. Runtime › Guides ›
 * Debugging). The final segment is the current page; earlier segments link when
 * given an `href`.
 */
export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps extends React.ComponentProps<"nav"> {
  segments: BreadcrumbSegment[];
}

export function Breadcrumbs({ segments, className, ...props }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm", className)} {...props}>
      <ol className="flex items-center gap-1.5">
        {segments.map((segment, i) => {
          const isLast = i === segments.length - 1;
          return (
            <li key={`${segment.label}-${i}`} className="flex items-center gap-1.5">
              {isLast ? (
                <span aria-current="page" className="font-medium text-foreground">
                  {segment.label}
                </span>
              ) : segment.href ? (
                <a
                  href={segment.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {segment.label}
                </a>
              ) : (
                <span className="text-muted-foreground">{segment.label}</span>
              )}
              {isLast ? null : (
                <ChevronRight aria-hidden className="h-4 w-4 text-muted-foreground/60" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
