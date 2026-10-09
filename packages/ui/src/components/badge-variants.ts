import { cva } from "class-variance-authority";

/**
 * Badge class variants. Kept out of badge.tsx so that file exports only
 * components and Fast Refresh can preserve state on edit.
 */
export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-semibold leading-none",
  {
    variants: {
      variant: {
        neutral: "border border-border text-muted-foreground",
        primary: "text-[var(--primary-emphasis)] [background:var(--primary-soft)]",
        supported: "text-[var(--success-emphasis)] [background:var(--success-soft)]",
        partial: "text-[var(--warning-emphasis)] [background:var(--warning-soft)]",
        missing: "text-muted-foreground [background:var(--muted)]",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  },
);
