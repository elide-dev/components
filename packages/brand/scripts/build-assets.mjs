/**
 * Generates every shipped brand asset from the geometry in `src/paths.ts`.
 *
 * Output lands in `assets/` and is committed, so consuming repos and CI never
 * need a native image toolchain — only this script does, and only when the
 * artwork changes.
 *
 *   assets/svg/elide-full-blend-dark.svg        (resolution-independent)
 *   assets/png/elide-full-blend-dark@2x.png     (1x has no suffix)
 *   assets/webp/...
 *   assets/avif/...
 *
 * Run: bun scripts/build-assets.mjs
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ARTWORKS, SCALES } from "../src/manifest.ts";
import { renderSvg, sizeAt } from "./artworks.mjs";

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets");

/**
 * Encoder settings, chosen by measuring size against a lossless reference
 * render rather than by reputation. Each format has a distinct job:
 *
 * - png  — the universal fallback, so it stays lossless. Largest of the three.
 * - webp — lossless *and* smaller than PNG on this artwork (10.8K vs 12.7K on
 *          the gradient square @2x, 4.5K vs 8.5K on the full mono), so there is
 *          no reason to trade away exactness here.
 * - avif — lossless AVIF is badly counterproductive on line art (28K, over
 *          double the PNG), so this is the one lossy encoder. At q90 the error
 *          against the lossless render is mae 0.32 / worst 11 on the gradient
 *          square and 0.00 on mono — imperceptible — while cutting the gradient
 *          artwork to 9.6K.
 *
 * `effort` is maxed because these files are generated once and served many times.
 */
const ENCODERS = {
  png: (img) => img.png({ compressionLevel: 9 }),
  webp: (img) => img.webp({ lossless: true, effort: 6 }),
  avif: (img) => img.avif({ quality: 90, effort: 9 }),
};

async function main() {
  await rm(ASSETS, { recursive: true, force: true });
  for (const dir of ["svg", ...Object.keys(ENCODERS)]) {
    await mkdir(path.join(ASSETS, dir), { recursive: true });
  }

  let count = 0;

  for (const { name, form } of ARTWORKS) {
    // The .svg on disk carries a viewBox and no fixed dimensions, so it scales
    // to whatever box a consumer puts it in.
    await writeFile(path.join(ASSETS, "svg", `${name}.svg`), `${renderSvg(name)}\n`);
    count++;

    for (const scale of SCALES) {
      const size = sizeAt(form, scale);
      // Give the SVG explicit pixel dimensions so librsvg rasterizes natively
      // at the target resolution rather than rendering small and upscaling.
      const svg = Buffer.from(renderSvg(name, size));
      const suffix = scale === 1 ? "" : `@${scale}x`;

      for (const [format, encode] of Object.entries(ENCODERS)) {
        const file = path.join(ASSETS, format, `${name}${suffix}.${format}`);
        await encode(sharp(svg)).toFile(file);
        count++;
      }
    }
  }

  console.log(`Wrote ${count} files to ${path.relative(process.cwd(), ASSETS)}/`);
}

await main();
