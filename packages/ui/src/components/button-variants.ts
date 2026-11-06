import { cva } from "class-variance-authority";

/**
 * Button class variants. Kept out of button.tsx so that file exports only
 * components and Fast Refresh can preserve state on edit.
 *
 * `gradient` is the purple-to-rose CTA (the "Install" button). `changelog` is the
 * softly tinted accent affordance used in the docs nav.
 *
 * The hover surface (including its border and shadow) fades on ::before.
 * Its isolated negative stack keeps it behind the label without extra markup,
 * including when the classes are composed onto an anchor. The hit area stays
 * still on hover. Only a deliberate press scales the control.
 */
export const buttonVariants = cva(
  [
    "relative isolate inline-flex shrink-0 cursor-pointer touch-manipulation select-none items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent font-medium leading-none outline-none",
    "transition-[scale] duration-[var(--eld-motion-settle)] ease-[var(--eld-motion-ease-out)] motion-safe:active:scale-[0.98] active:duration-[var(--eld-motion-press)] motion-reduce:transition-none",
    "before:pointer-events-none before:absolute before:-inset-px before:-z-10 before:rounded-[inherit] before:border before:border-transparent before:opacity-0 before:content-['']",
    "before:transition-opacity before:duration-[var(--eld-motion-hover)] before:ease-[var(--eld-motion-ease-out)] hover:before:opacity-100 active:before:opacity-100 active:before:duration-[var(--eld-motion-press)] motion-reduce:before:transition-none",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none disabled:before:opacity-0",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "[background:var(--button-primary-background)_border-box_padding-box,var(--button-border-background)_border-box] text-primary-foreground shadow-[var(--button-shadow)] before:[background:var(--button-primary-hover-background)_border-box_padding-box,var(--button-border-hover-background)_border-box] before:shadow-[var(--button-shadow-hover)]",
        gradient:
          "text-primary-foreground [background:var(--eld-gradient-brand)_border-box_padding-box,var(--button-border-background)_border-box] shadow-[var(--button-shadow)] before:[background:var(--eld-gradient-hover)_border-box_padding-box,var(--button-border-hover-background)_border-box] before:shadow-[var(--button-shadow-hover)]",
        outline:
          "border-foreground/25 bg-card text-foreground shadow-xs before:border-primary-emphasis/60 before:bg-primary-soft",
        ghost:
          "bg-transparent text-muted-foreground before:bg-primary-soft",
        changelog:
          "border-primary-emphasis/35 [background:var(--button-accent-background)] text-primary-emphasis before:border-primary-emphasis/60 before:bg-primary-soft before:shadow-xs",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-11 gap-2.5 px-5 text-sm",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
