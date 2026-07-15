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
        supported: "text-[var(--eld-success-strong)] [background:color-mix(in_oklab,var(--eld-success-strong)_14%,transparent)]",
        partial: "text-[var(--eld-warning-strong)] [background:color-mix(in_oklab,var(--eld-warning-strong)_14%,transparent)]",
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
