import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Flat config (ESLint 10) for the component source. Type-aware linting is left
 * off intentionally — the build (`tsup --dts` / `tsc`) is the type gate; this
 * pass catches lint-level issues in the TS/TSX only.
 */
export default tseslint.config(
  { ignores: ["dist/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
);
