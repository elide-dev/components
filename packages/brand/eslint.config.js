import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Flat config (ESLint 10), mirroring packages/ui. Type-aware linting is left
 * off intentionally — `tsc` is the type gate; this pass catches lint-level
 * issues only.
 *
 * Two environments here: `src` is environment-neutral (it must run in a
 * browser, in Node, and in a build script), while `scripts` is Node-only
 * tooling that never ships.
 */
export default tseslint.config(
  { ignores: ["dist/**", "assets/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
