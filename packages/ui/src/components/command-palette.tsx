import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Search, CornerDownLeft } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * CommandPalette — the ⌘K spotlight search overlay (direction 1b in the docs
 * mockups). Built on the Base UI Dialog primitive (the repo's overlay base) and
 * themed from `@elide/tokens`. Presentational + keyboard-navigable: it filters,
 * arrow-keys through a flat list, and selects on Enter/click. Wiring a global
 * ⌘K shortcut is left to the consumer so the primitive stays reusable.
 */
export interface CommandItem {
  id: string;
  title: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  /** Plain text used for filtering (falls back to `title` when it's a string). */
  keywords?: string;
  onSelect?: () => void;
}

export interface CommandGroup {
  heading: string;
  items: CommandItem[];
}

export interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  groups: CommandGroup[];
  placeholder?: string;
  emptyMessage?: string;
  /** Filter items by the query against title/keywords/subtitle. Default true. */
  filter?: boolean;
}

const groupHeadingCls =
  "px-2.5 pt-1.5 pb-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground";

export function CommandPalette({
  open,
  onOpenChange,
  groups,
  placeholder = "Search docs, commands, APIs…",
  emptyMessage = "No results found.",
  filter = true,
}: CommandPaletteProps) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!filter || !query.trim()) return groups;
    const q = query.toLowerCase();
    const match = (i: CommandItem) => {
      const hay = i.keywords ?? (typeof i.title === "string" ? i.title : "");
      return `${hay} ${i.subtitle ?? ""}`.toLowerCase().includes(q);
    };
    return groups
      .map((g) => ({ ...g, items: g.items.filter(match) }))
      .filter((g) => g.items.length > 0);
  }, [groups, query, filter]);

  // Flatten for keyboard navigation across groups.
  const flat = React.useMemo(() => filtered.flatMap((g) => g.items), [filtered]);
  const [active, setActive] = React.useState(0);
  React.useEffect(() => setActive(0), [query, open]);

  const select = (item: CommandItem | undefined) => {
    if (!item) return;
    item.onSelect?.();
    onOpenChange?.(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(flat[active]);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          aria-label="Command palette"
          onKeyDown={onKeyDown}
          className={cn(
            "fixed left-1/2 top-24 z-50 w-[560px] max-w-[calc(100%-2rem)] -translate-x-1/2",
            "overflow-hidden rounded-2xl border border-border-strong bg-popover",
            "shadow-[0_30px_70px_-20px_rgba(0,0,0,0.8)] outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          <div className="flex items-center gap-3 border-b border-border px-[18px] py-[15px]">
            <Search className="h-[18px] w-[18px] shrink-0 text-subtle-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              className="flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-subtle-foreground"
            />
            <kbd className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-subtle-foreground">
              esc
            </kbd>
          </div>

          <div className="flex max-h-[320px] flex-col gap-0.5 overflow-y-auto p-2">
            {flat.length === 0 ? (
              <div className="px-2.5 py-6 text-center text-[13.5px] text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              filtered.map((group) => (
                <div key={group.heading}>
                  <div className={groupHeadingCls}>{group.heading}</div>
                  {group.items.map((item) => {
                    const idx = flat.indexOf(item);
                    const isActive = idx === active;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseMove={() => setActive(idx)}
                        onClick={() => select(item)}
                        className={cn(
                          "flex w-full items-center gap-[11px] rounded-[9px] px-2.5 py-[9px] text-left",
                          isActive && "[background:var(--primary-soft)]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4",
                            isActive ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-foreground">
                            {item.title}
                          </span>
                          {item.subtitle ? (
                            <span className="block truncate text-[11.5px] text-subtle-foreground">
                              {item.subtitle}
                            </span>
                          ) : null}
                        </span>
                        {isActive ? (
                          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-primary" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
