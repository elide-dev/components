import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { badgeVariants } from "./badge-variants";

/**
 * Badge — leaf primitive. Includes the API-reference status tones
 * (supported / partial / missing) used across the docs reference pages.
 */
export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Show a leading status dot (auto-colored to the variant). */
  dot?: boolean;
}

export function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
