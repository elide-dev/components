import * as React from "react";
import { cn } from "../lib/utils";
import { useMessages } from "../i18n/context";

/**
 * TableOfContents — the "On this page" right-rail nav that lists in-page
 * anchor headings. Pass `activeId` to control the highlighted item directly
 * (e.g. from route state); omit it and the component scroll-spies the
 * headings itself on scroll (rAF-throttled), so one item is always current.
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
  /**
   * Pixels from the viewport top to the activation line: the active item is
   * the last heading whose top has scrolled above it. Defaults to 96.
   */
  activationOffset?: number;
}

export function TableOfContents({
  items,
  activeId,
  variant = "default",
  title,
  onSelect,
  activationOffset = 96,
  className,
  ...props
}: TableOfContentsProps) {
  const m = useMessages();
  const [spiedId, setSpiedId] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    // Controlled from outside — don't fight the caller with our own spy.
    if (activeId !== undefined) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      // At the bottom the last headings may never reach the activation line,
      // so the lowest heading on screen wins instead.
      const line = atBottom ? window.innerHeight : activationOffset;
      let first: string | undefined;
      let next: string | undefined;
      let nextTop = -Infinity;
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        first ??= item.id;
        const top = el.getBoundingClientRect().top;
        if (top <= line && top >= nextTop) {
          nextTop = top;
          next = item.id;
        }
      }
      // Above the first heading, the first entry stays highlighted.
      setSpiedId(next ?? first);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [items, activeId, activationOffset]);

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
