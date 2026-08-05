import * as React from "react";
import {
  paths,
  GRADIENTS,
  BRAND_PURPLE,
  BRAND_MAGENTA,
  SQUARE_VIEWBOX,
  FULL_VIEWBOX,
  SQUARE_ASPECT,
  FULL_ASPECT,
  assetPath,
  isThemed,
  resolveVariant,
  BASE_SIZE,
  SCALES,
  DEFAULT_ASSET_BASE,
  type BrandForm,
  type BrandVariant,
  type BrandFormat,
  type BrandTheme,
} from "@elide/brand";
import { cn } from "../lib/utils";

/**
 * ElideLogo — the brand mark, across the three axes the brand actually needs:
 * light/dark, square/full form, and vector/raster.
 *
 * Vector is the default and inlines the SVG, so there is no network request and
 * no asset to serve. `mono` and `blend` draw in `currentColor`, which means
 * light/dark costs nothing: the mark inverts with the surrounding text color.
 *
 * The raster formats exist for contexts that can't take inline SVG — email, OG
 * images, native shells, `<img>`-only CMS fields. They read files from
 * `@elide/brand/assets`, which the consuming app serves under `assetBase`.
 */

export type ElideLogoForm = BrandForm;
export type ElideLogoVariant = BrandVariant;
export type ElideLogoFormat = BrandFormat;

const VIEWBOX: Record<ElideLogoForm, string> = {
  square: SQUARE_VIEWBOX,
  full: FULL_VIEWBOX,
};

const ASPECT: Record<ElideLogoForm, number> = {
  square: SQUARE_ASPECT,
  full: FULL_ASPECT,
};

export interface ElideLogoProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** `square` is the hexagon badge; `full` is the glyph + wordmark lockup. */
  form?: ElideLogoForm;
  /**
   * `gradient` is the brand gradient, `mono` a single color that follows the
   * text color, `blend` a gradient glyph beside a mono wordmark. `blend` only
   * differs from `gradient` on the `full` form.
   */
  variant?: ElideLogoVariant;
  /** `svg` inlines the vector. The raster formats render an `<img>`. */
  format?: ElideLogoFormat;
  /** Link the `.svg` as an external file rather than inlining its path data. */
  linked?: boolean;
  /** Height in px. Width follows from the artwork's aspect ratio. */
  height?: number;
  /** Accessible name. */
  title?: string;
  /** Hide from assistive tech — for when an adjacent label already names it. */
  decorative?: boolean;
  /** URL prefix that `@elide/brand/assets` is served under. */
  assetBase?: string;
  /** @deprecated Use `form="square"`. */
  markOnly?: boolean;
}

interface Shape {
  key: string;
  d: string;
  fill: string;
  fillRule?: "evenodd";
}

interface Gradient {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Shapes for one artwork, in the artwork's own user space.
 *
 * The square mono cut merges body and ribbon into a single `evenodd` path so
 * the ribbon punches clean through to whatever is behind it. The delivered
 * artwork paints that ribbon opaque white — identical on a white page, wrong on
 * every other surface. The gradient cut keeps the opaque white ribbon, because
 * that is the official rendering of the mark.
 */
function shapesFor(
  form: ElideLogoForm,
  variant: ElideLogoVariant,
  gid: string,
): { gradients: Gradient[]; shapes: Shape[] } {
  const url = (suffix: string) => `url(#${gid}-${suffix})`;

  if (form === "square") {
    if (variant === "mono") {
      return {
        gradients: [],
        shapes: [
          {
            key: "body",
            d: `${paths.squareBody} ${paths.squareRibbon}`,
            fill: "currentColor",
            fillRule: "evenodd" as const,
          },
        ],
      };
    }
    return {
      gradients: [{ id: `${gid}-body`, ...GRADIENTS.squareBody }],
      shapes: [
        { key: "body", d: paths.squareBody, fill: url("body") },
        { key: "ribbon", d: paths.squareRibbon, fill: "#ffffff" },
      ],
    };
  }

  const glyphGradient = variant !== "mono";
  const wordmarkGradient = variant === "gradient";

  return {
    gradients: [
      ...(glyphGradient ? [{ id: `${gid}-glyph`, ...GRADIENTS.fullGlyph }] : []),
      ...(wordmarkGradient ? [{ id: `${gid}-word`, ...GRADIENTS.fullWordmark }] : []),
    ],
    shapes: [
      { key: "glyph", d: paths.fullGlyph, fill: glyphGradient ? url("glyph") : "currentColor" },
      {
        key: "wordmark",
        d: paths.fullWordmark,
        fill: wordmarkGradient ? url("word") : "currentColor",
      },
    ],
  };
}

/** Height/width pair for a given rendered height, rounded to hundredths of a px. */
function box(form: ElideLogoForm, height: number) {
  return { height, width: Math.round(height * ASPECT[form] * 100) / 100 };
}

export function ElideLogo({
  form,
  variant = "gradient",
  format = "svg",
  linked = false,
  height,
  title = "Elide",
  decorative = false,
  assetBase = DEFAULT_ASSET_BASE,
  markOnly,
  className,
  style,
  ...props
}: ElideLogoProps) {
  // Unique per instance so several logos on a page never share a gradient id.
  const gid = React.useId().replace(/:/g, "");

  const resolvedForm: ElideLogoForm = form ?? (markOnly ? "square" : "full");
  const resolvedVariant = resolveVariant(resolvedForm, variant);
  const { gradients, shapes } = shapesFor(resolvedForm, resolvedVariant, gid);

  const sized = height !== undefined ? box(resolvedForm, height) : undefined;
  const a11y = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": title } as const);

  if (format !== "svg" || linked) {
    return (
      <RasterLogo
        form={resolvedForm}
        variant={resolvedVariant}
        format={format}
        assetBase={assetBase}
        sized={sized}
        title={title}
        decorative={decorative}
        className={className}
        style={style}
        {...props}
      />
    );
  }

  return (
    <svg
      viewBox={VIEWBOX[resolvedForm]}
      // text-foreground is what makes `mono` and `blend` invert with the theme;
      // callers can retarget it with any text-* utility.
      className={cn(sized ? undefined : "h-6 w-auto", "text-foreground", className)}
      style={sized ? { ...sized, ...style } : style}
      {...a11y}
      {...(props as React.SVGProps<SVGSVGElement>)}
    >
      {gradients.length > 0 && (
        <defs>
          {gradients.map(({ id, x1, y1, x2, y2 }) => (
            <linearGradient
              key={id}
              id={id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor={BRAND_PURPLE} />
              <stop offset="1" stopColor={BRAND_MAGENTA} />
            </linearGradient>
          ))}
        </defs>
      )}
      {shapes.map(({ key, d, fill, fillRule }) => (
        <path key={key} d={d} fill={fill} fillRule={fillRule} />
      ))}
    </svg>
  );
}

interface RasterLogoProps extends React.HTMLAttributes<HTMLElement> {
  form: ElideLogoForm;
  variant: ElideLogoVariant;
  format: ElideLogoFormat;
  assetBase: string;
  sized?: { width: number; height: number };
  title: string;
  decorative: boolean;
}

/**
 * Raster (and linked-SVG) rendering.
 *
 * Theme-dependent artwork renders both cuts and toggles them with `dark:`
 * utilities rather than reading the theme in JavaScript. That needs no
 * provider, cannot flash, survives SSR, and — unlike a `<picture>` keyed on
 * `prefers-color-scheme` — respects a site theme that disagrees with the OS,
 * which matters because theming here is a `.dark` class on `<html>`.
 *
 * The cost is that a browser may fetch both files. It applies only to `mono`
 * and `blend`, the files are single-digit kilobytes, and vector — which has no
 * such cost — is the default.
 */
function RasterLogo({
  form,
  variant,
  format,
  assetBase,
  sized,
  title,
  decorative,
  className,
  style,
  ...props
}: RasterLogoProps) {
  const themed = isThemed(form, variant);
  const intrinsic = sized ?? BASE_SIZE[form];

  const image = (theme: BrandTheme, themeClass?: string) => (
    <img
      key={theme}
      src={assetPath({ form, variant, format, theme, base: assetBase })}
      // SVG is resolution-independent, so a density ladder would be noise.
      srcSet={
        format === "svg"
          ? undefined
          : SCALES.filter((s) => s !== 1)
              .map((s) => `${assetPath({ form, variant, format, theme, scale: s, base: assetBase })} ${s}x`)
              .join(", ")
      }
      // Always present so the box is known before the image loads.
      width={Math.round(intrinsic.width)}
      height={Math.round(intrinsic.height)}
      // Only the light cut carries the name — the pair is one logo, and the
      // hidden one would otherwise announce a duplicate.
      alt={decorative || theme === "dark" ? "" : title}
      aria-hidden={decorative || theme === "dark" ? true : undefined}
      className={cn(sized ? undefined : "h-6 w-auto", themeClass, className)}
      style={sized ? { ...sized, ...style } : style}
      {...(props as React.ImgHTMLAttributes<HTMLImageElement>)}
    />
  );

  if (!themed) return image("light");
  return (
    <>
      {image("light", "dark:hidden")}
      {image("dark", "hidden dark:block")}
    </>
  );
}

/**
 * ElideMark — the gradient hexagon badge at the nav's size.
 *
 * Retained at its original signature and output for `AppNav` and for anything
 * already importing it; new code should prefer `<ElideLogo form="square" />`.
 */
export function ElideMark({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  const gid = React.useId();
  return (
    <svg
      viewBox={SQUARE_VIEWBOX}
      role="img"
      aria-label="Elide"
      className={cn("h-[23px] w-auto", className)}
      {...props}
    >
      <defs>
        <linearGradient id={gid} {...GRADIENTS.squareBody} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={BRAND_PURPLE} />
          <stop offset="1" stopColor={BRAND_MAGENTA} />
        </linearGradient>
      </defs>
      <path fill={`url(#${gid})`} d={paths.squareBody} />
      <path fill="#ffffff" d={paths.squareRibbon} />
    </svg>
  );
}

/**
 * ElideWordmark — the standalone "elide" wordmark, drawn in `currentColor`.
 *
 * This is a different cut from the wordmark inside the `full` lockup (a wider
 * setting, on its own 179.42x42.36 canvas). It is kept because `AppNav`'s
 * lockup is built from it; `<ElideLogo form="full" />` is the official lockup.
 */
export function ElideWordmark({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 179.42 42.36"
      role="img"
      aria-label="Elide"
      className={cn("h-[14px] w-auto", className)}
      {...props}
    >
      <path
        fill="currentColor"
        d="m172.76 22.75c0 1.05-.72 1.6-1.6 1.6h-17.68c-.91 0-1.65-.74-1.65-1.65v-1.54c0-.94.72-1.82 1.6-1.82h17.74c.88 0 1.6.77 1.6 1.82v1.6zm6.66-4.57c0-3.03-2.48-5.34-5.34-5.34h-23.41c-2.86 0-5.34 1.98-5.34 5.34v18.9c.06 3.2 2.37 5.29 5.34 5.29h25.78c1.05 0 2.97-1.05 2.97-2.92v-.77c0-1.32-1.49-2.81-2.97-2.81h-23.03c-.88 0-1.6-.72-1.6-1.6v-2.64c0-.91.74-1.65 1.65-1.65h20.6c3.2 0 5.4-2.26 5.34-5.18v-6.61zm-151.99 4.57c0 1.05-.72 1.6-1.6 1.6h-17.68c-.91 0-1.65-.74-1.65-1.65v-1.54c0-.94.72-1.82 1.6-1.82h17.74c.88 0 1.6.77 1.6 1.82v1.6zm6.67-4.57c0-3.03-2.48-5.34-5.34-5.34h-23.42c-2.86 0-5.34 1.98-5.34 5.34v18.9c.06 3.2 2.37 5.29 5.34 5.29h25.78c1.05 0 2.97-1.05 2.97-2.92v-.77c0-1.32-1.49-2.81-2.97-2.81h-23.02c-.88 0-1.6-.72-1.6-1.6v-2.64c0-.91.74-1.65 1.65-1.65h20.6c3.2 0 5.4-2.26 5.34-5.18v-6.61zm98.5 17.68h-17.63c-.97 0-1.76-.79-1.76-1.76v-12.95c0-.94.72-1.82 1.6-1.82h17.79c.91 0 1.65.74 1.65 1.65v13.22c0 .91-.74 1.65-1.65 1.65zm5.34-35.86h-.88c-2.04 0-2.81 1.49-2.81 2.81v8.37c0 .91-.74 1.65-1.65 1.65h-20.6c-3.08 0-5.29 2.31-5.29 5.34v18.9c.06 3.25 2.31 5.29 5.29 5.29h23.47c2.81 0 5.29-2.53 5.29-5.29v-34.26c0-1.32-.88-2.81-2.81-2.81zm-80.21 35.86c-.91 0-1.65-.74-1.65-1.65v-31.4c0-1.32-.61-2.81-2.81-2.81h-13.44c-1.6 0-2.75 1.49-2.75 2.81v.88c0 1.32 1.16 2.81 2.75 2.81h8.1c.91 0 1.65.74 1.65 1.65v26.06c0 .91-.74 1.65-1.65 1.65h-8.1c-1.6 0-2.75 1.49-2.75 2.81v.88c0 1.49.99 2.81 2.75 2.81h26c1.6 0 2.75-1.16 2.75-2.81v-.88c0-1.32-.99-2.81-2.75-2.81zm30.36-28.75c1.65 0 3.08-1.38 3.08-3.14v-.88c0-1.76-1.43-3.08-3.08-3.08h-.88c-1.65 0-3.08 1.32-3.08 3.08v.88c0 1.76 1.43 3.14 3.08 3.14zm2.81 8.54c0-1.16-.61-2.81-2.81-2.81h-13.44c-1.6 0-2.81.94-2.81 2.81v.88c0 1.76 1.21 2.81 2.81 2.81h8.1c.91 0 1.65.74 1.65 1.65v13.22c0 .91-.74 1.65-1.65 1.65h-8.1c-1.16 0-2.81 1.21-2.81 2.81v.88c0 1.65 1.65 2.81 2.81 2.81h26c1.6 0 2.81-1.32 2.81-2.81v-.88c0-1.32-1.21-2.81-2.81-2.81h-8.1c-.91 0-1.65-.74-1.65-1.65z"
      />
    </svg>
  );
}
