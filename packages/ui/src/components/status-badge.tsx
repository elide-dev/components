import { Badge, type BadgeProps } from "./badge";

/**
 * StatusBadge — thin wrapper over `Badge`'s status tones. Maps an API-support
 * status (as used across the node:-compatibility reference pages) to a badge
 * variant, dot, and default label.
 */
export type ApiStatus = "implemented" | "supported" | "partial" | "missing" | "planned";

const STATUS_CONFIG: Record<ApiStatus, { variant: NonNullable<BadgeProps["variant"]>; label: string }> = {
  implemented: { variant: "supported", label: "Implemented" },
  supported: { variant: "supported", label: "Supported" },
  partial: { variant: "partial", label: "Partial" },
  missing: { variant: "missing", label: "Missing" },
  planned: { variant: "missing", label: "Planned" },
};

export interface StatusBadgeProps extends Omit<BadgeProps, "variant" | "dot"> {
  status: ApiStatus;
  /** Override the default per-status label. */
  label?: string;
}

export function StatusBadge({ status, label, children, ...props }: StatusBadgeProps) {
  const { variant, label: defaultLabel } = STATUS_CONFIG[status];
  return (
    <Badge dot variant={variant} {...props}>
      {children ?? label ?? defaultLabel}
    </Badge>
  );
}
