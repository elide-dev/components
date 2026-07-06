# @elide/tokens

Framework-agnostic design tokens for Elide. No dependencies, no framework — safe
to consume from any repo (docs site, marketing site, a React app, a Figma
plugin, a native target).

Values are lifted verbatim from the Figma **Elide Design System** variable
collections (`eld/colors`, `mode`, `eld/font`, `eld/syntax`, `tw/border-radius`).
Treat this package as the single source of truth; don't re-derive colors.

## What's inside

| Export | Use it for |
| --- | --- |
| `@elide/tokens/tokens.css` | Raw CSS custom properties (primitives + semantic light/dark). Import once at the app root. |
| `@elide/tokens/theme.css` | The above **plus** a Tailwind v4 `@theme` bridge and font `@import`s. Use in Tailwind apps. |
| `@elide/tokens/fonts.css` | Just the font `@import`s (swap for self-hosted in prod). |
| `@elide/tokens` (JS) | Typed token object — `magenta`, `neutral`, `syntax`, `radius`, `font`, `cssVar`… |

## Consuming

**Tailwind v4 app (docs, marketing):**

```css
/* app/styles/global.css */
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

The **code surface is intentionally dark in both themes** (matching the Figma
Code Block), so `--code-*` and `--eld-syntax-*` do not change with theme.
