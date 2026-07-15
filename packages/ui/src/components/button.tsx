import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { buttonVariants } from "./button-variants";

/**
 * Button — leaf primitive.
 *
 * Styled entirely from @elide/tokens (bg-primary, text-primary-foreground, …).
 *
 * The `render` prop mirrors Base UI's composition model (replaces Radix
 * `asChild`): pass an element and the button's props/classes merge onto it —
 * e.g. `<Button render={<a href="/install" />}>Install</Button>`.
 */
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
