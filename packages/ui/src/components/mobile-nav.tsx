import * as React from "react";
import { History, Menu, Search, Sparkle } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { Sheet, SheetTrigger, SheetContent } from "./sheet";
import { useMessages } from "../i18n/provider";

/**
 * MobileNav — the docs shell at phone width (mockup 3b): a condensed top app
 * bar, a slide-in section drawer (built on the shipped `Sheet`), and a
 * persistent bottom "Search or ask" bar. Data-driven and presentational —
 * callers own routing (`href`s) and the search/AI action.
 */
export interface MobileNavItem {
  label: string;
  href?: string;
  active?: boolean;
}

export interface MobileNavGroup {
  label: string;
  items: MobileNavItem[];
}

export interface MobileNavSection {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export interface MobileNavProps extends Omit<React.ComponentProps<"div">, "onSearch"> {
  /** Grouped drawer links, e.g. "Introduction" / "By language". */
  groups: MobileNavGroup[];
  /** The current section's header, shown atop the drawer (e.g. "Start"). */
  section?: MobileNavSection;
  /** Brand slot rendered in the app bar (logo + wordmark, a "DOCS" pill, …). */
  logo?: React.ReactNode;
  /** Fired by the app-bar search icon and the bottom search pill. */
  onSearch?: () => void;
  /** Renders the drawer footer as a link when set, a plain button otherwise. */
  changelogHref?: string;
  searchPlaceholder?: string;
  /** Controlled drawer state; falls back to internal state when omitted. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MobileNav({
  groups,
  section,
  logo,
  onSearch,
  changelogHref,
  searchPlaceholder,
  open,
  onOpenChange,
  className,
  children,
  ...props
}: MobileNavProps) {
  const m = useMessages();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const drawerOpen = open ?? internalOpen;
  const setDrawerOpen = React.useCallback(
    (next: boolean) => {
      if (open === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <div className={cn("flex flex-col bg-background text-foreground", className)} {...props}>
        <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border px-4">
          <SheetTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label={m.mobileNav.openNavigation}
                className={cn(
                  drawerOpen && "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-emphasis)]",
                )}
              />
            }
          >
            <Menu aria-hidden className="h-[18px] w-[18px]" />
          </SheetTrigger>
          <div className="flex flex-1 items-center gap-2 overflow-hidden">{logo}</div>
          <Button variant="outline" size="icon" aria-label={m.mobileNav.searchLabel} onClick={onSearch}>
            <Search aria-hidden className="h-[17px] w-[17px]" />
          </Button>
        </header>

        {children}

        <div className="mt-auto shrink-0 border-t border-border bg-[var(--nav-background)] px-4 py-3">
          <button
            type="button"
            onClick={onSearch}
            className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--muted)] px-3.5 text-[var(--subtle-foreground)]"
          >
            <Search aria-hidden className="h-4 w-4 text-[var(--primary-emphasis)]" />
            <span className="flex-1 text-left text-sm">{searchPlaceholder ?? m.mobileNav.searchPlaceholder}</span>
            <Sparkle aria-hidden className="h-[15px] w-[15px] text-[var(--primary-emphasis)]" />
          </button>
        </div>
      </div>

      <SheetContent
        side="left"
        showCloseButton={false}
        aria-label={section?.title ? `${section.title} navigation` : m.mobileNav.dialogLabel}
        className="flex w-72 flex-col gap-5 p-4"
      >
        {section ? (
          <div className="flex items-center gap-2.5">
            {section.icon ? (
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary-emphasis)]"
              >
                {section.icon}
              </span>
            ) : null}
            <div>
              <div className="text-sm font-semibold text-foreground">{section.title}</div>
              {section.subtitle ? (
                <div className="text-xs text-[var(--subtle-foreground)]">{section.subtitle}</div>
              ) : null}
            </div>
          </div>
        ) : null}

        <nav aria-label={m.mobileNav.navLabel} className="flex flex-1 flex-col gap-4 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <div className="px-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--subtle-foreground)]">
                {group.label}
              </div>
              {group.items.map((item) => {
                const linkClassName = cn(
                  "rounded-lg px-2.5 py-2 text-sm",
                  item.active
                    ? "font-semibold text-[var(--primary-emphasis)] bg-[var(--primary-soft)]"
                    : "text-muted-foreground",
                );
                return item.href ? (
                  <a
                    key={item.label}
                    href={item.href}
                    aria-current={item.active ? "page" : undefined}
                    className={linkClassName}
                  >
                    {item.label}
                  </a>
                ) : (
                  <span
                    key={item.label}
                    aria-current={item.active ? "page" : undefined}
                    className={linkClassName}
                  >
                    {item.label}
                  </span>
                );
              })}
            </div>
          ))}
        </nav>

        <Button
          variant="changelog"
          className="w-full justify-start"
          render={
            changelogHref ? <a href={changelogHref} aria-label={m.mobileNav.changelog} /> : undefined
          }
        >
          <History aria-hidden className="h-[15px] w-[15px]" />
          {m.mobileNav.changelog}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
