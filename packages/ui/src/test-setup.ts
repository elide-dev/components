// Registers jest-dom matchers (toBeInTheDocument, toHaveAttribute, …) on
// Vitest's `expect`, and clears the jsdom tree between tests.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
