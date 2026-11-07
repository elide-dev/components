import type { StorybookConfig } from "@storybook/react-vite";
import { createRequire, registerHooks } from "node:module";

// Docgen needs the JavaScript compiler API, which native TypeScript 7 no
// longer ships. Route its imports through Microsoft's compatibility package.
const require = createRequire(import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier === "typescript" || specifier.startsWith("typescript/")
      ? require.resolve(specifier.replace(/^typescript/, "@typescript/typescript6"))
      : specifier;
    return nextResolve(target, context);
  },
});

/**
 * Storybook 10 + React + Vite. Tailwind v4 is added through the Vite plugin in
 * viteFinal (v4 has automatic content detection, so no `content` array needed).
 */
const config: StorybookConfig = {
  stories: ["../../../packages/ui/src/**/*.stories.@(ts|tsx|mdx)"],
  addons: [
    "@storybook/addon-a11y",
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-mcp"
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // Expose component APIs and story examples to the local Storybook MCP server.
  features: { componentsManifest: true },
  typescript: { reactDocgen: "react-docgen-typescript" },
  // ElideLogo's raster modes read from @elide/brand/assets under `assetBase`,
  // which defaults to /brand. Serving it here is what a consuming app does when
  // it copies the package's assets into its public directory.
  staticDirs: [{ from: "../../../packages/brand/assets", to: "/brand" }],
  core: { disableTelemetry: true },
  async viteFinal(cfg) {
    cfg.resolve = {
      ...cfg.resolve,
      dedupe: [...new Set([...(cfg.resolve?.dedupe ?? []), "react", "react-dom"])],
    };
    const { default: tailwindcss } = await import("@tailwindcss/vite");
    cfg.plugins = cfg.plugins ?? [];
    cfg.plugins.push(tailwindcss());
    // Codecov bundle analysis — uploads bundle stats when CODECOV_TOKEN is set
    // (CI build). No-op locally without a token.
    const { codecovVitePlugin } = await import("@codecov/vite-plugin");
    cfg.plugins.push(
      codecovVitePlugin({
        enableBundleAnalysis: Boolean(process.env.CODECOV_TOKEN),
        bundleName: "elide-storybook",
        uploadToken: process.env.CODECOV_TOKEN,
      }),
    );
    return cfg;
  },
};

export default config;
