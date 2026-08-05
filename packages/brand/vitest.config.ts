import { defineConfig } from "vitest/config";

// Pure data/resolution tests — no DOM, no framework. Matches the package's
// framework-agnostic position below the React line.
export default defineConfig({
  test: {
    name: "brand",
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    reporters: ["default", ["junit", { outputFile: "./test-report.junit.xml" }]],
  },
});
