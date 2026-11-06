import { useMessages } from "../i18n/context";
import * as React from "react";
import { cn } from "../lib/utils";
import { CopyButton } from "./copy-button";

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
  const m = useMessages();
  return (
    <div
      className={cn("flex items-center gap-2.5 rounded-xl border px-3.5 py-3", className)}
      style={{ background: "var(--code-background)", borderColor: "var(--code-border)" }}
      {...props}
    >
      <div dir="ltr" className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          aria-hidden
          className="font-mono text-[12.5px]"
          style={{ color: "var(--eld-syntax-comment)" }}
        >
          {prompt}
        </span>
        <code
          dir="ltr"
          className="flex-1 overflow-x-auto font-mono text-[12.5px] whitespace-nowrap"
          style={{ color: "var(--eld-syntax-default)" }}
        >
          {command}
        </code>
      </div>
      <CopyButton value={command} label={label} copyLabel={m.copyCommand.copy} copiedLabel={m.copyCommand.copied} className="shrink-0 border-[var(--code-border)]" />
    </div>
  );
}
