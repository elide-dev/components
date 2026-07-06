import * as React from "react";
import { Check, ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "../lib/utils";
import { Badge } from "./badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

/**
 * Sidebar — the left nav column on docs pages: a `SectionSwitcher` (jumps
 * between top-level doc sections, e.g. Runtime ↔ Toolchain) above a static
 * stack of labeled `SidebarGroup`s. Purely presentational — callers own
 * routing and pass `active`/`comingSoon` per item.
 */
export interface SidebarSection {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export interface SectionSwitcherProps extends React.ComponentProps<"button"> {
  sections: SidebarSection[];
  activeId: string;
  onSectionChange?: (id: string) => void;
}

export function SectionSwitcher({
  sections,
  activeId,
  onSectionChange,
  className,
  ...props
}: SectionSwitcherProps) {
  const active = sections.find((section) => section.id === activeId) ?? sections[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted px-2.5 py-2 text-left transition-colors hover:bg-[var(--hover)]",
              className,
            )}
            {...props}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              {active?.icon ? (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
                  {active.icon}
                </span>
              ) : null}
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13.5px] font-semibold text-foreground">
                  {active?.title}
                </span>
                {active?.subtitle ? (
                  <span className="truncate text-[11px] text-subtle-foreground">
                    {active.subtitle}
                  </span>
                ) : null}
              </span>
            </span>
            <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-subtle-foreground" />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-64">
        {sections.map((section) => (
          <DropdownMenuItem
            key={section.id}
            onClick={() => onSectionChange?.(section.id)}
            className="items-center gap-2.5 py-1.5"
          >
            {section.icon ? (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
                {section.icon}
              </span>
            ) : null}
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-foreground">{section.title}</span>
              {section.subtitle ? (
                <span className="truncate text-xs text-muted-foreground">{section.subtitle}</span>
              ) : null}
            </span>
            {section.id === activeId ? (
              <Check aria-hidden className="ml-auto h-4 w-4 shrink-0 text-[var(--primary)]" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface SidebarItemProps {
  label: string;
  href?: string;
  active?: boolean;
  /** Opens in a new tab and shows a trailing external-link icon. */
  external?: boolean;
  /** Renders muted with a "Soon" marker instead of a navigable link. */
  comingSoon?: boolean;
  onSelect?: () => void;
}

export function SidebarItem({ label, href, active, external, comingSoon, onSelect }: SidebarItemProps) {
  if (comingSoon) {
    return (
      <span
        aria-disabled="true"
        className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13.5px] text-muted-foreground/60"
      >
        {label}
        <Badge variant="neutral" size="sm" className="shrink-0">
          Soon
        </Badge>
      </span>
    );
  }

  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={onSelect}
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13.5px] transition-colors",
        active
          ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary)]"
          : "text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground",
      )}
    >
      {label}
      {external ? <ExternalLink aria-hidden className="h-3.5 w-3.5 shrink-0" /> : null}
    </a>
  );
}

export interface SidebarGroupProps extends React.ComponentProps<"div"> {
  label: string;
  items: SidebarItemProps[];
}

export function SidebarGroup({ label, items, className, ...props }: SidebarGroupProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)} {...props}>
      <div className="px-2.5 pb-1 font-mono text-[11px] font-semibold tracking-wider text-subtle-foreground uppercase">
        {label}
      </div>
      {items.map((item) => (
        <SidebarItem key={item.label} {...item} />
      ))}
    </div>
  );
}

export interface SidebarProps extends Omit<React.ComponentProps<"nav">, "onSelect"> {
  sections: SidebarSection[];
  activeSectionId: string;
  onSectionChange?: (id: string) => void;
  groups: { label: string; items: SidebarItemProps[] }[];
}

export function Sidebar({
  sections,
  activeSectionId,
  onSectionChange,
  groups,
  className,
  ...props
}: SidebarProps) {
  return (
    <nav
      aria-label="Sidebar"
      className={cn("flex w-[264px] flex-col gap-[22px] border-r border-border bg-background p-3.5", className)}
      {...props}
    >
      <SectionSwitcher sections={sections} activeId={activeSectionId} onSectionChange={onSectionChange} />
      {groups.map((group) => (
        <SidebarGroup key={group.label} label={group.label} items={group.items} />
      ))}
    </nav>
  );
}
