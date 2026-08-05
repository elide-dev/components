/**
 * Fidelity gate for the rebuilt artwork.
 *
 * The gradient and blend lockups shipped in creatives-v2 embed their glyph as a
 * base64 PNG, so this package rebuilds every variant by re-filling the paths
 * extracted from the two all-vector files. This script is the proof that the
 * rebuild reproduces the official artwork rather than approximating it.
 *
 * It compares against the delivered **SVGs**, not the delivered PNGs. Both
 * sides then share a viewBox and a renderer, so the diff measures only what
 * this package changed — the evenodd merge and the re-filled gradients. The
 * PNG exports are canvas-rounded (102.700292 wide exported as 104px, 90.385516
 * tall as 92px), so diffing against those would measure the exporter's padding
 * instead of our geometry. They are still checked, as informational output.
 *
 * Both sides are flattened onto white before comparing: our mono cut punches
 * the ribbon through to transparency where the original paints it opaque white,
 * which is identical over white and isolates the geometry.
 *
 * Run: bun scripts/verify-fidelity.mjs [--creatives <dir>]
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { renderSvg } from "./artworks.mjs";

const argIndex = process.argv.indexOf("--creatives");
const CREATIVES =
  argIndex !== -1 ? process.argv[argIndex + 1] : path.join(homedir(), "txfer", "creatives-v2");

/**
 * `gate: true` comparisons share a viewBox with their reference, so they must
 * match within antialiasing noise.
 *
 * The rest are informational. The gradient/blend SVGs draw their glyph from an
 * embedded PNG and use a slightly different viewBox, and the PNG references
 * carry export padding — a small delta there is resampling, not a fault in our
 * geometry. A *large* delta would still mean a gradient runs the wrong way, so
 * the numbers are printed rather than dropped.
 */
const COMPARISONS = [
  { name: "elide-square-mono-light", reference: "elide-block-black.svg", gate: true },
  { name: "elide-square-gradient", reference: "elide-block-gradient.svg", gate: true },
  { name: "elide-full-mono-light", reference: "elide-mark-black.svg", gate: true },
  { name: "elide-full-gradient", reference: "elide-mark-gradient.svg", gate: false },
  { name: "elide-full-blend-light", reference: "elide-mark-blend.svg", gate: false },
  { name: "elide-square-mono-light", reference: "elide-block-black.png", gate: false },
  { name: "elide-full-mono-light", reference: "elide-mark-black.png", gate: false },
];

/** Height every comparison is normalized to before diffing. */
const COMPARE_HEIGHT = 512;

/** Mean absolute per-channel difference, 0-255, over an opaque RGB composite. */
async function compare(name, referenceFile) {
  const refPath = path.join(CREATIVES, referenceFile);
  const meta = await sharp(refPath).metadata();
  const width = Math.round((meta.width / meta.height) * COMPARE_HEIGHT);
  const size = { width, height: COMPARE_HEIGHT };

  // Both sides go through an identical pipeline, and ours is emitted with only
  // a viewBox — exactly like the reference — so neither gets a sharpness or
  // resampling advantage that would show up as a difference in geometry.
  const onWhite = (input) =>
    sharp(input, { density: 600 })
      .resize(size.width, size.height, { fit: "fill" })
      .flatten({ background: "#ffffff" })
      .raw()
      .toBuffer();

  const [ours, theirs] = await Promise.all([
    onWhite(Buffer.from(renderSvg(name))),
    onWhite(refPath),
  ]);

  let total = 0;
  let worst = 0;
  for (let i = 0; i < ours.length; i++) {
    const diff = Math.abs(ours[i] - theirs[i]);
    total += diff;
    if (diff > worst) worst = diff;
  }
  return { mae: total / ours.length, worst, size };
}

/**
 * The gated comparisons currently score 0.000 (gradient square, full mono —
 * pixel-identical) and 0.007 (mono square, where our evenodd hole antialiases
 * marginally differently from the original's opaque white overlay). The limit
 * is set just above that noise floor: anything larger is a real divergence,
 * not a rounding artifact.
 */
const MAE_LIMIT = 0.5;

if (!existsSync(CREATIVES)) {
  console.error(`Source artwork not found at ${CREATIVES}`);
  console.error("Pass --creatives <dir> to point at the creatives-v2 directory.");
  process.exit(2);
}

let failed = false;
for (const { name, reference, gate } of COMPARISONS) {
  const { mae, worst, size } = await compare(name, reference);
  const ok = !gate || mae <= MAE_LIMIT;
  if (!ok) failed = true;
  console.log(
    `${gate ? (ok ? "PASS" : "FAIL") : "info"} ${name} vs ${reference} ` +
      `(${size.width}x${size.height}) mae=${mae.toFixed(3)} worst=${worst}`,
  );
}

if (failed) {
  console.error(`\nA gated comparison exceeded mae ${MAE_LIMIT}.`);
  console.error("The rebuilt geometry does not match the delivered artwork — fix before shipping.");
  process.exit(1);
}
console.log("\nRebuilt artwork matches the delivered originals.");
