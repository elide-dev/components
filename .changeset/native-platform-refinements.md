---
"@elide/tokens": patch
"@elide/ui": minor
---

Adopt color-scheme, light-dark(), relative alpha(), and border-area clipping with
feature-detected fallbacks that preserve the existing palette. Make CardGrid,
StatStrip, and dialog footers adapt to their container, with optional compact
density. Share interruptible opacity/scale overlay transitions with starting
styles, discrete transitions, and reduced-motion support for CommandPalette.

Add opt-in AnchoredPopover with native CSS positioning, Base UI focus/dismissal,
and a floating fallback. Add DeferredContent for offscreen document bodies and a
decorative CSS scroll-timeline ReadingProgress. Preserve print, reduced-motion,
and unsupported-browser behavior. Export platform.css for custom Tailwind builds.

Add a prerendered platform example and local cross-browser checks for theme
parity, CSS fallbacks, container layouts, nested focus, anchor collisions, scroll
progress, and print. CI uses Chromium; Firefox and WebKit can be checked locally.
