import { useMessages } from "../i18n/context";
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
  /** Maximum number of columns; narrower containers wrap the cells. */
  columns?: number;
}

export function StatStrip({
  stats,
  columns,
  className,
  style,
  "aria-label": ariaLabel,
  ...props
}: StatStripProps) {
  const m = useMessages();
  const cols = Math.max(1, Math.floor(columns ?? stats.length));
  return (
    <dl
      aria-label={ariaLabel ?? m.statStrip.label}
      className={cn("eld-stat-strip m-0 grid overflow-hidden rounded-xl border border-border bg-card", className)}
      style={{ "--eld-stat-columns": cols, ...style } as React.CSSProperties}
      {...props}
    >
      {stats.map((stat) => {
        return (
          <div
            key={stat.label}
            data-slot="stat-cell"
            className="flex min-w-0 flex-col gap-[var(--eld-stat-gap,0.375rem)] p-[var(--eld-stat-padding,1.25rem)]"
          >
            {/* Semantic order is <dt> (term/label) then <dd> (value); `order-*`
                keeps the value visually on top per the mockup. */}
            <dt className="order-2 text-xs text-muted-foreground">{stat.label}</dt>
            <dd
              className={cn(
                "order-1 m-0 font-display text-[28px] font-bold leading-none",
                stat.emphasis ? "text-[var(--primary-emphasis)]" : "text-foreground",
              )}
            >
              {stat.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
