import * as React from "react";
import { cn } from "../lib/utils";
import { useMessages } from "../i18n/context";

/**
 * SectionTabs — the 46px top-level section bar under the main nav (Start ·
 * Runtime · Toolchain · API Reference · Resources), with a right-aligned
 * version indicator. These are plain section links, not ARIA tabs — there is
 * no associated tabpanel, so we render a `<nav>` of anchors rather than
 * `role="tablist"`.
 */
export interface SectionTabItem {
  label: string;
  href: string;
  active?: boolean;
}

export interface SectionTabsVersion {
  label: string;
  status?: "ok" | "beta" | "warn";
}

export interface SectionTabsProps extends Omit<React.ComponentProps<"nav">, "onSelect"> {
  items: SectionTabItem[];
  version?: SectionTabsVersion;
  onSelect?: (href: string) => void;
}

const dotColor: Record<NonNullable<SectionTabsVersion["status"]>, string> = {
  ok: "var(--eld-success-strong)",
  beta: "var(--eld-info)",
  warn: "var(--eld-warning-strong)",
};

export function SectionTabs({ items, version, onSelect, className, ...props }: SectionTabsProps) {
  const m = useMessages();
  return (
    <nav
      aria-label={m.sectionTabs.navLabel}
      className={cn(
        "flex h-[46px] items-center gap-1 border-b border-border bg-background px-[22px]",
        className,
      )}
      {...props}
    >
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          onClick={
            onSelect
              ? (e) => {
                  // Controlled selection: the consumer handles routing, so
                  // suppress the anchor's own in-page hash navigation.
                  e.preventDefault();
                  onSelect(item.href);
                }
              : undefined
          }
          className={cn(
            "relative px-3 py-3.5 text-[13.5px] text-muted-foreground transition-colors",
            item.active && "font-semibold text-[var(--primary-emphasis)]",
          )}
        >
          {item.label}
          {item.active ? (
            <span
              aria-hidden
              className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[var(--primary)]"
            />
          ) : null}
        </a>
      ))}
      <span className="flex-1" />
      {version ? (
        <span className="flex items-center gap-1.5 font-mono text-xs font-medium text-muted-foreground/80">
          <span
            aria-hidden
            className="h-[7px] w-[7px] rounded-full"
            style={{ background: dotColor[version.status ?? "ok"] }}
          />
          {version.label}
        </span>
      ) : null}
    </nav>
  );
}
