# @elide/tokens

Framework-agnostic design tokens for Elide. No dependencies, no framework — safe
to consume from any repo (docs site, marketing site, a React app, a Figma
plugin, a native target).

Values originate in the Figma **Elide Design System** variable collections
(`eld/colors`, `mode`, `eld/font`, `eld/syntax`, `tw/border-radius`). The UI now
uses purple-to-muted-rose gradients for primary actions, lavender for accent
text, tighter corner radii, and restrained button shadows. Original magenta and brand artwork colors remain
available. Treat this package as the single source of truth.

`purple` is exported for JS/TS consumers alongside the existing scales. Use
`--primary`, `--primary-hover`, `--primary-emphasis`, and `--primary-soft` for UI
colors that adapt to light and dark themes. CTA gradients use OKLCH stops and
explicit Oklab interpolation. The stops hold nearly constant lightness, keep
purple through 65% of the fill, and use the same restrained palette across
display gamuts. Both filled variants share this treatment. Hover
colors use relative OKLCH lightness where supported, with `color-mix()` and
sRGB fallbacks. `brand.gradient` exports the modern gradient;
`brand.gradientFallback` provides its sRGB alternative. Read CSS variables for
the active display-aware values. The brand artwork retains its original palette.

Buttons use a 6px radius and 1px border at every size. Filled buttons layer a
darker gradient border under the face, matching its direction and stop positions;
hover deepens both layers. Both layers share a border-box origin so their color
transitions line up at the edge. The radius scale also tightens panels
and other controls, while explicitly circular shapes remain circular.
Where supported, `background-clip: border-area` clips the rim to the border
without painting beneath the face; other browsers retain the layered fallback.

Button hover surfaces and shadows crossfade over 180ms on a separate pseudo
element. A press scales the control to 98% over 80ms, then settles back over
240ms. Hover never moves the hit area. Motion uses scale and opacity, with no
gradient, shadow, or layout interpolation and no JavaScript animation loop.
Keyboard focus appears immediately; reduced-motion preferences disable the
scale and transitions while preserving state feedback. The `motion` export
mirrors the `--eld-motion-*` timing tokens for other consumers.

## What's inside

| Export | Use it for |
| --- | --- |
| `@elide/tokens/tokens.css` | Raw CSS custom properties (primitives + semantic light/dark). Import once at the app root. |
| `@elide/tokens/theme.css` | The above **plus** a Tailwind v4 `@theme` bridge. Use in Tailwind apps. |
| `@elide/tokens/fonts.css` | Self-hosted variable WOFF2 fonts with Unicode subsets and swap display. |
| `@elide/tokens` (JS) | Typed token object — `magenta`, `neutral`, `syntax`, `radius`, `font`, `cssVar`… |

## Consuming

**Tailwind v4 app (docs, marketing):**

```css
/* app/styles/global.css */
@import "@elide/tokens/fonts.css";
@import "tailwindcss";
@import "@elide/tokens/theme.css";
```

Then use `bg-background`, `text-primary`, `rounded-lg`, `font-mono`, etc.

**Plain CSS / no Tailwind:**

```css
@import "@elide/tokens/tokens.css";
.button { background: var(--primary); color: var(--primary-foreground); }
```

**JS/TS:**

```ts
import { magenta, syntax } from "@elide/tokens";
chart.setSeriesColor(magenta[400]);
```

## Theming

Light is the default (on `:root`). Enable dark by adding `.dark` (or
`[data-theme="dark"]`) to `<html>`. The docs app defaults to dark at the app
level; this package stays neutral so the marketing site can default to light.
The selected theme sets `color-scheme` for native controls and scrollbars.
Feature-detected `light-dark()` pairs semantic colors and `alpha()` preserves
the source color space and alpha when deriving translucent colors. Explicit
theme values and `color-mix()` remain the fallbacks.

Text and icons in an accent or status color use the theme-aware emphasis
tokens — `--primary-emphasis`, `--info-emphasis`, `--success-emphasis`,
`--warning-emphasis`, `--danger-emphasis` (Tailwind: `text-success-emphasis`) —
over their `--*-soft` tints. The base hues (`--eld-info`, `--eld-success`, …)
are fill colors and fail AA as text on light surfaces. `bun test` checks every
semantic text/surface pairing against WCAG AA in both themes.

The **code surface is intentionally dark in both themes** (matching the Figma
Code Block), so `--code-*` and `--eld-syntax-*` do not change with theme.
