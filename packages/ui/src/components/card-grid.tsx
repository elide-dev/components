import * as React from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * FeatureCard — an icon-chip card that links (or triggers a callback) into a
 * section: category tiles on the API landing page, the mobile "Start here"
 * list. Renders as an anchor when `href` is given, otherwise a clickable
 * `div` so a caller can drive navigation itself via `onSelect`.
 */
export interface FeatureCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  href?: string;
  icon?: React.ReactNode;
  /** Trailing indicator, e.g. a count `Badge`. */
  badge?: React.ReactNode;
  /** Opens `href` in a new tab and shows an external-link glyph. */
  external?: boolean;
  onSelect?: () => void;
}

const cardBase =
  "group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left no-underline transition-[transform,background-color,border-color]";
const cardInteractive =
  "cursor-pointer hover:-translate-y-px hover:border-border-strong hover:bg-[var(--hover)]";

export function FeatureCard({
  title,
  description,
  href,
  icon,
  badge,
  external,
  onSelect,
  className,
  ...props
}: FeatureCardProps) {
  const interactive = Boolean(href || onSelect);
  const cardClassName = cn(cardBase, interactive && cardInteractive, className);

  const content = (
    <>
      {icon ? (
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--primary-soft)] text-[var(--primary-emphasis)] [&_svg]:h-[17px] [&_svg]:w-[17px]">
          {icon}
        </span>
      ) : null}
      <div className="flex items-center gap-2">
        <span className="text-[14.5px] font-semibold text-foreground">{title}</span>
        {external ? (
          <ExternalLink aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : null}
        {badge ? <span className="ml-auto shrink-0">{badge}</span> : null}
      </div>
      {description ? (
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        onClick={onSelect}
        className={cardClassName}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...props}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      className={cardClassName}
      {...props}
    >
      {content}
    </div>
  );
}

/**
 * CardGrid — responsive wrapper for `FeatureCard`s (or arbitrary children):
 * the "Browse by category" API grid, the mobile "Start here" stack.
 * Collapses to a single column on small widths regardless of `columns`.
 */
export interface CardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 1 | 2 | 3;
}

const columnClasses: Record<NonNullable<CardGridProps["columns"]>, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

export function CardGrid({ columns = 3, className, children, ...props }: CardGridProps) {
  return (
    <div className={cn("grid gap-3.5", columnClasses[columns], className)} {...props}>
      {children}
    </div>
  );
}
