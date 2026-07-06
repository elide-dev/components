import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

// Runs every story as a test in a real Chromium (Playwright). Interaction
// assertions live in each story's `play` function. Storybook's plugin reuses
// the .storybook config (framework, Tailwind viteFinal, decorators), and since
// Storybook 10.3 the addon applies the preview annotations automatically.
//
// Coverage is v8, same as the jsdom suite in packages/ui/vitest.config.ts.
// Stories live in packages/ui/src, outside this app's root, so `allowExternal`
// must be on or v8 drops those files before include/exclude ever runs. Once
// external files are allowed, matching is substring-based (picomatch
// `contains: true`), so the same `src/components/**` glob used in
// packages/ui/vitest.config.ts matches here too. Codecov merges this suite's
// `ui-browser` flag with `ui-unit`.
export default defineConfig({
  plugins: [storybookTest({ configDir: ".storybook" })],
  test: {
    name: "storybook",
    // JUnit output feeds Codecov Test Analytics (uploaded in CI).
    reporters: ["default", ["junit", { outputFile: "./test-report.junit.xml" }]],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      reportsDirectory: "./coverage",
      allowExternal: true,
      include: ["src/components/**"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.stories.tsx"],
    },
  },
});
