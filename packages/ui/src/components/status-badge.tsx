import { Badge, type BadgeProps } from "./badge";
import { useMessages } from "../i18n/provider";

/**
 * StatusBadge — thin wrapper over `Badge`'s status tones. Maps an API-support
 * status (as used across the node:-compatibility reference pages) to a badge
 * variant, dot, and default (localized) label.
 */
export type ApiStatus = "implemented" | "supported" | "partial" | "missing" | "planned";

const STATUS_VARIANT: Record<ApiStatus, NonNullable<BadgeProps["variant"]>> = {
  implemented: "supported",
  supported: "supported",
  partial: "partial",
  missing: "missing",
  planned: "missing",
};

export interface StatusBadgeProps extends Omit<BadgeProps, "variant" | "dot"> {
  status: ApiStatus;
  /** Override the default per-status label. */
  label?: string;
}

export function StatusBadge({ status, label, children, ...props }: StatusBadgeProps) {
  const m = useMessages();
  return (
    <Badge dot variant={STATUS_VARIANT[status]} {...props}>
      {children ?? label ?? m.statusBadge[status]}
    </Badge>
  );
}
