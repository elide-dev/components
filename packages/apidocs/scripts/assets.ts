/**
 * Completes dist/: the stylesheet, the fonts and social image the Elide preset
 * names, the runner, and the JSON Schema, beside the two bundles Vite wrote.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { elide } from "../src/presets/elide";

const require = createRequire(import.meta.url);
const pkg = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
mkdirSync(pkg("dist/assets/fonts"), { recursive: true });
mkdirSync(pkg("dist/assets/social"), { recursive: true });
copyFileSync(pkg("artwork/social-elide.png"), pkg("dist/assets/social/elide.png"));
copyFileSync(pkg("artwork/social-neutral.png"), pkg("dist/assets/social/neutral.png"));
copyFileSync(pkg("src/styles/apidocs.css"), pkg("dist/assets/apidocs.css"));
copyFileSync(pkg("src/runner.mjs"), pkg("dist/runner.mjs"));
copyFileSync(pkg("schema/apidocs-1.schema.json"), pkg("dist/apidocs-1.schema.json"));
for (const font of elide.fonts ?? []) {
  const file = font.asset.slice("fonts/".length);
  const family = file.replace(/-latin-.*$/, "");
  copyFileSync(require.resolve(`@fontsource-variable/${family}/files/${file}`), pkg(`dist/assets/${font.asset}`));
}
