import * as React from "react";
import { Check, CircleDot, X, type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { useMessages } from "../i18n/provider";
import type { Messages } from "../i18n/messages";

/**
 * SupportMatrix — composite. The bordered reference table used on API pages to
 * show per-method support ("Method support", node:fs and friends). Status is
 * conveyed with an icon *and* an accessible label — never color alone.
 */
export type SupportStatus = "yes" | "no" | "partial";

export interface SupportRow {
  method: React.ReactNode;
  status: SupportStatus;
  notes?: React.ReactNode;
}

export interface SupportMatrixColumn {
  key: string;
  label: string;
  align?: "left" | "center";
}

export interface SupportMatrixProps extends React.ComponentProps<"div"> {
  columns?: SupportMatrixColumn[];
  rows: SupportRow[];
  /** Accessible table name. Visually hidden — the visible heading lives outside the table. */
  caption?: string;
}

const DEFAULT_COLUMNS: SupportMatrixColumn[] = [
  { key: "method", label: "Method" },
  { key: "status", label: "Status", align: "center" },
  { key: "notes", label: "Notes" },
];

const STATUS_META: Record<SupportStatus, { messageKey: keyof Messages["supportMatrix"]; icon: LucideIcon; color: string }> = {
  yes: { messageKey: "supported", icon: Check, color: "var(--eld-success-strong)" },
  no: { messageKey: "notSupported", icon: X, color: "var(--subtle-foreground)" },
  partial: { messageKey: "partial", icon: CircleDot, color: "var(--eld-warning-strong)" },
};

export function SupportMatrix({
  columns = DEFAULT_COLUMNS,
  rows,
  caption,
  className,
  ...props
}: SupportMatrixProps) {
  const m = useMessages();
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border", className)} {...props}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption ?? m.supportMatrix.caption}</caption>
        <thead className="bg-[var(--muted)]">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-wide text-[var(--subtle-foreground)]",
                  column.align === "center" ? "text-center" : "text-left",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const status = STATUS_META[row.status];
            const StatusIcon = status.icon;
            const statusLabel = m.supportMatrix[status.messageKey];
            return (
              <tr key={i} className="border-t border-border">
                <td className="px-4 py-2.5 font-mono text-[var(--primary-emphasis)]">{row.method}</td>
                <td className="px-4 py-2.5 text-center">
                  <StatusIcon
                    role="img"
                    aria-label={statusLabel}
                    className="inline-block h-4 w-4"
                    style={{ color: status.color }}
                  />
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{row.notes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
