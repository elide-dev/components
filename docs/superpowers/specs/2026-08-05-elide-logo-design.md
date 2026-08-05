# Design: `ElideLogo` — the brand mark as a catalog component

**Date:** 2026-08-05
**Status:** Approved
**Branch / delivery:** `feat/elide-logo` → PR into `main`.

## Goal

Ship Elide's logo as a first-class component in the catalog, built from the
official artwork in `~/txfer/creatives-v2`. It must cover three axes the brand
actually needs:

- **light / dark** — the mark adapts to the active theme,
- **square / full form** — the hexagon badge alone, or the full lockup,
- **vector / raster mode** — inlined SVG by default, with `png` / `webp` / `avif`
  available for contexts that can't take inline SVG (email, OG images, native
  shells, `<img>`-only CMS fields).

SVG is the preferred and default mode. The raster formats are a supported
fallback, not the primary path.

## Source artwork

`~/txfer/creatives-v2` ships five artworks, each as `svg` / `png` / `webp` /
`jpg` / `pdf` at `@1x`–`@4x`:

| File stem | Maps to | Notes |
| --- | --- | --- |
| `elide-block-black` | `form="square"` `variant="mono"` | Pure vector: 2 paths (hexagon body + knockout ribbon) |
| `elide-block-gradient` | `form="square"` `variant="gradient"` | Pure vector, same 2 paths, gradient body |
| `elide-mark-black` | `form="full"` `variant="mono"` | Pure vector: 2 paths (glyph ribbon + wordmark) |
| `elide-mark-gradient` | `form="full"` `variant="gradient"` | **Glyph is an embedded base64 PNG**, wordmark is vector |
| `elide-mark-blend` | `form="full"` `variant="blend"` | **Glyph is an embedded base64 PNG**, wordmark is vector |

Geometry: square is `102.700292 × 114.027098` (≈0.9007:1), full is
`272.122583 × 90.385516` (≈3.0107:1).

The two gradient/blend lockups are not genuinely vector — the glyph is a raster
image. Because `elide-mark-black.svg` and `elide-block-black.svg` *are* clean
two-path vectors, every variant is **rebuilt** from those four `d` strings by
re-filling them. Nothing is traced, redrawn, or approximated; the geometry is
byte-for-byte the delivered paths.

No AVIF exists in the source set, so the AVIF renditions are generated.

## Vocabulary

The prop vocabulary follows the request (`square` / `full`), not the source
filenames (`block` / `mark`). The mapping is recorded in `paths.ts` so the
provenance stays traceable.

- `form`: `"square"` — the hexagon badge. `"full"` — glyph + wordmark lockup.
- `variant`: `"gradient"` — brand gradient. `"mono"` — one color, `currentColor`.
  `"blend"` — gradient glyph + mono wordmark.
- `blend` only differs from `gradient` on the `full` form. On `square` it
  resolves to `gradient`, which is what "blend" means there (gradient body,
  knockout ribbon). This is an alias, not an error.

`form="square"` names the *role* (compact badge), not a 1:1 aspect — the
hexagon is 0.9:1 and is rendered tight-cropped, faithful to the artwork. A
padded 1:1 favicon/app-icon set is deliberately out of scope; it can be added
later without changing this API.

## Package layout

Artwork lives in a new **`@elide/brand`** package, below the framework line
described in `ARCHITECTURE.md` — it is framework-agnostic (raw geometry, raw
SVG, raw raster), so Astro, native, and Figma consumers can reach it without
pulling in React.

```
packages/brand/
├─ package.json                 # @elide/brand
├─ tsconfig.json
├─ vitest.config.ts
├─ src/
│  ├─ paths.ts                  # hand-authored geometry — SINGLE SOURCE OF TRUTH
│  ├─ manifest.ts               # typed matrix + assetPath()
│  ├─ manifest.test.ts
│  └─ index.ts
├─ scripts/
│  └─ build-assets.mjs          # paths.ts → SVG files → png/webp/avif
└─ assets/                      # generated, committed
   ├─ svg/
   ├─ png/
   ├─ webp/
   └─ avif/
```

`paths.ts` holds the `d` strings, viewBoxes, and gradient stops. Both the
inlined React vector and the standalone asset files derive from it, so the two
representations cannot drift.

### Artwork matrix

Eight distinct artworks. `gradient` is theme-agnostic and therefore a single
file; `mono` and `blend` have a light and a dark cut.

| Artwork | Body | Ribbon / wordmark |
| --- | --- | --- |
| `elide-square-gradient` | brand gradient hexagon | `#ffffff` ribbon |
| `elide-square-mono-light` | `#000000` hexagon | transparent knockout |
| `elide-square-mono-dark` | `#ffffff` hexagon | transparent knockout |
| `elide-full-gradient` | gradient glyph | gradient wordmark |
| `elide-full-mono-light` | `#000000` glyph | `#000000` wordmark |
| `elide-full-mono-dark` | `#ffffff` glyph | `#ffffff` wordmark |
| `elide-full-blend-light` | gradient glyph | `#000000` wordmark |
| `elide-full-blend-dark` | gradient glyph | `#ffffff` wordmark |

Raster renditions: `png` / `webp` / `avif` at `@1x` / `@2x` / `@3x`. 1x equals
the artwork's natural pixel size — square `104×115`, full `273×92` — matching
the delivered PNGs exactly so regenerated output is directly comparable to the
source. That is 8 SVG + 72 raster files, all committed, so CI never needs a
native image toolchain.

Naming: `assets/<format>/elide-<form>-<variant>[-<theme>][@<n>x].<ext>`, e.g.
`assets/webp/elide-full-blend-dark@2x.webp`.

### The mono knockout

The delivered `elide-block-black.svg` paints the inner ribbon opaque `#ffffff`.
For `variant="mono"` this is replaced by **true transparency** — the hexagon
body and the ribbon are emitted as one path with `fill-rule="evenodd"`, so the
ribbon punches through and the enclosed sub-regions return to the body color.
On a white surface the result is pixel-identical to the source; on any other
surface it is correct rather than a white smear. `variant="gradient"` keeps the
opaque white ribbon exactly as delivered, because that is the official
rendering.

The `full` glyph path is already an outline authored for `fill-rule="nonzero"`
and is used unmodified.

## Component

`packages/ui/src/components/elide-logo.tsx`.

```tsx
export type ElideLogoForm = "square" | "full";
export type ElideLogoVariant = "gradient" | "mono" | "blend";
export type ElideLogoFormat = "svg" | "png" | "webp" | "avif";

export interface ElideLogoProps {
  form?: ElideLogoForm;        // default "full"
  variant?: ElideLogoVariant;  // default "gradient"
  format?: ElideLogoFormat;    // default "svg" — inlined, zero requests
  linked?: boolean;            // format="svg" as <img src>, not inlined
  height?: number;             // px; width derived from the artwork aspect
  title?: string;              // accessible name, default "Elide"
  decorative?: boolean;        // aria-hidden + alt=""
  assetBase?: string;          // raster/linked URL prefix, default "/brand"
  className?: string;
  /** @deprecated use form="square" */
  markOnly?: boolean;
}
```

**Vector vs raster.** `format="svg"` inlines the SVG element — no network
request, `currentColor`-aware, SSR-safe. The raster formats render `<img>`.
`linked` is the escape hatch for callers who want the `.svg` as an external,
cacheable file rather than path data in their HTML.

**Sizing.** With `height`, the element gets an explicit height and a width
derived from the artwork's aspect ratio. Without it the element falls back to
`h-6 w-auto`, overridable through `className`. Either way `<img>` elements
always carry intrinsic `width`/`height` attributes so the aspect ratio is known
before load and nothing shifts.

**Gradient ids** are per-instance via `React.useId()`, so multiple logos on a
page never collide — the existing `ElideMark` already does this and its test is
kept.

## Light / dark

**Vector mode needs no assets and no JavaScript.** `mono` fills with
`currentColor` (the wrapper defaults to `text-foreground`), so it inverts with
the theme automatically. `blend` pairs a gradient glyph with a `currentColor`
wordmark. `gradient` is theme-agnostic.

**Raster mode uses a CSS class swap.** For `mono` and `blend`, both the light
and dark `<img>` are rendered and toggled with `dark:hidden` /
`hidden dark:block`. `gradient` renders a single `<img>`.

This was chosen over the alternatives deliberately:

- It needs no JavaScript, is SSR-safe, and cannot flash.
- It works without a `ThemeProvider` ancestor (`useTheme` throws without one).
- It honors a *manual* theme override. Theming in this repo is a `.dark` class
  on `<html>`, so a `<picture>` + `prefers-color-scheme` approach would show
  the wrong logo to anyone whose site theme disagrees with their OS.

The accepted cost: a browser may prefetch both images for the two
theme-dependent variants. This affects `mono` and `blend` only, the files are
single-digit kilobytes, and vector — which has no such cost — is the default.

## Back-compat and `AppNav`

`ElideLogo`'s current contract is `{ markOnly?: boolean }` rendering a hexagon +
wordmark lockup. The new component supersedes it:

- `ElideMark` keeps its exact current output, re-expressed on the new square
  paths (identical geometry, so the render is unchanged).
- `ElideWordmark` is unchanged. Note it is a *different* wordmark cut
  (`179.42 × 42.36`) than the one inside the `full` lockup; it is retained
  because `AppNav` depends on it.
- `markOnly` is retained as a deprecated alias for `form="square"`.
- `AppNav`'s brand lockup moves into `app-nav.tsx` as an explicit
  `ElideMark` + `ElideWordmark` composition. **The nav renders exactly as it
  does today.**

`<ElideLogo />` with no props now means the official full lockup rather than
the old nav lockup. That is a breaking change to the default in a `0.1.0`
package; it ships with a changeset. Switching the nav to the official artwork
is a one-line opt-in for consumers:

```tsx
<AppNav logo={<ElideLogo variant="blend" height={24} />} … />
```

## Testing

**Reconstruction fidelity.** The build script rasterizes the rebuilt SVGs and
diffs them against the delivered `creatives-v2` PNGs. This is the proof that
re-filling the extracted paths reproduces the official artwork rather than
approximating it, and it is the gate on the whole vector approach.

**Unit (`packages/ui`, jsdom, vitest):** the `form × variant × format` matrix;
`blend` aliasing to `gradient` on `square`; unique gradient ids across
instances; accessible naming and `decorative`; the light/dark `<img>` pair for
theme-dependent variants and the single `<img>` for `gradient`; `assetBase`
override; intrinsic `width`/`height` on every `<img>`; `height` deriving width
from the aspect ratio; the deprecated `markOnly` alias; `ElideMark` /
`ElideWordmark` back-compat; `AppNav`'s unchanged brand lockup.

**Unit (`packages/brand`):** `assetPath()` resolution across the matrix,
including the theme-agnostic `gradient` case and scale suffixing.

**Storybook:** a story per form × variant, plus format and sizing stories.
Chromatic captures every story in both themes, which is the visual regression
gate on light/dark.

Coverage stays at the catalog's current bar (97% statements).

## Risk

Rasterization needs an SVG renderer. `rsvg-convert` and Inkscape are not
installed on this machine. The plan is `sharp` as a `packages/brand`
devDependency (libvips/librsvg, and it writes png/webp/avif in one pipeline).
If `sharp` cannot render these paths faithfully, the fallback is ImageMagick —
installed here, with AVIF and WebP write support — recoloring the delivered
PNGs, with the `full-blend-dark` cut composited from the gradient glyph and a
recolored wordmark. The fidelity diff decides which path is taken.

Note that the standalone SVG files must carry literal colors: `currentColor`
renders as black in librsvg and `var(--background)` is not resolvable outside a
document. This is why `mono` and `blend` are emitted as separate light/dark
files while the inlined React vector uses `currentColor`.

## Out of scope

- A padded 1:1 favicon / app-icon set.
- Replacing `AppNav`'s lockup with the official `full` artwork.
- The `jpg` and `pdf` renditions in the source set.
- Retiring the legacy `ElideWordmark` cut.
