/**
 * The brand asset matrix: which artworks exist, what they're called on disk,
 * and how to build a URL for one.
 *
 * Kept free of any framework or filesystem dependency so the docs site, the
 * marketing site, a native shell, or a build script can all resolve the same
 * asset names. `scripts/build-assets.mjs` generates exactly the artworks that
 * `ARTWORKS` enumerates, so this module and the contents of `assets/` cannot
 * drift apart.
 */

/** `square` is the hexagon badge; `full` is the glyph + wordmark lockup. */
export type BrandForm = "square" | "full";

/**
 * `gradient` is the brand gradient, `mono` a single color, `blend` a gradient
 * glyph beside a mono wordmark. `blend` is only distinct on the `full` form.
 */
export type BrandVariant = "gradient" | "mono" | "blend";

export type BrandFormat = "svg" | "png" | "webp" | "avif";

export type BrandTheme = "light" | "dark";

/** Density ladder generated for every raster format. */
export const SCALES = [1, 2, 3] as const;
export type BrandScale = (typeof SCALES)[number];

/**
 * 1x pixel size per form, matching the natural size of the delivered artwork
 * (`elide-block-*.png` is 104x115, `elide-mark-*.png` is 273x92) so regenerated
 * output can be diffed against the originals.
 */
export const BASE_SIZE: Record<BrandForm, { width: number; height: number }> = {
  square: { width: 104, height: 115 },
  full: { width: 273, height: 92 },
};

/** Where `assets/` is expected to be served from, unless a caller says otherwise. */
export const DEFAULT_ASSET_BASE = "/brand";

/**
 * Collapse a variant to the one that actually has artwork for the given form.
 *
 * The square artwork has no separate blend cut: a gradient body with a knockout
 * ribbon already *is* the blend of gradient and mono there. Treated as an alias
 * rather than an error so `variant` can be set once and used with either form.
 */
export function resolveVariant(form: BrandForm, variant: BrandVariant): BrandVariant {
  return form === "square" && variant === "blend" ? "gradient" : variant;
}

/**
 * Whether this artwork has separate light and dark cuts.
 *
 * The gradient reads on any surface and ships as one file; mono and blend carry
 * a color that has to invert with the theme.
 */
export function isThemed(form: BrandForm, variant: BrandVariant): boolean {
  return resolveVariant(form, variant) !== "gradient";
}

/**
 * File stem for an artwork, e.g. `elide-full-blend-dark`. Theme-agnostic
 * artwork drops the trailing segment.
 */
export function artworkName(
  form: BrandForm,
  variant: BrandVariant,
  theme: BrandTheme = "light",
): string {
  const resolved = resolveVariant(form, variant);
  const suffix = isThemed(form, resolved) ? `-${theme}` : "";
  return `elide-${form}-${resolved}${suffix}`;
}

export interface BrandArtwork {
  name: string;
  form: BrandForm;
  variant: BrandVariant;
  /** Absent when the artwork is theme-agnostic. */
  theme?: BrandTheme;
}

/** Every artwork the build script emits, in generation order. */
export const ARTWORKS: readonly BrandArtwork[] = [
  { name: "elide-square-gradient", form: "square", variant: "gradient" },
  { name: "elide-square-mono-light", form: "square", variant: "mono", theme: "light" },
  { name: "elide-square-mono-dark", form: "square", variant: "mono", theme: "dark" },
  { name: "elide-full-gradient", form: "full", variant: "gradient" },
  { name: "elide-full-mono-light", form: "full", variant: "mono", theme: "light" },
  { name: "elide-full-mono-dark", form: "full", variant: "mono", theme: "dark" },
  { name: "elide-full-blend-light", form: "full", variant: "blend", theme: "light" },
  { name: "elide-full-blend-dark", form: "full", variant: "blend", theme: "dark" },
];

export interface AssetPathOptions {
  form: BrandForm;
  variant: BrandVariant;
  format: BrandFormat;
  /** Ignored for theme-agnostic artwork. Defaults to the light cut. */
  theme?: BrandTheme;
  /** Ignored for `svg`, which is resolution-independent. Defaults to 1x. */
  scale?: BrandScale;
  /** URL prefix that `assets/` is served under. */
  base?: string;
}

/**
 * Build the URL for one asset, e.g.
 * `/brand/webp/elide-full-blend-dark@2x.webp`.
 *
 * SVG never takes a density suffix, and neither does 1x — so the common case
 * stays a clean, cacheable name.
 */
export function assetPath({
  form,
  variant,
  format,
  theme = "light",
  scale = 1,
  base = DEFAULT_ASSET_BASE,
}: AssetPathOptions): string {
  const name = artworkName(form, variant, theme);
  const density = format !== "svg" && scale !== 1 ? `@${scale}x` : "";
  return `${base.replace(/\/+$/, "")}/${format}/${name}${density}.${format}`;
}
