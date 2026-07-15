import { cva } from "class-variance-authority"

/**
 * Trigger style shared by NavigationMenuTrigger and standalone links styled to
 * match. Kept out of navigation-menu.tsx so that file exports only components
 * and Fast Refresh can preserve state on edit.
 */
export const navigationMenuTriggerStyle = cva(
  "group/navigation-menu-trigger inline-flex h-9 w-max items-center justify-center rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all outline-none hover:bg-muted focus:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-popup-open:bg-muted/50 data-popup-open:hover:bg-muted data-open:bg-muted/50 data-open:hover:bg-muted data-open:focus:bg-muted"
)
