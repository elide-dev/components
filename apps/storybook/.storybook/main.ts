import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Storybook 9 + React + Vite. Tailwind v4 is added through the Vite plugin in
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
  // ElideLogo's raster modes read from @elide/brand/assets under `assetBase`,
  // which defaults to /brand. Serving it here is what a consuming app does when
  // it copies the package's assets into its public directory.
  staticDirs: [{ from: "../../../packages/brand/assets", to: "/brand" }],
  core: { disableTelemetry: true },
  async viteFinal(cfg) {
    const { default: tailwindcss } = await import("@tailwindcss/vite");
    cfg.plugins = cfg.plugins ?? [];
    cfg.plugins.push(tailwindcss());
    // Codecov bundle analysis — uploads bundle stats when CODECOV_TOKEN is set
    // (CI build). No-op locally without a token.
    const { codecovVitePlugin } = await import("@codecov/vite-plugin");
    cfg.plugins.push(
      codecovVitePlugin({
        enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
        bundleName: "elide-storybook",
        uploadToken: process.env.CODECOV_TOKEN,
      }),
    );
    return cfg;
  },
};

export default config;
