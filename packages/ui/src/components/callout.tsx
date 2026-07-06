import * as React from "react";
import { Info, Lightbulb, TriangleAlert, OctagonAlert } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * Callout — composite. GFM-style admonition matching the Elide docs content
 * (Note / Tip / Important / Warning / Caution). Each tone carries its own hue,
 * left accent rule, and icon. Body accepts arbitrary rich content.
 */
type CalloutTone = "note" | "tip" | "important" | "warning" | "caution";

const TONES: Record<
  CalloutTone,
  { label: string; color: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }
> = {
  note: { label: "Note", color: "var(--eld-info)", icon: Info },
  tip: { label: "Tip", color: "var(--eld-success)", icon: Lightbulb },
  important: { label: "Important", color: "var(--eld-magenta-500)", icon: Info },
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
      className={cn("flex gap-3 rounded-xl border p-4", className)}
      style={{
        // tone-tinted surface + left accent, expressed off the tone color
        background: `color-mix(in oklab, ${t.color} 9%, transparent)`,
        borderColor: `color-mix(in oklab, ${t.color} 25%, transparent)`,
        borderLeft: `3px solid ${t.color}`,
      }}
      {...props}
    >
      <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" style={{ color: t.color } as React.CSSProperties} />
      <div className="min-w-0">
        <div className="mb-1 text-sm font-bold text-foreground">{title ?? t.label}</div>
        <div className="text-sm leading-relaxed text-muted-foreground [&_code]:font-mono [&_code]:text-[var(--primary-emphasis)]">
          {children}
        </div>
      </div>
    </div>
  );
}
