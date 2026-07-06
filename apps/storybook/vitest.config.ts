import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

// Runs every story as a test in a real Chromium (Playwright). Interaction
// assertions live in each story's `play` function. Storybook's plugin reuses
// the .storybook config (framework, Tailwind viteFinal, decorators), and since
// Storybook 10.3 the addon applies the preview annotations automatically.
export default defineConfig({
  plugins: [storybookTest({ configDir: ".storybook" })],
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});
