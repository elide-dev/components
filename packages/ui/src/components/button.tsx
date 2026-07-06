import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

/**
 * Button — leaf primitive.
 *
 * Styled entirely from @elide/tokens (bg-primary, text-primary-foreground, …).
 * `gradient` is the Elide brand CTA (the "Install" button). `changelog` is the
 * violet-outlined affordance used in the docs nav.
 *
 * The `render` prop mirrors Base UI's composition model (replaces Radix
 * `asChild`): pass an element and the button's props/classes merge onto it —
 * e.g. `<Button render={<a href="/install" />}>Install</Button>`.
 */
const buttonVariants = cva(
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

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * Slot-style composition: pass an element and the button's classes/props merge
   * onto it (e.g. `<Button render={<a href="/install" />}>`). Typed loosely so any
   * host element — anchor, button, custom — is accepted.
   */
  render?: React.ReactElement<Record<string, unknown>>;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, render, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), className);
    if (render) {
      return React.cloneElement(
        render,
        { className: cn(classes, render.props.className as string | undefined), ref, ...props },
        children,
      );
    }
    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
