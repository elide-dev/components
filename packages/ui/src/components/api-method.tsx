import * as React from "react";
import { Hash } from "lucide-react";
import { cn } from "../lib/utils";
import { StatusBadge, type ApiStatus } from "./status-badge";

/**
 * ParamRow — one parameter line inside an `ApiMethod` entry: a fixed-width
 * monospace name, its type, and a free-form description (may contain inline
 * `code`).
 */
export interface ParamRowProps {
  name: string;
  type: string;
  description?: React.ReactNode;
  className?: string;
}

export function ParamRow({ name, type, description, className }: ParamRowProps) {
  return (
    <div className={cn("flex items-baseline gap-3", className)}>
      <code className="w-24 shrink-0 font-mono text-[12.5px] text-[var(--primary-emphasis)]">{name}</code>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">{type}</span>
      {description ? (
        <span className="text-[13.5px] text-muted-foreground [&_code]:font-mono [&_code]:text-[var(--primary-emphasis)]">
          {description}
        </span>
      ) : null}
    </div>
  );
}

/** Emphasize the function-name portion of a plain-string signature (up to the first `(`). */
function emphasizeSignature(signature: string | React.ReactNode) {
  if (typeof signature !== "string") return signature;
  const parenIndex = signature.indexOf("(");
  if (parenIndex === -1) return signature;
  return (
    <>
      <span className="text-[var(--primary-emphasis)]">{signature.slice(0, parenIndex)}</span>
      {signature.slice(parenIndex)}
    </>
  );
}

/**
 * ApiMethod — a single method entry in a node:-compatibility reference page
 * (mockup 2b, node:fs): a signature + status + anchor link, a description,
 * typed params (`ParamRow`), and an optional example — pass a shipped
 * `CodeBlock` as `example`.
 */
export interface ApiMethodProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "id"> {
  signature: string | React.ReactNode;
  status?: ApiStatus;
  description?: React.ReactNode;
  params?: ParamRowProps[];
  example?: React.ReactNode;
  /** Anchor id for TOC/deep-linking; also renders a `#` link next to the signature. */
  anchorId?: string;
}

export function ApiMethod({
  signature,
  status,
  description,
  params,
  example,
  anchorId,
  className,
  ...props
}: ApiMethodProps) {
  return (
    <div id={anchorId} className={cn("border-t border-border pt-6", className)} {...props}>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <code className="font-mono text-[17px] font-medium leading-snug text-foreground">
          {emphasizeSignature(signature)}
        </code>
        {status ? <StatusBadge status={status} size="sm" /> : null}
        {anchorId ? (
          <a
            href={`#${anchorId}`}
            aria-label={`Link to ${typeof signature === "string" ? signature : "this method"}`}
            className="text-[var(--primary-emphasis)] opacity-55 transition-opacity hover:opacity-100"
          >
            <Hash aria-hidden className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
      {description ? (
        <p className="mb-4 max-w-[640px] text-[14.5px] leading-relaxed text-muted-foreground [&_code]:font-mono [&_code]:text-[var(--primary-emphasis)]">
          {description}
        </p>
      ) : null}
      {params && params.length > 0 ? (
        <div className="mb-4 flex flex-col gap-2">
          {params.map((param) => (
            <ParamRow key={param.name} {...param} />
          ))}
        </div>
      ) : null}
      {example ? <div className="max-w-[640px]">{example}</div> : null}
    </div>
  );
}
