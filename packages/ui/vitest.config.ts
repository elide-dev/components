import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Pure component unit tests in jsdom (logic/DOM/props/callbacks), run separately
// from the Storybook browser-mode suite in apps/storybook (which owns visual +
// interaction/play tests in real Chromium). Both emit coverage; Codecov merges
// the `ui-unit` and `ui-browser` flags.
export default defineConfig({
  plugins: [react()],
  test: {
    name: "ui-unit",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/components/**"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.stories.tsx"],
    },
  },
});
