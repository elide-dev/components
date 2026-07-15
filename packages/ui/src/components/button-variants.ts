import { cva } from "class-variance-authority";

/**
 * Button class variants. Kept out of button.tsx so that file exports only
 * components and Fast Refresh can preserve state on edit.
 *
 * `gradient` is the Elide brand CTA (the "Install" button). `changelog` is the
 * violet-outlined affordance used in the docs nav.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        gradient: "text-white [background:var(--eld-gradient-brand)] hover:opacity-95",
        outline: "border border-border bg-transparent text-foreground hover:bg-[var(--hover)]",
        ghost: "bg-transparent text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground",
        changelog:
          "border text-foreground [border-color:var(--eld-accent-violet)] [background:color-mix(in_oklab,var(--eld-accent-violet)_10%,transparent)] [box-shadow:0_0_0_1px_color-mix(in_oklab,var(--eld-accent-violet)_22%,transparent),0_0_16px_-4px_color-mix(in_oklab,var(--eld-accent-violet)_55%,transparent)] hover:[background:color-mix(in_oklab,var(--eld-accent-violet)_16%,transparent)]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
