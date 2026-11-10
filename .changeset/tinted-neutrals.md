---
"@elide/tokens": minor
---

Tint the neutral scale toward the accent. Every `--eld-neutral-*` step now
shares one hue (OKLCH 290, the purple scale's) at very low chroma, in place of
a mix of pure greys, a green-tinted white and two violet-tinted darks. Surfaces,
rules and text sit in the same family as the purple accent.

Each step keeps the relative luminance of the grey it replaced, so every
contrast pairing in `test/contrast.test.ts` is unchanged.
