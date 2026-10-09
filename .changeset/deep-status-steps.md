---
"@elide/tokens": minor
"@elide/ui": patch
---

Meet WCAG AA for every semantic text/surface pairing in both themes.

`@elide/tokens` adds AA text steps per hue: `--eld-{info,success,warning,danger}-deep`
for light surfaces, `--eld-{info,danger}-strong` to complete the dark-surface set,
`--eld-neutral-550` and `--eld-magenta-750`. New theme-aware semantic tokens
`--{info,success,warning,danger}-emphasis` (text and icons) and `--*-soft` (tints)
pick the right step per theme, with Tailwind colors to match
(`text-success-emphasis`, `bg-success-soft`, …). Light `--subtle-foreground` moves
to neutral-550, light `--primary-emphasis` to magenta-750, and `--destructive` to
the deep red so white text on it passes. `bun test` gates the pairings.

`@elide/ui` reads status text from the emphasis tokens: Badge, SupportMatrix,
SectionTabs, Callout labels (rules keep the base hue) and destructive
DropdownMenu items.
