import { useMessages } from "../i18n/context";
import * as React from "react";
import { Info, Lightbulb, MessageSquareWarning, TriangleAlert, OctagonAlert } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * Callout — composite. GitHub-style admonition (Note / Tip / Important /
 * Warning / Caution): a plain left rule in the tone's base hue, with the icon +
 * label line in its text-safe emphasis color, no surface fill or outer border.
 * Body accepts arbitrary rich content and renders in the regular foreground
 * color.
 */
type CalloutTone = "note" | "tip" | "important" | "warning" | "caution";

const TONES: Record<
  CalloutTone,
  {
    rule: string;
    color: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  }
> = {
  note: { rule: "var(--eld-info)", color: "var(--info-emphasis)", icon: Info },
  tip: { rule: "var(--eld-success)", color: "var(--success-emphasis)", icon: Lightbulb },
  important: {
    rule: "var(--primary-emphasis)",
    color: "var(--primary-emphasis)",
    icon: MessageSquareWarning,
  },
  warning: { rule: "var(--eld-warning)", color: "var(--warning-emphasis)", icon: TriangleAlert },
  caution: { rule: "var(--eld-danger)", color: "var(--danger-emphasis)", icon: OctagonAlert },
};

export interface CalloutProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: CalloutTone;
  /** Override the default tone label (e.g. a custom heading). */
  title?: React.ReactNode;
}

export function Callout({ tone = "note", title, className, children, ...props }: CalloutProps) {
  const m = useMessages();
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div
      role="note"
      className={cn("flex flex-col gap-2 py-2 ps-4 pe-2", className)}
      style={{ borderInlineStart: `3px solid ${t.rule}` }}
      {...props}
    >
      <div
        className="flex items-center gap-2 text-sm font-semibold leading-none"
        style={{ color: t.color }}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {title ?? m.callout[tone]}
      </div>
      <div className="text-sm leading-relaxed text-foreground [&_code]:font-mono [&_code]:text-[var(--primary-emphasis)]">
        {children}
      </div>
    </div>
  );
}
