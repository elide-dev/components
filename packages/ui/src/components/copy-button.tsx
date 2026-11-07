import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "../lib/utils";
import { useMessages } from "../i18n/context";

/**
 * CopyButton — copies `value` to the clipboard, flips to a check for 1.5s.
 * Used by CodeBlock and CopyCommand.
 */
export function CopyButton({
  value,
  className,
  label,
  copyLabel,
  copiedLabel,
}: {
  value: string;
  className?: string;
  /** Visible label; omit or pass "" for an icon-only button. Defaults to the localized "Copy". */
  label?: string;
  /** Accessible copy action and success text overrides for composed controls. */
  copyLabel?: string;
  copiedLabel?: string;
}) {
  const m = useMessages();
  const [copied, setCopied] = React.useState(false);
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = React.useRef(false);
  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(resetTimer.current); };
  }, []);
  return (
    <button
      type="button"
      aria-label={copied ? copiedLabel ?? m.codeBlock.copied : label || copyLabel || m.codeBlock.copy}
      onClick={async () => {
        if (!navigator.clipboard) return;
        try {
          await navigator.clipboard.writeText(value);
          if (!mounted.current) return;
          clearTimeout(resetTimer.current);
          setCopied(true);
          resetTimer.current = setTimeout(() => setCopied(false), 1500);
        } catch {
          // Preserve the retry affordance; never announce an unsuccessful copy.
          if (mounted.current) setCopied(false);
        }
      }}
      className={cn(
        "inline-flex select-none touch-manipulation items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors duration-[var(--eld-motion-hover)] ease-[var(--eld-motion-ease-out)] motion-reduce:transition-none",
        "border-[var(--code-border)] text-[var(--code-control-foreground)] hover:bg-[var(--code-control-hover)] hover:text-[var(--code-syntax-default)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--code-prompt)]",
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {label ? <span>{copied ? copiedLabel ?? m.codeBlock.copied : label}</span> : null}
    </button>
  );
}

