import * as React from "react";
import { Info, Lightbulb, MessageSquareWarning, TriangleAlert, OctagonAlert } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * Callout — composite. GitHub-style admonition (Note / Tip / Important /
 * Warning / Caution): a plain left rule with the icon + label line tinted in
 * the tone color, no surface fill or outer border. Body accepts arbitrary
 * rich content and renders in the regular foreground color.
 */
type CalloutTone = "note" | "tip" | "important" | "warning" | "caution";

const TONES: Record<
  CalloutTone,
  { label: string; color: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }
> = {
  note: { label: "Note", color: "var(--eld-info)", icon: Info },
  tip: { label: "Tip", color: "var(--eld-success)", icon: Lightbulb },
  important: { label: "Important", color: "var(--eld-magenta-500)", icon: MessageSquareWarning },
  warning: { label: "Warning", color: "var(--eld-warning)", icon: TriangleAlert },
  caution: { label: "Caution", color: "var(--eld-danger)", icon: OctagonAlert },
};

export interface CalloutProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: CalloutTone;
  /** Override the default tone label (e.g. a custom heading). */
  title?: React.ReactNode;
}

export function Callout({ tone = "note", title, className, children, ...props }: CalloutProps) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div
      role="note"
      className={cn("flex flex-col gap-2 py-2 pl-4 pr-2", className)}
      style={{ borderLeft: `3px solid ${t.color}` }}
      {...props}
    >
      <div
        className="flex items-center gap-2 text-sm font-semibold leading-none"
        style={{ color: t.color }}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {title ?? t.label}
      </div>
      <div className="text-sm leading-relaxed text-foreground [&_code]:font-mono [&_code]:text-[var(--primary-emphasis)]">
        {children}
      </div>
    </div>
  );
}
