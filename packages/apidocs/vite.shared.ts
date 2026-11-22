import type { UserConfig } from "vite";

/** Settings both bundles share: Preact JSX, ES2020 output (GraalJS, Bun, Node and browsers), no CDN, no splitting. */
export function bundle(entry: string, name: string, fileName: string, outDir: string): UserConfig {
  return {
    oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
    resolve: { dedupe: ["preact"] },
    build: {
      target: "es2020",
      outDir,
      emptyOutDir: false,
      minify: true,
      sourcemap: false,
      copyPublicDir: false,
      lib: { entry, name, formats: ["iife"], fileName: () => fileName },
    },
    logLevel: "warn",
  };
}
