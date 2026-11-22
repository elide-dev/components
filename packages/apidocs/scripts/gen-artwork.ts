/**
 * Generates src/presets/elide-artwork.ts: the @elide/brand artwork the Elide
 * preset puts in a site's assets, as strings, so the renderer bundle needs no
 * file access.
 *
 *   bun scripts/gen-artwork.ts          # rewrite the file
 *   bun scripts/gen-artwork.ts --check  # exit 1 when it is stale
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const svg = (name: string) => readFileSync(require.resolve(`@elide/brand/assets/svg/${name}.svg`), "utf8").trim();

const text = [
  "// Generated from @elide/brand by scripts/gen-artwork.ts. Do not edit.",
  "",
  "/** The full lockup for light surfaces (dark wordmark). */",
  `export const logoLight = ${JSON.stringify(svg("elide-full-blend-light"))};`,
  "",
  "/** The full lockup for dark surfaces (light wordmark). */",
  `export const logoDark = ${JSON.stringify(svg("elide-full-blend-dark"))};`,
  "",
  "/** The square badge, used as the favicon. */",
  `export const mark = ${JSON.stringify(svg("elide-square-gradient"))};`,
  "",
].join("\n");

const target = fileURLToPath(new URL("../src/presets/elide-artwork.ts", import.meta.url));
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== text) {
    console.error("src/presets/elide-artwork.ts is stale: run bun scripts/gen-artwork.ts");
    process.exit(1);
  }
} else {
  writeFileSync(target, text);
}
