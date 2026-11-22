/**
 * Generates the presets' link-preview images, at 1200 by 630 as Open Graph expects:
 * - artwork/social-elide.png: the dark lockup from @elide/brand, centered on the Elide preset's dark surface;
 * - artwork/social-neutral.png: the neutral preset's favicon mark, unbranded, on its light page color.
 * Committed, so builds need no image tooling; run it again when the artwork changes.
 *
 *   bun scripts/gen-social.ts
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { neutral } from "@elide/tokens";
import { neutral as neutralTheme } from "../src/theme";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const lockup = readFileSync(require.resolve("@elide/brand/assets/svg/elide-full-blend-dark.svg"), "utf8");
const [, , w, h] = /viewBox="([\d.\s]+)"/.exec(lockup)![1]!.trim().split(/\s+/).map(Number) as [number, number, number, number];
const WIDTH = 1200;
const HEIGHT = 630;
const LOGO = 520;
const logoHeight = Math.round((LOGO * h) / w);
const logo = await sharp(Buffer.from(lockup), { density: 600 }).resize(LOGO, logoHeight).png().toBuffer();
const out = fileURLToPath(new URL("../artwork/social-elide.png", import.meta.url));
await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: neutral[950] } })
  .composite([{ input: logo, left: Math.round((WIDTH - LOGO) / 2), top: Math.round((HEIGHT - logoHeight) / 2) }])
  .png({ compressionLevel: 9 })
  .toFile(out);
console.log(`wrote ${out}`);

const markSize = 168;
const mark = await sharp(Buffer.from(neutralTheme.favicon!), { density: 1200 }).resize(markSize, markSize).png().toBuffer();
const plain = fileURLToPath(new URL("../artwork/social-neutral.png", import.meta.url));
await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: "#fbfcfd" } })
  .composite([{ input: mark, left: (WIDTH - markSize) / 2, top: (HEIGHT - markSize) / 2 }])
  .png({ compressionLevel: 9 })
  .toFile(plain);
console.log(`wrote ${plain}`);
