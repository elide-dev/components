---
"@elide/brand": minor
"@elide/ui": minor
---

Ship the Elide logo as a catalog component.

New `@elide/brand` package holding the logo geometry and every rendition
generated from it — 8 artworks (square/full × gradient/mono/blend, with light
and dark cuts where the variant is theme-dependent) as scalable SVG plus
png/webp/avif at 1x/2x/3x.

`ElideLogo` in `@elide/ui` now covers light/dark, square/full form, and
vector/raster in one component. Vector is the default and inlines the SVG, so
there is no request and no asset to serve; `mono` and `blend` draw in
`currentColor` and invert with the theme for free. Raster mode reads from
`@elide/brand/assets` under `assetBase` (default `/brand`).

**Breaking:** `<ElideLogo />` with no props now renders the official full
lockup. It previously rendered the nav's badge-plus-wordmark lockup, which is
different artwork. That lockup still ships as `AppNav`'s default, so navs are
unaffected; anywhere else, pass `form="square"` for the badge alone, or compose
`ElideMark` + `ElideWordmark` to reproduce the old output exactly. `markOnly` is
still accepted as a deprecated alias for `form="square"`.
