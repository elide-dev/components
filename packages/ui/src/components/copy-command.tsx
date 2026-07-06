import * as React from "react";
import { cn } from "../lib/utils";
import { CopyButton } from "./code-block";

/**
 * CopyCommand — the single-line install command (`$ curl elide.sh | bash`):
 * a prompt glyph, the command in monospace, and a copy affordance. Shares the
 * dark code surface with `CodeBlock` and reuses its `CopyButton`.
 */
export interface CopyCommandProps extends React.HTMLAttributes<HTMLDivElement> {
  command: string;
  /** Prompt glyph shown before the command. */
  prompt?: string;
  /** Visible label next to the copy icon; icon-only (matching the mockup) when omitted. */
  label?: string;
}

export function CopyCommand({ command, prompt = "$", label = "", className, ...props }: CopyCommandProps) {
  return (
    <div
      className={cn("flex items-center gap-2.5 rounded-xl border px-3.5 py-3", className)}
      style={{ background: "var(--code-background)", borderColor: "var(--code-border)" }}
      {...props}
    >
      <span
        aria-hidden
        className="font-mono text-[12.5px]"
        style={{ color: "var(--eld-syntax-comment)" }}
      >
        {prompt}
      </span>
      <code
        className="flex-1 overflow-x-auto font-mono text-[12.5px] whitespace-nowrap"
        style={{ color: "var(--eld-syntax-default)" }}
      >
        {command}
      </code>
      <CopyButton value={command} label={label} className="shrink-0 border-[var(--code-border)]" />
    </div>
  );
}
