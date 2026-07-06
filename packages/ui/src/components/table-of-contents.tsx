import * as React from "react";
import { cn } from "../lib/utils";
import { useMessages } from "../i18n/provider";

/**
 * TableOfContents — the "On this page" right-rail nav that lists in-page
 * anchor headings. Pass `activeId` to control the highlighted item directly
 * (e.g. from route state); omit it and the component scroll-spies the
 * headings itself via `IntersectionObserver`.
 */
export interface TocItem {
  id: string;
  label: string;
  /** Nesting level for sub-headings (h3 under h2, etc). Defaults to 0. */
  depth?: number;
}

export interface TableOfContentsProps extends Omit<React.ComponentProps<"nav">, "onSelect"> {
  items: TocItem[];
  /** Controlled active item id. When omitted, the component scroll-spies. */
  activeId?: string;
  /** `mono` renders labels in JetBrains Mono, for API method listings. */
  variant?: "default" | "mono";
  title?: string;
  onSelect?: (id: string) => void;
}

export function TableOfContents({
  items,
  activeId,
  variant = "default",
  title,
  onSelect,
  className,
  ...props
}: TableOfContentsProps) {
  const m = useMessages();
  const [visibleIds, setVisibleIds] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    // Controlled from outside — don't fight the caller with our own observer.
    if (activeId !== undefined) return;
    // jsdom (and older browsers) have no IntersectionObserver; degrade to "no
    // active item" rather than throwing.
    if (typeof IntersectionObserver === "undefined") return;

    const targets = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleIds((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            if (entry.isIntersecting) next.add(entry.target.id);
            else next.delete(entry.target.id);
          }
          return next;
        });
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items, activeId]);

  const spiedId = items.find((item) => visibleIds.has(item.id))?.id;
  const currentId = activeId ?? spiedId;

  return (
    <nav
      aria-label={m.tableOfContents.navLabel}
      className={cn("flex flex-col gap-[11px]", className)}
      {...props}
    >
      <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">
        {title ?? m.tableOfContents.title}
      </div>
      {items.map((item) => {
        const isActive = item.id === currentId;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={isActive ? "location" : undefined}
            onClick={onSelect ? () => onSelect(item.id) : undefined}
            style={{ paddingLeft: 11 + (item.depth ?? 0) * 12 }}
            className={cn(
              "border-l-2 text-[13px] no-underline transition-colors",
              variant === "mono" && "font-mono",
              isActive
                ? "border-[var(--primary)] font-semibold text-[var(--primary-emphasis)]"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
