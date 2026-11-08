import { defineConfig } from "tsup";
import { readdirSync } from "node:fs";

export default defineConfig({
  entry: ["src/index.ts", "src/elements/logo.tsx", "src/i18n/index.ts", "src/i18n/messages.ts", "src/i18n/locales.ts", "src/i18n/loader.ts",
    ...readdirSync("src/i18n/locales").filter(name => name.endsWith(".ts")).map(name => `src/i18n/locales/${name}`), ...readdirSync("src/components")
    .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
    .map((name) => `src/components/${name}`)],
  format: ["esm"],
  target: "es2022",
  splitting: true,
  treeshake: true,
  dts: true,
  clean: true,
});
