import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Storybook 9 + React + Vite. Tailwind v4 is added through the Vite plugin in
 * viteFinal (v4 has automatic content detection, so no `content` array needed).
 */
const config: StorybookConfig = {
  stories: ["../../../packages/ui/src/**/*.stories.@(ts|tsx|mdx)"],
  addons: ["@storybook/addon-a11y", "@chromatic-com/storybook", "@storybook/addon-vitest"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: { disableTelemetry: true },
  async viteFinal(cfg) {
    const { default: tailwindcss } = await import("@tailwindcss/vite");
    cfg.plugins = cfg.plugins ?? [];
    cfg.plugins.push(tailwindcss());
    return cfg;
  },
};

export default config;
