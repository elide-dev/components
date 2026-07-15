import * as React from "react";
import { ChevronDown, Globe, History, Search, Sparkles, Sun } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { ElideLogo } from "./elide-logo";
import { useMessages } from "../i18n/provider";

/**
 * AppNav — the 56px top nav bar present on every docs page: brand + "DOCS"
 * pill, primary section links, a search trigger, and the theme/locale/
 * changelog/install cluster. Purely presentational — callers own routing,
 * theme state, and the search/locale overlays; this just renders the bar and
 * fires callbacks.
 */
export interface NavLink {
  label: string;
  href: string;
  active?: boolean;
}

export interface AppNavProps extends React.ComponentProps<"nav"> {
  links: NavLink[];
  /** Defaults to a text/mark fallback — pass your own logo element to override. */
  logo?: React.ReactNode;
  searchPlaceholder?: string;
  /** Current locale label shown in the switcher (e.g. "EN"). */
  locale?: string;
  installHref?: string;
  changelogHref?: string;
  onSearchClick?: () => void;
  onThemeToggle?: () => void;
  onLocaleClick?: () => void;
}

const defaultLogo = <ElideLogo />;

export function AppNav({
  links,
  logo,
  searchPlaceholder,
  locale = "EN",
  installHref = "/install",
  changelogHref = "/changelog",
  onSearchClick,
  onThemeToggle,
  onLocaleClick,
  className,
  ...props
}: AppNavProps) {
  const m = useMessages();
  return (
    <nav
      aria-label={m.appNav.navLabel}
      className={cn(
        "flex h-14 items-center gap-[18px] border-b border-border px-[22px] backdrop-blur-xl [background:var(--nav-background)]",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        {logo ?? defaultLogo}
        <span className="rounded-md border border-border-strong px-[7px] py-0.5 font-mono text-[10px] font-semibold tracking-wider text-muted-foreground">
          {m.appNav.docsBadge}
        </span>
      </div>

      <span aria-hidden className="h-[22px] w-px bg-border" />

      <div className="flex items-center gap-0.5 text-[13.5px]">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            aria-current={link.active ? "page" : undefined}
            className={cn(
              "rounded-[7px] px-2.5 py-1.5 transition-colors hover:bg-[var(--hover)]",
              link.active
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </a>
        ))}
      </div>

      <span className="flex-1" />

      <button
        type="button"
        onClick={onSearchClick}
        aria-label={m.appNav.searchLabel}
        className="flex h-[34px] w-[280px] items-center gap-2 rounded-[9px] border border-border bg-muted px-3 text-subtle-foreground transition-colors hover:border-border-strong"
      >
        <Search aria-hidden className="h-[15px] w-[15px] shrink-0" />
        <span className="flex-1 text-left text-[13px]">{searchPlaceholder ?? m.appNav.searchPlaceholder}</span>
        <Sparkles aria-hidden className="h-[13px] w-[13px] shrink-0 text-primary" />
        <kbd className="rounded-[5px] border border-border-strong px-1.5 py-px font-mono text-[11px] font-medium">
          ⌘K
        </kbd>
      </button>

      <button
        type="button"
        onClick={onThemeToggle}
        aria-label={m.appNav.toggleTheme}
        className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-border text-muted-foreground transition-colors hover:bg-[var(--hover)] hover:text-foreground"
      >
        <Sun aria-hidden className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onLocaleClick}
        aria-label={m.appNav.language}
        className="flex h-[34px] items-center gap-1.5 rounded-[9px] border border-border px-[11px] text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-[var(--hover)] hover:text-foreground"
      >
        <Globe aria-hidden className="h-[15px] w-[15px]" />
        {locale}
        <ChevronDown aria-hidden className="h-[13px] w-[13px]" />
      </button>

      {/* The render-prop anchors get their visible text merged in by Button at
          runtime; the aria-label keeps them labelled for static analysis and
          mirrors the visible text exactly. */}
      <Button
        variant="changelog"
        size="sm"
        render={<a href={changelogHref} aria-label={m.appNav.changelog} />}
      >
        <History aria-hidden className="h-[15px] w-[15px]" />
        {m.appNav.changelog}
      </Button>

      <Button
        variant="gradient"
        size="sm"
        render={<a href={installHref} aria-label={m.appNav.install} />}
      >
        {m.appNav.install}
      </Button>
    </nav>
  );
}
