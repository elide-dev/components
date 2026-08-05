# @elide/brand

Elide's brand artwork: the logo geometry, and every rendition generated from it.

Framework-agnostic by design — this package sits below the React line in
[ARCHITECTURE.md](../../ARCHITECTURE.md), so the docs site, the marketing site,
a native shell, or a build script can all consume it. React consumers should
reach for [`<ElideLogo>`](../ui/src/components/elide-logo.tsx) in `@elide/ui`
instead, which is built on top of this.

## The artwork

Two forms and three variants:

- **`square`** — the hexagon badge. viewBox `0 0 102.700292 114.027098`.
- **`full`** — the glyph + wordmark lockup. viewBox `0 0 272.122583 90.385516`.

- **`gradient`** — the brand gradient, purple `#662d91` to magenta `#e7008c`.
- **`mono`** — a single color.
- **`blend`** — a gradient glyph beside a mono wordmark. Only distinct on the
  `full` form; on `square` it resolves to `gradient`, which is what blend means
  there.

`gradient` reads on any surface and ships as one file. `mono` and `blend` carry
a color that has to invert with the theme, so each ships a light and a dark cut.
That makes eight artworks:

| | gradient | mono | blend |
| --- | --- | --- | --- |
| `square` | `elide-square-gradient` | `elide-square-mono-{light,dark}` | → gradient |
| `full` | `elide-full-gradient` | `elide-full-mono-{light,dark}` | `elide-full-blend-{light,dark}` |

## Assets

```
assets/svg/elide-full-blend-dark.svg        resolution-independent
assets/png/elide-full-blend-dark.png        1x — no suffix
assets/png/elide-full-blend-dark@2x.png
assets/webp/…                               @1x, @2x, @3x
assets/avif/…
```

1x is the artwork's natural pixel size — `square` is 104×115, `full` is 273×92.

Encoder choices were measured against a lossless reference render, not assumed:

| Format | Setting | Why |
| --- | --- | --- |
| `png` | lossless | The universal fallback. Correctness over bytes. |
| `webp` | lossless | Lossless *and* smaller than PNG on this artwork (10.8K vs 12.7K on the gradient square @2x). Nothing to trade. |
| `avif` | quality 90 | Lossless AVIF on line art is counterproductive — over double the PNG. At q90 the error is mae 0.32 / worst 11 on the gradient square and 0.00 on mono, while cutting gradient artwork to 9.6K. |

### Serving them

Copy `assets/` into the app's public directory and point `assetBase` at it —
`<ElideLogo assetBase="/brand" />` is the default. In Storybook this is done
with `staticDirs`; see `apps/storybook/.storybook/main.ts`.

## Regenerating

Only needed when the artwork itself changes. `assets/` is committed, so normal
builds and CI never run this.

```bash
bun run --filter @elide/brand build:assets    # regenerate all 80 files
bun run --filter @elide/brand verify:assets   # diff against the source artwork
```

Both need `sharp`, which is a devDependency of this package only.

## How the geometry got here

`src/paths.ts` holds four path strings copied verbatim out of `creatives-v2`:
the hexagon body and knockout ribbon from `elide-block-black.svg`, and the glyph
and wordmark from `elide-mark-black.svg`. Everything else — every variant, every
format, every scale — is generated from those four strings, so the
representations cannot drift.

The delivered `elide-mark-gradient.svg` and `elide-mark-blend.svg` are *not*
usable as vector sources: they embed their glyph as a base64 PNG. Those variants
are rebuilt here by re-filling the paths above, which keeps them genuinely
vector while leaving the geometry byte-identical to the originals.

`verify-fidelity.mjs` is the proof. It compares against the delivered **SVGs**
rather than the delivered PNGs, because the PNG exports are canvas-rounded
(102.700292 wide is exported as 104px), so diffing those would measure the
exporter's padding instead of the geometry. Against the SVGs the gradient square
and the full mono are pixel-identical (mae 0.000); the mono square differs by
0.007, which is antialiasing where our `evenodd` hole meets the original's
opaque white overlay.

### One deliberate change

For `mono`, the ribbon is punched through to transparency — body and ribbon are
emitted as a single `fill-rule="evenodd"` path — where the delivered artwork
paints it opaque white. Over white the two are identical; over anything else,
transparency is correct and a white smear is not. `gradient` keeps the opaque
white ribbon, because that is the official rendering of the mark.
