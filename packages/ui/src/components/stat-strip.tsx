import * as React from "react";
import { cn } from "../lib/utils";

/**
 * StatStrip — composite. The bordered row of headline figures at the top of
 * API landing pages (module count, Test262 pass rate, WinterTC coverage). A
 * single stat may be `emphasis`-ed to draw the eye to a standout figure.
 */
export interface Stat {
  value: React.ReactNode;
  label: string;
  /** Render the value in the primary accent color instead of the default foreground. */
  emphasis?: boolean;
}

export interface StatStripProps extends React.ComponentProps<"dl"> {
  stats: Stat[];
  /** Number of columns; defaults to one column per stat (a single row). */
  columns?: number;
}

export function StatStrip({
  stats,
  columns,
  className,
  "aria-label": ariaLabel = "Statistics",
  ...props
}: StatStripProps) {
  const cols = columns ?? stats.length;
  return (
    <dl
      aria-label={ariaLabel}
      className={cn("m-0 grid overflow-hidden rounded-xl border border-border", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      {...props}
    >
      {stats.map((stat, i) => {
        const lastInRow = (i + 1) % cols === 0;
        const last = i === stats.length - 1;
        return (
          <div
            key={i}
            className={cn("flex flex-col gap-1.5 p-5", !lastInRow && !last && "border-r border-border")}
          >
            <dd
              className={cn(
                "m-0 font-display text-[28px] font-bold leading-none",
                stat.emphasis ? "text-[var(--primary)]" : "text-foreground",
              )}
            >
              {stat.value}
            </dd>
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          </div>
        );
      })}
    </dl>
  );
}
