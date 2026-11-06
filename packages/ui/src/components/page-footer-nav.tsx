import { useMessages } from "../i18n/context";
import * as React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * PageFooterNav — the prev/next cards at the bottom of a docs page. Either side
 * may be omitted; a lone `next` stays right-aligned.
 */
export interface PageFooterNavLink {
  label: string;
  href: string;
}

export interface PageFooterNavProps extends React.ComponentProps<"nav"> {
  prev?: PageFooterNavLink;
  next?: PageFooterNavLink;
}

const cardBase =
  "group flex flex-1 flex-col gap-1 rounded-xl border p-4 transition-colors duration-[var(--eld-motion-hover)] ease-[var(--eld-motion-ease-out)] motion-reduce:transition-none hover:bg-[var(--hover)]";

export function PageFooterNav({ prev, next, className, ...props }: PageFooterNavProps) {
  const m = useMessages();
  return (
    <nav
      aria-label={m.pageFooterNav.navLabel}
      className={cn("flex items-stretch justify-between gap-4", className)}
      {...props}
    >
      {prev ? (
        <a href={prev.href} className={cardBase}>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowLeft aria-hidden className="h-3.5 w-3.5 rtl:rotate-180" />
            {m.pageFooterNav.previous}
          </span>
          <span className="text-sm font-medium text-foreground">{prev.label}</span>
        </a>
      ) : (
        <span aria-hidden className="flex-1" />
      )}
      {next ? (
        <a href={next.href} className={cn(cardBase, "items-end text-end")}>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {m.pageFooterNav.next}
            <ArrowRight aria-hidden className="h-3.5 w-3.5 rtl:rotate-180" />
          </span>
          <span className="text-sm font-medium text-foreground">{next.label}</span>
        </a>
      ) : (
        <span aria-hidden className="flex-1" />
      )}
    </nav>
  );
}
