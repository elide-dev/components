/**
 * Composes each artwork's SVG markup from the shared geometry.
 *
 * Shared by build-assets.mjs (which writes the files) and verify-fidelity.mjs
 * (which diffs them against the delivered originals), so the thing that gets
 * verified is exactly the thing that gets shipped.
 *
 * These files carry literal colors on purpose. librsvg renders `currentColor`
 * as black and cannot resolve `var(--background)`, so a standalone file has to
 * commit to a color — which is why mono and blend each ship a light and a dark
 * cut. The inlined React vector in @elide/ui uses `currentColor` instead and
 * needs no such split.
 */
import {
  paths,
  GRADIENTS,
  BRAND_PURPLE,
  BRAND_MAGENTA,
  SQUARE_VIEWBOX,
  FULL_VIEWBOX,
} from "../src/paths.ts";
import { BASE_SIZE } from "../src/manifest.ts";

const VIEWBOX = { square: SQUARE_VIEWBOX, full: FULL_VIEWBOX };

function gradient(id, { x1, y1, x2, y2 }) {
  return (
    `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ` +
    `gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="${BRAND_PURPLE}"/>` +
    `<stop offset="1" stop-color="${BRAND_MAGENTA}"/>` +
    `</linearGradient>`
  );
}

/**
 * Body of each artwork: the `<defs>` it needs and the shapes that draw it.
 *
 * The mono cuts merge body and ribbon into one `fill-rule="evenodd"` path so
 * the ribbon punches clean through to whatever is behind it. The delivered
 * artwork paints that ribbon opaque white, which is identical on a white page
 * and wrong on every other surface. The gradient cut keeps the opaque white
 * ribbon, because that is the official rendering of the mark.
 */
const COMPOSE = {
  "elide-square-gradient": () => ({
    form: "square",
    defs: gradient("g", GRADIENTS.squareBody),
    shapes:
      `<path fill="url(#g)" d="${paths.squareBody}"/>` +
      `<path fill="#ffffff" d="${paths.squareRibbon}"/>`,
  }),
  "elide-square-mono-light": () => monoSquare("#000000"),
  "elide-square-mono-dark": () => monoSquare("#ffffff"),
  "elide-full-gradient": () => ({
    form: "full",
    defs: gradient("g", GRADIENTS.fullGlyph) + gradient("w", GRADIENTS.fullWordmark),
    shapes:
      `<path fill="url(#g)" d="${paths.fullGlyph}"/>` +
      `<path fill="url(#w)" d="${paths.fullWordmark}"/>`,
  }),
  "elide-full-mono-light": () => monoFull("#000000"),
  "elide-full-mono-dark": () => monoFull("#ffffff"),
  "elide-full-blend-light": () => blendFull("#000000"),
  "elide-full-blend-dark": () => blendFull("#ffffff"),
};

function monoSquare(color) {
  return {
    form: "square",
    defs: "",
    shapes:
      `<path fill="${color}" fill-rule="evenodd" ` +
      `d="${paths.squareBody} ${paths.squareRibbon}"/>`,
  };
}

function monoFull(color) {
  return {
    form: "full",
    defs: "",
    shapes:
      `<path fill="${color}" d="${paths.fullGlyph}"/>` +
      `<path fill="${color}" d="${paths.fullWordmark}"/>`,
  };
}

function blendFull(wordmarkColor) {
  return {
    form: "full",
    defs: gradient("g", GRADIENTS.fullGlyph),
    shapes:
      `<path fill="url(#g)" d="${paths.fullGlyph}"/>` +
      `<path fill="${wordmarkColor}" d="${paths.fullWordmark}"/>`,
  };
}

/**
 * Render an artwork to SVG markup.
 *
 * With `size`, the root gets explicit width/height so librsvg rasterizes
 * natively at that resolution instead of rendering small and upscaling. The
 * files written to `assets/svg/` omit it and stay resolution-independent.
 */
export function renderSvg(name, size) {
  const compose = COMPOSE[name];
  if (!compose) throw new Error(`unknown artwork: ${name}`);
  const { form, defs, shapes } = compose();
  const dims = size ? ` width="${size.width}" height="${size.height}"` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX[form]}"${dims}>` +
    (defs ? `<defs>${defs}</defs>` : "") +
    shapes +
    `</svg>`
  );
}

/** Pixel size of an artwork at a given density. */
export function sizeAt(form, scale) {
  const { width, height } = BASE_SIZE[form];
  return { width: width * scale, height: height * scale };
}
