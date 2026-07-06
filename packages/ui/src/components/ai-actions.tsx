import * as React from "react";
import { Check, Copy, ExternalLink, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * AiActions — the "Use with AI" panel in the docs right rail: copy the page as
 * Markdown, or hand it off to an assistant (Open in Claude/ChatGPT, view as
 * plain text). Actions are data-driven so callers own the destinations.
 */
export interface AiActionItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  /** Opens `href` in a new tab and shows an external-link glyph. */
  external?: boolean;
  onClick?: () => void;
}

export interface AiActionsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  /** When given, renders a "Copy as Markdown" button that writes this to the clipboard. */
  markdown?: string;
  actions?: AiActionItem[];
}

const itemClass =
  "flex items-center gap-2 rounded-lg border border-border bg-muted px-2.5 py-2 text-left text-[12.5px] font-medium text-foreground no-underline transition-colors hover:bg-accent";

export function AiActions({
  title = "Use with AI",
  markdown,
  actions = [],
  className,
  ...props
}: AiActionsProps) {
  const [copied, setCopied] = React.useState(false);

  return (
    <div
      className={cn("flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5", className)}
      {...props}
    >
      <div className="mb-0.5 flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-wider text-subtle-foreground uppercase">
        <Sparkles aria-hidden className="h-[13px] w-[13px] text-[var(--primary)]" />
        {title}
      </div>

      {markdown ? (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(markdown);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className={itemClass}
        >
          {copied ? (
            <Check aria-hidden className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Copy aria-hidden className="h-3.5 w-3.5 shrink-0" />
          )}
          {copied ? "Copied" : "Copy as Markdown"}
        </button>
      ) : null}

      {actions.map((action) => {
        const content = (
          <>
            <span className="flex-1">{action.label}</span>
            {action.icon ??
              (action.external ? (
                <ExternalLink aria-hidden className="h-[13px] w-[13px] shrink-0 text-subtle-foreground" />
              ) : null)}
          </>
        );
        return action.href ? (
          <a
            key={action.label}
            href={action.href}
            onClick={action.onClick}
            className={cn(itemClass, "justify-between")}
            {...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {content}
          </a>
        ) : (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={cn(itemClass, "justify-between")}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
