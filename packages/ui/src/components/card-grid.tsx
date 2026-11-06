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
  "group flex flex-col gap-[var(--eld-card-gap,0.5rem)] rounded-xl border border-border bg-card p-[var(--eld-card-padding,1rem)] text-start no-underline transition-[background-color,border-color] duration-[var(--eld-motion-hover)] ease-[var(--eld-motion-ease-out)] motion-reduce:transition-none";
const cardInteractive =
  "cursor-pointer hover:border-primary-emphasis/50 hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

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
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary-emphasis)] [&_svg]:h-[17px] [&_svg]:w-[17px]">
          {icon}
        </span>
      ) : null}
      <div className="flex items-center gap-2">
        <span className="text-[14.5px] font-semibold text-foreground">{title}</span>
        {external ? (
          <ExternalLink aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : null}
        {badge ? <span className="ms-auto shrink-0">{badge}</span> : null}
      </div>
      {description ? (
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a
        data-slot="feature-card"
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
      data-slot="feature-card"
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
 * Uses its available inline size, including inside narrow sidebars and panels.
 * `columns` is the maximum count; each card keeps a useful minimum width.
 */
export interface CardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 1 | 2 | 3;
}

export function CardGrid({ columns = 3, className, style, children, ...props }: CardGridProps) {
  return (
    <div
      className={cn("eld-card-grid grid gap-3.5", className)}
      style={{ "--eld-card-columns": columns, ...style } as React.CSSProperties}
      {...props}
    >
      {children}
    </div>
  );
}
