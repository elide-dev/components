import { defineConfig } from "tsup";
import { readdirSync } from "node:fs";

export default defineConfig({
  entry: ["src/index.ts", ...readdirSync("src/components")
    .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
    .map((name) => `src/components/${name}`)],
  format: ["esm"],
  target: "es2022",
  splitting: true,
  treeshake: true,
  dts: true,
  clean: true,
});
