---
"@elide/tokens": minor
"@elide/ui": minor
---

Refresh primary UI accents with purple-to-muted-rose gradients in both themes.
Use OKLCH stops, Oklab interpolation, balanced stop lightness, and relative-color
hover shading with sRGB fallbacks. Tighten the shared radius scale and use 6px
corners on buttons. Simplify catalog copy and use plain JetBrains Mono labels.
Add a typed purple scale, primary hover and soft Tailwind colors, and themed
button shadows while preserving the original brand artwork palette.

Refine all button variants with 1px borders, darker aligned gradient edges on
filled actions, and restrained depth. Crossfade hover surfaces and shadows with
opacity; add responsive press scaling and eased release using shared motion
tokens. Preserve stable hover targets, immediate keyboard focus, and
reduced-motion support. Add a large size
and catalog examples for product context, sizes, disabled states, and links.

Carry the treatment through badges, tabs, switches, menus, sheets, dialogs,
accordions, cards, and navigation. Use shared motion timing, restrained overlay
scale, explicit transition properties, reduced-motion overrides, and system
colors for forced-color controls. Suppress selection on controls while retaining
selectable prose and code. Fix vertical tab keyboard behavior and horizontal tab
layout, align navigation accessible names with visible labels, and report copy
success only after the clipboard write succeeds.

Ship self-hosted variable fonts, component-level ESM exports targeting ES2022,
a lightweight CopyButton entry point, and separate catalog-only CSS. Add a
prerendered production consumer, Lighthouse audits, leaf bundle budgets, and
browser regression checks. Make catalog accessibility violations fail tests.
